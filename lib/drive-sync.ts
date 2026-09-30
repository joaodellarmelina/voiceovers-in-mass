import "server-only";
import { ensureSubfolder, isNotFound, replaceFile, trashFile, uploadFile } from "./google-drive";
import { safeFileName } from "./naming";
import { contentTypeFor, downloadAudio, exportRelativePath, getProject, updateProjectFields } from "./store";
import { createAdminClient } from "./supabase/admin";
import type { DriveLink, Project } from "./types";

const PARALLEL = 3;

type State = { running: boolean; again: boolean; timer?: ReturnType<typeof setTimeout> };
// On globalThis so dev hot reloads don't start a second sync for the same project.
const states: Map<string, State> = ((globalThis as Record<string, unknown>).__driveSync ??= new Map()) as Map<string, State>;

export const isSyncing = (projectId: string) => !!states.get(projectId)?.running;

/**
 * Asks for a sync soon. Approvals call this and return immediately; bursts of approvals collapse
 * into one run, and a request that arrives mid-run triggers one more pass when it finishes.
 * Runs without the user's session, so it uses the admin client scoped to `userId` explicitly.
 */
export function scheduleSync(projectId: string, userId: string, delayMs = 1500) {
  const s = states.get(projectId) ?? { running: false, again: false };
  states.set(projectId, s);
  if (s.running) {
    s.again = true;
    return;
  }
  clearTimeout(s.timer);
  s.timer = setTimeout(() => void runSync(projectId, userId).catch((err) => console.error("Drive sync", err)), delayMs);
}

export async function runSync(projectId: string, userId: string) {
  const s = states.get(projectId) ?? { running: false, again: false };
  states.set(projectId, s);
  if (s.running) {
    s.again = true;
    return;
  }
  s.running = true;
  try {
    do {
      s.again = false;
      await reconcile(projectId, userId);
    } while (s.again);
  } finally {
    s.running = false;
  }
}

type Change =
  | { kind: "folder"; rowId: string; folderId: string }
  | { kind: "file"; key: string; fileId: string; takeId: string }
  | { kind: "removed"; key: string };

/** Makes the Drive folder match the approvals: upload new, replace changed, trash un-approved. */
async function reconcile(projectId: string, userId: string) {
  const db = createAdminClient();
  const project = await getProject(db, userId, projectId);
  const link = project.drive;
  if (!link) return;

  const changes: Change[] = [];
  const errors: string[] = [];
  const folders = { ...link.folders };

  // One promise per ROW_ID: parallel uploads for the same row share a single folder lookup/creation.
  const pending = new Map<string, Promise<string>>();
  const folderFor = (rowId: string) => {
    if (folders[rowId]) return Promise.resolve(folders[rowId]);
    let p = pending.get(rowId);
    if (!p) {
      p = ensureSubfolder(userId, link.folderId, safeFileName(rowId)).then((id) => {
        folders[rowId] = id;
        changes.push({ kind: "folder", rowId, folderId: id });
        return id;
      });
      p.catch(() => pending.delete(rowId));
      pending.set(rowId, p);
    }
    return p;
  };

  const tasks: (() => Promise<void>)[] = [];

  for (const [key, takeId] of Object.entries(project.approved)) {
    const current = link.files[key];
    if (current?.takeId === takeId) continue;
    const take = project.takes.find((t) => t.id === takeId);
    if (!take) continue;
    tasks.push(async () => {
      const name = exportRelativePath(project, take).split("/").pop()!;
      const body = await downloadAudio(db, take.file);
      const mime = contentTypeFor(take.file);
      if (current) {
        try {
          await replaceFile(userId, current.fileId, name, body, mime);
          changes.push({ kind: "file", key, fileId: current.fileId, takeId });
          return;
        } catch (err) {
          if (!isNotFound(err)) throw err; // deleted on Drive by hand: upload again below
        }
      }
      let fileId: string;
      try {
        fileId = await uploadFile(userId, await folderFor(take.rowId), name, body, mime);
      } catch (err) {
        if (!isNotFound(err)) throw err;
        // The ROW_ID folder was deleted on Drive: recreate it once.
        delete folders[take.rowId];
        pending.delete(take.rowId);
        fileId = await uploadFile(userId, await folderFor(take.rowId), name, body, mime);
      }
      changes.push({ kind: "file", key, fileId, takeId });
    });
  }

  for (const [key, file] of Object.entries(link.files)) {
    if (project.approved[key]) continue;
    tasks.push(async () => {
      try {
        await trashFile(userId, file.fileId);
      } catch (err) {
        if (!isNotFound(err)) throw err;
      }
      changes.push({ kind: "removed", key });
    });
  }

  // Small fixed parallelism: fast enough for hundreds of files, gentle on Drive's rate limits.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, tasks.length) }, async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        try {
          await task();
        } catch (err) {
          errors.push(describe(err));
        }
      }
    }),
  );

  // Re-read before writing: the link may have been removed or pointed elsewhere while this ran.
  const fresh = (await getProject(db, userId, projectId)).drive;
  if (!fresh || fresh.folderId !== link.folderId) return;
  applyChanges(fresh, changes);
  fresh.lastSyncAt = new Date().toISOString();
  fresh.lastError = errors.length ? `${errors.length} arquivo(s) com erro. Último: ${errors.at(-1)}` : undefined;
  await updateProjectFields(db, userId, projectId, { drive: fresh });
}

function applyChanges(drive: DriveLink, changes: Change[]) {
  for (const c of changes) {
    if (c.kind === "folder") drive.folders[c.rowId] = c.folderId;
    if (c.kind === "file") drive.files[c.key] = { fileId: c.fileId, takeId: c.takeId };
    if (c.kind === "removed") delete drive.files[c.key];
  }
}

function describe(err: unknown) {
  const e = err as { message?: string; response?: { data?: { error?: { message?: string } } } };
  return e?.response?.data?.error?.message ?? e?.message ?? String(err);
}

/** How many approved cells already have their current take on Drive. */
export function syncedCount(project: Pick<Project, "approved" | "drive">) {
  const files = project.drive?.files ?? {};
  return Object.entries(project.approved).filter(([key, takeId]) => files[key]?.takeId === takeId).length;
}
