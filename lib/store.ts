import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exportFileName, safeFileName } from "./naming";
import {
  DEFAULT_SETTINGS,
  cellKey,
  type DriveLink,
  type Language,
  type NewProjectInput,
  type Project,
  type ProjectSummary,
  type Row,
  type Settings,
  type ApprovalChange,
  type Take,
} from "./types";

export type { ApprovalChange };

/**
 * Data access over Supabase. Works with the user's RLS client (requests) and with the admin client
 * (background Drive sync): every query also filters by user_id explicitly, so the admin client can
 * never read or write another user's data by mistake.
 */
type Db = SupabaseClient;

export const BUCKET = "takes";
const PAGE = 1000; // PostgREST returns at most 1000 rows per request by default

export class NotFoundError extends Error {
  constructor() {
    super("Não encontrado");
  }
}

class DbError extends Error {}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    // PGRST116: .single() matched no row. 22P02: malformed id (e.g. not a uuid) in the URL.
    if (res.error.code === "PGRST116" || res.error.code === "22P02") throw new NotFoundError();
    throw new DbError(res.error.message);
  }
  return res.data;
}

async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new DbError(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

// ---- row <-> model mapping ---------------------------------------------------------------------

type ProjectRow = {
  id: string;
  name: string;
  export_folder: string;
  meta_columns: string[];
  languages: Language[];
  settings: Settings;
  drive: DriveLink | null;
  created_at: string;
  updated_at: string;
};

type TakeRow = {
  id: string;
  row_id: string;
  lang_key: string;
  storage_path: string;
  seed: number;
  model_id: string;
  voice_id: string;
  request_id: string | null;
  character_cost: number | null;
  rejected: boolean;
  created_at: string;
};

const TAKE_COLUMNS = "id,row_id,lang_key,storage_path,seed,model_id,voice_id,request_id,character_cost,rejected,created_at";

const toTake = (t: TakeRow): Take => ({
  id: t.id,
  rowId: t.row_id,
  langKey: t.lang_key,
  createdAt: t.created_at,
  file: t.storage_path,
  seed: Number(t.seed),
  modelId: t.model_id,
  voiceId: t.voice_id,
  requestId: t.request_id ?? undefined,
  characterCost: t.character_cost ?? undefined,
  rejected: t.rejected || undefined,
});

// ---- projects ------------------------------------------------------------------------------------

export async function listProjects(db: Db, userId: string): Promise<ProjectSummary[]> {
  const projects = check(
    await db.from("projects").select("id,name,languages,created_at,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }),
  ) as Pick<ProjectRow, "id" | "name" | "languages" | "created_at" | "updated_at">[];
  if (!projects.length) return [];
  const [rows, approvals] = await Promise.all([
    fetchAll<{ project_id: string; texts: Record<string, string> }>((a, b) =>
      db.from("project_rows").select("project_id,texts").eq("user_id", userId).range(a, b),
    ),
    fetchAll<{ project_id: string }>((a, b) => db.from("approvals").select("project_id").eq("user_id", userId).range(a, b)),
  ]);
  return projects.map((p) => {
    const mine = rows.filter((r) => r.project_id === p.id);
    return {
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      rows: mine.length,
      languages: p.languages.map((l) => l.code.toUpperCase()),
      cells: mine.reduce((n, r) => n + p.languages.filter((l) => r.texts[l.key]?.trim()).length, 0),
      approved: approvals.filter((a) => a.project_id === p.id).length,
    };
  });
}

/** Project settings only (no rows or takes): cheap enough to call on every generation. */
export async function getProjectMeta(db: Db, userId: string, id: string) {
  return check(
    await db
      .from("projects")
      .select("id,name,export_folder,meta_columns,languages,settings,drive,created_at,updated_at")
      .eq("id", id)
      .eq("user_id", userId)
      .single(),
  ) as ProjectRow;
}

export async function getRow(db: Db, userId: string, projectId: string, rowId: string): Promise<Row> {
  return check(
    await db.from("project_rows").select("id,meta,texts").eq("project_id", projectId).eq("id", rowId).eq("user_id", userId).single(),
  ) as Row;
}

/** Everything the review screen needs, in the shape the UI already uses. */
export async function getProject(db: Db, userId: string, id: string): Promise<Project> {
  // Project first: a missing or foreign project surfaces as NotFound before any child query runs.
  const p = await getProjectMeta(db, userId, id);
  const [rows, takes, approvals] = await Promise.all([
    fetchAll<Row & { position: number }>((a, b) =>
      db.from("project_rows").select("id,meta,texts,position").eq("project_id", id).eq("user_id", userId).order("position").range(a, b),
    ),
    fetchAll<TakeRow>((a, b) =>
      db.from("takes").select(TAKE_COLUMNS).eq("project_id", id).eq("user_id", userId).order("created_at").order("id").range(a, b),
    ),
    fetchAll<{ row_id: string; lang_key: string; take_id: string }>((a, b) =>
      db.from("approvals").select("row_id,lang_key,take_id").eq("project_id", id).eq("user_id", userId).range(a, b),
    ),
  ]);
  return {
    id: p.id,
    name: p.name,
    exportFolder: p.export_folder,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    metaColumns: p.meta_columns,
    languages: p.languages,
    rows: rows.map(({ id, meta, texts }) => ({ id, meta, texts })),
    settings: { ...DEFAULT_SETTINGS, ...p.settings },
    takes: takes.map(toTake),
    approved: Object.fromEntries(approvals.map((a) => [cellKey(a.row_id, a.lang_key), a.take_id])),
    drive: p.drive ?? undefined,
  };
}

export async function createProject(db: Db, userId: string, input: NewProjectInput, settings: Partial<Settings> = {}) {
  const project = check(
    await db
      .from("projects")
      .insert({
        user_id: userId,
        name: input.name,
        export_folder: safeFileName(input.name),
        meta_columns: input.metaColumns,
        languages: input.languages,
        settings: { ...DEFAULT_SETTINGS, ...settings },
      })
      .select("id")
      .single(),
  ) as { id: string };
  try {
    for (let i = 0; i < input.rows.length; i += 500) {
      const chunk = input.rows.slice(i, i + 500).map((r, j) => ({
        project_id: project.id,
        user_id: userId,
        id: r.id,
        position: i + j,
        meta: r.meta,
        texts: r.texts,
      }));
      check(await db.from("project_rows").insert(chunk));
    }
  } catch (err) {
    await db.from("projects").delete().eq("id", project.id).eq("user_id", userId);
    throw err;
  }
  return project.id;
}

export async function updateProjectFields(
  db: Db,
  userId: string,
  id: string,
  patch: { name?: string; export_folder?: string; settings?: Settings; languages?: Language[]; drive?: DriveLink | null },
) {
  check(await db.from("projects").update(patch).eq("id", id).eq("user_id", userId));
}

/** Deletes the project (rows, takes and approvals cascade) and all of its audio in Storage. */
export async function deleteProject(db: Db, userId: string, id: string) {
  // Someone else's (or a missing) project is a 404, not a silent no-op "success".
  await getProjectMeta(db, userId, id);
  const prefix = `${userId}/${id}`;
  for (;;) {
    const files = check(await db.storage.from(BUCKET).list(prefix, { limit: 1000 })) as { name: string }[];
    if (!files.length) break;
    check(await db.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`)));
    if (files.length < 1000) break;
  }
  check(await db.from("projects").delete().eq("id", id).eq("user_id", userId));
}

// ---- takes ---------------------------------------------------------------------------------------

export const storagePath = (userId: string, projectId: string, takeId: string, ext: string) => `${userId}/${projectId}/${takeId}.${ext}`;

const CONTENT_TYPE: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", opus: "audio/ogg" };
export const contentTypeFor = (path: string) => CONTENT_TYPE[path.split(".").pop() ?? ""] ?? "application/octet-stream";

/** Uploads the audio first, then records the take; if the insert fails the file is removed. */
export async function saveTake(
  db: Db,
  userId: string,
  projectId: string,
  take: Omit<Take, "file" | "createdAt">,
  audio: Buffer,
  ext: string,
  createdAt?: string,
) {
  const path = storagePath(userId, projectId, take.id, ext);
  check(await db.storage.from(BUCKET).upload(path, audio, { contentType: contentTypeFor(path), upsert: false }));
  try {
    const row = check(
      await db
        .from("takes")
        .insert({
          id: take.id,
          project_id: projectId,
          user_id: userId,
          row_id: take.rowId,
          lang_key: take.langKey,
          storage_path: path,
          seed: take.seed,
          model_id: take.modelId,
          voice_id: take.voiceId,
          request_id: take.requestId ?? null,
          character_cost: take.characterCost ?? null,
          rejected: !!take.rejected,
          ...(createdAt ? { created_at: createdAt } : {}),
        })
        .select(TAKE_COLUMNS)
        .single(),
    ) as TakeRow;
    return toTake(row);
  } catch (err) {
    await db.storage.from(BUCKET).remove([path]);
    throw err;
  }
}

export async function getTake(db: Db, userId: string, projectId: string, takeId: string) {
  const t = check(
    await db.from("takes").select(TAKE_COLUMNS).eq("id", takeId).eq("project_id", projectId).eq("user_id", userId).single(),
  ) as TakeRow;
  return toTake(t);
}

export async function downloadAudio(db: Db, path: string) {
  const blob = check(await db.storage.from(BUCKET).download(path)) as Blob;
  return Buffer.from(await blob.arrayBuffer());
}

export type TakeAction = "approve" | "unapprove" | "reject" | "unreject";

/** Applies a review action and returns the take and the cell's approved take id afterwards. */
export async function reviewTake(db: Db, userId: string, projectId: string, take: Take, action: TakeAction) {
  const cell = { project_id: projectId, row_id: take.rowId, lang_key: take.langKey };
  const current = check(await db.from("approvals").select("take_id").match(cell).eq("user_id", userId).maybeSingle()) as {
    take_id: string;
  } | null;
  let approved = current?.take_id ?? null;

  if (action === "approve") {
    check(await db.from("approvals").upsert({ ...cell, user_id: userId, take_id: take.id }));
    if (take.rejected) check(await db.from("takes").update({ rejected: false }).eq("id", take.id).eq("user_id", userId));
    approved = take.id;
    take = { ...take, rejected: undefined };
  }
  if ((action === "unapprove" || action === "reject") && approved === take.id) {
    check(await db.from("approvals").delete().match(cell).eq("user_id", userId));
    approved = null;
  }
  if (action === "reject" || action === "unreject") {
    const rejected = action === "reject";
    check(await db.from("takes").update({ rejected }).eq("id", take.id).eq("user_id", userId));
    take = { ...take, rejected: rejected || undefined };
  }
  return { take, approvedTakeId: approved };
}

// ---- export layout -------------------------------------------------------------------------------

/** <ROW_ID>/<phrase>.<ext>: the layout of the ZIP and of the Drive mirror. */
export function exportRelativePath(project: Pick<Project, "languages" | "rows">, take: Take) {
  const row = project.rows.find((r) => r.id === take.rowId);
  if (!row) throw new NotFoundError();
  const ext = `.${take.file.split(".").pop()}`;
  return `${safeFileName(row.id)}/${exportFileName(project.languages, row, take.langKey, ext)}`;
}

// ---- bulk approvals ------------------------------------------------------------------------------


/**
 * Sets many cells at once: a takeId approves that take (and un-discards it), null removes the
 * approval. Used by bulk approve and by its undo. Every take is checked to belong to this user,
 * project and cell before anything is written.
 */
export async function setApprovals(db: Db, userId: string, projectId: string, changes: ApprovalChange[]) {
  const approve = changes.filter((c) => c.takeId);
  const clear = changes.filter((c) => !c.takeId);

  if (approve.length) {
    const ids = [...new Set(approve.map((c) => c.takeId!))];
    const takes: { id: string; row_id: string; lang_key: string; rejected: boolean }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      takes.push(
        ...(check(
          await db.from("takes").select("id,row_id,lang_key,rejected").in("id", ids.slice(i, i + 200)).eq("project_id", projectId).eq("user_id", userId),
        ) as typeof takes),
      );
    }
    const byId = new Map(takes.map((t) => [t.id, t]));
    const rows = approve.map((c) => {
      const t = byId.get(c.takeId!);
      if (!t || t.row_id !== c.rowId || t.lang_key !== c.langKey) throw new NotFoundError();
      return { project_id: projectId, user_id: userId, row_id: c.rowId, lang_key: c.langKey, take_id: c.takeId! };
    });
    for (let i = 0; i < rows.length; i += 500) check(await db.from("approvals").upsert(rows.slice(i, i + 500)));
    const unreject = takes.filter((t) => t.rejected).map((t) => t.id);
    if (unreject.length) check(await db.from("takes").update({ rejected: false }).in("id", unreject).eq("user_id", userId));
  }

  // Deletes grouped by language: one request per language instead of one per cell.
  const byLang = new Map<string, string[]>();
  for (const c of clear) byLang.set(c.langKey, [...(byLang.get(c.langKey) ?? []), c.rowId]);
  for (const [langKey, rowIds] of byLang) {
    for (let i = 0; i < rowIds.length; i += 200) {
      check(
        await db.from("approvals").delete().eq("project_id", projectId).eq("user_id", userId).eq("lang_key", langKey).in("row_id", rowIds.slice(i, i + 200)),
      );
    }
  }
}
