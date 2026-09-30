import { randomInt, randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { elevenlabs, resolveVoiceId } from "@/lib/elevenlabs";
import { errorResponse } from "@/lib/http";
import { getProjectMeta, getRow, saveTake, updateProjectFields } from "@/lib/store";
import { DEFAULT_SETTINGS, extensionFor, voiceSettingKeys } from "@/lib/types";

/**
 * Generates ONE take for one phrase in one language. The browser runs a queue that calls this
 * with bounded concurrency, so each request maps 1:1 to an ElevenLabs request. The audio goes to
 * Storage (<user>/<project>/<take>.<ext>) and the take is recorded in the database.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/projects/[id]/generate">) {
  try {
    const { supabase, userId } = await requireUser();
    const { id } = await ctx.params;
    const { rowId, langKey } = (await request.json()) as { rowId: string; langKey: string };

    const [project, row] = await Promise.all([getProjectMeta(supabase, userId, id), getRow(supabase, userId, id, rowId)]);
    const lang = project.languages.find((l) => l.key === langKey);
    const text = row.texts[langKey]?.trim();
    if (!lang || !text) return Response.json({ error: "Frase não encontrada" }, { status: 404 });

    const settings = { ...DEFAULT_SETTINGS, ...project.settings };
    let voiceId = lang.voiceId || settings.defaultVoiceId;
    // Projects created before the API key was set only know the default voice by name.
    if (!voiceId && settings.defaultVoiceName) {
      voiceId = await resolveVoiceId(settings.defaultVoiceName);
      if (voiceId) await updateProjectFields(supabase, userId, id, { settings: { ...settings, defaultVoiceId: voiceId } });
    }
    if (!voiceId) {
      const error = settings.defaultVoiceName
        ? `A voz “${settings.defaultVoiceName}” não está em “Minhas vozes”. Em Configurações, abra a voz e adicione-a pela aba Voice Library (ou escolha outra voz).`
        : `Escolha uma voz para ${lang.key}`;
      return Response.json({ error, fatal: true }, { status: 400 });
    }

    const supports = voiceSettingKeys(settings.modelId);
    // A random seed per take makes variations differ, and storing it makes a good take reproducible.
    const seed = randomInt(0, 2 ** 32 - 1);
    const { data, rawResponse } = await elevenlabs()
      .textToSpeech.convert(
        voiceId,
        {
          text,
          modelId: settings.modelId,
          outputFormat: settings.outputFormat,
          languageCode: settings.languageOverride ? lang.code : undefined,
          seed,
          voiceSettings: {
            // Eleven v3 only accepts discrete stability values (0 creative, 0.5 natural, 1 robust).
            stability: settings.modelId === "eleven_v3" ? Math.round(settings.stability * 2) / 2 : settings.stability,
            similarityBoost: settings.similarityBoost,
            style: supports.style ? settings.style : undefined,
            speed: supports.speed ? settings.speed : undefined,
            useSpeakerBoost: supports.speakerBoost ? settings.useSpeakerBoost : undefined,
          },
        },
        { abortSignal: request.signal },
      )
      .withRawResponse();

    const audio = Buffer.from(await new Response(data).arrayBuffer());
    const cost = Number(rawResponse.headers.get("character-cost"));
    const take = await saveTake(
      supabase,
      userId,
      id,
      {
        id: randomUUID(),
        rowId,
        langKey,
        seed,
        modelId: settings.modelId,
        voiceId,
        requestId: rawResponse.headers.get("request-id") ?? undefined,
        characterCost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
      },
      audio,
      extensionFor(settings.outputFormat),
    );
    return Response.json(take, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
