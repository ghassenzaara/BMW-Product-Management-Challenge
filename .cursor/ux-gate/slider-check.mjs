// Real-input check of the ripple factor slider: keyboard ArrowRight ×5 and a mouse drag.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3021";
const CHROME = `${process.env.USERPROFILE}\\.browser-driver-manager\\chrome\\win64-155.0.8059.39\\chrome-win64\\chrome.exe`;
const post = (path, user, body) => fetch(`${BASE}/api${path}`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": user }, body: JSON.stringify(body ?? {}) });

await post("/admin/reset", "u-katrin");
await post("/agent-runs/refresh", "u-lena", { series: "G60" });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--remote-debugging-port=9703"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setCookie({ name: "rs_user", value: "u-lena", url: BASE });
await page.goto(`${BASE}/ripple/RIP-0001`, { waitUntil: "networkidle2" });
await page.waitForSelector('input[type="range"]');
const state = () => page.evaluate(() => ({ text: [...document.querySelectorAll("p")].map((p) => p.textContent).find((t) => t?.includes("CLTC ≈")), value: document.querySelector('input[type="range"]').value, row: [...document.querySelectorAll("tr")].map((r) => r.textContent).find((t) => t?.includes("5 Series") && !t.includes("China")) }));
console.log("start", await state());
await page.focus('input[type="range"]');
for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
await new Promise((r) => setTimeout(r, 600));
console.log("after ArrowRight x5", await state());
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Team value"))?.click());
await new Promise((r) => setTimeout(r, 400));
console.log("after Team value reset", await state());
const box = await (await page.$('input[type="range"]')).boundingBox();
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.99, box.y + box.height / 2, { steps: 8 });
await page.mouse.up();
await new Promise((r) => setTimeout(r, 600));
console.log("after mouse drag to the right end", await state());
await browser.close();
