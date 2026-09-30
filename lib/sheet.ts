import * as XLSX from "xlsx";
import type { Language, NewProjectInput, Row } from "./types";

export type Grid = { sheets: string[]; read: (sheet: string) => string[][] };

/** Reads .xlsx/.xls/.csv/.ods files, or text pasted straight from Google Sheets/Excel (tab separated). */
export function readWorkbook(data: ArrayBuffer | string): Grid {
  const wb = typeof data === "string" ? XLSX.read(data, { type: "string" }) : XLSX.read(data, { type: "array" });
  return {
    sheets: wb.SheetNames,
    read: (sheet) =>
      (XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheet], { header: 1, defval: "", raw: false, blankrows: false }) as unknown[][])
        .map((r) => r.map((c) => String(c ?? "").trim())),
  };
}

export type ColumnRole = { kind: "id" } | { kind: "meta" } | { kind: "lang"; code: string } | { kind: "ignore" };

const LANG_IN_HEADER = /\(([a-z]{2,3})(?:[-_][a-z]{2,4})?\)\s*$/i;

const LANG_NAMES: Record<string, string> = {
  portugu: "pt", ingl: "en", english: "en", espa: "es", spanish: "es", franc: "fr", french: "fr",
  alem: "de", german: "de", deutsch: "de", ital: "it", árabe: "ar", arabe: "ar", arabic: "ar",
  japon: "ja", japanese: "ja", chin: "zh", mandarim: "zh", corean: "ko", korean: "ko", hindi: "hi",
  russo: "ru", russian: "ru", holand: "nl", dutch: "nl", turco: "tr", turkish: "tr", polon: "pl", polish: "pl",
};

export function guessLanguage(header: string): string | undefined {
  const m = header.match(LANG_IN_HEADER);
  if (m) return m[1].toLowerCase();
  const lower = header.toLowerCase();
  return Object.entries(LANG_NAMES).find(([k]) => lower.startsWith(k))?.[1];
}

/** First row with at least two filled cells is the header. */
export function splitHeader(grid: string[][]) {
  const idx = grid.findIndex((r) => r.filter(Boolean).length >= 2);
  if (idx < 0) return { header: [] as string[], body: [] as string[][] };
  const width = Math.max(...grid.map((r) => r.length));
  const header = Array.from({ length: width }, (_, i) => grid[idx][i] || `Coluna ${i + 1}`);
  return { header, body: grid.slice(idx + 1) };
}

export function guessRoles(header: string[], body: string[][]): ColumnRole[] {
  const roles: ColumnRole[] = header.map((h) => {
    const code = guessLanguage(h);
    return code ? { kind: "lang", code } : { kind: "meta" };
  });
  const isUnique = (i: number) => {
    const values = body.map((b) => b[i]).filter(Boolean);
    return values.length > 0 && new Set(values).size === values.length;
  };
  const byName = header.findIndex((h, i) => roles[i].kind === "meta" && /\bid\b|áudio|audio|c[oó]d/i.test(h));
  const idCol = byName >= 0 ? byName : roles.findIndex((r, i) => r.kind === "meta" && isUnique(i));
  if (idCol >= 0) roles[idCol] = { kind: "id" };
  return roles;
}

export function buildProject(name: string, header: string[], body: string[][], roles: ColumnRole[]): NewProjectInput {
  const idCol = roles.findIndex((r) => r.kind === "id");
  const languages: Language[] = [];
  roles.forEach((r, i) => {
    if (r.kind === "lang") languages.push({ key: header[i], code: r.code.trim().toLowerCase() });
  });
  const metaColumns = header.filter((_, i) => roles[i].kind === "meta");
  const seen = new Map<string, number>();
  const rows: Row[] = [];
  body.forEach((cells, n) => {
    const texts: Record<string, string> = {};
    roles.forEach((r, i) => {
      if (r.kind === "lang" && cells[i]) texts[header[i]] = cells[i];
    });
    if (!Object.keys(texts).length) return;
    let id = (idCol >= 0 && cells[idCol]) || `LINHA_${String(n + 1).padStart(3, "0")}`;
    const dup = seen.get(id) ?? 0;
    seen.set(id, dup + 1);
    if (dup) id = `${id}_${dup + 1}`;
    const meta: Record<string, string> = {};
    roles.forEach((r, i) => {
      if (r.kind === "meta" && cells[i]) meta[header[i]] = cells[i];
    });
    rows.push({ id, meta, texts });
  });
  return { name, metaColumns, languages, rows };
}
