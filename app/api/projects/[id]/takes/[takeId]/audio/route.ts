import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { contentTypeFor, downloadAudio, exportRelativePath, getProjectMeta, getRow, getTake } from "@/lib/store";

/** Streams a take from Storage for playback; `?download=1` serves it with its final file name. */
export async function GET(request: Request, ctx: RouteContext<"/api/projects/[id]/takes/[takeId]/audio">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id, takeId } = await ctx.params;
    const take = await getTake(supabase, userId, id, takeId);
    const audio = await downloadAudio(supabase, take.file);
    const headers = new Headers({
      "Content-Type": contentTypeFor(take.file),
      "Content-Length": String(audio.byteLength),
      // A take never changes once generated; private because it belongs to one user.
      "Cache-Control": "private, max-age=31536000, immutable",
    });
    if (new URL(request.url).searchParams.has("download")) {
      const [project, row] = await Promise.all([getProjectMeta(supabase, userId, id), getRow(supabase, userId, id, take.rowId)]);
      const name = exportRelativePath({ languages: project.languages, rows: [row] }, take).replace("/", " - ");
      headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    }
    return new Response(new Uint8Array(audio), { headers });
  } catch (err) {
    return errorResponse(err);
  }
}
