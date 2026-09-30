"use client";

import { memo, useState } from "react";
import { langColor } from "@/lib/lang-colors";
import type { Language, Row, Take } from "@/lib/types";
import type { CellStatus } from "./generation-queue";
import { Track } from "./player";
import { useTakeUrl } from "./take-url";

export type LangView = Language & { color: number };
export type TakeAction = "approve" | "unapprove" | "reject" | "unreject";

export type RowCardProps = {
  projectId: string;
  row: Row;
  /** Changes whenever anything visible in this row changes; lets memo skip the other rows. */
  sig: string;
  languages: LangView[];
  metaColumns: string[];
  takes: Map<string, Take[]>;
  approved: Record<string, string>;
  status: Map<string, CellStatus>;
  selected: boolean;
  variations: number;
  onSelect: (rowId: string, range: boolean) => void;
  onSelectFrom: (rowId: string) => void;
  onGenerate: (rowId: string, langKeys: string[], n: number, priority: boolean) => void;
  onTake: (take: Take, action: TakeAction) => void;
};

export const RowCard = memo(
  function RowCard(p: RowCardProps) {
    const langs = p.languages.filter((l) => p.row.texts[l.key]?.trim());
    const approvedCount = langs.filter((l) => p.approved[`${p.row.id}::${l.key}`]).length;
    const meta = p.metaColumns.map((c) => p.row.meta[c]).filter(Boolean).join(" · ");

    return (
      <section
        className={`card overflow-hidden transition-shadow ${p.selected ? "ring-2 ring-accent-400 ring-offset-2 ring-offset-[var(--background)]" : ""}`}
      >
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 pb-2">
          <input
            type="checkbox"
            checked={p.selected}
            onChange={() => undefined}
            onClick={(e) => p.onSelect(p.row.id, e.shiftKey)}
            title="Shift+clique seleciona o intervalo"
            className="size-4 rounded accent-accent-600"
          />
          <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[13px] font-semibold text-stone-800">{p.row.id}</span>
          {meta && <span className="truncate text-xs text-stone-500">{meta}</span>}
          <span className="flex items-center gap-1" title={`${approvedCount}/${langs.length} aprovados`}>
            {langs.map((l) => (
              <span
                key={l.key}
                className={`size-1.5 rounded-full ${p.approved[`${p.row.id}::${l.key}`] ? langColor(l.color).dot : "bg-stone-200"}`}
              />
            ))}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => p.onSelectFrom(p.row.id)} className="btn-ghost px-2 py-1 text-xs" title="Selecionar este ID e todos abaixo">
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M8 3v10M4 9l4 4 4-4" /></svg>
              Daqui para baixo
            </button>
            <button
              onClick={() => p.onGenerate(p.row.id, langs.map((l) => l.key), p.variations, true)}
              className="btn-ghost px-2 py-1 text-xs text-accent-700 hover:bg-accent-50 hover:text-accent-800"
            >
              Gerar linha × {p.variations}
            </button>
          </div>
        </header>
        <div className="grid gap-3 px-4 pb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
          {langs.map((l) => {
            const k = `${p.row.id}::${l.key}`;
            return (
              <Cell
                key={l.key}
                projectId={p.projectId}
                rowId={p.row.id}
                lang={l}
                text={p.row.texts[l.key]}
                takes={p.takes.get(l.key) ?? []}
                approvedId={p.approved[k]}
                status={p.status.get(k)}
                variations={p.variations}
                onGenerate={p.onGenerate}
                onTake={p.onTake}
              />
            );
          })}
        </div>
      </section>
    );
  },
  (a, b) =>
    a.sig === b.sig && a.row === b.row && a.selected === b.selected && a.languages === b.languages && a.variations === b.variations,
);

