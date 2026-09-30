import "server-only";
import { Readable } from "node:stream";
import { drive as driveApi, type drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { createAdminClient } from "./supabase/admin";

/**
 * Google Drive access with the user's own account (OAuth). A service account can't be used:
 * it has no storage quota in a personal "My Drive", so uploads into the user's folder would fail.
 *
 * Scope: full Drive, because the output goes into an existing folder the user picks by link;
 * the narrower `drive.file` scope only sees files this app created itself.
 */
export const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];
const FOLDER_MIME = "application/vnd.google-apps.folder";

type StoredToken = { refreshToken: string; email?: string };

export function driveConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient(origin: string) {
  if (!driveConfigured()) throw new DriveConfigError();
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: `${origin}/api/drive/callback`,
  });
}

export class DriveConfigError extends Error {
  constructor() {
    super("Google Drive não configurado: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env e reinicie o servidor.");
  }
}

export class DriveNotConnectedError extends Error {
  constructor() {
    super("Conecte sua conta Google para sincronizar com o Drive.");
  }
}

/**
 * Refresh tokens live in public.drive_connections: RLS on and no grants for anon/authenticated,
 * so only the server (secret key) can read them. One Google connection per app user.
 */
export async function readToken(userId: string): Promise<StoredToken | null> {
  const { data, error } = await createAdminClient().from("drive_connections").select("refresh_token,email").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { refreshToken: data.refresh_token, email: data.email ?? undefined } : null;
}

export async function saveToken(userId: string, token: StoredToken) {
  const { error } = await createAdminClient()
    .from("drive_connections")
    .upsert({ user_id: userId, refresh_token: token.refreshToken, email: token.email ?? null, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  clients.delete(userId);
}

export async function clearToken(userId: string) {
  const token = await readToken(userId);
  await createAdminClient().from("drive_connections").delete().eq("user_id", userId);
  clients.delete(userId);
  if (token && driveConfigured()) {
    await oauthClient("http://localhost").revokeToken(token.refreshToken).catch(() => undefined);
  }
}

const clients = new Map<string, { drive: drive_v3.Drive; refreshToken: string }>();

/** Drive client for a user's connected account. The library refreshes the access token as needed. */
export async function driveClient(userId: string) {
  const token = await readToken(userId);
  if (!token) throw new DriveNotConnectedError();
  const hit = clients.get(userId);
  if (hit?.refreshToken === token.refreshToken) return hit.drive;
  const auth = oauthClient("http://localhost");
  auth.setCredentials({ refresh_token: token.refreshToken });
  const drive = driveApi({ version: "v3", auth });
  clients.set(userId, { drive, refreshToken: token.refreshToken });
  return drive;
}

/** Accepts a folder link (drive.google.com/drive/folders/<id>, …/open?id=<id>) or a bare id. */
export function parseFolderId(input: string) {
  const s = input.trim();
  const m = s.match(/\/folders\/([\w-]{10,})/) ?? s.match(/[?&]id=([\w-]{10,})/);
  if (m) return m[1];
  return /^[\w-]{10,}$/.test(s) ? s : null;
}

export async function getFolder(userId: string, folderId: string) {
  const drive = await driveClient(userId);
  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "id,name,mimeType,webViewLink,trashed,capabilities(canAddChildren)",
    supportsAllDrives: true,
  });
  if (data.mimeType !== FOLDER_MIME) throw new Error("O link não é de uma pasta do Drive.");
  if (data.trashed) throw new Error("A pasta está na lixeira.");
  if (!data.capabilities?.canAddChildren) throw new Error("Sua conta não tem permissão de edição nesta pasta.");
  return { id: data.id!, name: data.name ?? "Pasta", url: data.webViewLink ?? `https://drive.google.com/drive/folders/${folderId}`, isPublic: await isPublic(userId, folderId) };
}

async function isPublic(userId: string, fileId: string) {
  const drive = await driveClient(userId);
  const { data } = await drive.permissions.list({ fileId, fields: "permissions(type,role)", supportsAllDrives: true });
  return (data.permissions ?? []).some((p) => p.type === "anyone");
}

/** "Anyone with the link can view" on the folder; files inside inherit it. */
export async function makePublic(userId: string, folderId: string) {
  const drive = await driveClient(userId);
  await drive.permissions.create({ fileId: folderId, requestBody: { type: "anyone", role: "reader" }, supportsAllDrives: true });
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Finds or creates the <ROW_ID> subfolder, so re-running never duplicates folders. */
export async function ensureSubfolder(userId: string, parentId: string, name: string) {
  const drive = await driveClient(userId);
  const { data } = await drive.files.list({
    q: `'${q(parentId)}' in parents and name = '${q(name)}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  if (data.files?.[0]?.id) return data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  return created.data.id!;
}

export async function uploadFile(userId: string, parentId: string, name: string, body: Buffer, mimeType: string) {
  const drive = await driveClient(userId);
  const { data } = await drive.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body: Readable.from(body) },
    fields: "id",
    supportsAllDrives: true,
  });
  return data.id!;
}

/** Replaces a file's audio in place: same file id, so shared links keep working. */
export async function replaceFile(userId: string, fileId: string, name: string, body: Buffer, mimeType: string) {
  const drive = await driveClient(userId);
  await drive.files.update({ fileId, requestBody: { name }, media: { mimeType, body: Readable.from(body) }, supportsAllDrives: true });
}

/** Moves to the Drive trash (recoverable for 30 days) rather than deleting for good. */
export async function trashFile(userId: string, fileId: string) {
  const drive = await driveClient(userId);
  await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true });
}

export function isNotFound(err: unknown) {
  const e = err as { code?: number; status?: number };
  return e?.code === 404 || e?.status === 404;
}

export async function accountEmail(userId: string) {
  const drive = await driveClient(userId);
  const { data } = await drive.about.get({ fields: "user(emailAddress)" });
  return data.user?.emailAddress ?? undefined;
}
