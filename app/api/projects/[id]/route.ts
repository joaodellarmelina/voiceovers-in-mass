import { requireUser } from "@/lib/auth";
import { safeFileName } from "@/lib/naming";
import { errorResponse } from "@/lib/http";
import { deleteProject, getProject, getProjectMeta, updateProjectFields } from "@/lib/store";
import { DEFAULT_SETTINGS, type Language, type Settings } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    return Response.json(await getProject(supabase, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}

type Patch = { name?: string; settings?: Partial<Settings>; languages?: Pick<Language, "key" | "code" | "voiceId" | "voiceName">[] };

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const patch = (await request.json()) as Patch;
    const current = await getProjectMeta(supabase, userId, id);
    const next: Parameters<typeof updateProjectFields>[3] = {};
    if (patch.name !== undefined) {
      const name = patch.name.trim().replace(/\s+/g, " ");
      if (!name || name.length > 200) return Response.json({ error: "O nome precisa ter entre 1 e 200 caracteres." }, { status: 400 });
      // The ZIP is named after the project, so it follows a rename.
      next.name = name;
      next.export_folder = safeFileName(name);
    }
    if (patch.settings) next.settings = { ...DEFAULT_SETTINGS, ...current.settings, ...patch.settings };
    if (patch.languages) {
      // Only voice and code are editable; language keys come from the sheet.
      next.languages = current.languages.map((lang) => {
        const upd = patch.languages!.find((l) => l.key === lang.key);
        return upd ? { ...lang, code: upd.code, voiceId: upd.voiceId, voiceName: upd.voiceName } : lang;
      });
    }
    await updateProjectFields(supabase, userId, id, next);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/projects/[id]">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    await deleteProject(supabase, userId, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
