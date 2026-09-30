import { SfxLink, SoundToggle } from "./sound-toggle";

/** Public-site header (landing + blog). Solid background instead of a live blur: cheaper to scroll. */
export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/60 bg-[#faf9f7]/95">
      <nav className="mx-auto flex h-12 max-w-5xl items-center justify-between px-5" aria-label="Principal">
        <SfxLink href="/" sound="page" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
            <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
          </svg>
          voiceovers
        </SfxLink>
        <div className="flex items-center gap-1.5">
          <SfxLink href="/blog" sound="page" className="rounded-md px-2 py-1 text-xs text-stone-500 transition hover:text-stone-900">
            Blog
          </SfxLink>
          <SoundToggle />
          <SfxLink href="/dashboard" className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-800 shadow-sm transition hover:border-stone-300 active:scale-95">
            Abrir o app
          </SfxLink>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200/70">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-stone-400">
        <span>Bulk text-to-speech para jogos e diálogos · áudios gerados pela API do ElevenLabs.</span>
        <div className="flex gap-4">
          <SfxLink href="/blog" sound="tick" className="hover:text-stone-700">Blog</SfxLink>
          <SfxLink href="/dashboard" sound="tick" className="hover:text-stone-700">Abrir o app</SfxLink>
          <SfxLink href="https://elevenlabs.io/pricing/api" sound="tick" className="hover:text-stone-700">Preços da API</SfxLink>
        </div>
      </div>
    </footer>
  );
}
