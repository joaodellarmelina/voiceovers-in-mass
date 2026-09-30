import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProject, saveTake } from "./store";
import type { Project } from "./types";

/**
 * One-time move of projects created before Supabase (data/projects/<id>/project.json + takes/*.mp3)
 * into the signed-in user's account. Imported folders are moved to data/projects-imported/,
 * so nothing is deleted and nothing is imported twice.
 */
const LOCAL_DIR = path.join(process.cwd(), "data", "projects");
const DONE_DIR = path.join(process.cwd(), "data", "projects-imported");

async function localProjectDirs() {
  try {
    const entries = await fs.readdir(LOCAL_DIR, { withFileTypes: true });
    const dirs = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const file = path.join(LOCAL_DIR, e.name, "project.json");
      if (await fs.stat(file).then(() => true, () => false)) dirs.push(path.join(LOCAL_DIR, e.name));
    }
    return dirs;
  } catch {
    return [];
  }
}

export async function localProjectCount() {
  return (await localProjectDirs()).length;
}

export async function importLocalProjects(db: SupabaseClient, userId: string) {
  const results: { name: string; takes: number; approved: number; error?: string }[] = [];
  await fs.mkdir(DONE_DIR, { recursive: true });
  for (const dir of await localProjectDirs()) {
    const local = JSON.parse(await fs.readFile(path.join(dir, "project.json"), "utf8")) as Project;
    try {
      const projectId = await createProject(db, userId, local, local.settings);
      const takeIds = new Map<string, string>();
      for (const t of local.takes) {
        const audio = await fs.readFile(path.join(dir, "takes", path.basename(t.file)));
        const ext = path.extname(t.file).slice(1) || "mp3";
        const take = {
          id: crypto.randomUUID(),
          rowId: t.rowId,
          langKey: t.langKey,
          seed: t.seed,
          modelId: t.modelId,
          voiceId: t.voiceId,
          requestId: t.requestId,
          characterCost: t.characterCost,
          rejected: t.rejected,
        };
        const saved = await saveTake(db, userId, projectId, take, audio, ext, t.createdAt);
        takeIds.set(t.id, saved.id);
      }
      const approvals = Object.entries(local.approved)
        .filter(([, takeId]) => takeIds.has(takeId))
        .map(([key, takeId]) => {
          const [rowId, langKey] = key.split("::");
          return { project_id: projectId, user_id: userId, row_id: rowId, lang_key: langKey, take_id: takeIds.get(takeId)! };
        });
      if (approvals.length) {
        const { error } = await db.from("approvals").insert(approvals);
        if (error) throw new Error(error.message);
      }
      await fs.rename(dir, path.join(DONE_DIR, path.basename(dir)));
      results.push({ name: local.name, takes: takeIds.size, approved: approvals.length });
    } catch (err) {
      results.push({ name: local.name, takes: 0, approved: 0, error: (err as Error).message });
    }
  }
  return results;
}
