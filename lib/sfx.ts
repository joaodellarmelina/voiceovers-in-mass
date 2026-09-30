"use client";

import { play, setEnabled, type SoundName } from "cuelume";
import { useSyncExternalStore } from "react";

/**
 * Interaction sounds (cuelume, synthesized with Web Audio — no files).
 * One cue per completed action, never on hover or per streamed item, and never on audio playback
 * itself so it doesn't mix with the voiceover being reviewed.
 */
export function sfx(name: SoundName, volume?: number) {
  play(name, volume === undefined ? undefined : { volume });
}

const KEY = "voiceovers:sfx";
const EVENT = "voiceovers:sfx-change";

function readEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

// Apply the stored preference as soon as this module loads in the browser.
if (typeof window !== "undefined") setEnabled(readEnabled());

export function setSfxEnabled(on: boolean) {
  setEnabled(on);
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Private mode or blocked storage: the toggle still works for this session.
  }
  window.dispatchEvent(new Event(EVENT));
  if (on) sfx("toggle");
}

export function useSfxEnabled() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    readEnabled,
    () => true,
  );
}
