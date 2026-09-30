"use client";

import { useState } from "react";
import { langColor } from "@/lib/lang-colors";
import type { Project } from "@/lib/types";
import type { Job, useGenerationQueue } from "./generation-queue";

type Q = ReturnType<typeof useGenerationQueue>;

/**
 * Non-blocking queue: a translucent panel floating over the content (no scrim), so you keep
 * reviewing while it runs. Collapses to a pill; expands to show what is running, errors and controls.
 */
export function QueueDock({
  q, project, onShowReview, onConcurrency,
}: { q: Q; project: Project; onShowReview: () => void; onConcurrency: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const { counts, snap, queue } = q;
  if (!counts.total) return null;

  const finished = counts.done + counts.error;
  const active = counts.queued + counts.running > 0;
  const pct = (finished / counts.total) * 100;
  const running = snap.jobs.filter((j) => j.status === "running");
  const next = snap.jobs.filter((j) => j.status === "queued").slice(0, 4);
  const errors = snap.jobs.filter((j) => j.status === "error");

  const title = !active
    ? counts.error
      ? `${counts.done} gerados · ${counts.error} com erro`
      : `${counts.done} takes gerados`
    : snap.paused
      ? `Pausado · ${counts.queued} na fila`
      : `Gerando ${finished + 1} de ${counts.total}`;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-30 flex w-[min(24rem,calc(100vw-2rem))] justify-end">
      <div
        className="glass pointer-events-auto w-full overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-2xl shadow-stone-900/15 ring-1 ring-stone-900/5 backdrop-blur-xl backdrop-saturate-150"
        style={{ animation: "rise-in 280ms cubic-bezier(0.2,0.9,0.3,1)" }}
      >
        <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <Ring pct={pct} active={active && !snap.paused} error={!active && counts.error > 0} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-900">{title}</div>
            <div className="text-xs tabular-nums text-stone-500">
              {counts.running} em andamento · {counts.queued} na fila · {counts.done} prontos
            </div>
          </div>
          <svg viewBox="0 0 16 16" className={`size-4 text-stone-400 transition-transform duration-200 ${open ? "" : "rotate-180"}`} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>

        <div className="h-1 bg-stone-100">
          <div className={`h-full transition-[width] duration-300 ${counts.error && !active ? "bg-rose-400" : "bg-accent-500"}`} style={{ width: `${pct}%` }} />
        </div>

        {snap.pauseReason && (
          <div className="flex items-start gap-2 border-b border-rose-100 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-700">
            <span className="flex-1">
              <b>Fila pausada.</b> {snap.pauseReason}
            </span>
            <button onClick={() => queue.resume()} className="shrink-0 font-medium text-accent-700 hover:underline">Continuar</button>
          </div>
        )}

        {open && (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto px-4 py-3">
            {running.length > 0 && <JobList label="Em andamento" jobs={running} project={project} spinner />}
            {next.length > 0 && <JobList label={`Próximos (${counts.queued})`} jobs={next} project={project} />}
            {errors.length > 0 && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label text-rose-500">Erros ({errors.length})</span>
                  <button onClick={() => queue.retryFailed()} className="text-xs font-medium text-accent-700 hover:underline">
                    Tentar de novo
                  </button>
                </div>
                <ul className="space-y-1">
                  {errors.slice(0, 5).map((j) => (
                    <li key={j.id} className="rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
                      <b className="font-mono">{j.rowId}</b> · {j.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-stone-100 pt-3">
              <span className="text-xs text-stone-500">Em paralelo</span>
              <div className="flex items-center rounded-lg border border-stone-200 bg-white">
                <button onClick={() => onConcurrency(snap.concurrency - 1)} className="px-2 py-0.5 text-stone-500 hover:bg-stone-50">−</button>
                <span className="w-6 text-center text-xs font-medium tabular-nums">{snap.concurrency}</span>
                <button onClick={() => onConcurrency(snap.concurrency + 1)} className="px-2 py-0.5 text-stone-500 hover:bg-stone-50">+</button>
              </div>
              <div className="ml-auto flex gap-1.5">
                {active ? (
                  <>
                    {snap.paused ? (
                      <button onClick={() => queue.resume()} className="btn-secondary px-2.5 py-1 text-xs">Continuar</button>
                    ) : (
                      <button onClick={() => queue.pause()} className="btn-secondary px-2.5 py-1 text-xs">Pausar</button>
                    )}
                    <button onClick={() => queue.cancelAll()} className="btn-danger px-2.5 py-1 text-xs">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button onClick={onShowReview} className="btn-secondary px-2.5 py-1 text-xs">Ver para revisar</button>
                    <button onClick={() => queue.dismissFinished()} className="btn-ghost px-2.5 py-1 text-xs">Fechar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function JobList({ label, jobs, project, spinner }: { label: string; jobs: Job[]; project: Project; spinner?: boolean }) {
  return (
    <div>
      <div className="label mb-1">{label}</div>
      <ul className="space-y-1">
        {jobs.map((j) => {
          const li = project.languages.findIndex((l) => l.key === j.langKey);
          const text = project.rows.find((r) => r.id === j.rowId)?.texts[j.langKey];
          return (
            <li key={j.id} className="flex items-center gap-2 text-xs">
              {spinner ? (
                <span className="size-3 shrink-0 animate-spin rounded-full border-[1.5px] border-accent-200 border-t-accent-600" />
              ) : (
                <span className="size-3 shrink-0 rounded-full border-[1.5px] border-stone-200" />
              )}
              <span className="font-mono font-medium text-stone-700">{j.rowId}</span>
              <span className={`rounded px-1 text-[10px] font-semibold uppercase ring-1 ${langColor(li).chip}`}>{project.languages[li]?.code}</span>
              <span dir="auto" className="truncate text-stone-500">{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Ring({ pct, active, error }: { pct: number; active: boolean; error: boolean }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-stone-200" />
        <circle
          cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          className={`transition-[stroke-dashoffset] duration-300 ${error ? "stroke-rose-500" : active ? "stroke-accent-600" : "stroke-emerald-500"}`}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold tabular-nums text-stone-700">
        {!active && !error && pct >= 100 ? "✓" : `${Math.round(pct)}%`}
      </span>
    </span>
  );
}
