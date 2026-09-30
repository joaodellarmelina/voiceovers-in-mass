import { elevenlabs } from "@/lib/elevenlabs";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireUser();
    const params = new URL(request.url).searchParams;
    const res = await elevenlabs().voices.search({
      search: params.get("search") || undefined,
      nextPageToken: params.get("page") || undefined,
      pageSize: 50,
      sort: "name",
      sortDirection: "asc",
    });
    return Response.json({
      voices: res.voices.map((v) => ({
        voiceId: v.voiceId,
        name: v.name ?? v.voiceId,
        category: v.category,
        labels: v.labels ?? {},
        previewUrl: v.previewUrl,
        languages: [...new Set((v.verifiedLanguages ?? []).map((l) => l.language))],
      })),
      nextPage: res.hasMore ? res.nextPageToken : undefined,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
