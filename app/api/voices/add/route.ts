import { requireUser } from "@/lib/auth";
import { elevenlabs } from "@/lib/elevenlabs";
import { errorResponse } from "@/lib/http";

/** Adds a Voice Library voice to the account ("Add to My Voices"), so the API can use it. */
export async function POST(request: Request) {
  try {
    await requireUser();
    const { publicOwnerId, voiceId, name } = (await request.json()) as { publicOwnerId?: string; voiceId?: string; name?: string };
    if (!publicOwnerId || !voiceId || !name) return Response.json({ error: "Voz inválida." }, { status: 400 });
    const added = await elevenlabs().voices.share(publicOwnerId, voiceId, { newName: name });
    return Response.json({ voiceId: added.voiceId, name }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
