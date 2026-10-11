import seed from "./fixtures/seed.json";
import type { ActorType, AuditEvent, Dataset, Notification, ObjectType, RequirementCheck, ScoreSnapshot } from "@/contracts";

/**
 * In-memory store behind the mock REST API. One process-wide instance
 * (survives Next.js hot reloads via globalThis). POST /api/admin/reset restores the seed.
 * The real backend replaces all of src/mock; nothing in the UI imports from here.
 */

const g = globalThis as unknown as { __rsStore?: Dataset; __rsSeq?: Record<string, number>; __rsChecks?: Map<string, RequirementCheck> };

function fresh(): Dataset {
  return structuredClone(seed) as unknown as Dataset;
}

export function db(): Dataset {
  if (!g.__rsStore) g.__rsStore = fresh();
  return g.__rsStore;
}

export function resetStore() {
  g.__rsStore = fresh();
  g.__rsSeq = {};
  g.__rsChecks = new Map();
}

/** Latest quality check per requirement. Derived data, so it lives beside the dataset, not in the seed. */
export function checks(): Map<string, RequirementCheck> {
  g.__rsChecks ??= new Map();
  return g.__rsChecks;
}

/** Clock of the synthetic world: real time, but never before the seed's "now". */
export function now(): string {
  const t = Math.max(Date.now(), new Date(db().generatedAt).getTime());
  return new Date(t).toISOString();
}

export function nextId(prefix: string, existing: { id: string }[], pad = 4): string {
  g.__rsSeq ??= {};
  const max = existing
    .map((e) => e.id)
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length).replace(/\D/g, "")))
    .filter((n) => !Number.isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  const n = Math.max(max, g.__rsSeq[prefix] ?? 0) + 1;
  g.__rsSeq[prefix] = n;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

export function audit(e: {
  actorId: string;
  action: string;
  objectType: ObjectType;
  objectId: string;
  before?: unknown;
  after?: unknown;
  rationale?: string;
  actorType?: ActorType;
  scoreSnapshot?: ScoreSnapshot;
}): AuditEvent {
  const d = db();
  const event: AuditEvent = {
    seq: (d.audit.at(-1)?.seq ?? 0) + 1,
    at: now(),
    actorType: e.actorType ?? (e.actorId.startsWith("agent:") ? "ai" : "human"),
    ...e,
  };
  d.audit.push(event);
  return event;
}

export function notify(n: Omit<Notification, "id" | "read" | "createdAt">) {
  const d = db();
  d.notifications.push({ ...n, id: nextId("N-", d.notifications), read: false, createdAt: now() });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function must<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new ApiError(404, `${what} not found`);
  return value;
}
