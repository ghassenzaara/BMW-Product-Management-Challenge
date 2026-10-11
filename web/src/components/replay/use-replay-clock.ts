"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Beats of the trace replay; about 15 s at 1×. The last beat holds (end state). */
export const BEATS = [
  { id: "opening", label: "Requirement", ms: 1600 },
  { id: "rewind", label: "Rewind", ms: 1000 },
  { id: "voices", label: "Voices", ms: 2600 },
  { id: "signals", label: "Signals", ms: 2400 },
  { id: "score", label: "Case & score", ms: 2600 },
  { id: "decisions", label: "Decisions", ms: 3400 },
  { id: "planned", label: "Planned", ms: 1400 },
  { id: "chain", label: "Chain check", ms: 0 },
] as const;
export type BeatId = (typeof BEATS)[number]["id"];

const query = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = window.matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

/**
 * requestAnimationFrame clock. `progress` (0..1) runs within the current beat and drives
 * staggered reveals; with reduced motion it jumps to 1 so beats step instead of animate.
 */
export function useReplayClock() {
  const reduced = useReducedMotion();
  const [beat, setBeat] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const elapsed = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      const dt = last.current === null ? 0 : t - last.current;
      last.current = t;
      elapsed.current += dt * speed;
      const ms = BEATS[beat].ms;
      if (!ms) {
        setProgress(1);
        setPlaying(false);
        return;
      }
      if (elapsed.current >= ms) {
        elapsed.current = 0;
        setBeat((b) => Math.min(BEATS.length - 1, b + 1));
        setProgress(reduced ? 1 : 0);
        return;
      }
      setProgress(reduced ? 1 : elapsed.current / ms);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, beat, speed, reduced]);

  const goTo = useCallback((i: number) => {
    elapsed.current = 0;
    last.current = null;
    setBeat(Math.max(0, Math.min(BEATS.length - 1, i)));
    setProgress(1);
  }, []);
  const step = useCallback(
    (delta: number) => {
      setPlaying(false);
      goTo(beat + delta);
    },
    [beat, goTo],
  );
  const toggle = useCallback(() => {
    if (beat === BEATS.length - 1) {
      goTo(0);
      setProgress(0);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  }, [beat, goTo]);

  return { beat, beatId: BEATS[beat].id as BeatId, progress, playing, speed, setSpeed, toggle, step, goTo, setPlaying, reduced };
}
