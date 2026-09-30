import type { Language, Row } from "./types";

/** Strips characters that are invalid in file names on macOS/Windows while keeping accents and punctuation like "?". */
export function safeFileName(name: string) {
  return (
    name
      .replace(/[\/\\:*"<>|\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150) || "untitled"
  );
}

/**
 * File name of an approved take inside its <ROW_ID>/ folder: the phrase itself, like the manual Drive layout.
 * When two languages share the exact same text in a row, the language code is appended.
 */
export function exportFileName(languages: Language[], row: Row, langKey: string, ext: string) {
  const lang = languages.find((l) => l.key === langKey);
  const text = row.texts[langKey] ?? "";
  const clash = languages.some((l) => l.key !== langKey && row.texts[l.key]?.trim() === text.trim());
  return safeFileName(text) + (clash && lang ? ` (${lang.code})` : "") + ext;
}
