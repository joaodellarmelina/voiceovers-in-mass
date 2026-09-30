export type Language = {
  /** Column header in the source sheet, e.g. "Português (PT)". Unique per project. */
  key: string;
  /** ISO 639-1 code sent as `language_code` when language override is on, e.g. "pt". */
  code: string;
  /** Per-language voice. Falls back to the project default voice when empty. */
  voiceId?: string;
  voiceName?: string;
};

export type Row = {
  /** Audio ID from the sheet, e.g. "PERG_001". Becomes the export folder name. */
  id: string;
  /** Non-language columns (Tipo, Contexto/Uso, ...) kept for display. */
  meta: Record<string, string>;
  /** Text per language key. */
  texts: Record<string, string>;
};

export type OutputFormat =
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "wav_44100"
  | "wav_48000"
  | "opus_48000_128";

export type Settings = {
  modelId: string;
  outputFormat: OutputFormat;
  defaultVoiceId?: string;
  defaultVoiceName?: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
  useSpeakerBoost: boolean;
  /** Send `language_code` to enforce the language (only some models accept it). */
  languageOverride: boolean;
  /** How many takes to generate per phrase on each bulk run. */
  variations: number;
  /** Parallel requests. Keep within your plan's concurrency limit. */
  concurrency: number;
};

export type Take = {
  id: string;
  rowId: string;
  langKey: string;
  createdAt: string;
  file: string;
  seed: number;
  modelId: string;
  voiceId: string;
  requestId?: string;
  characterCost?: number;
  rejected?: boolean;
};

export type Project = {
  id: string;
  name: string;
  /** Name of the exported ZIP (and its top folder). */
  exportFolder: string;
  createdAt: string;
  updatedAt: string;
  metaColumns: string[];
  languages: Language[];
  rows: Row[];
  settings: Settings;
  takes: Take[];
  /** cellKey -> approved take id */
  approved: Record<string, string>;
  /** Google Drive folder that mirrors the approved takes as <ID>/<phrase>.<ext>. */
  drive?: DriveLink;
};

export type DriveLink = {
  folderId: string;
  folderName: string;
  folderUrl: string;
  /** "Anyone with the link can view" is set on the folder. */
  isPublic: boolean;
  /** ROW_ID -> Drive subfolder id. */
  folders: Record<string, string>;
  /** cellKey -> the Drive file mirroring its approved take. */
  files: Record<string, { fileId: string; takeId: string }>;
  lastSyncAt?: string;
  lastError?: string;
};

/** Summary the UI polls: how far the Drive mirror is from the approvals. */
export type DriveStatus = {
  configured: boolean;
  connected: boolean;
  email?: string;
  link?: Omit<DriveLink, "folders" | "files">;
  approved: number;
  synced: number;
  syncing: boolean;
};

export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  rows: number;
  languages: string[];
  cells: number;
  approved: number;
};

export type NewProjectInput = Pick<Project, "name" | "metaColumns" | "languages" | "rows">;

/** One cell's approval in a bulk change: a take id approves it, null removes the approval. */
export type ApprovalChange = { rowId: string; langKey: string; takeId: string | null };

/** The unit of work: one phrase in one language. */
export const cellKey = (rowId: string, langKey: string) => `${rowId}::${langKey}`;

/** Mirrors the ElevenLabs UI setup used for these voiceovers: Eleven v4 + Gus. */
export const DEFAULT_VOICE_NAME = "Gus - Natural Goofy Best Friend";
/**
 * Gus is a Voice Library voice, which the Free plan cannot use through the API.
 * On Free, new projects start with this premade voice instead (closest in tone: young, relaxed, male).
 */
export const FREE_PLAN_VOICE_NAME = "Will - Relaxed Optimist";

export const DEFAULT_SETTINGS: Settings = {
  modelId: "eleven_v4",
  outputFormat: "mp3_44100_128",
  defaultVoiceName: DEFAULT_VOICE_NAME,
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0,
  speed: 1,
  useSpeakerBoost: true,
  languageOverride: false,
  variations: 2,
  concurrency: 3,
};

/**
 * Voice settings each model family exposes. Eleven v3/v4 only take stability + similarity
 * (the ElevenLabs UI hides style, speed and speaker boost for them).
 */
export function voiceSettingKeys(modelId: string) {
  const expressive = modelId.startsWith("eleven_v4") || modelId.startsWith("eleven_v3");
  return { style: !expressive, speed: !expressive, speakerBoost: !expressive };
}

export const OUTPUT_FORMATS: { value: OutputFormat; label: string }[] = [
  { value: "mp3_44100_128", label: "MP3 44.1 kHz (128kbps)" },
  { value: "mp3_44100_192", label: "MP3 44.1 kHz (192kbps) — Creator+" },
  { value: "wav_44100", label: "WAV 44.1 kHz — Pro+" },
  { value: "wav_48000", label: "WAV 48 kHz — Pro+" },
  { value: "opus_48000_128", label: "Opus 48 kHz (128kbps)" },
];

/**
 * List-price credits per character by model, used until the account has real history for a
 * model + voice (the generate route stores the API's `character-cost` on every take).
 * Flash/Turbo cost half; the rest 1 credit per character (measured: Eleven v4 = 1 on this account).
 */
export function creditsPerChar(modelId: string) {
  return /flash|turbo/.test(modelId) ? 0.5 : 1;
}

/** ElevenLabs bills characters as code points of the text sent (accents and Arabic count as one each). */
export const billableChars = (text: string) => [...text.trim()].length;

export function extensionFor(format: OutputFormat) {
  return format.split("_")[0];
}
