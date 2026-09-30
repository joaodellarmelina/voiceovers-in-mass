import "server-only";
import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { DEFAULT_VOICE_NAME, FREE_PLAN_VOICE_NAME } from "./types";

let client: ElevenLabsClient | undefined;

/**
 * The API key only ever lives on the server (ELEVENLABS_API_KEY in .env.local).
 * The SDK retries 429/5xx with exponential backoff; we raise the retry count because
 * bulk runs routinely hit the plan's concurrency limit.
 */
export function elevenlabs() {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new ConfigError("ELEVENLABS_API_KEY não configurada. Crie .env.local com ELEVENLABS_API_KEY=... e reinicie o servidor.");
  }
  client ??= new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
    maxRetries: 4,
    timeoutInSeconds: 120,
  });
  return client;
}

export class ConfigError extends Error {}

/**
 * Turns SDK errors into a status + readable message for the UI.
 * `fatal` marks errors that will fail every following request too (bad key, no credits, a voice
 * the plan cannot use),
 * so the client queue pauses instead of burning through the whole batch.
 */
export function describeError(err: unknown): { status: number; message: string; fatal?: boolean } {
  if (err instanceof ConfigError) return { status: 500, message: err.message, fatal: true };
  if (err instanceof ElevenLabsError) {
    const body = err.body as { detail?: { status?: string; message?: string } | string } | undefined;
    const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
    const code = typeof body?.detail === "object" ? body.detail.status : undefined;
    const status = err.statusCode ?? 502;
    const text = `${code ?? ""} ${detail ?? ""}`;
    // Library voices are blocked on the Free plan's API, and some library voices are paid-only.
    const voiceBlocked = /free users|library voices|not available for free|upgrade your subscription/i.test(text);
    const hint = voiceBlocked
      ? "Esta voz é da Voice Library, que o plano Free não libera pela API. Assine um plano pago (Starter+) ou escolha uma voz padrão (premade) nas configurações."
      : status === 401
        ? "Chave de API inválida ou sem permissão de Text to Speech."
        : code === "quota_exceeded"
          ? "Créditos insuficientes na conta ElevenLabs."
          : /voice_limit|voice limit|maximum number of voices|voice slots/i.test(text)
            ? "Limite de vozes do plano atingido: remova uma voz em “My Voices” no ElevenLabs para adicionar outra."
            : status === 429
              ? "Limite de concorrência do plano atingido — reduza a concorrência nas configurações."
              : undefined;
    return {
      status,
      message: [hint, detail ?? err.message].filter(Boolean).join(" "),
      fatal: status === 401 || code === "quota_exceeded" || voiceBlocked,
    };
  }
  if (err instanceof Error && err.name === "AbortError") return { status: 499, message: "Cancelado" };
  return { status: 500, message: err instanceof Error ? err.message : String(err) };
}

/**
 * Finds the default voice's id by its display name (voice ids differ per account/library).
 * Returns undefined when it cannot be resolved.
 */
export async function resolveVoiceId(name: string): Promise<string | undefined> {
  if (!process.env.ELEVENLABS_API_KEY) return undefined;
  try {
    const short = name.split(" - ")[0];
    const res = await elevenlabs().voices.search({ search: short, pageSize: 50 });
    const exact = res.voices.find((v) => v.name === name) ?? res.voices.find((v) => v.name?.startsWith(`${short} -`));
    return exact?.voiceId;
  } catch {
    return undefined;
  }
}

let tierCache: { tier: string; at: number } | undefined;

/** Subscription tier ("free", "starter", …), cached for 5 minutes. */
async function subscriptionTier(): Promise<string | undefined> {
  if (tierCache && Date.now() - tierCache.at < 5 * 60_000) return tierCache.tier;
  try {
    const { tier } = await elevenlabs().user.subscription.get();
    tierCache = { tier, at: Date.now() };
    return tier;
  } catch {
    return undefined;
  }
}

/**
 * The voice a new project starts with: Gus on paid plans, a premade voice while the account is on Free
 * (library voices are blocked there). ELEVENLABS_DEFAULT_VOICE_ID overrides both.
 */
export async function defaultVoiceForPlan(): Promise<{ voiceId?: string; voiceName?: string }> {
  if (process.env.ELEVENLABS_DEFAULT_VOICE_ID) return { voiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID };
  const free = (await subscriptionTier()) === "free";
  const voiceName = free ? FREE_PLAN_VOICE_NAME : DEFAULT_VOICE_NAME;
  return { voiceName, voiceId: await resolveVoiceId(voiceName) };
}
