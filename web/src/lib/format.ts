export function fmtDate(iso?: string) {
  if (!iso) return "—";
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function fromNow(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  // The synthetic world's clock starts the morning after the hackathon: treat near-future times as "just now".
  if (diff < 0 && diff > -2 * 24 * 60 * 60_000) return "just now";
  const abs = Math.abs(diff);
  const m = 60_000;
  const h = 60 * m;
  const day = 24 * h;
  const fmt = (n: number, u: string) => `${n} ${u}${n === 1 ? "" : "s"}`;
  const s = abs < h ? fmt(Math.max(1, Math.round(abs / m)), "min") : abs < day ? fmt(Math.round(abs / h), "hour") : abs < 60 * day ? fmt(Math.round(abs / day), "day") : fmtDate(iso);
  if (abs >= 60 * day) return s;
  return diff >= 0 ? `${s} ago` : `in ${s}`;
}

export const pct = (n?: number, digits = 0) => (n === undefined ? "—" : `${(n * 100).toFixed(digits)}%`);
export const num = (n: number) => n.toLocaleString("en-GB");
export const score = (n?: number) => (n === undefined ? "—" : n.toFixed(2));

export function download(filename: string, content: string, mime = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
