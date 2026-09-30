"use client";

import { useEffect, useRef, useState } from "react";
import { langColor } from "@/lib/lang-colors";
import { sfx } from "@/lib/sfx";
import { cellKey, type Take } from "@/lib/types";
import type { CellStatus } from "../generation-queue";
import { player, Track } from "../player";
import { ReadyView } from "../ready-view";
import { RowCard, type LangView, type TakeAction } from "../review";
import { TakeUrlContext } from "../take-url";
import { DEMO_PROJECT, demoTakeUrl } from "./story-data";

/** Runs `onEnter` once, the first time the element scrolls into view. */
function useInView<T extends Element>(onEnter: () => void, threshold = 0.35) {
  const ref = useRef<T>(null);
  const cb = useRef(onEnter);
  useEffect(() => {
    cb.current = onEnter;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        cb.current();
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades content up as it enters, once. Static for reduced motion. */
export function Reveal({ children, className = "", delay = 0, id }: { children: React.ReactNode; className?: string; delay?: number; id?: string }) {
  const [shown, setShown] = useState(false);
  const ref = useInView<HTMLDivElement>(() => setShown(true), 0.05);
  return (
    <div
      ref={ref}
      id={id}
      // Short, small rise: enough to feel content arrive, light enough to never lag behind the scroll.
      className={`scroll-mt-20 transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** A number that counts up when it scrolls into view. */
export function CountUp({ to, duration = 1400, className = "" }: { to: number; duration?: number; className?: string }) {
  const [value, setValue] = useState(0);
  const ref = useInView<HTMLSpanElement>(() => {
    if (reducedMotion()) return setValue(to);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {value.toLocaleString("pt-BR")}
    </span>
  );
}

/**
 * The queue as it looks mid-run (the app's floating dock, simplified): plays through a
 * 1.024-take batch when it scrolls into view.
 */
export function QueueStory({ total, credits }: { total: number; credits: number }) {
  const [done, setDone] = useState(0);
  // Plays on scroll, so it stays silent: cues only answer something the visitor did.
  const ref = useInView<HTMLDivElement>(() => {
    if (reducedMotion()) {
      setDone(total);
      return;
    }
    const start = performance.now();
    const run = (now: number) => {
      const t = Math.min(1, (now - start) / 4200);
      setDone(Math.round(total * t));
      if (t < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  });
  const pct = (done / total) * 100;
  const finished = done >= total;
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <div ref={ref} className="w-full max-w-sm rounded-2xl border border-white/70 bg-white shadow-2xl shadow-stone-900/10 ring-1 ring-stone-900/5">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center">
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" className="stroke-stone-200" />
            <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className={finished ? "stroke-emerald-500" : "stroke-[#e4572e]"} />
          </svg>
          <span className="absolute text-[10px] font-semibold tabular-nums text-stone-700">{finished ? "✓" : `${Math.round(pct)}%`}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-900">{finished ? `${total.toLocaleString("pt-BR")} takes gerados` : `Gerando ${(done + 1).toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`}</div>
          <div className="text-xs tabular-nums text-stone-500">
            {finished ? "0 na fila" : `3 em andamento · ${(total - done - 3 > 0 ? total - done - 3 : 0).toLocaleString("pt-BR")} na fila`} · {done.toLocaleString("pt-BR")} prontos
          </div>
        </div>
      </div>
      <div className="h-1 bg-stone-100">
        <div className={`h-full ${finished ? "bg-emerald-500" : "bg-[#e4572e]"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 text-xs text-stone-500">
        <span>Custo estimado antes do clique</span>
        <span className="rounded-md bg-[#fff4ee] px-1.5 py-0.5 font-mono text-[11px] text-[#b4431f] ring-1 ring-[#f6d5c6]">≈ {credits.toLocaleString("pt-BR")} créditos</span>
      </div>
    </div>
  );
}

const LANGS: LangView[] = DEMO_PROJECT.languages.map((l, i) => ({ ...l, color: i }));

/** The app's real review card, over the original takes. Approvals are local to the page. */
export function ReviewStory() {
  const [takes, setTakes] = useState<Take[]>(DEMO_PROJECT.takes);
  const [approved, setApproved] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Map<string, CellStatus>>(new Map());

  const onTake = (take: Take, action: TakeAction) => {
    const k = cellKey(take.rowId, take.langKey);
    sfx(action === "approve" ? "success" : action === "reject" ? "whisper" : "release");
    setApproved((a) => {
      const next = { ...a };
      if (action === "approve") next[k] = take.id;
      if ((action === "unapprove" || action === "reject") && next[k] === take.id) delete next[k];
      return next;
    });
    setTakes((ts) => ts.map((t) => (t.id !== take.id ? t : { ...t, rejected: action === "reject" ? true : action === "unreject" || action === "approve" ? false : t.rejected })));
  };

  // "+1 take" here only shows the queue state; on the page nothing is sent to ElevenLabs.
  const onGenerate = (rowId: string, langKeys: string[]) => {
    setStatus((m) => {
      const next = new Map(m);
      for (const lk of langKeys) next.set(cellKey(rowId, lk), { queued: 0, running: 1 });
      return next;
    });
    setTimeout(() => {
      sfx("droplet", 0.6);
      setStatus((m) => {
        const next = new Map(m);
        for (const lk of langKeys) next.delete(cellKey(rowId, lk));
        return next;
      });
    }, 1400);
  };

  const row = DEMO_PROJECT.rows[0];
  const sig = JSON.stringify([approved, takes.map((t) => t.rejected), [...status]]);
  const byLang = new Map<string, Take[]>();
  for (const t of takes) if (t.rowId === row.id) byLang.set(t.langKey, [...(byLang.get(t.langKey) ?? []), t]);

  return (
    <TakeUrlContext value={demoTakeUrl}>
      <RowCard
        projectId="demo"
        row={row}
        sig={sig}
        languages={LANGS}
        metaColumns={DEMO_PROJECT.metaColumns}
        takes={byLang}
        approved={approved}
        status={status}
        selected={false}
        variations={2}
        onSelect={() => undefined}
        onSelectFrom={() => undefined}
        onGenerate={onGenerate}
        onTake={onTake}
      />
    </TakeUrlContext>
  );
}

/** The app's real "Prontos" view: approved files per ID, exactly as they land in output/. */
export function ReadyStory({ onReviewHref }: { onReviewHref: string }) {
  return (
    <TakeUrlContext value={demoTakeUrl}>
      <ReadyView
        project={DEMO_PROJECT}
        languages={LANGS}
        onReview={() => document.querySelector(onReviewHref)?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" })}
      />
    </TakeUrlContext>
  );
}

const HERO_TAKES = [
  { lang: 0, file: "perg_022-pt-2.mp3" },
  { lang: 1, file: "perg_022-en-1.mp3" },
  { lang: 2, file: "perg_022-es-1.mp3" },
  { lang: 3, file: "perg_022-ar-1.mp3" },
];

/** Hero product shot: one line of dialogue, approved in four languages, playable (original takes). */
export function HeroPlayer() {
  const row = DEMO_PROJECT.rows[1];
  const urls = HERO_TAKES.map((t) => `/landing/audio/${t.file}`);
  return (
    <div className="bg-[#faf9f7] p-3 sm:p-4">
      <section className="card overflow-hidden text-left">
        <header className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
          <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[13px] font-semibold text-stone-800">{row.id}</span>
          <span className="truncate text-xs text-stone-500">4 idiomas · aprovados · salvos em output/</span>
          <button onClick={() => player.playAll(urls)} className="btn-secondary ml-auto px-2.5 py-1 text-xs">
            ▶ Tocar tudo
          </button>
        </header>
        <ul className="divide-y divide-stone-100">
          {HERO_TAKES.map((t) => {
            const lang = LANGS[t.lang];
            return (
              <li key={t.file} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`w-9 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold uppercase ring-1 ${langColor(lang.color).chip}`}>{lang.code}</span>
                <div className="min-w-0 flex-1">
                  <Track url={`/landing/audio/${t.file}`} tone="emerald" title={<span dir="auto" className="font-normal text-stone-700">{row.texts[lang.key]}</span>} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
