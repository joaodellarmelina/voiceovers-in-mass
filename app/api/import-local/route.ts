import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { importLocalProjects } from "@/lib/local-import";

/** Moves the projects saved on this computer (before accounts existed) into the signed-in account. */
export async function POST() {
  try {
    const { supabase, userId } = await requireUser();
    return Response.json(await importLocalProjects(supabase, userId));
  } catch (err) {
    return errorResponse(err);
  }
}
