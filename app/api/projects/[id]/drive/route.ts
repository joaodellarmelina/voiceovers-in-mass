import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { isSyncing, runSync, scheduleSync, syncedCount } from "@/lib/drive-sync";
import { driveConfigured, getFolder, makePublic, parseFolderId, readToken } from "@/lib/google-drive";
import { errorResponse } from "@/lib/http";
import { getProjectMeta, updateProjectFields } from "@/lib/store";
import type { DriveStatus } from "@/lib/types";

async function status(db: SupabaseClient, userId: string, projectId: string): Promise<DriveStatus> {
  const [project, approvals, token] = await Promise.all([
    getProjectMeta(db, userId, projectId),
    db.from("approvals").select("row_id,lang_key,take_id").eq("project_id", projectId).eq("user_id", userId),
    driveConfigured() ? readToken(userId) : Promise.resolve(null),
  ]);
  const approved = Object.fromEntries((approvals.data ?? []).map((a) => [`${a.row_id}::${a.lang_key}`, a.take_id as string]));
  const d = project.drive;
  return {
    configured: driveConfigured(),
    connected: !!token,
    email: token?.email,
    link: d
      ? { folderId: d.folderId, folderName: d.folderName, folderUrl: d.folderUrl, isPublic: d.isPublic, lastSyncAt: d.lastSyncAt, lastError: d.lastError }
      : undefined,
    approved: Object.keys(approved).length,
    synced: syncedCount({ approved, drive: d ?? undefined }),
    syncing: isSyncing(projectId),
  };
}

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/drive">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    return Response.json(await status(supabase, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Links a Drive folder (by link or id) and starts mirroring the approved takes into it. */
export async function PUT(request: Request, ctx: RouteContext<"/api/projects/[id]/drive">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const { folder } = (await request.json()) as { folder?: string };
    const folderId = parseFolderId(folder ?? "");
    if (!folderId) return Response.json({ error: "Cole o link de uma pasta do Google Drive." }, { status: 400 });
    const [info, project] = await Promise.all([getFolder(userId, folderId), getProjectMeta(supabase, userId, id)]);
    // Relinking the same folder keeps what was already uploaded; a new folder starts clean.
    const same = project.drive?.folderId === info.id;
    await updateProjectFields(supabase, userId, id, {
      drive: {
        folderId: info.id,
        folderName: info.name,
        folderUrl: info.url,
        isPublic: info.isPublic,
        folders: same ? project.drive!.folders : {},
        files: same ? project.drive!.files : {},
        lastSyncAt: same ? project.drive!.lastSyncAt : undefined,
      },
    });
    scheduleSync(id, userId, 0);
    return Response.json(await status(supabase, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Unlinks the folder. Files already on Drive stay there. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]/drive">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    await updateProjectFields(supabase, userId, id, { drive: null });
    return Response.json(await status(supabase, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}

/** `{ action: "sync" }` runs a full sync now; `{ action: "public" }` makes the folder viewable by link. */
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/drive">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const { action } = (await request.json()) as { action: "sync" | "public" };
    const project = await getProjectMeta(supabase, userId, id);
    if (!project.drive) return Response.json({ error: "Nenhuma pasta do Drive vinculada." }, { status: 400 });
    if (action === "public") {
      await makePublic(userId, project.drive.folderId);
      await updateProjectFields(supabase, userId, id, { drive: { ...project.drive, isPublic: true } });
    } else {
      await runSync(id, userId);
    }
    return Response.json(await status(supabase, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}
