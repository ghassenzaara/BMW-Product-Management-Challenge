import type { Market, SignalKind } from "@/contracts";

/** Parses CSV text (quoted fields, escaped quotes, line breaks inside quotes). Delimiter: comma or semicolon, whichever the header uses more. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const header = src.slice(0, src.indexOf("\n") === -1 ? src.length : src.indexOf("\n"));
  const delim = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const find = (header: string[], re: RegExp) => header.findIndex((h) => re.test(h.trim()));

/** Guesses which columns hold the text, a title, the market and the kind. The text column falls back to the longest one. */
export function guessColumns(header: string[], rows: string[][]) {
  let text = find(header, /^(text|quote|verbatim|comment|feedback|review|message|body|content)/i);
  if (text === -1) {
    const avg = header.map((_, i) => rows.slice(0, 50).reduce((n, r) => n + (r[i]?.length ?? 0), 0));
    text = avg.indexOf(Math.max(...avg));
  }
  return {
    text,
    title: find(header, /^(title|summary|subject|headline)/i),
    market: find(header, /^(market|region|country)/i),
    kind: find(header, /^(kind|type|sentiment|category)/i),
  };
}

export function toMarket(v: string | undefined, fallback: Market): Market {
  const x = (v ?? "").trim().toLowerCase();
  if (!x) return fallback;
  if (/^(us|usa|united states|america)/.test(x)) return "US";
  if (/^(cn|china|prc)/.test(x)) return "CN";
  if (/^(eu|europe|de|germany|uk|gb|united kingdom|fr|france|it|italy|es|spain|nl|at|ch)/.test(x)) return "EU";
  if (/^(row|rest)/.test(x)) return "RoW";
  return fallback;
}

export function toKind(v: string | undefined, fallback: SignalKind): SignalKind {
  const x = (v ?? "").trim().toLowerCase();
  if (/like|positive|praise|love/.test(x)) return "like";
  if (/wish|request|idea|suggest/.test(x)) return "wish";
  if (/complain|negative|problem|defect|issue/.test(x)) return "complaint";
  if (/compet/.test(x)) return "competitor_fact";
  if (/trend/.test(x)) return "trend";
  return fallback;
}
