import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { endpoints, type EndpointName } from "@/contracts";
import { handlers } from "@/mock/handlers";
import { ApiError, db } from "@/mock/store";

/**
 * MOCK BACKEND. One catch-all route that implements the REST contract in
 * src/contracts/api.ts on the in-memory store. The real backend (FastAPI on
 * Supabase) implements the same contract; point NEXT_PUBLIC_API_BASE_URL at it
 * and this folder can be deleted.
 */

const routes = (Object.keys(endpoints) as EndpointName[]).map((name) => {
  const def = endpoints[name];
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      def.path.replace(/:[a-zA-Z]+/g, (m) => {
        keys.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$",
  );
  return { name, def, keys, pattern };
});

function match(method: string, path: string) {
  for (const r of routes) {
    if (r.def.method !== method) continue;
    const m = path.match(r.pattern);
    if (m) return { ...r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const route = match(req.method, "/" + path.join("/"));
  if (!route) return Response.json({ error: `No endpoint ${req.method} /${path.join("/")}` }, { status: 404 });

  try {
    const userId = req.headers.get("x-user-id") ?? req.cookies.get("rs_user")?.value ?? "u-lena";
    const user = db().users.find((u) => u.id === userId);
    if (!user) throw new ApiError(401, `Unknown user ${userId}`);

    const def = route.def as { query?: { parse(v: unknown): unknown }; body?: { parse(v: unknown): unknown }; response: { safeParse(v: unknown): { success: boolean; error?: ZodError } } };
    const query = def.query ? def.query.parse(Object.fromEntries(req.nextUrl.searchParams)) : {};
    let body: unknown = undefined;
    if (def.body) {
      const text = await req.text();
      body = def.body.parse(text ? JSON.parse(text) : {});
    }

    const handler = handlers[route.name] as (c: unknown) => unknown;
    const result = await handler({ params: route.params, query, body, user });

    if (process.env.NODE_ENV !== "production") {
      const check = def.response.safeParse(result);
      if (!check.success) console.error(`[mock] ${route.name} response breaks the contract:`, check.error?.issues.slice(0, 5));
    }
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    console.error("[mock] unhandled", error);
    return Response.json({ error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
