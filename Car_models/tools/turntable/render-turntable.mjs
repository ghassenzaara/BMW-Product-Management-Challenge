// Renders a car as a turntable sheet: many angles on a transparent background, packed into one WebP.
// The page plays it with a CSS animation, so the preview costs no WebGL and no JavaScript.
// Usage: node render-turntable.mjs <model.glb> <out.webp> [front=-x] [length=5.06] [frames=60] [cols=10] [start=0]
// Needs puppeteer-core and sharp (DEPS_DIR: a folder whose node_modules has them) and three (THREE_DIR: .../node_modules/three).
import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const [model, out, front = "-x", length = "5.06", frames = "60", cols = "10", start = "0"] = process.argv.slice(2);
const tw = 640, th = 240, rows = Math.ceil(Number(frames) / Number(cols));
const need = createRequire(pathToFileURL(join(process.env.DEPS_DIR, "x.js")).href);
const puppeteer = need("puppeteer-core"), sharp = need("sharp");

const types = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = path === "/model.glb" ? model : path.startsWith("/three/") ? join(process.env.THREE_DIR, normalize(path.slice(7)).replace(/^(\.\.[\\/])+/, "")) : join(here, "turn.html");
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[file.slice(file.lastIndexOf("."))] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
  protocolTimeout: 900000,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage();
await page.setViewport({ width: tw * Number(cols), height: th * rows, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 300)));
await page.goto(`http://127.0.0.1:${server.address().port}/?front=${front}&length=${length}&frames=${frames}&cols=${cols}&w=${tw}&h=${th}&start=${start}`, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => document.title === "ready", { timeout: 900000 });
const png = await page.screenshot({ omitBackground: true, type: "png" });
await sharp(png).webp({ quality: 78, alphaQuality: 80, effort: 5 }).toFile(out);
console.log("wrote", out, `${tw}x${th} x ${frames} frames`);
await browser.close();
server.close();
