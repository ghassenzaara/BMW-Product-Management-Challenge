import type { CarArea, Case, Series } from "@/contracts";

/**
 * Where a case sits on the car. UI-only: the contract has no "zone", so a case
 * is placed by keywords in its feature name and title, then by its car area.
 *
 * Zones are regions of the car's bounding box, not named parts, because the
 * 3D models we have are merged shells without separable parts. Coordinates are
 * normalised so the same zone works on both sedans:
 *   u: 0 = front bumper, 1 = rear bumper
 *   v: 0 = ground, 1 = roof
 *   w: -1 = left side, 1 = right side
 */
export type ZoneId =
  | "front"
  | "hood"
  | "windshield"
  | "cockpit"
  | "climate"
  | "console"
  | "front_seats"
  | "rear_seats"
  | "cabin"
  | "roof"
  | "doors"
  | "trunk"
  | "battery"
  | "charge_port"
  | "wheels"
  | "glovebox";

/** A region of the car the viewer can fly to and light up. */
export interface Region {
  id: string;
  label: string;
  center: [u: number, v: number, w: number];
  radius: [u: number, v: number, w: number];
  /** Inside the cabin or under the skin: the body is shown see-through. */
  interior: boolean;
  /** Camera: degrees around the car (0 = from the front, 90 = from the left), degrees above the horizon, distance in car lengths. */
  view: { azimuth: number; elevation: number; distance: number };
  /** How strongly the region is tinted, 0..1. Large regions use less so the car stays readable. Default 1. */
  tint?: number;
}

export interface Zone extends Region {
  id: ZoneId;
}

const zones: Record<ZoneId, Zone> = {
  front: { id: "front", label: "Front end & lights", center: [0.04, 0.38, 0], radius: [0.1, 0.3, 0.95], interior: false, view: { azimuth: 28, elevation: 12, distance: 0.95 } },
  hood: { id: "hood", label: "Under the bonnet", center: [0.14, 0.52, 0], radius: [0.13, 0.24, 0.8], interior: false, view: { azimuth: 35, elevation: 32, distance: 0.95 } },
  windshield: { id: "windshield", label: "Windscreen & mirror", center: [0.33, 0.82, 0], radius: [0.08, 0.14, 0.6], interior: false, view: { azimuth: 30, elevation: 28, distance: 0.9 } },
  cockpit: { id: "cockpit", label: "Cockpit & displays", center: [0.36, 0.6, -0.1], radius: [0.07, 0.14, 0.6], interior: true, view: { azimuth: 118, elevation: 24, distance: 0.8 } },
  climate: { id: "climate", label: "Climate controls & vents", center: [0.37, 0.52, 0], radius: [0.06, 0.11, 0.65], interior: true, view: { azimuth: 122, elevation: 22, distance: 0.8 } },
  console: { id: "console", label: "Centre console", center: [0.45, 0.44, 0], radius: [0.08, 0.12, 0.28], interior: true, view: { azimuth: 105, elevation: 38, distance: 0.8 } },
  front_seats: { id: "front_seats", label: "Front seats", center: [0.48, 0.5, 0], radius: [0.09, 0.24, 0.75], interior: true, view: { azimuth: 100, elevation: 26, distance: 0.85 } },
  rear_seats: { id: "rear_seats", label: "Rear seats", center: [0.65, 0.5, 0], radius: [0.09, 0.24, 0.75], interior: true, view: { azimuth: 78, elevation: 26, distance: 0.85 } },
  cabin: { id: "cabin", label: "Cabin", center: [0.54, 0.55, 0], radius: [0.2, 0.3, 0.8], interior: true, view: { azimuth: 90, elevation: 24, distance: 0.95 } },
  roof: { id: "roof", label: "Roof", center: [0.53, 0.97, 0], radius: [0.17, 0.09, 0.6], interior: false, view: { azimuth: 70, elevation: 52, distance: 0.95 } },
  doors: { id: "doors", label: "Doors & access", center: [0.5, 0.5, -1], radius: [0.2, 0.26, 0.28], interior: false, view: { azimuth: 90, elevation: 12, distance: 0.9 } },
  trunk: { id: "trunk", label: "Luggage compartment", center: [0.91, 0.6, 0], radius: [0.1, 0.24, 0.85], interior: false, view: { azimuth: 152, elevation: 24, distance: 0.9 } },
  battery: { id: "battery", label: "Battery & range", center: [0.5, 0.14, 0], radius: [0.27, 0.11, 0.8], interior: true, view: { azimuth: 90, elevation: 14, distance: 1.0 } },
  charge_port: { id: "charge_port", label: "Charge port", center: [0.82, 0.55, 1], radius: [0.07, 0.12, 0.22], interior: false, view: { azimuth: 235, elevation: 14, distance: 0.8 } },
  wheels: { id: "wheels", label: "Wheels & chassis", center: [0.17, 0.2, -1], radius: [0.09, 0.22, 0.3], interior: false, view: { azimuth: 62, elevation: 8, distance: 0.8 } },
  glovebox: { id: "glovebox", label: "Glovebox", center: [0.39, 0.45, 0.55], radius: [0.06, 0.1, 0.35], interior: true, view: { azimuth: 245, elevation: 26, distance: 0.8 } },
};

