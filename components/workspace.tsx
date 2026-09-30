"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { langColor } from "@/lib/lang-colors";
import { sfx } from "@/lib/sfx";
import { billableChars, cellKey, creditsPerChar, type ApprovalChange, type Language, type Project, type Settings, type Take } from "@/lib/types";
import { useGenerationQueue, type CellStatus } from "./generation-queue";
import { QueueDock } from "./queue-dock";
import { ReadyView, Segmented } from "./ready-view";
import { RowCard, type LangView, type TakeAction } from "./review";
import { DriveChip, DriveModal, useDriveStatus } from "./drive-sync";
import { ProjectMenu, renameProject } from "./project-actions";
import { SettingsModal } from "./settings-modal";
import { SoundToggle } from "./sound-toggle";
import { useIncremental } from "./use-incremental";

type Filter = "all" | "pending" | "review" | "approved";
type Cell = { rowId: string; langKey: string };

/** Stable function identity that always calls the latest closure (keeps memoized rows from re-rendering). */
function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}

export function Workspace({ initial }: { initial: Project }) {
  const [project, setProject] = useState(initial);
  const router = useRouter();
  const hasVoice = !!initial.settings.defaultVoiceId || initial.languages.some((l) => l.voiceId);
  const [settingsOpen, setSettingsOpen] = useState(!hasVoice);
  const [notice, setNotice] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ message: string; changes: ApprovalChange[] } | null>(null);
  const [tab, setTab] = useState<"review" | "ready">("review");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [hiddenLangs, setHiddenLangs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const [credits, setCredits] = useState<{ remaining: number; tier: string } | null>(null);
  const [driveOpen, setDriveOpen] = useState(false);

  const id = project.id;

  // ---- persistence -------------------------------------------------------

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingPatch = useRef<{ settings?: Partial<Settings>; languages?: Language[] }>({});

  /** Sends debounced settings right away, so a generation never runs with stale voice settings. */
  const flush = useStableCallback(async () => {
    clearTimeout(saveTimer.current);
    const body = pendingPatch.current;
    if (!body.settings && !body.languages) return;
    pendingPatch.current = {};
    const res = await fetch(`/api/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!res.ok) setNotice((await res.json()).error);
  });

  const persist = (patch: { settings?: Partial<Settings>; languages?: Language[] }) => {
    pendingPatch.current = {
      settings: patch.settings ? { ...pendingPatch.current.settings, ...patch.settings } : pendingPatch.current.settings,
      languages: patch.languages ?? pendingPatch.current.languages,
    };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), 400);
  };

  const updateSettings = (patch: Partial<Settings>) => {
    setProject((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
    persist({ settings: patch });
  };

  const updateLanguage = (key: string, patch: Partial<Language>) => {
    const languages = project.languages.map((l) => (l.key === key ? { ...l, ...patch } : l));
    setProject((p) => ({ ...p, languages }));
    persist({ languages });
  };

  const refreshCredits = useCallback(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setCredits(c))
      .catch(() => undefined);
  }, []);
  useEffect(refreshCredits, [refreshCredits]);

  // ---- Google Drive --------------------------------------------------------

  const drive = useDriveStatus(project.id);

  // Back from Google sign-in (?drive=connected|denied|…): reopen the Drive modal and say how it went.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("drive");
    if (!result) return;
    params.delete("drive");
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
    const messages: Record<string, string> = {
      denied: "Acesso ao Google Drive não autorizado.",
      invalid: "A conexão com o Google expirou. Tente de novo.",
      "no-refresh-token": "O Google não devolveu acesso permanente. Remova o app em myaccount.google.com/permissions e conecte de novo.",
      error: "Não foi possível conectar ao Google Drive.",
    };
    // Deferred so the state updates don't run synchronously inside the effect.
    setTimeout(() => {
      setDriveOpen(true);
      if (result === "connected") sfx("success");
      else setNotice(messages[result] ?? messages.error);
      void drive.refresh();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- queue -------------------------------------------------------------

  const q = useGenerationQueue(id, project.settings.concurrency, {
    beforeRun: flush,
    onTake: (take) => setProject((p) => ({ ...p, takes: [...p.takes, take] })),
    // A take you asked for on the phrase in front of you: a soft cue that it's ready to hear.
    onPriorityTake: () => sfx("droplet", 0.6),
    onIdle: refreshCredits,
    onRunComplete: ({ error }) => sfx(error ? "error" : "ready"),
    onFatal: () => sfx("error"),
  });

  // ---- derived views -----------------------------------------------------

  const langViews = useMemo<LangView[]>(
    () => project.languages.map((l, i) => ({ ...l, color: i })).filter((l) => !hiddenLangs.includes(l.key)),
    [project.languages, hiddenLangs],
  );
  const allLangViews = useMemo<LangView[]>(() => project.languages.map((l, i) => ({ ...l, color: i })), [project.languages]);

  const takesByRow = useMemo(() => {
    const map = new Map<string, Map<string, Take[]>>();
    for (const t of project.takes) {
      const row = map.get(t.rowId) ?? new Map<string, Take[]>();
      row.set(t.langKey, [...(row.get(t.langKey) ?? []), t]);
      map.set(t.rowId, row);
    }
    return map;
  }, [project.takes]);

  const stateOf = useCallback(
    (rowId: string, langKey: string) => {
      if (project.approved[cellKey(rowId, langKey)]) return "approved" as const;
      return takesByRow.get(rowId)?.get(langKey)?.some((t) => !t.rejected) ? ("review" as const) : ("pending" as const);
    },
    [project.approved, takesByRow],
  );

  const rows = useMemo(() => {
    const qs = search.trim().toLowerCase();
    return project.rows.filter((r) => {
      const langs = langViews.filter((l) => r.texts[l.key]?.trim());
      if (!langs.length) return false;
      if (qs && !r.id.toLowerCase().includes(qs) && !Object.values(r.texts).some((t) => t.toLowerCase().includes(qs))) return false;
      return filter === "all" || langs.some((l) => stateOf(r.id, l.key) === filter);
    });
  }, [project.rows, langViews, search, filter, stateOf]);

  const stats = useMemo(() => {
    const s = { total: 0, approved: 0, pending: 0, review: 0 };
    for (const r of project.rows)
      for (const l of langViews) {
        if (!r.texts[l.key]?.trim()) continue;
        s.total++;
        s[stateOf(r.id, l.key)]++;
      }
    return s;
  }, [project.rows, langViews, stateOf]);

  const perLang = useMemo(
    () =>
      new Map(
        project.languages.map((l) => {
          const cells = project.rows.filter((r) => r.texts[l.key]?.trim());
          return [l.key, { total: cells.length, approved: cells.filter((r) => project.approved[cellKey(r.id, l.key)]).length }];
        }),
      ),
    [project.languages, project.rows, project.approved],
  );

  const busy = (k: string) => {
    const s = q.byCell.get(k);
    return !!s && s.queued + s.running > 0;
  };

  /** Signature of everything a row shows, so only rows that actually changed re-render. */
  const sigOf = (rowId: string) => {
    const t = takesByRow.get(rowId);
    let sig = "";
    for (const l of langViews) {
      const k = cellKey(rowId, l.key);
      const s = q.byCell.get(k);
      sig += `${l.key}:${project.approved[k] ?? ""}:${t?.get(l.key)?.map((x) => x.id + (x.rejected ? "r" : "")).join(",") ?? ""}:${s ? `${s.queued}.${s.running}.${s.error ?? ""}` : ""}|`;
    }
    return sig;
  };

  const inc = useIncremental(rows.length, `${filter}|${search}|${hiddenLangs.join()}`);

  // ---- selection ---------------------------------------------------------

  const onSelect = useStableCallback((rowId: string, range: boolean) => {
    sfx(range ? "scan" : "tick");
    const ids = rows.map((r) => r.id);
    setSelected((prev) => {
      const next = new Set(prev);
      const from = anchor.current ? ids.indexOf(anchor.current) : -1;
      const to = ids.indexOf(rowId);
      if (range && from >= 0 && to >= 0) {
        // Shift+click: select everything between the last clicked row and this one.
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(ids[i]);
      } else if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    anchor.current = rowId;
  });

  const selectIds = (ids: string[], replace = true) => setSelected((prev) => new Set(replace ? ids : [...prev, ...ids]));

  const onSelectFrom = useStableCallback((rowId: string) => {
    const i = rows.findIndex((r) => r.id === rowId);
    selectIds(rows.slice(i).map((r) => r.id));
    sfx("scan");
    anchor.current = rowId;
  });

  function selectRange(fromId: string, toId: string) {
    const ids = rows.map((r) => r.id);
    const find = (v: string) => ids.findIndex((x) => x.toLowerCase() === v.trim().toLowerCase());
    const a = fromId.trim() ? find(fromId) : 0;
    const b = toId.trim() ? find(toId) : ids.length - 1;
    if (a < 0 || b < 0) return setNotice(`ID não encontrado nos resultados: ${a < 0 ? fromId : toId}`);
    selectIds(ids.slice(Math.min(a, b), Math.max(a, b) + 1));
    sfx("scan");
    setNotice(null);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !settingsOpen) setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settingsOpen]);

  // ---- generation --------------------------------------------------------

  function enqueue(cells: Cell[], n: number, priority = false) {
    if (!cells.length) return;
    const missing = project.languages.filter(
      (l) => !l.voiceId && !project.settings.defaultVoiceId && cells.some((c) => c.langKey === l.key),
    );
    if (missing.length) {
      sfx("pulse");
      setNotice(`Escolha uma voz para: ${missing.map((l) => l.key).join(", ")}`);
      setSettingsOpen(true);
      return;
    }
    setNotice(null);
    // Bulk runs get a start cue; single-phrase requests stay quiet until their take arrives.
    if (!priority) sfx("loading");
    void q.queue.add(cells.flatMap((c) => Array.from({ length: n }, () => c)), { priority });
  }

  const cellsOf = (rowIds: Iterable<string>, onlyPending: boolean) => {
    const set = new Set(rowIds);
    return project.rows
      .filter((r) => set.has(r.id))
      .flatMap((r) =>
        langViews
          .filter((l) => r.texts[l.key]?.trim() && !busy(cellKey(r.id, l.key)) && (!onlyPending || stateOf(r.id, l.key) === "pending"))
          .map((l) => ({ rowId: r.id, langKey: l.key })),
      );
  };

  const pendingAll = cellsOf(rows.map((r) => r.id), true);
  const pendingSelected = cellsOf(selected, true);
  const allSelected = cellsOf(selected, false);

  // ---- bulk approve --------------------------------------------------------

  /** Selected cells with no approval yet but at least one take still in play. */
  const approvable = useMemo(() => {
    const out: { rowId: string; langKey: string; first: string; last: string }[] = [];
    for (const r of project.rows) {
      if (!selected.has(r.id)) continue;
      for (const l of langViews) {
        if (project.approved[cellKey(r.id, l.key)]) continue;
        const live = (takesByRow.get(r.id)?.get(l.key) ?? []).filter((t) => !t.rejected);
        if (live.length) out.push({ rowId: r.id, langKey: l.key, first: live[0].id, last: live.at(-1)!.id });
      }
    }
    return out;
  }, [project.rows, project.approved, selected, langViews, takesByRow]);

  const approvedInSelection = useMemo(
    () =>
      project.rows
        .filter((r) => selected.has(r.id))
        .flatMap((r) => langViews.filter((l) => project.approved[cellKey(r.id, l.key)]).map((l) => ({ rowId: r.id, langKey: l.key }))),
    [project.rows, project.approved, selected, langViews],
  );

  /** Applies approval changes optimistically, persists them in one request, and offers undo. */
  async function applyApprovals(changes: ApprovalChange[], message: string | null) {
    if (!changes.length) return;
    const before = changes.map((c) => ({ ...c, takeId: project.approved[cellKey(c.rowId, c.langKey)] ?? null }));
    const approvedIds = new Set(changes.flatMap((c) => (c.takeId ? [c.takeId] : [])));
    setProject((p) => {
      const approved = { ...p.approved };
      for (const c of changes) {
        if (c.takeId) approved[cellKey(c.rowId, c.langKey)] = c.takeId;
        else delete approved[cellKey(c.rowId, c.langKey)];
      }
      // The server un-discards approved takes; mirror that locally.
      return { ...p, approved, takes: p.takes.map((t) => (approvedIds.has(t.id) && t.rejected ? { ...t, rejected: undefined } : t)) };
    });
    const res = await fetch(`/api/projects/${id}/approvals`, { method: "PUT", body: JSON.stringify({ changes }) });
    if (!res.ok) {
      setProject((p) => {
        const approved = { ...p.approved };
        for (const c of before) {
          if (c.takeId) approved[cellKey(c.rowId, c.langKey)] = c.takeId;
          else delete approved[cellKey(c.rowId, c.langKey)];
        }
        return { ...p, approved };
      });
      sfx("error");
      setNotice((await res.json()).error ?? "Não foi possível salvar as aprovações.");
      return;
    }
    sfx(changes.some((c) => c.takeId) ? "success" : "release");
    setUndo(message ? { message, changes: before } : null);
  }

  const bulkApprove = (which: "first" | "last") =>
    applyApprovals(
      approvable.map((c) => ({ rowId: c.rowId, langKey: c.langKey, takeId: which === "first" ? c.first : c.last })),
      `${approvable.length} ${approvable.length === 1 ? "frase aprovada" : "frases aprovadas"} (${which === "first" ? "1º" : "último"} take)`,
    );

  const bulkClear = () =>
    applyApprovals(
      approvedInSelection.map((c) => ({ ...c, takeId: null })),
      `${approvedInSelection.length} ${approvedInSelection.length === 1 ? "aprovação removida" : "aprovações removidas"}`,
    );

  // The undo offer fades after a while; it only makes sense right after the action.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  // ---- credit estimate ---------------------------------------------------

  const rowById = useMemo(() => new Map(project.rows.map((r) => [r.id, r])), [project.rows]);

  /**
   * Real credits per character already charged for each model + voice, from the `character-cost`
   * stored on past takes. Captures library voices with a credit multiplier, which list prices miss.
   */
  const observedRate = useMemo(() => {
    const acc = new Map<string, { cost: number; chars: number }>();
    for (const t of project.takes) {
      const text = rowById.get(t.rowId)?.texts[t.langKey];
      if (!t.characterCost || !text) continue;
      const k = `${t.modelId}|${t.voiceId}`;
      const a = acc.get(k) ?? { cost: 0, chars: 0 };
      a.cost += t.characterCost;
      a.chars += billableChars(text);
      acc.set(k, a);
    }
    return new Map([...acc].map(([k, a]) => [k, a.cost / a.chars]));
  }, [project.takes, rowById]);

  const estimateCredits = (cells: Cell[], takes: number) => {
    const { modelId, defaultVoiceId } = project.settings;
    let total = 0;
    for (const c of cells) {
      const text = rowById.get(c.rowId)?.texts[c.langKey] ?? "";
      const voice = project.languages.find((l) => l.key === c.langKey)?.voiceId || defaultVoiceId;
      const rate = observedRate.get(`${modelId}|${voice}`) ?? creditsPerChar(modelId);
      total += billableChars(text) * rate * takes;
    }
    return Math.ceil(total);
  };

  const costPendingAll = estimateCredits(pendingAll, project.settings.variations);
  const costPendingSelected = estimateCredits(pendingSelected, project.settings.variations);
  const costOneMoreSelected = estimateCredits(allSelected, 1);

  const onGenerate = useStableCallback((rowId: string, langKeys: string[], n: number, priority: boolean) =>
    enqueue(langKeys.map((langKey) => ({ rowId, langKey })), n, priority),
  );

  // ---- review ------------------------------------------------------------

  const onTake = useStableCallback(async (take: Take, action: TakeAction) => {
    // Cue on press, not on the server round-trip: approve = success, discard = soft whisper.
    sfx(action === "approve" ? "success" : action === "reject" ? "whisper" : "release");
    const res = await fetch(`/api/projects/${id}/takes/${take.id}`, { method: "PATCH", body: JSON.stringify({ action }) });
    const json = await res.json();
    if (!res.ok) {
      sfx("error");
      return setNotice(json.error);
    }
    const k = cellKey(take.rowId, take.langKey);
    setProject((p) => {
      const approved = { ...p.approved };
      if (json.approvedTakeId) approved[k] = json.approvedTakeId;
      else delete approved[k];
      return { ...p, approved, takes: p.takes.map((t) => (t.id === take.id ? json.take : t)) };
    });
  });

  const toggleLang = (key: string, solo: boolean) => {
    sfx("toggle");
    setHiddenLangs((h) => {
      if (solo) return project.languages.map((l) => l.key).filter((k) => k !== key);
      const next = h.includes(key) ? h.filter((k) => k !== key) : [...h, key];
      return next.length === project.languages.length ? h : next; // keep at least one language
    });
  };

  const openSettings = () => {
    sfx("page");
    setSettingsOpen(true);
  };

  const totalAll = [...perLang.values()].reduce((a, b) => a + b.total, 0);
  const approvedAll = [...perLang.values()].reduce((a, b) => a + b.approved, 0);

  return (
    <div className="flex min-h-full flex-col">
      <header className="glass sticky top-0 z-20 border-b border-stone-200/70 bg-white/75 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="btn-ghost -ml-2 px-2" aria-label="Voltar aos projetos">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M10 3 5 8l5 5" /></svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-0.5">
              <EditableTitle
                name={project.name}
                onSave={async (name) => {
                  await renameProject(id, name);
                  setProject((p) => ({ ...p, name }));
                  sfx("success");
                }}
              />
              <ProjectMenu
                id={id}
                name={project.name}
                onRenamed={(name) => setProject((p) => ({ ...p, name }))}
                onDeleted={() => {
                  q.queue.cancelAll();
                  router.replace("/dashboard");
                  router.refresh();
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-stone-100">
                <span className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500" style={{ width: `${totalAll ? (approvedAll / totalAll) * 100 : 0}%` }} />
              </span>
              <span className="tabular-nums">{approvedAll}/{totalAll} aprovados</span>
            </div>
          </div>

          <Segmented
            value={tab}
            onChange={(t) => {
              sfx("page");
              setTab(t);
            }}
            options={[
              ["review", "Gerar e revisar"],
              ["ready", <>Prontos <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-xs text-emerald-700 tabular-nums">{approvedAll}</span></>],
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {credits && (
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums text-stone-600" title={`Plano ${credits.tier}`}>
                {credits.remaining.toLocaleString("pt-BR")} créditos
              </span>
            )}
            <SoundToggle />
            <button onClick={openSettings} className="btn-secondary">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
              Configurações
            </button>
            <DriveChip
              status={drive.status}
              onClick={() => {
                sfx("page");
                setDriveOpen(true);
              }}
            />
            <a href={`/api/projects/${id}/export`} onClick={() => sfx("sparkle")} className={`btn-secondary ${approvedAll ? "" : "pointer-events-none opacity-40"}`}>
              Baixar ZIP
            </a>
          </div>
        </div>

        {tab === "review" && (
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-3 sm:px-6">
            <div className="flex items-center gap-1" title="Clique: liga/desliga · Duplo clique: só este idioma">
              {project.languages.map((l, i) => {
                const on = !hiddenLangs.includes(l.key);
                const s = perLang.get(l.key)!;
                return (
                  <button
                    key={l.key}
                    onClick={() => toggleLang(l.key, false)}
                    onDoubleClick={() => toggleLang(l.key, true)}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition active:scale-[0.97] ${
                      on ? `ring-1 ${langColor(i).chip}` : "bg-white text-stone-400 ring-1 ring-stone-200 hover:text-stone-600"
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${on ? langColor(i).dot : "bg-stone-300"}`} />
                    <span className="uppercase">{l.code}</span>
                    <span className="tabular-nums opacity-70">{s.approved}/{s.total}</span>
                  </button>
                );
              })}
              {hiddenLangs.length > 0 && (
                <button onClick={() => setHiddenLangs([])} className="px-1.5 text-xs text-stone-500 hover:text-stone-800">
                  todos
                </button>
              )}
            </div>

            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                ["all", "Todas"],
                ["pending", <>Sem áudio <Count n={stats.pending} /></>],
                ["review", <>Revisar <Count n={stats.review} tone="amber" /></>],
                ["approved", <>Aprovadas <Count n={stats.approved} tone="emerald" /></>],
              ]}
            />

            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar ID ou frase…" className="input w-48" />

            <RangeSelect ids={rows.map((r) => r.id)} onSelect={selectRange} />
            <button
              onClick={() => {
                selectIds(rows.map((r) => r.id));
                sfx("scan");
              }}
              className="btn-ghost px-2 text-xs"
            >
              Selecionar todas ({rows.length})
            </button>

            <button
              onClick={() => enqueue(pendingAll, project.settings.variations)}
              disabled={!pendingAll.length}
              className="btn-primary ml-auto"
              title={creditTitle(costPendingAll, credits?.remaining)}
            >
              Gerar pendentes ({pendingAll.length} × {project.settings.variations})
              {pendingAll.length > 0 && <CreditTag cost={costPendingAll} remaining={credits?.remaining} onPrimary />}
            </button>
          </div>
        )}
        {notice && !settingsOpen && (
          <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between">
              {notice}
              <button onClick={() => setNotice(null)} aria-label="Fechar aviso">✕</button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 pb-40 sm:px-6">
        {tab === "review" ? (
          <div className="space-y-4">
            {rows.slice(0, inc.visible).map((row) => (
              <RowCard
                key={row.id}
                projectId={id}
                row={row}
                sig={sigOf(row.id)}
                languages={langViews}
                metaColumns={project.metaColumns}
                takes={takesByRow.get(row.id) ?? EMPTY_TAKES}
                approved={project.approved}
                status={q.byCell as Map<string, CellStatus>}
                selected={selected.has(row.id)}
                variations={project.settings.variations}
                onSelect={onSelect}
                onSelectFrom={onSelectFrom}
                onGenerate={onGenerate}
                onTake={onTake}
              />
            ))}
            {inc.sentinel}
            {!rows.length && <p className="py-20 text-center text-sm text-stone-500">Nenhuma frase neste filtro.</p>}
          </div>
        ) : (
          <ReadyView
            project={project}
            languages={allLangViews}
            onReview={(rowId) => {
              setTab("review");
              setFilter("all");
              setSearch(rowId);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </main>

      {selected.size > 0 && tab === "review" && (
        <div className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 ${q.counts.total ? "lg:pr-[26rem]" : ""}`}>
          <div
            className="glass pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/85 py-2 pr-2 pl-4 shadow-2xl shadow-stone-900/15 ring-1 ring-stone-900/5 backdrop-blur-xl"
            style={{ animation: "rise-in 240ms cubic-bezier(0.2,0.9,0.3,1)" }}
          >
            <span className="text-sm font-semibold tabular-nums text-stone-900">
              {selected.size} {selected.size === 1 ? "ID selecionado" : "IDs selecionados"}
            </span>
            <span className="text-xs text-stone-400">em {langViews.map((l) => l.code.toUpperCase()).join(" · ")}</span>
            <span className="mx-1 h-5 w-px bg-stone-200" />
            <button
              onClick={() => enqueue(pendingSelected, project.settings.variations)}
              disabled={!pendingSelected.length}
              className="btn-primary"
              title={creditTitle(costPendingSelected, credits?.remaining)}
            >
              Gerar pendentes ({pendingSelected.length} × {project.settings.variations})
              {pendingSelected.length > 0 && <CreditTag cost={costPendingSelected} remaining={credits?.remaining} onPrimary />}
            </button>
            <button
              onClick={() => enqueue(allSelected, 1)}
              disabled={!allSelected.length}
              className="btn-secondary"
              title={`Um take novo para cada frase selecionada. ${creditTitle(costOneMoreSelected, credits?.remaining)}`}
            >
              +1 take em tudo ({allSelected.length})
              {allSelected.length > 0 && <CreditTag cost={costOneMoreSelected} remaining={credits?.remaining} />}
            </button>
            {credits && (
              <span className="px-1 text-xs tabular-nums text-stone-500">
                saldo {credits.remaining.toLocaleString("pt-BR")}
              </span>
            )}
            <BulkApproveMenu
              approvable={approvable.length}
              approved={approvedInSelection.length}
              onApprove={bulkApprove}
              onClear={bulkClear}
            />
            <button onClick={() => setSelected(new Set())} className="btn-ghost" title="Limpar seleção (Esc)">
              Limpar
            </button>
          </div>
        </div>
      )}

      {undo && (
        <div
          role="status"
          className="glass fixed bottom-4 left-4 z-40 flex items-center gap-3 rounded-xl border border-white/70 bg-stone-900/95 py-2 pr-2 pl-4 text-sm text-white shadow-2xl"
          style={{ animation: "rise-in 220ms cubic-bezier(0.2,0.9,0.3,1)" }}
        >
          {undo.message}
          <button
            onClick={() => {
              const changes = undo.changes;
              setUndo(null);
              void applyApprovals(changes, null);
            }}
            className="rounded-lg bg-white/10 px-2.5 py-1 font-medium transition hover:bg-white/20 active:scale-95"
          >
            Desfazer
          </button>
          <button onClick={() => setUndo(null)} aria-label="Fechar" className="px-1 text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <QueueDock
        q={q}
        project={project}
        onConcurrency={(n) => updateSettings({ concurrency: Math.max(1, Math.min(30, n)) })}
        onShowReview={() => {
          setTab("review");
          setFilter("review");
          q.queue.dismissFinished();
        }}
      />

      <DriveModal
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        projectId={id}
        status={drive.status}
        setStatus={drive.setStatus}
        refresh={drive.refresh}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          void flush();
        }}
        notice={notice}
        settings={project.settings}
        languages={project.languages}
        onSettings={updateSettings}
        onLanguage={updateLanguage}
      />
    </div>
  );
}

const EMPTY_TAKES = new Map<string, Take[]>();

const fmt = (n: number) => n.toLocaleString("pt-BR");

function creditTitle(cost: number, remaining?: number) {
  if (remaining === undefined) return `Estimativa: ${fmt(cost)} créditos`;
  return cost > remaining
    ? `Estimativa: ${fmt(cost)} créditos — faltam ${fmt(cost - remaining)} (saldo ${fmt(remaining)})`
    : `Estimativa: ${fmt(cost)} créditos · sobram ${fmt(remaining - cost)} de ${fmt(remaining)}`;
}

/** "≈ 520 cr" inside a generate button; turns amber/red when the balance does not cover it. */
function CreditTag({ cost, remaining, onPrimary }: { cost: number; remaining?: number; onPrimary?: boolean }) {
  const short = remaining !== undefined && cost > remaining;
  const cls = short
    ? "bg-rose-100 text-rose-700"
    : onPrimary
      ? "bg-white/20 text-white"
      : "bg-stone-100 text-stone-600";
  return (
    <span className={`ml-1 rounded-md px-1.5 py-px text-[11px] font-medium tabular-nums ${cls}`}>
      ≈ {fmt(cost)} créditos{short ? " · saldo insuficiente" : ""}
    </span>
  );
}

function Count({ n, tone = "slate" }: { n: number; tone?: "slate" | "amber" | "emerald" }) {
  const cls = { slate: "bg-stone-200/70 text-stone-600", amber: "bg-amber-100 text-amber-700", emerald: "bg-emerald-100 text-emerald-700" }[tone];
  return <span className={`ml-1 rounded-full px-1.5 text-[11px] tabular-nums ${cls}`}>{n}</span>;
}

/** "De PERG_010 até PERG_050" — either side may be left empty to mean first / last. */
function RangeSelect({ ids, onSelect }: { ids: string[]; onSelect: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary text-xs">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M3 4h10M3 8h10M3 12h6" /></svg>
        Intervalo
      </button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSelect(from, to);
            setOpen(false);
          }}
          className="absolute left-0 z-40 mt-1.5 w-72 origin-top-left rounded-xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/10"
          style={{ animation: "modal-in 180ms cubic-bezier(0.2,0.9,0.3,1)" }}
        >
          <datalist id="row-ids">
            {ids.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <p className="mb-2 text-xs text-stone-500">Selecione um intervalo de IDs. Deixe &quot;até&quot; vazio para ir até o fim.</p>
          <div className="flex items-center gap-2">
            <input autoFocus list="row-ids" value={from} onChange={(e) => setFrom(e.target.value)} placeholder={ids[0] ?? "De"} className="input w-full font-mono text-xs" />
            <span className="text-xs text-stone-400">até</span>
            <input list="row-ids" value={to} onChange={(e) => setTo(e.target.value)} placeholder={ids.at(-1) ?? "Até"} className="input w-full font-mono text-xs" />
          </div>
          <button type="submit" className="btn-primary mt-3 w-full">Selecionar intervalo</button>
        </form>
      )}
    </div>
  );
}

/** "Aprovar ▾": opens upward from the floating selection bar. */
function BulkApproveMenu({
  approvable, approved, onApprove, onClear,
}: { approvable: number; approved: number; onApprove: (which: "first" | "last") => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const item = "flex w-full items-center justify-between gap-6 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} disabled={!approvable && !approved} className="btn-secondary" aria-expanded={open}>
        Aprovar
        <svg viewBox="0 0 16 16" className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="m4 10 4-4 4 4" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 w-72 origin-bottom-left rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-900/10"
          style={{ animation: "modal-in 160ms cubic-bezier(0.2,0.9,0.3,1)" }}
        >
          <div className="px-3 pt-1.5 pb-1 text-[11px] text-stone-400">Frases selecionadas ainda sem aprovação</div>
          <button disabled={!approvable} onClick={() => { onApprove("first"); setOpen(false); }} className={item}>
            Aprovar o 1º take de cada <span className="tabular-nums text-stone-400">{approvable}</span>
          </button>
          <button disabled={!approvable} onClick={() => { onApprove("last"); setOpen(false); }} className={item}>
            Aprovar o último take de cada <span className="tabular-nums text-stone-400">{approvable}</span>
          </button>
          <div className="my-1 h-px bg-stone-100" />
          <button disabled={!approved} onClick={() => { onClear(); setOpen(false); }} className={`${item} text-rose-600`}>
            Remover aprovações <span className="tabular-nums text-rose-300">{approved}</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** Click the project name to rename it in place: Enter saves, Esc cancels. */
function EditableTitle({ name, onSave }: { name: string; onSave: (name: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  // Esc must win even if the browser fires blur while the input goes away.
  const cancelled = useRef(false);

  async function commit() {
    const next = value.trim().replace(/\s+/g, " ");
    setEditing(false);
    if (cancelled.current) return setValue(name);
    if (!next || next === name) return setValue(name);
    try {
      await onSave(next);
      setError(null);
    } catch (e) {
      sfx("error");
      setError((e as Error).message);
      setValue(name);
    }
  }

  if (!editing) {
    return (
      <h1 className="min-w-0">
        <button
          type="button"
          onClick={() => {
            cancelled.current = false;
            setValue(name);
            setEditing(true);
          }}
          title={error ?? "Clique para renomear"}
          className={`max-w-[40vw] truncate rounded-md px-1 text-left text-[17px] font-semibold tracking-tight transition hover:bg-stone-100 ${error ? "text-rose-600" : "text-stone-900"}`}
        >
          {name}
        </button>
      </h1>
    );
  }
  return (
    <input
      autoFocus
      value={value}
      maxLength={200}
      aria-label="Nome do projeto"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className="input w-72 py-0.5 text-[17px] font-semibold tracking-tight"
    />
  );
}
