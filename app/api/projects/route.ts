import { requireUser } from "@/lib/auth";
import { defaultVoiceForPlan } from "@/lib/elevenlabs";
import { errorResponse } from "@/lib/http";
import { createProject, listProjects } from "@/lib/store";
import type { NewProjectInput } from "@/lib/types";

export async function GET() {
  try {
    const { supabase, userId } = await requireUser();
    return Response.json(await listProjects(supabase, userId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, userId } = await requireUser();
    const input = (await request.json()) as NewProjectInput;
    if (!input.name?.trim() || !input.rows?.length || !input.languages?.length) {
      return Response.json({ error: "Informe nome, ao menos uma linha e um idioma." }, { status: 400 });
    }
    if (new Set(input.rows.map((r) => r.id)).size !== input.rows.length) {
      return Response.json({ error: "Há IDs de áudio duplicados na planilha." }, { status: 400 });
    }
    const voice = await defaultVoiceForPlan();
    const id = await createProject(supabase, userId, input, { defaultVoiceId: voice.voiceId, defaultVoiceName: voice.voiceName });
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
