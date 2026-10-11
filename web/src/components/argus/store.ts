"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { ArgusAttachment } from "@/contracts";

/**
 * Shared state of the Argus bubble: open, the context chips waiting in the composer,
 * and drag feedback. Any page can attach (the case board on drop, links natively).
 */

export type Attachment = ArgusAttachment & { title?: string };

type State = { open: boolean; pending: Attachment[]; dragging: boolean; over: boolean; hiddenBy: number };
let state: State = { open: false, pending: [], dragging: false, over: false, hiddenBy: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useArgus = () => useSyncExternalStore(subscribe, () => state, () => state);

export const setArgusOpen = (open: boolean) => set({ open });
export const setArgusDrag = (dragging: boolean, over = false) => (state.dragging !== dragging || state.over !== over) && set({ dragging, over });
export const setPending = (pending: Attachment[]) => set({ pending });

export function attachToArgus(a: Attachment) {
  set({ open: true, dragging: false, over: false, pending: [...state.pending.filter((p) => p.id !== a.id), a].slice(-5) });
}

/** A page-level Argus panel is open (case or requirement page): hide the bubble so the two don't overlap. */
export function useHideArgusBubble(active: boolean) {
  useEffect(() => {
    if (!active) return;
    set({ hiddenBy: state.hiddenBy + 1 });
    return () => set({ hiddenBy: state.hiddenBy - 1 });
  }, [active]);
}

/** Is the point over the bubble? Used by the case board, whose cards drag with dnd-kit, not natively. */
export const overArgus = (x: number, y: number) => document.elementsFromPoint(x, y).some((el) => el.closest("[data-argus-drop]"));

/** A dragged link or pasted ID → attachment. Accepts /cases/ID, /cases/ID?signal=SID, /requirements/ID or a bare ID. */
export function parseAttachment(raw: string): Attachment | null {
  const text = raw.trim().split(/\s+/)[0] ?? "";
  if (/^REQ-[A-Z0-9-]+$/.test(text)) return { kind: "requirement", id: text };
  if (/^CASE-[A-Z0-9-]+$/.test(text)) return { kind: "case", id: text };
  try {
    const url = new URL(text, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const [, section, id] = url.pathname.split("/");
    const signal = url.searchParams.get("signal");
    if (signal) return { kind: "signal", id: signal };
    if (section === "cases" && id) return { kind: "case", id: decodeURIComponent(id) };
    if (section === "requirements" && id) return { kind: "requirement", id: decodeURIComponent(id) };
  } catch {
    /* not a link */
  }
  return null;
}
