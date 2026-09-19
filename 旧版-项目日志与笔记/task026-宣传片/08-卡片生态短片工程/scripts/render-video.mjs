import { chromium } from "playwright";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const seconds = Number(args.seconds ?? 90);
const width = Number(args.width ?? 1920);
const height = Number(args.height ?? 1080);
const fps = Number(args.fps ?? 25);
const output = resolve(args.output ?? "output/chips_card_ecosystem_silent.webm");
const port = Number(args.port ?? 4310);

await mkdir(dirname(output), { recursive: true });

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForServer(port, server);
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ]
  });

  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("console", (message) => console.log(`[page:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.error(`[page:error] ${error.message}`));
  page.on("download", (download) => console.error(`[page:download] ${download.suggestedFilename()}`));
  const stream = createWriteStream(output);

  await page.exposeBinding("saveVideoChunk", async (_source, base64) => {
    if (!base64) return;
    stream.write(Buffer.from(base64, "base64"));
  });

  await page.goto(`http://127.0.0.1:${port}/?w=${width}&h=${height}&fps=${fps}`, {
    waitUntil: "networkidle"
  });

  const support = await page.evaluate(() => ({
    mediaRecorder: Boolean(window.MediaRecorder),
    vp9: window.MediaRecorder?.isTypeSupported?.("video/webm;codecs=vp9"),
    vp8: window.MediaRecorder?.isTypeSupported?.("video/webm;codecs=vp8")
  }));

  if (!support.mediaRecorder) {
    throw new Error("MediaRecorder is not available in this browser.");
  }

  await page.evaluate(
    ({ seconds, fps }) => window.recordFilm({ seconds, fps }),
    { seconds, fps }
  );

  await new Promise((resolveDone) => stream.end(resolveDone));
  await browser.close();
  console.log(`Rendered silent video: ${output}`);
} finally {
  server.kill("SIGTERM");
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

async function waitForServer(port, child) {
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
        const html = await res.text();
        if (html.includes("薯片卡片生态宣传片")) return;
      }
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }

  throw new Error(`Vite server did not start on port ${port}.\n${stderr}`);
}
