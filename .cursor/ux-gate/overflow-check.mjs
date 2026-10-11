// 390px horizontal-overflow check: elements inside <main> that stick out past the viewport.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE_URL ?? "http://localhost:3020";
const CHROME = `${process.env.USERPROFILE}\\.browser-driver-manager\\chrome\\win64-155.0.8059.39\\chrome-win64\\chrome.exe`;
const routes = ["/", "/inbox", "/cases", "/cases/CASE-G60-0003", "/cases/CASE-G60-0003?step=knowledge", "/requirements/REQ-G60-0010", "/plan/G60", "/radar", "/innovation", "/settings", "/audit", "/brief"];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--remote-debugging-port=9705"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.setCookie({ name: "rs_user", value: "u-lena", url: BASE });
for (const r of routes) {
  await page.goto(`${BASE}${r}`, { waitUntil: "networkidle2", timeout: 120000 });
  await new Promise((res) => setTimeout(res, 1500));
  const out = await page.evaluate(() => {
    const main = document.querySelector("main");
    if (!main) return { scroll: 0, client: 0, offenders: [] };
    const vw = document.documentElement.clientWidth;
    const offenders = [...main.querySelectorAll("*")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.right <= vw + 1) return false;
        // ignore children of intentional horizontal scrollers (kanban, tables)
        for (let p = el.parentElement; p && p !== main; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "hidden") return false;
        }
        return true;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} right=${Math.round(el.getBoundingClientRect().right)}`);
    return { scroll: main.scrollWidth, client: main.clientWidth, offenders };
  });
  console.log(`${out.scroll > out.client + 1 || out.offenders.length ? "OVERFLOW" : "ok      "} ${r}  main ${out.scroll}/${out.client}`);
  for (const o of out.offenders) console.log("    ", o);
}
await browser.close();
