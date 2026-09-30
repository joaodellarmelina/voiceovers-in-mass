import { requireUser } from "@/lib/auth";
import { elevenlabs } from "@/lib/elevenlabs";
import { errorResponse } from "@/lib/http";

/**
 * Searches the public Voice Library. These voices only work through the API after being added
 * to the account ("My Voices"), which takes one of the plan's voice slots: see POST /api/voices/add.
 */
export async function GET(request: Request) {
  try {
    await requireUser();
    const params = new URL(request.url).searchParams;
    const res = await elevenlabs().voices.getShared({
      search: params.get("search") || undefined,
      page: Number(params.get("page") ?? 0),
      pageSize: 30,
    });
    return Response.json({
      voices: res.voices.map((v) => ({
        voiceId: v.voiceId,
        publicOwnerId: v.publicOwnerId,
        name: v.name,
        labels: { gender: v.gender, accent: v.accent, age: v.age },
        previewUrl: v.previewUrl,
        languages: [...new Set((v.verifiedLanguages ?? []).map((l) => l.language))],
        // >1 means the voice costs more credits per character.
        rate: v.rate ?? 1,
      })),
      hasMore: res.hasMore,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
