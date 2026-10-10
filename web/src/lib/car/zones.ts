import type { CarArea, Case, Series } from "@/contracts";

/**
 * Where a case sits on the car. UI-only: the contract has no "zone", so a case
 * is placed by keywords in its feature name and title, then by its car area.
 *
 * Zones are regions of the car's bounding box, not named parts, because the
 * 3D models we have are merged shells without separable parts. Coordinates are
 * normalised so the same zone works on every body:
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

export type BodyStyle = "sedan" | "hatchback";

export interface Zone {
  id: ZoneId;
  label: string;
  center: [u: number, v: number, w: number];
  radius: [u: number, v: number, w: number];
  /** Inside the cabin or under the skin: the body is shown see-through. */
  interior: boolean;
  /** Camera: degrees around the car (0 = from the front, 90 = from the left), degrees above the horizon, distance in car lengths. */
  view: { azimuth: number; elevation: number; distance: number };
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

/** A hatchback has no boot lid: the luggage area sits lower and further back. */
const bodyOverrides: Record<BodyStyle, Partial<Record<ZoneId, Partial<Zone>>>> = {
  sedan: {},
  hatchback: {
    trunk: { center: [0.9, 0.55, 0], radius: [0.1, 0.28, 0.85] },
    rear_seats: { center: [0.68, 0.5, 0] },
    roof: { center: [0.56, 0.97, 0], radius: [0.2, 0.09, 0.6] },
  },
};

export function getZone(id: ZoneId, body: BodyStyle): Zone {
  return { ...zones[id], ...bodyOverrides[body][id] };
}

export const zoneIds = Object.keys(zones) as ZoneId[];

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
  [/charge port|charging flap|vehicle-to-load|bidirectional/, "charge_port"],
  [/range|charging|battery|cltc|wltp/, "battery"],
  [/start-stop|msa\b|engine|exhaust|drivetrain|motor\b/, "hood"],
  [/sport(y|iness)|handling|chassis|suspension|\bride\b/, "wheels"],
  [/climate|cool[- ]?down|cools down|air[- ]?con|a\/c|hvac|heater|vents?\b/, "climate"],
  [/carplay|android auto|wireless charging|phone|esim|wi-?fi|hotspot/, "console"],
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

export interface CarModel {
  file: string;
  body: BodyStyle;
  /** Real overall length in metres, used to scale the model. */
  length: number;
  /** The viewer finds the car's axes from its proportions (longest = length, shortest = height). These say which end is which. */
  flipFront: boolean;
  flipUp: boolean;
  /** Shown under the viewer. Says what the model is and is not. */
  note: string;
  credit: string;
  /** The file is single-colour, so the viewer gives it a neutral paint. */
  repaint: boolean;
}

/**
 * One model per series. The 7 Series has no file yet, so it borrows the
 * 5 Series body and says so.
 */
export const carModels: Record<Series, CarModel> = {
  G60: {
    file: "/models/g60-i5.glb",
    body: "sedan",
    length: 5.06,
    flipFront: true,
    flipUp: false,
    note: "BMW i5 M60 (G60) community model. Zones are approximate regions, not exact parts.",
    credit: "Model: “2023 BMW i5 M60” by Nazh Design, CC BY 4.0 (Sketchfab)",
    repaint: true,
  },
  F70: {
    file: "/models/f70-1series.glb",
    body: "hatchback",
    length: 4.36,
    flipFront: false,
    flipUp: false,
    note: "AI-generated 1 Series (F70) shape: exterior shell only, no interior. Zones are approximate regions.",
    credit: "Model: “Bmw-1-series 2025” by teenlin3, CC BY 4.0 (Sketchfab)",
    repaint: false,
  },
  G70: {
    file: "/models/g60-i5.glb",
    body: "sedan",
    length: 5.39,
    flipFront: true,
    flipUp: false,
    note: "Stand-in: no 7 Series model yet, shown on the 5 Series body. Zones are approximate regions.",
    credit: "Model: “2023 BMW i5 M60” by Nazh Design, CC BY 4.0 (Sketchfab)",
    repaint: true,
  },
};
