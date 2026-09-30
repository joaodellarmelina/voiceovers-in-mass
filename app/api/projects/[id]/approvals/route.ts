import { requireUser } from "@/lib/auth";
import { scheduleSync } from "@/lib/drive-sync";
import { errorResponse } from "@/lib/http";
import { getProjectMeta, setApprovals, type ApprovalChange } from "@/lib/store";

/** Bulk approve / un-approve: `{ changes: [{ rowId, langKey, takeId | null }] }` in one request. */
export async function PUT(request: Request, ctx: RouteContext<"/api/projects/[id]/approvals">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const { changes } = (await request.json()) as { changes?: ApprovalChange[] };
    if (!Array.isArray(changes) || !changes.length) return Response.json({ error: "Nada para aprovar." }, { status: 400 });
    if (changes.length > 5000) return Response.json({ error: "Selecione no máximo 5.000 frases por vez." }, { status: 400 });
    await setApprovals(supabase, userId, id, changes);
    // One Drive sync for the whole batch, in the background.
    if ((await getProjectMeta(supabase, userId, id)).drive) scheduleSync(id, userId);
    return Response.json({ ok: true, count: changes.length });
  } catch (err) {
    return errorResponse(err);
  }
}
