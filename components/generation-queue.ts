"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { cellKey, type Take } from "@/lib/types";

export type JobStatus = "queued" | "running" | "done" | "error";
export type Job = { id: number; rowId: string; langKey: string; status: JobStatus; error?: string; priority?: boolean };
export type CellStatus = { queued: number; running: number; error?: string };

type Handlers = {
  /** Called before a batch starts, e.g. to flush unsaved settings. */
  beforeRun?: () => Promise<void>;
  onTake?: (take: Take) => void;
  /** A take asked for on one phrase ("+1 take", "Gerar × N" on a cell) has arrived. */
  onPriorityTake?: (take: Take) => void;
  onIdle?: () => void;
  /** Fired once when the queue drains after work: how the run went. */
  onRunComplete?: (result: { done: number; error: number }) => void;
  /** Fired once when a fatal error pauses the queue. */
  onFatal?: (message: string) => void;
};

type Snapshot = { jobs: Job[]; paused: boolean; concurrency: number; pauseReason?: string };

/**
 * Browser-side queue: each job is one POST /generate, i.e. one ElevenLabs request.
 * Lives outside React so a long run keeps going while you review, filter or open modals.
 */
class GenerationQueue {
  private snap: Snapshot = { jobs: [], paused: false, concurrency: 3 };
  private listeners = new Set<() => void>();
  private controllers = new Map<number, AbortController>();
  private seq = 0;
  private handlers: Handlers = {};
  private busy = false;

  constructor(private projectId: string) {}

  setHandlers(h: Handlers) {
    this.handlers = h;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.snap;

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  private update(id: number, patch: Partial<Job>) {
    this.set({ jobs: this.snap.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) });
  }

  /**
   * `priority` puts the jobs ahead of everything still waiting, so asking for "+1 take" on the
   * phrase you are reviewing does not wait behind a 500-item bulk run.
   */
  async add(items: { rowId: string; langKey: string }[], { priority = false } = {}) {
    if (!items.length) return;
    const idle = !this.snap.jobs.some((j) => j.status === "queued" || j.status === "running");
    // Starting fresh: drop finished jobs so the progress bar describes this run only.
    const kept = idle ? this.snap.jobs.filter((j) => j.status === "error") : this.snap.jobs;
    const fresh: Job[] = items.map((i) => ({ ...i, id: ++this.seq, status: "queued", priority }));
    let jobs: Job[];
    if (priority) {
      const firstQueued = kept.findIndex((j) => j.status === "queued");
      jobs = firstQueued < 0 ? [...kept, ...fresh] : [...kept.slice(0, firstQueued), ...fresh, ...kept.slice(firstQueued)];
    } else jobs = [...kept, ...fresh];
    this.set({ jobs });
    this.busy = true;
    await this.handlers.beforeRun?.();
    this.pump();
  }

  private pump() {
    if (this.snap.paused) return;
    let running = this.snap.jobs.filter((j) => j.status === "running").length;
    for (const job of this.snap.jobs) {
      if (running >= this.snap.concurrency) break;
      if (job.status !== "queued") continue;
      running++;
      void this.run(job);
    }
    if (running > 0) return;
    this.handlers.onIdle?.();
    if (this.busy && !this.snap.jobs.some((j) => j.status === "queued")) {
      this.busy = false;
      const c = { done: 0, error: 0 };
      for (const j of this.snap.jobs) if (j.status === "done" || j.status === "error") c[j.status]++;
      this.handlers.onRunComplete?.(c);
    }
  }

  private async run(job: Job) {
    this.update(job.id, { status: "running", error: undefined });
    const ctrl = new AbortController();
    this.controllers.set(job.id, ctrl);
    try {
      const res = await fetch(`/api/projects/${this.projectId}/generate`, {
        method: "POST",
        body: JSON.stringify({ rowId: job.rowId, langKey: job.langKey }),
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        // Bad key / no credits: every other job would fail the same way, so stop and say why.
        if (json.fatal && !this.snap.pauseReason) {
          this.set({ paused: true, pauseReason: json.error });
          this.handlers.onFatal?.(json.error);
        }
        throw new Error(json.error ?? res.statusText);
      }
      this.handlers.onTake?.(json as Take);
      if (job.priority) this.handlers.onPriorityTake?.(json as Take);
      this.update(job.id, { status: "done" });
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      if (aborted) this.set({ jobs: this.snap.jobs.filter((j) => j.id !== job.id) });
      else this.update(job.id, { status: "error", error: (e as Error).message });
    } finally {
      this.controllers.delete(job.id);
      this.pump();
    }
  }

  setConcurrency(n: number) {
    this.set({ concurrency: Math.max(1, Math.min(30, n)) });
    this.pump();
  }

  pause() {
    this.set({ paused: true, pauseReason: undefined });
  }

  resume() {
    this.set({ paused: false, pauseReason: undefined });
    this.pump();
  }

  /** Drops everything waiting; running requests finish (their credits are already spent). */
  clearQueued() {
    this.set({ jobs: this.snap.jobs.filter((j) => j.status !== "queued") });
  }

  /** Drops everything waiting and aborts in-flight requests. */
  cancelAll() {
    this.clearQueued();
    for (const c of this.controllers.values()) c.abort();
  }

  retryFailed() {
    this.set({ jobs: this.snap.jobs.map((j) => (j.status === "error" ? { ...j, status: "queued", error: undefined } : j)) });
    this.pump();
  }

  dismissFinished() {
    this.set({ jobs: this.snap.jobs.filter((j) => j.status === "queued" || j.status === "running") });
  }
}

export function useGenerationQueue(projectId: string, concurrency: number, handlers: Handlers) {
  const [queue] = useState(() => new GenerationQueue(projectId));
  const snap = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);

  useEffect(() => {
    queue.setHandlers(handlers);
  });
  useEffect(() => {
    queue.setConcurrency(concurrency);
  }, [queue, concurrency]);

  /** Per phrase/language status, used by the cells. An error sticks until a later job for that cell succeeds. */
  const byCell = useMemo(() => {
    const map = new Map<string, CellStatus>();
    for (const j of snap.jobs) {
      const k = cellKey(j.rowId, j.langKey);
      const s = map.get(k) ?? { queued: 0, running: 0 };
      if (j.status === "queued") s.queued++;
      if (j.status === "running") s.running++;
      if (j.status === "error") s.error = j.error;
      if (j.status === "done") s.error = undefined;
      map.set(k, s);
    }
    return map;
  }, [snap.jobs]);

  const counts = useMemo(() => {
    const c = { queued: 0, running: 0, done: 0, error: 0 };
    for (const j of snap.jobs) c[j.status]++;
    return { ...c, total: snap.jobs.length };
  }, [snap.jobs]);

  return { queue, snap, byCell, counts };
}
