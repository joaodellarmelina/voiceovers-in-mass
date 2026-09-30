import { elevenlabs } from "@/lib/elevenlabs";
import { requireUser } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    await requireUser();
    const models = await elevenlabs().models.list();
    return Response.json(
      models
        .filter((m) => m.canDoTextToSpeech)
        .map((m) => ({
          modelId: m.modelId,
          name: m.name ?? m.modelId,
          maxChars: m.maximumTextLengthPerRequest,
          languages: (m.languages ?? []).map((l) => l.languageId),
        })),
    );
  } catch (err) {
    return errorResponse(err);
  }
}
