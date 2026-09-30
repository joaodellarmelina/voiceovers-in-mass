import JSZip from "jszip";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { downloadAudio, exportRelativePath, getProject } from "@/lib/store";

/** ZIP of every approved take from Storage, laid out as <ROW_ID>/<phrase>.<ext>. */
export async function GET(_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const project = await getProject(supabase, userId, id);
    const zip = new JSZip();
    const takes = Object.values(project.approved)
      .map((takeId) => project.takes.find((t) => t.id === takeId))
      .filter((t) => t !== undefined);
    // Download a few at a time: fast, without opening hundreds of connections at once.
    for (let i = 0; i < takes.length; i += 8) {
      await Promise.all(
        takes.slice(i, i + 8).map(async (take) => zip.file(exportRelativePath(project, take), await downloadAudio(supabase, take.file))),
      );
    }
    const body = await zip.generateAsync({ type: "arraybuffer", compression: "STORE" });
    return new Response(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(project.exportFolder)}.zip`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
