import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn, execFileSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const width = Number(args.width ?? 960);
const height = Number(args.height ?? 540);
const port = Number(args.port ?? 4313);
const outDir = resolve(args.output ?? "output/keyframes");

const shots = [
  ["C01-a", 2.5],
  ["C01-b", 5.6],
  ["C02-a", 8.5],
  ["C02-b", 11.6],
  ["C03-a", 15.5],
  ["C03-b", 18.8],
  ["C04-a", 22.0],
  ["C04-b", 26.5],
  ["C05-a", 31.0],
  ["C05-b", 34.5],
  ["C06-a", 39.0],
  ["C06-b", 42.5],
  ["C07-a", 46.5],
  ["C07-b", 51.0],
  ["C08-a", 56.0],
  ["C08-b", 60.5],
  ["C09-a", 65.0],
  ["C09-b", 69.0],
  ["C10-a", 73.0],
  ["C10-b", 76.5],
  ["C11-a", 80.0],
  ["C11-b", 82.8],
  ["C12-a", 85.5],
  ["C12-b", 88.3]
];

await mkdir(outDir, { recursive: true });

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForServer(port);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => console.error(`[page:error] ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/?w=${width}&h=${height}&fps=25`, {
    waitUntil: "networkidle"
  });
  await page.waitForFunction(() => typeof window.renderFilmFrame === "function");

  for (const [name, time] of shots) {
    await page.evaluate((seconds) => window.renderFilmFrame(seconds), time);
    await page.screenshot({
      path: resolve(outDir, `${name}_${String(time).replace(".", "p")}s.png`),
      clip: { x: 0, y: 0, width, height }
    });
  }

  await browser.close();
  buildContactSheet(outDir, width, height);
  console.log(`Rendered ${shots.length} keyframes into ${outDir}`);
} finally {
  server.kill("SIGTERM");
}

function buildContactSheet(dir, width, height) {
  const files = shots.map(([name, time]) => resolve(dir, `${name}_${String(time).replace(".", "p")}s.png`));
  const labeled = files.map((file, i) => {
    const out = resolve(dir, `labeled_${String(i + 1).padStart(2, "0")}.png`);
    const [name, time] = shots[i];
    execFileSync("magick", [
      file,
      "-gravity",
      "NorthWest",
      "-fill",
      "#20242C",
      "-undercolor",
      "#FFFFFFCC",
      "-pointsize",
      String(Math.round(width / 34)),
      "-annotate",
      "+18+18",
      `${name}  ${time.toFixed(1)}s`,
      out
    ]);
    return out;
  });

  execFileSync("magick", [
    "montage",
    ...labeled,
    "-tile",
    "4x6",
    "-geometry",
    `${width}x${height}+16+16`,
    "-background",
    "#F6F7FA",
    resolve(dir, "contact_sheet.png")
  ]);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    parsed[key] = value;
  }
  return parsed;
}

async function waitForServer(port) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error(`Vite server did not start on port ${port}.`);
}
