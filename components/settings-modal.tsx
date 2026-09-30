"use client";

import { useEffect, useRef, useState } from "react";
import { langColor } from "@/lib/lang-colors";
import { OUTPUT_FORMATS, voiceSettingKeys, type Language, type OutputFormat, type Settings } from "@/lib/types";
import { VoicePicker } from "./voice-picker";

type Model = { modelId: string; name: string; maxChars?: number; languages: string[] };

export function SettingsModal({
  open,
  onClose,
  notice,
  settings,
  languages,
  onSettings,
  onLanguage,
}: {
  open: boolean;
  onClose: () => void;
  notice?: string | null;
  settings: Settings;
  languages: Language[];
  onSettings: (patch: Partial<Settings>) => void;
  onLanguage: (key: string, patch: Partial<Language>) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || models.length) return;
    fetch("/api/models")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setModels(json);
      })
      .catch((e) => setModelsError(e.message));
  }, [open, models.length]);

  const model = models.find((m) => m.modelId === settings.modelId);
  const supports = voiceSettingKeys(settings.modelId);
  const expressive = !supports.style;
  const unsupported = model?.languages.length
    ? languages.filter((l) => !model.languages.some((code) => code.toLowerCase().startsWith(l.code)))
    : [];

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      className="m-auto w-[min(56rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl bg-white p-0 text-stone-800 shadow-2xl shadow-stone-900/20 open:animate-[modal-in_220ms_cubic-bezier(0.2,0.9,0.3,1)] motion-reduce:open:animate-none"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-center justify-between border-b border-stone-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Configurações de geração</h2>
            <p className="text-sm text-stone-500">Valem para os próximos takes. Os já gerados não mudam.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="btn-ghost size-9 rounded-full p-0">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="m4 4 8 8M12 4l-8 8" /></svg>
          </button>
        </header>

        {notice && <div className="mx-6 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">{notice}</div>}

        <div className="grid flex-1 gap-8 overflow-y-auto px-6 py-5 md:grid-cols-[1.1fr_1fr]">
          <section className="space-y-4">
            <h3 className="label">Vozes</h3>
            <Field label="Voz padrão" hint="Usada nos idiomas sem voz própria">
              <VoicePicker
                value={{ voiceId: settings.defaultVoiceId, voiceName: settings.defaultVoiceName }}
                onChange={(v) => onSettings({ defaultVoiceId: v.voiceId, defaultVoiceName: v.voiceName })}
              />
            </Field>
            <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
              {languages.map((l, i) => (
                <div key={l.key} className="flex items-center gap-3 px-3 py-2.5">
                  <span className={`w-10 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold uppercase ring-1 ${langColor(i).chip}`}>
                    {l.code || "?"}
                  </span>
                  <div className="w-28 shrink-0">
                    <div className="truncate text-sm text-stone-700" title={l.key}>{l.key}</div>
                    <input
                      value={l.code}
                      onChange={(e) => onLanguage(l.key, { code: e.target.value.trim().toLowerCase() })}
                      title="Código ISO 639-1 enviado como language_code"
                      className="mt-0.5 w-16 rounded border border-transparent px-1 text-xs text-stone-400 hover:border-stone-200 focus:border-accent-300 focus:outline-none"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <VoicePicker
                      value={l}
                      placeholder={settings.defaultVoiceName ? `Padrão · ${settings.defaultVoiceName}` : "Escolher voz"}
                      onChange={(v) => onLanguage(l.key, v)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="space-y-3">
              <h3 className="label">Modelo e saída</h3>
              <Field label="Modelo">
                <select value={settings.modelId} onChange={(e) => onSettings({ modelId: e.target.value })} className="input w-full">
                  {!models.some((m) => m.modelId === settings.modelId) && <option value={settings.modelId}>{settings.modelId}</option>}
                  {models.map((m) => (
                    <option key={m.modelId} value={m.modelId}>{m.name}</option>
                  ))}
                </select>
                {modelsError && <p className="mt-1 text-xs text-rose-600">{modelsError}</p>}
                {unsupported.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">Este modelo não lista suporte a: {unsupported.map((l) => l.code).join(", ")}</p>
                )}
              </Field>
              <Field label="Formato">
                <select value={settings.outputFormat} onChange={(e) => onSettings({ outputFormat: e.target.value as OutputFormat })} className="input w-full">
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Takes por frase">
                  <Stepper value={settings.variations} min={1} max={5} onChange={(v) => onSettings({ variations: v })} />
                </Field>
                <Field label="Em paralelo" hint="Free 2 · Starter 3 · Creator 5 · Pro 10">
                  <Stepper value={settings.concurrency} min={1} max={30} onChange={(v) => onSettings({ concurrency: v })} />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="label">Voice settings</h3>
              <Slider
                label="Stability"
                left={expressive ? "Creative" : "Mais variável"}
                right={expressive ? "Robust" : "Mais estável"}
                value={settings.stability}
                onChange={(v) => onSettings({ stability: v })}
              />
              <Slider label="Similarity" left="Low" right="High" value={settings.similarityBoost} onChange={(v) => onSettings({ similarityBoost: v })} />
              {supports.style && (
                <Slider label="Style exaggeration" left="Nenhum" right="Exagerado" value={settings.style} onChange={(v) => onSettings({ style: v })} />
              )}
              {supports.speed && (
                <Slider label="Speed" left="0.7×" right="1.2×" min={0.7} max={1.2} value={settings.speed} onChange={(v) => onSettings({ speed: v })} />
              )}
              {supports.speakerBoost && (
                <Switch label="Speaker boost" checked={settings.useSpeakerBoost} onChange={(v) => onSettings({ useSpeakerBoost: v })} />
              )}
              <Switch
                label="Language override"
                hint="Envia o language_code da coluna. Nem todos os modelos aceitam."
                checked={settings.languageOverride}
                onChange={(v) => onSettings({ languageOverride: v })}
              />
            </div>
          </section>
        </div>

        <footer className="flex justify-end border-t border-stone-100 bg-stone-50/60 px-6 py-3">
          <button onClick={onClose} className="btn-primary">Concluído</button>
        </footer>
      </div>
    </dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}
    </label>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-stone-200 bg-white">
      <button type="button" disabled={value <= min} onClick={() => onChange(value - 1)} className="h-full w-9 rounded-l-lg text-stone-500 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-30">−</button>
      <span className="flex-1 text-center text-sm font-medium tabular-nums">{value}</span>
      <button type="button" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-full w-9 rounded-r-lg text-stone-500 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-30">+</button>
    </div>
  );
}

function Slider({
  label, left, right, value, onChange, min = 0, max = 1,
}: { label: string; left: string; right: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between font-medium text-stone-700">
        {label} <span className="font-normal tabular-nums text-stone-400">{value.toFixed(2)}</span>
      </span>
      <input type="range" min={min} max={max} step={0.05} value={value} onChange={(e) => onChange(+e.target.value)} className="mt-1 w-full accent-accent-600" />
      <span className="flex justify-between text-[11px] text-stone-400">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </label>
  );
}

function Switch({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 text-sm">
      <span>
        <span className="font-medium text-stone-700">{label}</span>
        {hint && <span className="block text-[11px] text-stone-400">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-stone-200 transition-colors peer-checked:bg-accent-600 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-300 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-4" />
    </label>
  );
}
