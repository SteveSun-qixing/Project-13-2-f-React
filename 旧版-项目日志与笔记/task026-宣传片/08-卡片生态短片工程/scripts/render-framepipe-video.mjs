import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const seconds = Number(args.seconds ?? 90);
const width = Number(args.width ?? 1280);
const height = Number(args.height ?? 720);
const fps = Number(args.fps ?? 25);
const port = Number(args.port ?? 4315);
const output = resolve(args.output ?? `dist/chips_card_ecosystem_${width}x${height}_${fps}fps_silent.mp4`);
const totalFrames = Math.round(seconds * fps);

await mkdir(dirname(output), { recursive: true });

const server = spawn("npx", ["vite", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"]
});

let browser;
let ffmpeg;

try {
  await waitForServer(port);
  browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding"
    ]
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (error) => console.error(`[page:error] ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/?w=${width}&h=${height}&fps=${fps}`, {
    waitUntil: "networkidle"
  });
  await page.waitForFunction(() => typeof window.renderFilmFrame === "function");

  ffmpeg = spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-vcodec",
      "mjpeg",
      "-i",
      "pipe:0",
      "-an",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      output
    ],
    { stdio: ["pipe", "inherit", "inherit"] }
  );

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const time = frame / fps;
    await page.evaluate((secondsAtFrame) => window.renderFilmFrame(secondsAtFrame), time);
    const jpeg = await page.evaluate(() => {
      const data = document.getElementById("stage").toDataURL("image/jpeg", 0.92);
      return data.slice(data.indexOf(",") + 1);
    });
    if (!ffmpeg.stdin.write(Buffer.from(jpeg, "base64"))) {
      await new Promise((resolveDrain) => ffmpeg.stdin.once("drain", resolveDrain));
    }
    if (frame % 125 === 0) {
      console.log(`frame ${frame}/${totalFrames}`);
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolveDone, rejectDone) => {
    ffmpeg.on("close", (code) => {
      if (code === 0) resolveDone();
      else rejectDone(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  await browser.close();
  console.log(`Rendered deterministic video: ${output}`);
} finally {
  if (browser) await browser.close().catch(() => {});
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
