// Click-through check of the requirement trace: replay opened from the side sheet and from the page,
// every control clicked, the overlay and the sheet must stay, the URL must not change unless a link says so.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3040";
const CHROME = `${process.env.USERPROFILE}\\.browser-driver-manager\\chrome\\win64-155.0.8059.39\\chrome-win64\\chrome.exe`;
await fetch(`${BASE}/api/admin/reset`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-katrin" }, body: "{}" });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--remote-debugging-port=9709"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setCookie({ name: "rs_user", value: "u-lena", url: BASE });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const has = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);
const check = async (what, cond) => { const ok = await cond(); if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"}  ${what}`); };
const clickText = (t, scope = "body") => page.evaluate((x, s) => { const root = document.querySelector(s) ?? document.body; const el = [...root.querySelectorAll("button, a, [role=tab]")].find((e) => e.textContent?.trim().includes(x)); el?.click(); return !!el; }, t, scope);
const realClick = async (sel) => { const box = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; el.scrollIntoView({ block: "nearest", inline: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel); if (!box) { console.log("   (no element " + sel + ")"); return false; } await page.mouse.click(box.x, box.y); return true; };
const overlay = '[role="dialog"]:has(> h2.sr-only), [role="dialog"][aria-labelledby]';
const replayOpen = () => page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].some((d) => d.textContent?.includes("Trace replay")));
const sheetOpen = () => page.evaluate(() => !!document.querySelector('[data-slot="sheet-content"]'));

// 1. Side sheet from the case page
await page.goto(`${BASE}/cases/CASE-G60-0013?step=requirements`, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForFunction(() => document.body.innerText.includes("Highway range"), { timeout: 60000 });
await clickText("Next gen ·");
await page.waitForFunction(() => document.body.innerText.includes("SMART specification"), { timeout: 30000 });
const url0 = page.url();
await check("side sheet opens", sheetOpen);
await page.evaluate(() => [...document.querySelectorAll('[data-slot="sheet-content"] button')].find((b) => b.textContent?.trim() === "Replay")?.click());
await page.waitForFunction(() => document.body.innerText.includes("Where it ended up"), { timeout: 30000 });
await check("replay opens from the sheet", replayOpen);
// Real mouse clicks on controls inside the overlay
for (const [label, sel] of [
  ["beat Case & score", null], ["Next beat", 'button[aria-label^="Next beat"]'], ["Previous beat", 'button[aria-label^="Previous beat"]'], ["Speed", 'button[aria-label="Speed"]'],
  ["a timeline card", 'ol[aria-label="Decisions timeline"] li:nth-child(2) button'], ["the scrubber", 'input[aria-label="Scrub the timeline"]'], ["a Sankey box", '[role="dialog"] section button'],
  ["the stage background", '[role="dialog"] aside'],
]) {
  if (sel) await realClick(sel);
  else {
    const h = await page.evaluateHandle(() => [...document.querySelectorAll('nav[aria-label="Beats"] button')].find((b) => b.textContent?.includes("Case & score")));
    await h.asElement()?.click();
  }
  await sleep(500);
  const st = { replay: await replayOpen(), sheet: await sheetOpen(), url: page.url().replace(BASE, "") }; await check(`click ${label}: replay still open, sheet still open, URL unchanged ${JSON.stringify(st)}`, async () => st.replay && st.sheet && page.url() === url0);
}
await check("timeline card click sets the scrubber state", () => page.evaluate(() => !!document.querySelector('ol[aria-label="Decisions timeline"] button[aria-current="step"]')));
await page.keyboard.press("Escape");
await sleep(500);
await check("Escape closes the replay only (sheet stays)", async () => !(await replayOpen()) && (await sheetOpen()));
// Trace steps in the sheet open previews, not pages
await page.evaluate(() => [...document.querySelectorAll('[data-slot="sheet-content"] button')].find((b) => b.textContent?.includes("Signals"))?.click());
await sleep(500);
await check("Signals step opens a preview in place", async () => (await has("Open the evidence on the case")) && page.url() === url0 && (await sheetOpen()));
await page.keyboard.press("Escape");
await sleep(300);
await check("Escape closes the preview, sheet stays", async () => !(await has("Open the evidence on the case")) && (await sheetOpen()));

// 2. Requirement page: the preview link is the explicit way out
await page.goto(`${BASE}/requirements/REQ-G60-0010`, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForFunction(() => document.body.innerText.includes("SMART specification"), { timeout: 60000 });
const url1 = page.url();
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Case (problem)"))?.click());
await sleep(500);
await check("Case step opens a preview, page stays", async () => (await has("Open the case")) && page.url() === url1);
await page.evaluate(() => [...document.querySelectorAll("a")].find((a) => a.textContent?.includes("Open the case"))?.click());
await page.waitForFunction((u) => location.href !== u, { timeout: 20000 }, url1).catch(() => {});
await check(`"Open the case" navigates to the case (${page.url().replace(BASE, "")})`, async () => page.url().includes("/cases/"));
await page.goto(`${BASE}/requirements/REQ-G60-0010`, { waitUntil: "networkidle2", timeout: 120000 });
await page.waitForFunction(() => document.body.innerText.includes("SMART specification"), { timeout: 60000 });
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Replay")?.click());
await page.waitForFunction(() => document.body.innerText.includes("Where it ended up"), { timeout: 30000 });
const playLabel = () => page.evaluate(() => [...document.querySelectorAll('[role="dialog"] header button')].map((b) => b.textContent?.trim()).find((t) => t === "Pause" || t === "Play" || t === "Replay"));
const before = await playLabel();
await page.keyboard.press("Space");
await sleep(400);
const after = await playLabel();
await check(`Space toggles play/pause (${before} -> ${after})`, async () => before !== after);
await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Beats"] button')].find((b) => b.textContent?.includes("Chain check"))?.click());
await page.waitForFunction(() => document.body.innerText.includes("Chain intact"), { timeout: 20000 }).catch(() => {});
await check("Chain check reachable, Export dossier present", async () => (await has("Chain intact")) && (await has("Export dossier")));
await realClick('button[aria-label="Close (Esc)"]');
await sleep(400);
await check("Close button closes the replay, page stays", async () => !(await replayOpen()) && page.url() === url1);
console.log(`\n${fails} failure(s); page errors: ${errors.length ? errors.join(" | ") : "none"}`);
await browser.close();
