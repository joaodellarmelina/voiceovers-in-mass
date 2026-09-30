"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";

const SAMPLE = "ID do Áudio\tPersonagem\tPortuguês (PT)\tInglês (EN)\tEspanhol (ES)\nFALA_001\tFerreiro\tBem-vindo à vila, viajante!\tWelcome to the village, traveler!\t¡Bienvenido a la aldea, viajero!\nFALA_002\tGuarda\tCuidado, a ponte está quebrada.\tCareful, the bridge is broken.\tCuidado, el puente está roto.\nFALA_003\tNarrador\tVocê encontrou uma chave dourada!\tYou found a golden key!\t¡Encontraste una llave dorada!";

type Detected = { id?: string; langs: string[]; rows: number };

/** Paste tile: runs the app's real sheet parser (loaded on first use) on whatever is typed or pasted. */
export function PasteTile() {
  const [text, setText] = useState("");
  const [detected, setDetected] = useState<Detected | null>(null);

  useEffect(() => {
    if (!text.trim()) return;
    let alive = true;
    import("@/lib/sheet").then(({ readWorkbook, splitHeader, guessRoles, buildProject }) => {
      try {
        const g = readWorkbook(text);
        const { header, body } = splitHeader(g.read(g.sheets[0]));
        const roles = guessRoles(header, body);
        const p = buildProject("demo", header, body, roles);
        const idCol = roles.findIndex((r) => r.kind === "id");
        if (alive) setDetected({ id: idCol >= 0 ? header[idCol] : undefined, langs: p.languages.map((l) => l.code.toUpperCase()), rows: p.rows.length });
      } catch {
        if (alive) setDetected(null);
      }
    });
    return () => {
      alive = false;
    };
  }, [text]);

  const shown = text.trim() ? detected : null;

  return (
    <div className="flex h-full flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={() => sfx("chime", 0.7)}
        placeholder="Cole aqui células do Google Sheets…"
        className="min-h-40 flex-1 resize-none rounded-lg border border-stone-200 bg-stone-50/60 p-3 font-mono text-[12px] whitespace-pre text-stone-800 outline-none placeholder:text-stone-400 focus:border-stone-400 focus:bg-white [tab-size:4]"
      />
      <div className="flex min-h-7 flex-wrap items-center gap-1.5 text-[11px]">
        {shown ? (
          <>
            {shown.id && <Chip tone="stone">ID · {shown.id}</Chip>}
            {shown.langs.map((l) => (
              <Chip key={l} tone="orange">{l}</Chip>
            ))}
            <span className="ml-auto text-stone-500">
              {shown.rows} frases × {shown.langs.length} idiomas = <b className="text-stone-800">{shown.rows * shown.langs.length} áudios</b>
            </span>
          </>
        ) : (
          <button
            onClick={() => {
              setText(SAMPLE);
              sfx("chime", 0.7);
            }}
            className="rounded-md border border-stone-200 px-2 py-1 text-stone-600 transition hover:border-stone-300 active:scale-95"
          >
            Usar um exemplo
          </button>
        )}
      </div>
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        sfx("success", 0.6);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:scale-90"
      aria-label="Copiar"
    >
      {done ? (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="m3.5 8.5 3 3 6-7" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="5" y="5" width="8" height="8" rx="1.5" /><path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" /></svg>
      )}
    </button>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "stone" | "orange" }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 font-medium ${tone === "orange" ? "bg-[#fff4ee] text-[#b4431f] ring-1 ring-[#f6d5c6]" : "bg-stone-100 text-stone-700"}`}>
      {children}
    </span>
  );
}
