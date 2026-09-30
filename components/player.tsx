"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/* ------------------------------------------------------------------------------------------------
 * One shared audio engine for the whole page: starting a take stops the previous one, which is what
 * you want while reviewing. Components subscribe with per-url selectors that return primitives, so
 * only the track that is actually playing re-renders on each animation frame.
 * ---------------------------------------------------------------------------------------------- */

type Listener = () => void;

class PlayerEngine {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private raf = 0;
  private playlist: string[] = [];
  url: string | null = null;
  playing = false;
  time = 0;
  duration = 0;

  private el() {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = "auto";
    a.onplay = () => {
      this.playing = true;
      this.tick();
    };
    a.onpause = () => {
      this.playing = false;
      cancelAnimationFrame(this.raf);
      this.emit();
    };
    a.onloadedmetadata = () => {
      this.duration = a.duration;
      this.emit();
    };
    a.onended = () => {
      this.time = 0;
      const next = this.playlist.shift();
      if (next) this.play(next);
      else this.emit();
    };
    this.audio = a;
    return a;
  }

  // requestAnimationFrame instead of `timeupdate` (~4Hz) so the playhead moves continuously.
  private tick = () => {
    if (!this.audio) return;
    this.time = this.audio.currentTime;
    this.emit();
    if (this.playing) this.raf = requestAnimationFrame(this.tick);
  };

  private emit() {
    for (const l of this.listeners) l();
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  play(url: string, at?: number) {
    const a = this.el();
    if (this.url !== url) {
      this.url = url;
      this.time = at ?? 0;
      this.duration = 0;
      a.src = url;
    }
    if (at !== undefined) a.currentTime = at;
    void a.play().catch(() => undefined);
    this.emit();
  }

  toggle(url: string) {
    this.playlist = [];
    if (this.url === url && this.playing) this.audio?.pause();
    else this.play(url);
  }

  /** Seeks by fraction; starts that track if it is not the current one. */
  seek(url: string, fraction: number, duration?: number) {
    const d = this.url === url && this.duration ? this.duration : duration ?? 0;
    const at = Math.max(0, Math.min(d, fraction * d));
    if (this.url === url) {
      this.el().currentTime = at;
      this.time = at;
      if (!this.playing) void this.el().play().catch(() => undefined);
      this.emit();
    } else {
      this.playlist = [];
      this.play(url, at);
    }
  }

  /** Plays urls back to back (e.g. every approved language of one ID). */
  playAll(urls: string[]) {
    if (!urls.length) return;
    this.playlist = urls.slice(1);
    this.play(urls[0], 0);
  }

  stop() {
    this.playlist = [];
    this.audio?.pause();
  }
}

export const player = typeof window === "undefined" ? (null as unknown as PlayerEngine) : new PlayerEngine();

const noop = () => () => undefined;

export function useIsPlaying(url: string) {
  return useSyncExternalStore(player?.subscribe ?? noop, () => player.url === url && player.playing, () => false);
}

function usePlayhead(url: string) {
  return useSyncExternalStore(player?.subscribe ?? noop, () => (player.url === url ? player.time : -1), () => -1);
}

export function useIsCurrent(url: string) {
  return useSyncExternalStore(player?.subscribe ?? noop, () => player.url === url, () => false);
}

/* ------------------------------------------------------------------------------------------------
 * Waveforms are decoded once per url (lazily, when the track scrolls into view) and cached.
 * ---------------------------------------------------------------------------------------------- */

type Wave = { peaks: number[]; duration: number };
const BARS = 42;
const waveCache = new Map<string, Promise<Wave>>();
let decoder: AudioContext | null = null;

function loadWave(url: string): Promise<Wave> {
  let p = waveCache.get(url);
  if (!p) {
    p = (async () => {
      const buf = await (await fetch(url)).arrayBuffer();
      decoder ??= new AudioContext();
      const audio = await decoder.decodeAudioData(buf);
      const data = audio.getChannelData(0);
      const step = Math.max(1, Math.floor(data.length / BARS));
      const peaks: number[] = [];
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j++) sum += data[j] * data[j];
        peaks.push(Math.sqrt(sum / step));
      }
      const max = Math.max(...peaks, 0.001);
      return { peaks: peaks.map((v) => Math.max(0.08, v / max)), duration: audio.duration };
    })();
    p.catch(() => waveCache.delete(url));
    waveCache.set(url, p);
  }
  return p;
}

function useWave(url: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [wave, setWave] = useState<Wave | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        loadWave(url).then((w) => alive && setWave(w)).catch(() => undefined);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      io.disconnect();
    };
  }, [url]);
  return { ref, wave };
}

