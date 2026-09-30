import type { Project, Take } from "@/lib/types";

/**
 * A slice of a real project ("FRASES JADE"): 128 phrases × 4 languages. The two rows below were
 * generated with Eleven v4 + the "Will" voice; their takes are the original files in /public/landing/audio.
 */
export const REAL = {
  phrases: 128,
  languages: 4,
  audios: 512,
  takesPerPhrase: 2,
  /** Billable characters across all 512 cells; Eleven v4 + Will measured at 1 credit per character. */
  totalChars: 10_545,
};

const LANGUAGES = [
  { key: "Português (PT)", code: "pt" },
  { key: "Inglês (EN)", code: "en" },
  { key: "Espanhol (ES)", code: "es" },
  { key: "Árabe (AR-AE)", code: "ar" },
];

const ROWS = [
  {
    id: "PERG_021",
    meta: { Tipo: "Enunciado", "Contexto/Uso": "Adição - Fase 3, Subfase 1" },
    texts: {
      "Português (PT)": "Quanto é oito mais cinco?",
      "Inglês (EN)": "How much is eight plus five?",
      "Espanhol (ES)": "¿Cuánto es ocho más cinco?",
      "Árabe (AR-AE)": "كم يساوي ثمانية زائد خمسة؟",
    },
  },
  {
    id: "PERG_022",
    meta: { Tipo: "Enunciado", "Contexto/Uso": "Adição - Fase 3, Subfase 2" },
    texts: {
      "Português (PT)": "Quanto é seis mais sete?",
      "Inglês (EN)": "How much is six plus seven?",
      "Espanhol (ES)": "¿Cuánto es seis más siete?",
      "Árabe (AR-AE)": "كم يساوي ستة زائد سبعة؟",
    },
  },
];

function takesFor(rowId: string): Take[] {
  return LANGUAGES.flatMap((l) =>
    [1, 2].map((n) => ({
      id: `${rowId}-${l.code}-${n}`,
      rowId,
      langKey: l.key,
      createdAt: "2026-09-29T18:40:00.000Z",
      file: `${rowId.toLowerCase()}-${l.code}-${n}.mp3`,
      seed: 0,
      modelId: "eleven_v4",
      voiceId: "bIHbv24MWmeRgasZH58o",
    })),
  );
}

export const DEMO_PROJECT: Project = {
  id: "demo",
  name: "Meu jogo",
  exportFolder: "Meu jogo",
  createdAt: "2026-09-29T18:00:00.000Z",
  updatedAt: "2026-09-29T18:40:00.000Z",
  metaColumns: ["Contexto/Uso"],
  languages: LANGUAGES,
  rows: ROWS,
  settings: {
    modelId: "eleven_v4",
    outputFormat: "mp3_44100_128",
    defaultVoiceId: "bIHbv24MWmeRgasZH58o",
    defaultVoiceName: "Will - Relaxed Optimist",
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    speed: 1,
    useSpeakerBoost: true,
    languageOverride: false,
    variations: 2,
    concurrency: 3,
  },
  takes: [...takesFor("PERG_021"), ...takesFor("PERG_022")],
  approved: {
    "PERG_021::Português (PT)": "PERG_021-pt-1",
    "PERG_021::Inglês (EN)": "PERG_021-en-2",
    "PERG_021::Espanhol (ES)": "PERG_021-es-1",
    "PERG_021::Árabe (AR-AE)": "PERG_021-ar-1",
    "PERG_022::Português (PT)": "PERG_022-pt-2",
    "PERG_022::Inglês (EN)": "PERG_022-en-1",
  },
};

export const demoTakeUrl = (_projectId: string, take: Take) => `/landing/audio/${take.file}`;
