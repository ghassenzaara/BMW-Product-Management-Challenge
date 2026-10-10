import { endpoints, type BodyOf, type EndpointName, type QueryOf, type ResponseOf } from "@/contracts";
import { getUserId } from "@/lib/session";

/**
 * Typed client for the REST contract. The UI only talks to the backend through
 * this function. Base URL: NEXT_PUBLIC_API_BASE_URL (default "/api" = the mock).
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface CallOptions<N extends EndpointName> {
  params?: Record<string, string>;
  query?: [QueryOf<N>] extends [never] ? never : Partial<Record<keyof QueryOf<N>, string | number | boolean | undefined>>;
  body?: [BodyOf<N>] extends [never] ? never : BodyOf<N>;
}

export function buildPath<N extends EndpointName>(name: N, opts: CallOptions<N> = {}) {
  const def = endpoints[name];
  const path = def.path.replace(/:([a-zA-Z]+)/g, (_, k: string) => {
    const v = opts.params?.[k];
    if (v === undefined) throw new Error(`Missing path param "${k}" for ${name}`);
    return encodeURIComponent(v);
  });
  const q = Object.entries((opts.query ?? {}) as Record<string, unknown>).filter(([, v]) => v !== undefined && v !== "");
  return path + (q.length ? "?" + new URLSearchParams(q.map(([k, v]) => [k, String(v)])).toString() : "");
}

export async function api<N extends EndpointName>(name: N, opts: CallOptions<N> = {}): Promise<ResponseOf<N>> {
  const def = endpoints[name];
  const headers: Record<string, string> = { "content-type": "application/json" };
  const user = getUserId();
  if (user) headers["x-user-id"] = user;
  const res = await fetch(BASE + buildPath(name, opts), {
    method: def.method,
    headers,
    body: "body" in def ? JSON.stringify(opts.body ?? {}) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, json?.error ?? `Request failed (${res.status})`, json?.issues);
  return json as ResponseOf<N>;
}