export const formatTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------------------------------------
 * UI
 * ---------------------------------------------------------------------------------------------- */

type Tone = "accent" | "emerald";
const TONES: Record<Tone, { button: string; played: string; head: string }> = {
  accent: { button: "bg-stone-900 hover:bg-stone-800 shadow-stone-900/20", played: "bg-accent-500", head: "bg-accent-500" },
  emerald: { button: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25", played: "bg-emerald-600", head: "bg-emerald-600" },
};

export function PlayButton({ url, size = "md", tone = "accent" }: { url: string; size?: "sm" | "md"; tone?: Tone }) {
  const playing = useIsPlaying(url);
  const dim = size === "sm" ? "size-7" : "size-9";
  return (
    <button
      type="button"
      onClick={() => player.toggle(url)}
      aria-label={playing ? "Pausar" : "Tocar"}
      // Feedback on press, not release: instant scale-down.
      className={`${dim} ${TONES[tone].button} inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-md transition-[transform,background-color] duration-100 ease-out active:scale-[0.92] motion-reduce:active:scale-100`}
    >
      {playing ? (
        <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="ml-0.5 size-3.5" fill="currentColor">
          <path d="M4.5 2.9v10.2a.6.6 0 0 0 .92.5l8-5.1a.6.6 0 0 0 0-1l-8-5.1a.6.6 0 0 0-.92.5Z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Spotify-like track: play button, real waveform that fills as it plays, elapsed / total time.
 * The waveform is a scrubber: press anywhere to jump, drag to scrub 1:1 with the pointer
 * (pointer capture keeps tracking outside the bounds), release to commit.
 */
export function Track({ url, title, subtitle, tone = "accent", trailing }: {
  url: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  tone?: Tone;
  trailing?: React.ReactNode;
}) {
  const { ref, wave } = useWave(url);
  const head = usePlayhead(url);
  const current = useIsCurrent(url);
  const [drag, setDrag] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const duration = wave?.duration ?? 0;
  const progress = drag ?? (current && duration ? Math.min(1, Math.max(0, head) / duration) : 0);
  const shownTime = drag !== null ? drag * duration : current ? Math.max(0, head) : 0;

  const fractionAt = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlayButton url={url} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2 text-xs">
          {title && <span className="min-w-0 truncate font-medium text-stone-800">{title}</span>}
          {subtitle && <span className="truncate text-stone-400">{subtitle}</span>}
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-stone-400">
            {current || drag !== null ? <span className="text-stone-600">{formatTime(shownTime)} / </span> : null}
            {formatTime(duration)}
          </span>
        </div>
        <div
          ref={ref}
          role="slider"
          aria-label="Posição do áudio"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownTime)}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              player.toggle(url);
            }
            if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && duration) {
              e.preventDefault();
              const delta = (e.key === "ArrowRight" ? 1 : -1) / duration;
              player.seek(url, (current ? Math.max(0, head) / duration : 0) + delta, duration);
            }
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(fractionAt(e));
          }}
          onPointerMove={(e) => {
            const f = fractionAt(e);
            if (drag !== null) setDrag(f);
            else if (e.pointerType === "mouse") setHover(f);
          }}
          onPointerUp={(e) => {
            if (drag === null) return;
            player.seek(url, fractionAt(e), duration);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
          onPointerLeave={() => setHover(null)}
          className="group relative flex h-7 w-full cursor-pointer touch-none items-center gap-[2px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2"
        >
          {(wave?.peaks ?? PLACEHOLDER).map((p, i, all) => {
            const at = (i + 0.5) / all.length;
            const played = at <= progress;
            const hovered = hover !== null && drag === null && at <= hover && !played;
            return (
              <span
                key={i}
                className={`min-w-[2px] flex-1 rounded-full transition-colors duration-75 ${
                  played ? TONES[tone].played : hovered ? "bg-stone-400" : wave ? "bg-stone-300" : "animate-pulse bg-stone-200"
                }`}
                style={{ height: `${Math.round(p * 100)}%` }}
              />
            );
          })}
          {(current || drag !== null) && duration > 0 && (
            <span
              className={`pointer-events-none absolute top-0 bottom-0 w-0.5 -translate-x-1/2 rounded-full ${TONES[tone].head}`}
              style={{ left: `${progress * 100}%` }}
            />
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}

const PLACEHOLDER = Array.from({ length: BARS }, (_, i) => 0.25 + 0.2 * Math.abs(Math.sin(i * 0.7)));
