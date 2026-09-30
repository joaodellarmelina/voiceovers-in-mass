"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sfx";
import { PlayButton } from "./player";

type Voice = {
  voiceId: string;
  name: string;
  category?: string;
  labels: Record<string, string>;
  previewUrl?: string;
  languages: string[];
  /** Voice Library only */
  publicOwnerId?: string;
  rate?: number;
};

type Source = "mine" | "library";

export function VoicePicker({
  value,
  placeholder = "Escolher voz",
  onChange,
}: {
  value?: { voiceId?: string; voiceName?: string };
  placeholder?: string;
  onChange: (v: { voiceId?: string; voiceName?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<Source>("mine");
  const [adding, setAdding] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const endpoint = source === "mine" ? "/api/voices" : "/api/voices/library";
        const res = await fetch(`${endpoint}?search=${encodeURIComponent(search)}`, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        setVoices(json.voices);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, search, source]);

  /** Library voices must be added to the account ("My Voices") before the API can use them. */
  async function addAndUse(v: Voice) {
    setAdding(v.voiceId);
    setError(null);
    try {
      const res = await fetch("/api/voices/add", {
        method: "POST",
        body: JSON.stringify({ publicOwnerId: v.publicOwnerId, voiceId: v.voiceId, name: v.name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      sfx("success");
      onChange({ voiceId: json.voiceId, voiceName: v.name });
      setOpen(false);
    } catch (e) {
      sfx("error");
      setError((e as Error).message);
    } finally {
      setAdding(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation(); // close the popover, not the surrounding dialog
      e.preventDefault();
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex w-full items-center justify-between gap-2 text-left">
        <span className={`truncate ${value?.voiceId ? "text-stone-800" : "text-stone-400"}`}>{value?.voiceName || value?.voiceId || placeholder}</span>
        <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-stone-400" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-1.5 w-[22rem] origin-top-right rounded-xl border border-stone-200 bg-white p-2 shadow-xl shadow-stone-900/10">
          <div className="mb-2 grid grid-cols-2 rounded-lg bg-stone-100 p-0.5 text-xs">
            {(
              [
                ["mine", "Minhas vozes"],
                ["library", "Voice Library"],
              ] as const
            ).map(([s, label]) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSource(s);
                  setVoices([]);
                  setError(null);
                }}
                className={`rounded-md py-1 font-medium transition ${source === s ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={source === "mine" ? "Buscar nas suas vozes…" : "Buscar na Voice Library (ex.: Gus)…"}
            className="input mb-2 w-full"
          />
          {source === "library" && (
            <p className="mb-2 px-1 text-[11px] text-stone-400">Adicionar leva a voz para “Minhas vozes” (usa 1 espaço de voz do seu plano) e já a seleciona.</p>
          )}
          {error && <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
          <ul className="max-h-72 overflow-y-auto">
            {value?.voiceId && source === "mine" && (
              <li>
                <button type="button" onClick={() => { onChange({}); setOpen(false); }} className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50">
                  Limpar (usar voz padrão)
                </button>
              </li>
            )}
            {voices.map((v) => (
              <li
                key={v.voiceId}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-stone-50 ${v.voiceId === value?.voiceId ? "bg-accent-50" : ""}`}
              >
                {v.previewUrl ? <PlayButton url={v.previewUrl} size="sm" /> : <span className="size-7" />}
                <button
                  type="button"
                  disabled={source === "library"}
                  onClick={() => { onChange({ voiceId: v.voiceId, voiceName: v.name }); setOpen(false); }}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-stone-800">{v.name}</span>
                    {source === "library" ? (
                      (v.rate ?? 1) > 1 && (
                        <span className="shrink-0 rounded bg-rose-50 px-1 text-[10px] font-medium text-rose-700" title="Consome mais créditos por caractere">
                          ×{v.rate} créditos
                        </span>
                      )
                    ) : v.category === "premade" ? (
                      <span className="shrink-0 rounded bg-emerald-50 px-1 text-[10px] font-medium text-emerald-700">Padrão</span>
                    ) : (
                      <span className="shrink-0 rounded bg-amber-50 px-1 text-[10px] font-medium text-amber-700" title="Voz da Voice Library adicionada à sua conta. Não funciona pela API no plano Free.">
                        Biblioteca
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-stone-500">
                    {[v.labels.gender, v.labels.accent, v.languages.join(" ")].filter(Boolean).join(" · ")}
                  </div>
                </button>
                {source === "library" && (
                  <button
                    type="button"
                    disabled={!!adding}
                    onClick={() => addAndUse(v)}
                    className="btn-secondary shrink-0 px-2 py-1 text-xs"
                  >
                    {adding === v.voiceId ? "Adicionando…" : "Adicionar"}
                  </button>
                )}
              </li>
            ))}
            {!loading && !voices.length && !error && <li className="p-2 text-xs text-stone-500">Nenhuma voz encontrada</li>}
            {loading && <li className="p-2 text-xs text-stone-500">Carregando…</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
