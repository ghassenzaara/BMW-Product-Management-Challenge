// Console errors (incl. hydration) on a few routes of a dev server.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3020";
const CHROME = `${process.env.USERPROFILE}\\.browser-driver-manager\\chrome\\win64-155.0.8059.39\\chrome-win64\\chrome.exe`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--remote-debugging-port=9704"] });
for (const [path, user] of [["/login", "u-wei"], ["/brief?onboarding=1", "u-wei"], ["/ripple/RIP-0001", "u-katrin"], ["/", "u-katrin"]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  if (user) await page.setCookie({ name: "rs_user", value: user, url: BASE });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 600)));
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 600)));
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 120000 });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(`== ${path}: ${errors.length} error(s)`);
  for (const e of errors) console.log("  ", e);
  await page.close();
}
await browser.close();
