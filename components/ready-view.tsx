"use client";

import { useMemo, useState } from "react";
import { langColor } from "@/lib/lang-colors";
import { exportFileName } from "@/lib/naming";
import type { Project, Take } from "@/lib/types";
import { player, Track } from "./player";
import { useTakeUrl } from "./take-url";
import type { LangView } from "./review";
import { useIncremental } from "./use-incremental";

type Filter = "all" | "complete" | "incomplete";

/** The approved audios, organised exactly like the export folder: one card per ID, one file per language. */
export function ReadyView({ project, languages, onReview }: { project: Project; languages: LangView[]; onReview: (rowId: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const takeById = useMemo(() => new Map(project.takes.map((t) => [t.id, t])), [project.takes]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return project.rows
      .map((row) => {
        const langs = languages.filter((l) => row.texts[l.key]?.trim());
        const files = langs.map((l) => {
          const id = project.approved[`${row.id}::${l.key}`];
          return { lang: l, take: id ? takeById.get(id) : undefined };
        });
        return { row, files, done: files.filter((f) => f.take).length };
      })
      .filter(({ row, files, done }) => {
        if (!files.length) return false;
        if (q && !row.id.toLowerCase().includes(q) && !Object.values(row.texts).some((t) => t.toLowerCase().includes(q))) return false;
        if (filter === "complete") return done === files.length;
        if (filter === "incomplete") return done < files.length;
        return true;
      });
  }, [project.rows, project.approved, languages, takeById, search, filter]);

  const summary = useMemo(() => {
    let ids = 0, complete = 0, files = 0, approved = 0;
    for (const row of project.rows) {
      const langs = languages.filter((l) => row.texts[l.key]?.trim());
      if (!langs.length) continue;
      ids++;
      files += langs.length;
      const ok = langs.filter((l) => project.approved[`${row.id}::${l.key}`]).length;
      approved += ok;
      if (ok === langs.length) complete++;
    }
    return { ids, complete, files, approved };
  }, [project.rows, project.approved, languages]);

  const { visible, sentinel } = useIncremental(items.length, `${filter}|${search}`);
  const takeUrl = useTakeUrl();
  const url = (t: Take) => takeUrl(project.id, t);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <Stat label="IDs completos" value={summary.complete} total={summary.ids} />
        <Stat label="Áudios aprovados" value={summary.approved} total={summary.files} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[["all", "Todos"], ["complete", "Completos"], ["incomplete", "Faltando"]]}
          />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ID ou frase…" className="input w-52" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {items.slice(0, visible).map(({ row, files, done }) => {
          const complete = done === files.length;
          const ready = files.flatMap((f) => (f.take ? [url(f.take)] : []));
          return (
            <section key={row.id} className="card overflow-hidden">
              <header className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
                <span className={`flex size-9 items-center justify-center rounded-xl ${complete ? "bg-emerald-50 text-emerald-600" : "bg-stone-100 text-stone-400"}`}>
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h3.6a2 2 0 0 1 1.4.6L12 6h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold text-stone-800">{row.id}</div>
                  <div className="truncate text-xs text-stone-500">
                    {project.metaColumns.map((c) => row.meta[c]).filter(Boolean).join(" · ") || `${files.length} idiomas`}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {done}/{files.length}
                </span>
                <button
                  disabled={!ready.length}
                  onClick={() => player.playAll(ready)}
                  className="btn-secondary px-2.5 py-1 text-xs"
                  title="Ouvir todos os idiomas em sequência"
                >
                  ▶ Tocar tudo
                </button>
              </header>
              <ul className="divide-y divide-stone-100">
                {files.map(({ lang, take }) => (
                  <li key={lang.key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`w-9 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold uppercase ring-1 ${langColor(lang.color).chip}`}>
                      {lang.code}
                    </span>
                    {take ? (
                      <div className="min-w-0 flex-1">
                        <Track
                          url={url(take)}
                          tone="emerald"
                          title={<span dir="auto" className="font-normal text-stone-700">{exportFileName(project.languages, row, lang.key, extOf(take))}</span>}
                          trailing={
                            <a href={`${url(take)}?download=1`} download title="Baixar" className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
                              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                              </svg>
                            </a>
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span dir="auto" className="min-w-0 flex-1 truncate text-sm text-stone-400">{row.texts[lang.key]}</span>
                        <button onClick={() => onReview(row.id)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50">
                          Revisar →
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {sentinel}
      {!items.length && <p className="py-16 text-center text-sm text-stone-500">Nada por aqui ainda. Aprove takes na aba Revisar.</p>}
    </div>
  );
}

const extOf = (t: Take) => t.file.slice(t.file.lastIndexOf("."));

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total ? (value / total) * 100 : 0;
  return (
    <div className="min-w-44">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-xl font-semibold tracking-tight tabular-nums text-stone-900">
        {value} <span className="text-sm font-normal text-stone-400">/ {total}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: readonly (readonly [T, React.ReactNode])[] }) {
  return (
    <div className="inline-flex rounded-lg bg-stone-100 p-0.5 text-sm">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1 font-medium transition ${value === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