export function getZone(id: ZoneId): Zone {
  return zones[id];
}

/** First match wins, so the specific phrases come before the general ones. */
const keywordRules: [RegExp, ZoneId][] = [
  [/frunk|front trunk/, "hood"],
  [/tailgate|trunk|luggage|boot lid|cargo|loading/, "trunk"],
  [/spare wheel|flat[- ]tire|flat[- ]tyre|run-flat|rims?\b|wheels?\b|tires?\b|tyres?\b/, "wheels"],
  [/owner'?s manual|printed manual/, "glovebox"],
  [/rear[- ]view mirror|mirror/, "windshield"],
  [/panorama|sunroof|glass roof|\broof\b/, "roof"],
  [/cooler|fridge|rear[- ]seat|rear[- ]console|rear space|second row|legroom|chauffeur|cramped|roomy/, "rear_seats"],
  [/massage|seat ventilation|seat heating|\bseats?\b/, "front_seats"],
  // Before the charging rules: "wireless charging" is about the phone, not the battery.
  [/carplay|android auto|wireless charging|phone|esim|wi-?fi|hotspot/, "console"],
  [/charge port|charging flap|vehicle-to-load|bidirectional/, "charge_port"],
  [/range|charging|battery|cltc|wltp/, "battery"],
  [/start-stop|msa\b|engine|exhaust|drivetrain|motor\b/, "hood"],
  [/sport(y|iness)|handling|chassis|suspension|\bride\b/, "wheels"],
  [/climate|cool[- ]?down|cools down|air[- ]?con|a\/c|hvac|heater|vents?\b/, "climate"],
  [/button|shortcut|touch|menu|screen|display|idrive|operating concept|hmi|assistant|apps?\b|connected/, "cockpit"],
  [/ambient light|equipment|equipped/, "cabin"],
  [/headlight|grille|styling|exterior design/, "front"],
  [/door|handle|comfort access|keyless/, "doors"],
];

const areaFallback: Record<CarArea, ZoneId> = {
  exterior_design: "front",
  interior_comfort: "cabin",
  seats: "front_seats",
  climate: "climate",
  infotainment_hmi: "cockpit",
  connectivity_digital: "console",
  driver_assistance: "windshield",
  dynamics_powertrain: "hood",
  range_charging: "battery",
  practicality: "trunk",
  quality_materials: "cabin",
};

export function zoneForCase(c: Pick<Case, "title" | "featureName" | "carArea">): ZoneId {
  const text = `${c.featureName} ${c.title}`.toLowerCase();
  for (const [pattern, zone] of keywordRules) if (pattern.test(text)) return zone;
  return areaFallback[c.carArea];
}

/**
 * The five areas of the car on the vehicle plan. Each groups several zones; a case
 * belongs to the area of its zone, a requirement to the area of its case.
 */
export type AreaId = "exterior" | "interior" | "rear" | "range" | "dynamics";

export interface Area extends Region {
  id: AreaId;
  summary: string;
  zones: ZoneId[];
}

export const areas: Area[] = [
  {
    id: "exterior",
    label: "Exterior & design",
    summary: "Design, lights, doors, roof and luggage access: how the car looks and works from the outside.",
    zones: ["front", "windshield", "roof", "doors", "trunk"],
    center: [0.5, 0.5, 0],
    radius: [0.75, 0.9, 1.5],
    interior: false,
    tint: 0.28,
    view: { azimuth: 42, elevation: 14, distance: 1.35 },
  },
  {
    id: "interior",
    label: "Interior & infotainment",
    summary: "Cockpit, displays, controls, climate, front seats and digital services.",
    zones: ["cockpit", "climate", "console", "front_seats", "cabin", "glovebox"],
    center: [0.43, 0.56, 0],
    radius: [0.16, 0.32, 0.85],
    interior: true,
    view: { azimuth: 108, elevation: 24, distance: 1.05 },
  },
  {
    id: "rear",
    label: "Rear seats & comfort",
    summary: "Rear space, seats and comfort features for passengers.",
    zones: ["rear_seats"],
    center: [0.66, 0.52, 0],
    radius: [0.13, 0.3, 0.85],
    interior: true,
    view: { azimuth: 76, elevation: 24, distance: 1.05 },
  },
  {
    id: "range",
    label: "Range & charging",
    summary: "Range as experienced, charging speed and charging at home and on the road.",
    zones: ["battery", "charge_port"],
    center: [0.5, 0.14, 0],
    radius: [0.3, 0.13, 0.85],
    interior: true,
    view: { azimuth: 90, elevation: 14, distance: 1.2 },
  },
  {
    id: "dynamics",
    label: "Driving dynamics",
    summary: "Powertrain, chassis, wheels and how the car feels to drive.",
    zones: ["hood", "wheels"],
    center: [0.5, 0.2, 0],
    radius: [0.6, 0.24, 1.25],
    interior: false,
    tint: 0.6,
    view: { azimuth: 62, elevation: 10, distance: 1.25 },
  },
];

export function areaForZone(zone: ZoneId): AreaId {
  return (areas.find((a) => a.zones.includes(zone)) ?? areas[0]).id;
}

/** For things that only carry the contract's car area (today's equipment, a requirement without its case). */
export function areaForCarArea(carArea: CarArea): AreaId {
  return areaForZone(areaFallback[carArea]);
}

export interface CarModel {
  file: string;
  /** Body style and electric variant, as shown under the car's name. */
  body: string;
  /** Real overall length in metres, used to scale the model. */
  length: number;
  /** The viewer finds the car's axes from its proportions (longest = length, shortest = height). These say which end is which. */
  flipFront: boolean;
  flipUp: boolean;
  /** Shown under the viewer. Says what the model is and is not. */
  note: string;
  credit: string;
}

/** The car lines the demo covers: the ones we have a usable 3D model for. */
export const modelledSeries = ["G60", "G70"] as const satisfies readonly Series[];
export type ModelledSeries = (typeof modelledSeries)[number];

export function isModelled(series: Series): series is ModelledSeries {
  return (modelledSeries as readonly Series[]).includes(series);
}

/** The car a case is shown on: its own line, or the first related line we have a model for. */
export function modelSeriesFor(c: Pick<Case, "series" | "relatedSeries">): ModelledSeries | null {
  return [c.series, ...c.relatedSeries].find(isModelled) ?? null;
}

export const carModels: Record<ModelledSeries, CarModel> = {
  G60: {
    file: "/models/g60-i5.glb",
    body: "Sedan, incl. i5",
    length: 5.06,
    flipFront: true,
    flipUp: false,
    note: "BMW i5 M60 (G60) community model, materials rebuilt by us. Zones are approximate regions, not exact parts.",
    credit: "Model: “2023 BMW i5 M60” by Nazh Design, CC BY 4.0 (Sketchfab)",
  },
  G70: {
    file: "/models/g70-i7.glb",
    body: "Sedan, incl. i7",
    length: 5.39,
    flipFront: false,
    flipUp: false,
    note: "BMW i7 (G70) community model, materials rebuilt by us. Zones are approximate regions, not exact parts.",
    credit: "Model: “2023 BMW i7 G70” by Nazh Design, CC BY 4.0 (Sketchfab)",
  },
};
