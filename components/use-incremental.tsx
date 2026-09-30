"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Renders long lists in chunks: more items mount as the sentinel approaches the viewport.
 * Changing `resetKey` (filters, search) starts again from the first chunk.
 */
export function useIncremental(total: number, resetKey: string, step = 30) {
  const [state, setState] = useState({ key: resetKey, count: step });
  const count = state.key === resetKey ? state.count : step;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setState((s) => ({ key: resetKey, count: (s.key === resetKey ? s.count : step) + step }));
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [resetKey, step, count]);

  /** Makes sure the first `n` items are mounted (e.g. before scrolling to one). */
  const ensure = useCallback((n: number) => setState((s) => ({ key: resetKey, count: Math.max(s.key === resetKey ? s.count : step, n) })), [resetKey, step]);

  return {
    visible: count,
    ensure,
    sentinel: count < total ? <div ref={ref} className="flex h-16 items-center justify-center text-xs text-stone-400">Carregando mais…</div> : null,
  };
}
