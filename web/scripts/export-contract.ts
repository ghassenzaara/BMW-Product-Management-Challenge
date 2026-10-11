/**
 * Exports the REST contract for the backend and data teams.
 *
 *   npm run export-contract
 *
 * Writes (repo root):
 *   contracts/openapi.yaml            every endpoint of src/contracts/api.ts (OpenAPI 3.1)
 *   contracts/schemas/<Entity>.json   JSON Schema per entity (e.g. for Pydantic codegen)
 *
 * Uses Zod 4's native JSON Schema output; named entities become
 * components.schemas and are referenced with $ref.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { stringify } from "yaml";
import * as entities from "../src/contracts/entities";
import { endpoints } from "../src/contracts/api";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../contracts");
mkdirSync(resolve(outDir, "schemas"), { recursive: true });

const named = Object.entries(entities).filter(([, v]) => v instanceof z.ZodType) as [string, z.ZodType][];
const reg = z.registry<{ id: string }>();
for (const [name, schema] of named) reg.add(schema, { id: name });

const components: Record<string, unknown> = {};
type Json = Record<string, unknown>;

/** JSON Schema for a Zod schema, with registered entities hoisted to components. */
function schemaOf(schema: z.ZodType, io: "input" | "output" = "output"): Json {
  const raw = z.toJSONSchema(schema, { metadata: reg, unrepresentable: "any", io, target: "draft-2020-12" }) as Json;
  const text = JSON.stringify(raw).replaceAll('"#/$defs/', '"#/components/schemas/');
  const json = JSON.parse(text) as Json & { $defs?: Record<string, Json> };
  for (const [k, v] of Object.entries(json.$defs ?? {})) components[k] ??= v;
  delete json.$defs;
  delete json.$schema;
  return json;
}

const paths: Record<string, Record<string, unknown>> = {};
for (const [name, def] of Object.entries(endpoints)) {
  const d = def as { method: string; path: string; summary: string; tag: string; query?: z.ZodObject; body?: z.ZodType; response: z.ZodType };
  const oasPath = d.path.replace(/:([a-zA-Z]+)/g, "{$1}");
  const parameters = [
    ...[...d.path.matchAll(/:([a-zA-Z]+)/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } })),
    ...(d.query
      ? Object.entries(d.query.shape).map(([k, v]) => ({
          name: k,
          in: "query",
          required: !(v as z.ZodType).safeParse(undefined).success,
          schema: schemaOf(v as z.ZodType, "input"),
        }))
      : []),
  ];
  paths[oasPath] ??= {};
  paths[oasPath][d.method.toLowerCase()] = {
    operationId: name,
    summary: d.summary,
    tags: [d.tag],
    parameters: parameters.length ? parameters : undefined,
    requestBody: d.body ? { required: true, content: { "application/json": { schema: schemaOf(d.body, "input") } } } : undefined,
    responses: {
      200: { description: "OK", content: { "application/json": { schema: schemaOf(d.response) } } },
      400: { description: "Invalid request (Zod issues)" },
      403: { description: "Not allowed for this user (e.g. not the owner)" },
      404: { description: "Not found" },
      409: { description: "Invalid state transition" },
    },
  };
}
for (const [name, schema] of named) components[name] ??= schemaOf(schema);

const doc = {
  openapi: "3.1.0",
  info: {
    title: "Argon API",
    version: "0.1.0",
    description:
      "Contract between the UI and the backend. Source of truth: web/src/contracts (Zod). Regenerate with `npm run export-contract` in web/. Reference implementation (mock): web/src/mock.",
  },
  servers: [{ url: "/api", description: "Mock backend (Next.js route handlers)" }],
  security: [{ userHeader: [] }],
  paths,
  components: {
    securitySchemes: {
      userHeader: { type: "apiKey", in: "header", name: "x-user-id", description: "Mock auth: the acting user's id. The real backend uses a bearer token." },
    },
    schemas: components,
  },
};
writeFileSync(resolve(outDir, "openapi.yaml"), stringify(JSON.parse(JSON.stringify(doc)), { aliasDuplicateObjects: false, lineWidth: 0 }));

for (const [name, schema] of named) {
  writeFileSync(resolve(outDir, "schemas", `${name}.json`), JSON.stringify(z.toJSONSchema(schema, { unrepresentable: "any" }), null, 2));
}
console.log(`contracts/openapi.yaml: ${Object.keys(endpoints).length} endpoints, ${Object.keys(components).length} component schemas`);
