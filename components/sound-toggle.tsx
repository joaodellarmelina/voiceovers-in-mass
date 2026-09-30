"use client";

import type { SoundName } from "cuelume";
import Link from "next/link";
import { setSfxEnabled, sfx, useSfxEnabled } from "@/lib/sfx";

/** Mute / unmute interface sounds; the choice is remembered in this browser. */
export function SoundToggle({ className = "" }: { className?: string }) {
  const on = useSfxEnabled();
  return (
    <button
      type="button"
      onClick={() => setSfxEnabled(!on)}
      aria-pressed={on}
      title={on ? "Silenciar sons da interface" : "Ativar sons da interface"}
      className={`inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 active:scale-90 ${className}`}
    >
      {on ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
      )}
    </button>
  );
}

/** A link that plays a cue on press (not on release), so the sound lands with the touch. */
export function SfxLink({
  href,
  sound = "press",
  className,
  children,
}: {
  href: string;
  sound?: SoundName;
  className?: string;
  children: React.ReactNode;
}) {
  const onPointerDown = () => sfx(sound, 0.8);
  if (href.startsWith("#") || href.startsWith("http")) {
    return (
      <a href={href} onPointerDown={onPointerDown} className={className} {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onPointerDown={onPointerDown} className={className}>
      {children}
    </Link>
  );
}
