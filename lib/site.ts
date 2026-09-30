/** Public site settings used by metadata, sitemap, robots and structured data. */
export const SITE = {
  name: "voiceovers",
  title: "Voiceovers em massa: bulk text-to-speech a partir de planilhas",
  description:
    "Bulk text-to-speech para jogos, apps e diálogos: cole a planilha, gere voiceovers em lote em vários idiomas com o ElevenLabs, revise os takes e receba tudo organizado por ID.",
  /** Set NEXT_PUBLIC_SITE_URL to the production domain so canonicals, sitemap and OG links are absolute. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  locale: "pt_BR",
  keywords: [
    "bulk text-to-speech",
    "text-to-speech em massa",
    "TTS em lote",
    "batch text-to-speech",
    "voiceover em massa",
    "voiceovers em lote",
    "gerar áudio a partir de planilha",
    "text-to-speech Excel",
    "text-to-speech CSV",
    "dublagem de jogos com IA",
    "localização de voz para jogos",
    "voz para NPC",
    "ElevenLabs em massa",
    "ElevenLabs API",
    "TTS multilíngue",
  ],
};

export const absoluteUrl = (path = "/") => new URL(path, SITE.url).toString();

/** Serializes JSON-LD safely for a <script> tag (escapes "<" as recommended by the Next.js docs). */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });
