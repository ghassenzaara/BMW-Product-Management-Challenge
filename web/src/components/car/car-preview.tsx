"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Maximize2, X } from "lucide-react";
import { carAreaLabel, seriesShort, type Requirement, type Series } from "@/contracts";
import { areaForCarArea, areas, carModels, getZone, isModelled, zoneForCase, type AreaId } from "@/lib/car/zones";
import { cn } from "@/lib/utils";
import { ReqStatusDot } from "@/components/common/badges";
import { Button } from "@/components/ui/button";

// The 3D code is loaded only when someone opens the view; the page itself never runs it.
const CarScene = dynamic(() => import("./car-scene"), { ssr: false });

const AREAS_WIDTH = 232;
const LIST_WIDTH = 344;

/**
 * The car on top of the vehicle plan. The small card is a pre-rendered still picture: the page runs no 3D,
 * no WebGL and no animation for it.
 * A click opens the real 3D view large, with the car areas and their requirements.
 * The picture is made by `Car_models/tools/turntable`.
 */
export function CarPreview({ series, reqs, onOpenRequirement }: { series: Series; reqs: Requirement[]; onOpenRequirement: (id: string) => void }) {
  const model = isModelled(series) ? carModels[series] : null;
  const { resolvedTheme } = useTheme();
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [areaId, setAreaId] = useState<AreaId | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  // The tab in the background draws nothing.
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const close = useCallback(() => {
    setExpanded(false);
    setAreaId(null);
    setPickedId(null);
    opener.current?.focus();
  }, []);
  useEffect(() => {
    if (!expanded) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, close]);

  if (!model || !isModelled(series)) return null;

  // Someone about to click gets the 3D code and the model fetched ahead, so the view opens quickly.
  const prefetch = () => void import("./car-scene").then((m) => m.preloadCar(model.file));

  const counts = Object.fromEntries(areas.map((a) => [a.id, reqs.filter((r) => areaForCarArea(r.carArea) === a.id).length])) as Record<AreaId, number>;
  const area = areas.find((a) => a.id === areaId) ?? null;
  const inArea = area ? reqs.filter((r) => areaForCarArea(r.carArea) === area.id) : [];
  const picked = reqs.find((r) => r.id === pickedId) ?? null;
  const focus = picked ? getZone(zoneForCase({ title: picked.title, featureName: picked.shortTitle, carArea: picked.carArea })) : area;
  const name = seriesShort[series];
  const still = model.file.replace(/\.glb$/, "-still.webp");

  return (
    <div className="px-6 pt-6">
      <section className="relative h-44 overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted/50">
        {/* A still picture of the car: the page runs no 3D until someone opens the view. */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 aspect-[8/3] -translate-x-1/2 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${still})` }} />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-card/90 to-transparent" />
        <div className="pointer-events-none absolute top-5 left-6 flex flex-col gap-0.5">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Your car in 3D</span>
          <span className="text-xl font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{reqs.length} requirements across 5 car areas</span>
        </div>
        <span className="pointer-events-none absolute right-4 bottom-3 flex items-center gap-1.5 rounded-full border bg-card/90 px-3 py-1 text-xs font-medium">
          <Maximize2 className="size-3.5" /> Explore
        </span>
        <button
          type="button"
          aria-label={`Explore the ${name} in 3D`}
          className="absolute inset-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onClick={(e) => {
            opener.current = e.currentTarget;
            setExpanded(true);
          }}
        />
      </section>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40 animate-in bg-black/60 duration-200 fade-in" onClick={close} />
          <section
            role="dialog"
            aria-modal
            aria-label={`${name} in 3D`}
            className="fixed inset-4 z-50 animate-in overflow-hidden rounded-xl border bg-gradient-to-b from-card to-muted/50 shadow-2xl duration-200 fade-in zoom-in-95"
          >
            <CarScene model={model} focus={focus} dark={resolvedTheme !== "light"} paused={hidden} insetLeft={AREAS_WIDTH} insetRight={focus ? LIST_WIDTH : 0} />

            <div className="pointer-events-none absolute top-4 left-5 flex flex-col">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Explore in 3D</span>
              <h2 className="text-2xl font-semibold">{name}</h2>
            </div>
            <Button ref={closeButton} size="icon" variant="outline" className="absolute top-4 right-4" aria-label="Close 3D view" onClick={close}>
              <X className="size-4" />
            </Button>

            <nav aria-label="Areas of the car" className="absolute bottom-5 left-5 flex flex-col items-start gap-2">
              <span className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Areas · requirements</span>
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={a.id === areaId}
                  onClick={() => {
                    setAreaId(a.id === areaId ? null : a.id);
                    setPickedId(null);
                  }}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border bg-card/90 px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 hover:border-border-strong",
                    a.id === areaId && "border-primary bg-primary text-primary-foreground hover:border-primary",
                  )}
                >
                  {a.label}
                  <span className="text-xs tabular-nums opacity-80">{counts[a.id]}</span>
                </button>
              ))}
            </nav>

            {area ? (
              <aside aria-label={`${area.label} requirements`} className="absolute top-16 right-4 bottom-4 flex animate-in flex-col gap-2 overflow-hidden rounded-lg border bg-card p-4 shadow-xl duration-300 fade-in slide-in-from-right-6" style={{ width: LIST_WIDTH - 24 }}>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[15px] font-semibold">{area.label}</h3>
                  <span className="text-xs text-muted-foreground">{inArea.length} requirements</span>
                </div>
                <ul className="-mx-1 flex-1 divide-y overflow-y-auto overscroll-contain px-1">
                  {inArea.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        aria-pressed={r.id === pickedId}
                        onClick={() => setPickedId(r.id === pickedId ? null : r.id)}
                        className={cn("flex w-full flex-col gap-1 rounded-md px-2 py-2.5 text-left transition-colors duration-150 hover:bg-muted/60", r.id === pickedId && "bg-muted")}
                      >
                        <span className="text-sm font-medium">{r.shortTitle}</span>
                        <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          {carAreaLabel[r.carArea]}
                          <ReqStatusDot status={r.status} />
                        </span>
                      </button>
                    </li>
                  ))}
                  {inArea.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No requirements in this area yet.</li>}
                </ul>
                {picked && (
                  <div className="flex flex-col gap-2 border-t pt-3">
                    <p className="line-clamp-4 text-[13px] leading-[18px] text-muted-foreground">{picked.title}</p>
                    <Button
                      size="sm"
                      onClick={() => {
                        close();
                        onOpenRequirement(picked.id);
                      }}
                    >
                      Open requirement
                    </Button>
                  </div>
                )}
              </aside>
            ) : (
              <p className="pointer-events-none absolute right-5 bottom-5 max-w-56 text-right text-xs text-muted-foreground">Pick an area to light it up on the car. Drag to turn it, scroll to zoom.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
