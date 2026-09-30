import { requireUser } from "@/lib/auth";
import { scheduleSync } from "@/lib/drive-sync";
import { errorResponse } from "@/lib/http";
import { getProjectMeta, getTake, reviewTake, type TakeAction } from "@/lib/store";

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]/takes/[takeId]">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id, takeId } = await ctx.params;
    const { action } = (await request.json()) as { action: TakeAction };
    const take = await getTake(supabase, userId, id, takeId);
    const result = await reviewTake(supabase, userId, id, take, action);
    // Mirror to Drive in the background: the review click never waits on Google.
    if (action !== "unreject" && (await getProjectMeta(supabase, userId, id)).drive) scheduleSync(id, userId);
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
