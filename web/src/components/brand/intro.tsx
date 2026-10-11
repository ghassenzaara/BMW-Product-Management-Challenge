"use client";

import { useEffect, useRef } from "react";

/**
 * The headlight intro (landing/index.html), played once per browser on the first visit:
 * darkness, the light travels around the eyes, they stay lit, fade, and the app appears.
 * Click to skip. `?intro=1` plays it again; reduced-motion users never see it.
 *
 * The script in the root layout decides before the first paint (`<html data-intro="play">`),
 * so a returning visitor never sees a black flash and a first-time visitor never sees the app first.
 */
export const INTRO_SEEN_KEY = "argon_intro_seen";

/** Runs before hydration (root layout). */
export const introBootScript = `try{var s=location.search.indexOf("intro=1")>=0;if(s||(!localStorage.getItem("${INTRO_SEEN_KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches))document.documentElement.setAttribute("data-intro","play")}catch(e){}`;

// Times in milliseconds (the values of landing/index.html).
const DARK_PAUSE = 600; // black screen before the lights start
const REVEAL_TIME = 1150; // the light travelling around the eyes
const HOLD_TIME = 1200; // the fully lit eyes stay on screen
const FADE_OUT = 800; // the eyes fade back into the dark
const DARK_END = 300; // black screen before the app opens
const EYES_WIDTH = 0.71; // share of the screen width the eyes span, as in the video

// The video's distinct frames and how far each one is lit, in pixels. The light front travels
// continuously; each refresh shows the frame lit just beyond the front and hides what lies ahead.
const FRAME_COUNT = 19;
const SEQ = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18];
const FRONTS = [167, 248, 353, 467, 555, 662, 736, 874, 963, 1066, 1131, 1188, 1248, 1365, 1502];
const FROM = 70;
const TO = 1600;
const EDGE = 46;

export function Intro() {
  const stage = useRef<HTMLDivElement>(null);
  const eyes = useRef<HTMLDivElement>(null);
  const still = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = { stage: stage.current, eyes: eyes.current, still: still.current, canvas: canvas.current };
    const ctx = el.canvas?.getContext("2d");
    if (root.getAttribute("data-intro") !== "play" || !el.stage || !el.eyes || !el.still || !el.canvas || !ctx) return;
    const { stage: stageEl, eyes: eyesEl, still: stillEl, canvas: canvasEl } = el as { [K in keyof typeof el]: NonNullable<(typeof el)[K]> };

    let alive = true;
    const timers: number[] = [];
    const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));

    const frames = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new Image();
      img.src = `/intro/frames/f${String(i).padStart(2, "0")}.jpg`;
      return img;
    });
    const decoded = (img: HTMLImageElement) =>
      (img.complete && img.naturalWidth ? Promise.resolve() : new Promise<void>((r) => (img.onload = img.onerror = () => r()))).then(() => img.decode?.().catch(() => {}));

    const finish = () => {
      if (!alive) return;
      alive = false;
      try {
        localStorage.setItem(INTRO_SEEN_KEY, "1");
      } catch {}
      stageEl.classList.add("done");
      timers.push(window.setTimeout(() => root.removeAttribute("data-intro"), 800));
    };

    const drawLight = () =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const draw = (now: number) => {
          if (!alive) return resolve();
          const p = Math.max(0, Math.min(1, (now - t0) / REVEAL_TIME));
          const x = FROM + (TO - FROM) * p; // where the light front is now
          let k = SEQ.length - 1;
          for (let i = 0; i < SEQ.length; i++) {
            if (FRONTS[i] >= x) {
              k = i;
              break;
            }
          }
          const img = frames[SEQ[k]];
          ctx.globalCompositeOperation = "source-over";
          ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
          if (img.naturalWidth) ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
          if (p < 1) {
            // hide everything ahead of the front with a soft edge
            const g = ctx.createLinearGradient(x - EDGE, 0, x, 0);
            g.addColorStop(0, "rgba(0,0,0,1)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalCompositeOperation = "destination-in";
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
            ctx.globalCompositeOperation = "source-over";
            requestAnimationFrame(draw);
            return;
          }
          resolve();
        };
        draw(t0);
      });

    const play = async () => {
      await Promise.race([Promise.all([...frames, stillEl].map(decoded)), wait(4000)]); // never hold the app back for images
      if (!alive) return;
      // one fixed size, the same share of the screen as in the video (0.883 = share of the image the eyes cover)
      eyesEl.style.transform = `translate(-50%, -50%) scale(${(EYES_WIDTH * window.innerWidth) / (eyesEl.offsetWidth * 0.883)})`;
      await wait(DARK_PAUSE);
      if (!alive) return;
      await drawLight();
      if (!alive) return;
      // the sharp still takes over from the video frames without a visible change
      stillEl.animate([{ opacity: 0.001 }, { opacity: 1 }], { duration: 120, fill: "forwards" });
      canvasEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 120, fill: "forwards" });
      eyesEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_OUT, delay: HOLD_TIME, easing: "cubic-bezier(.4,0,.6,1)", fill: "forwards" });
      await wait(HOLD_TIME + FADE_OUT + DARK_END);
      finish();
    };

    stageEl.addEventListener("click", finish);
    void play();
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
      stageEl.removeEventListener("click", finish);
      // The attribute stays: React's development double-mount runs this cleanup and then plays again.
      for (const node of [stillEl, canvasEl, eyesEl]) node.getAnimations().forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div ref={stage} className="intro-stage" title="Click to skip" aria-hidden="true">
      <div ref={eyes} className="intro-eyes">
        <canvas ref={canvas} width={1540} height={310} />
        {/* eslint-disable-next-line @next/next/no-img-element -- a plain image: the canvas hands over to it frame-exactly */}
        <img ref={still} src="/intro/eyes.png" alt="" />
      </div>
    </div>
  );
}