function Cell({
  projectId, rowId, lang, text, takes, approvedId, status, variations, onGenerate, onTake,
}: {
  projectId: string;
  rowId: string;
  lang: LangView;
  text: string;
  takes: Take[];
  approvedId?: string;
  status?: CellStatus;
  variations: number;
  onGenerate: RowCardProps["onGenerate"];
  onTake: RowCardProps["onTake"];
}) {
  const [showRejected, setShowRejected] = useState(false);
  const takeUrl = useTakeUrl();
  const numbered = takes.map((t, i) => ({ t, n: i + 1 }));
  const live = numbered.filter(({ t }) => !t.rejected);
  const rejected = numbered.filter(({ t }) => t.rejected);
  const shown = showRejected ? numbered : live;

  return (
    <div
      className={`flex flex-col rounded-xl border p-3 transition-colors ${
        approvedId ? "border-emerald-200 bg-emerald-50/40" : "border-stone-200 bg-stone-50/40"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase ring-1 ${langColor(lang.color).chip}`}>{lang.code}</span>
        <StatusBadge approved={!!approvedId} status={status} live={live.length} />
      </div>
      <p dir="auto" className="mb-2 text-[15px] leading-snug text-stone-800">
        {text}
      </p>

      {shown.length > 0 && (
        <ul className="-mx-1 space-y-0.5">
          {shown.map(({ t, n }) => {
            const url = takeUrl(projectId, t);
            const isApproved = approvedId === t.id;
            return (
              <li
                key={t.id}
                className={`rounded-lg px-1.5 py-1.5 transition-colors ${
                  isApproved ? "bg-white ring-1 ring-emerald-200" : t.rejected ? "opacity-45" : "hover:bg-white"
                }`}
                style={{ animation: "rise-in 260ms cubic-bezier(0.2,0.9,0.3,1)" }}
              >
                <Track
                  url={url}
                  tone={isApproved ? "emerald" : "accent"}
                  title={`Take ${n}`}
                  subtitle={isApproved ? <span className="font-medium text-emerald-600">Aprovado · salvo</span> : undefined}
                  trailing={
                    <div className="flex shrink-0 items-center">
                      <IconButton
                        label={isApproved ? "Remover aprovação" : "Aprovar e salvar"}
                        active={isApproved}
                        activeClass="text-emerald-600 bg-emerald-50"
                        onClick={() => onTake(t, isApproved ? "unapprove" : "approve")}
                      >
                        <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
                      </IconButton>
                      <IconButton
                        label={t.rejected ? "Restaurar" : "Descartar"}
                        active={!!t.rejected}
                        activeClass="text-rose-600 bg-rose-50"
                        onClick={() => onTake(t, t.rejected ? "unreject" : "reject")}
                      >
                        <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
                      </IconButton>
                      <a href={`${url}?download=1`} download title="Baixar" className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
                        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                        </svg>
                      </a>
                    </div>
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-2 pt-2 text-xs">
        {status?.error && (
          <span className="line-clamp-1 flex-1 text-rose-600" title={status.error}>
            {status.error}
          </span>
        )}
        {rejected.length > 0 && (
          <button onClick={() => setShowRejected((s) => !s)} className="text-stone-400 hover:text-stone-700">
            {showRejected ? "ocultar descartados" : `${rejected.length} descartado${rejected.length > 1 ? "s" : ""}`}
          </button>
        )}
        <button
          onClick={() => onGenerate(rowId, [lang.key], live.length ? 1 : variations, true)}
          className="ml-auto rounded-md px-2 py-1 font-medium text-accent-700 transition hover:bg-accent-50 active:scale-[0.97]"
        >
          {live.length ? "+1 take" : `Gerar × ${variations}`}
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ approved, status, live }: { approved: boolean; status?: CellStatus; live: number }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";
  if (status?.running)
    return (
      <span className={`${base} bg-accent-50 text-accent-700`}>
        <span className="size-2.5 animate-spin rounded-full border-[1.5px] border-accent-200 border-t-accent-600" />
        Gerando{status.queued ? ` · +${status.queued}` : "…"}
      </span>
    );
  if (status?.queued) return <span className={`${base} bg-stone-100 text-stone-600`}>Na fila · {status.queued}</span>;
  if (approved) return <span className={`${base} bg-emerald-100 text-emerald-700`}>✓ Aprovado</span>;
  if (status?.error) return <span className={`${base} bg-rose-50 text-rose-700`}>Erro</span>;
  if (live) return <span className={`${base} bg-amber-50 text-amber-700`}>Revisar · {live}</span>;
  return <span className={`${base} bg-stone-100 text-stone-500`}>Sem áudio</span>;
}

function IconButton({
  label, active, activeClass, onClick, children,
}: { label: string; active: boolean; activeClass: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md p-1.5 transition active:scale-90 ${active ? activeClass : "text-stone-400 hover:bg-stone-100 hover:text-stone-700"}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.2 : 0} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
