/**
 * UX gate: screenshots (1440 / 768, light / dark), axe violations and Lighthouse
 * (accessibility + best practices) for the web/ app, logged in as a persona.
 *
 *   node gate.mjs --out ../../docs/ux-audit/baseline [--targets targets.json] [--only name1,name2] [--no-lighthouse]
 *
 * The persona is the `rs_user` cookie (web/src/lib/session.ts). The theme is next-themes'
 * localStorage key `theme`. The demo store is reset first; targets can ask for a Refresh
 * (agent run) so the ripple exists. Chrome for Testing comes from browser-driver-manager.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import lighthouse from "lighthouse";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => { const [k, ...v] = a.trim().split(" "); return [k, v.join(" ") || true]; }));
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), args.out ?? "out");
const CHROME = process.env.CHROME_TEST_PATH ?? `${process.env.USERPROFILE}\\.browser-driver-manager\\chrome\\win64-155.0.8059.39\\chrome-win64\\chrome.exe`;
const targets = JSON.parse(readFileSync(resolve(here, args.targets ?? "targets.json"), "utf8")).filter((t) => !args.only || String(args.only).split(",").includes(t.name));
const WIDTHS = (process.env.WIDTHS ?? "1440,768").split(",").map(Number);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9333);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
mkdirSync(resolve(OUT, "screens"), { recursive: true });

const api = (path, user, body) =>
  fetch(`${BASE}/api${path}`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": user }, body: JSON.stringify(body ?? {}) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function prepare(setup) {
  await api("/admin/reset", "u-katrin");
  if (setup?.includes("refresh")) await api("/agent-runs/refresh", "u-lena", { series: "G60" });
}

async function clickText(page, text) {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button, a, [role=tab], [role=button]")].find((e) => e.textContent?.trim().includes(t) && !e.closest("[aria-hidden=true]"));
    if (el) (el).click();
    return !!el;
  }, text);
  if (!ok) throw new Error(`no clickable element with text "${text}"`);
}

async function open(page, t) {
  await page.goto(`${BASE}${t.path}`, { waitUntil: "networkidle2" });
  if (t.waitFor) await page.waitForFunction((w) => document.body.innerText.includes(w), { timeout: 20000 }, t.waitFor);
  else await sleep(1500);
  for (const a of t.actions ?? []) {
    if (a.click) await clickText(page, a.click);
    if (a.sel) await page.click(a.sel);
    if (a.key) await page.keyboard.press(a.key);
    if (a.wait) await page.waitForFunction((w) => document.body.innerText.includes(w), { timeout: 20000 }, a.wait);
    await sleep(a.ms ?? 900);
  }
  await sleep(t.settle ?? 600);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: [`--remote-debugging-port=${CDP_PORT}`, "--no-first-run"], defaultViewport: null });
const results = [];
let lastSetup = null;
try {
  for (const t of targets) {
    const setup = t.setup ?? "reset";
    if (setup !== lastSetup || t.freshSetup) await prepare(setup);
    lastSetup = setup;
    const page = await browser.newPage();
    await page.setCookie({ name: "rs_user", value: t.persona ?? "u-lena", url: BASE });
    const shots = [];
    for (const theme of ["light", "dark"]) {
      for (const width of WIDTHS) {
        await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
        await page.evaluateOnNewDocument((th) => localStorage.setItem("theme", th), theme);
        await open(page, t);
        const file = `screens/${t.name}_${width}_${theme}.png`;
        await page.screenshot({ path: resolve(OUT, file), fullPage: true });
        shots.push(file);
      }
    }
    // axe on the 1440 light state (with the target's actions applied).
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument((th) => localStorage.setItem("theme", th), process.env.AXE_THEME ?? "light");
    await open(page, t);
    await page.evaluate(axeSource);
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")) }));
    });
    // Lighthouse on route-level targets only (it reloads the page, so actions are not replayed).
    let lh = null;
    if (!args["no-lighthouse"] && !t.actions?.length) {
      const run = await lighthouse(`${BASE}${t.path}`, { port: CDP_PORT, output: "json", logLevel: "error", onlyCategories: ["accessibility", "best-practices"], disableStorageReset: true, formFactor: "desktop", screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttlingMethod: "provided" });
      const c = run.lhr.categories;
      lh = {
        accessibility: Math.round((c.accessibility?.score ?? 0) * 100),
        bestPractices: Math.round((c["best-practices"]?.score ?? 0) * 100),
        failing: Object.values(run.lhr.audits).filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === "binary").map((a) => a.id),
      };
    }
    await page.close();
    results.push({ name: t.name, title: t.title, persona: t.persona ?? "u-lena", path: t.path, shots, axe, lighthouse: lh });
    console.log(`${t.name}: axe ${axe.length} rule(s) / ${axe.reduce((s, v) => s + v.nodes, 0)} node(s)${lh ? `, LH a11y ${lh.accessibility}, BP ${lh.bestPractices}` : ""}`);
  }
} finally {
  await browser.close();
}

writeFileSync(resolve(OUT, "results.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 1));
const md = [
  `# UX gate · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
  "",
  "| Screen / state | Persona | axe rules (nodes) | Lighthouse a11y | Best practices | Screenshots |",
  "|---|---|---|---|---|---|",
  ...results.map((r) => `| ${r.title} | ${r.persona} | ${r.axe.length} (${r.axe.reduce((s, v) => s + v.nodes, 0)}) | ${r.lighthouse?.accessibility ?? "—"} | ${r.lighthouse?.bestPractices ?? "—"} | ${r.shots.map((s) => `[${s.split("_").slice(-2).join(" ").replace(".png", "")}](${s})`).join(" · ")} |`),
  "",
  "## axe violations",
  "",
  ...results.flatMap((r) => (r.axe.length ? [`### ${r.title}`, ...r.axe.map((v) => `- **${v.id}** (${v.impact}, ${v.nodes} nodes): ${v.help} · e.g. \`${v.targets[0] ?? ""}\``), ""] : [])),
].join("\n");
writeFileSync(resolve(OUT, "index.md"), md);
console.log(`written ${resolve(OUT, "index.md")}`);
