import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const outDir = resolve("output/audio");
await mkdir(outDir, { recursive: true });
await mkdir(resolve("output"), { recursive: true });

const sampleRate = 48_000;
const duration = 90;
const musicPath = resolve("output/audio/music_bed.wav");
const mixPath = resolve("output/chips_card_ecosystem_audio_mix.wav");

writeWavStereo(musicPath, buildMusic(duration, sampleRate), sampleRate);

const lines = [
  [0.5, "我们每天创造信息。"],
  [6.25, "但它们常常被格式分开，也被软件分开。"],
  [13.25, "如果信息本身，能成为一个独立的载体呢？"],
  [20.45, "在薯片生态里，它可以成为一张卡片。"],
  [28.25, "文字、图片，可以在同一个载体里被保存。"],
  [36.25, "视频、音乐，也可以成为同一张卡片的一部分。"],
  [44.25, "文字可以是卡片。图片可以是卡片。一个作品、一份资料、一本书，也可以是卡片。"],
  [53.25, "卡片可以组合，也可以嵌套。简单信息，可以生长成完整内容。"],
  [63.25, "复杂内容，也可以像打开图片一样简单。"],
  [71.25, "保存、发送、打开。信息不再只能停留在某一个软件里。"],
  [78.25, "卡片可以组成箱子，箱子可以组成空间。知识、作品和资料，都能被重新组织。"],
  [84.25, "信息，终于可以回到自己手里。薯片卡片生态，让信息脱离软件，自由保存。"]
];

const voiceFiles = [];
const sayPath = commandExists("say");
if (sayPath) {
  for (let i = 0; i < lines.length; i += 1) {
    const file = resolve(outDir, `voice_${String(i + 1).padStart(2, "0")}.aiff`);
    execFileSync("say", ["-v", "Tingting", "-r", "185", "-o", file, lines[i][1]], {
      stdio: "ignore"
    });
    voiceFiles.push(file);
  }
}

if (voiceFiles.length) {
  const ffmpegArgs = ["-y", "-i", musicPath];
  for (const file of voiceFiles) ffmpegArgs.push("-i", file);

  const filters = ["[0:a]volume=0.34[music]"];
  const mixInputs = ["[music]"];

  for (let i = 0; i < voiceFiles.length; i += 1) {
    const delay = Math.max(0, Math.round(lines[i][0] * 1000));
    filters.push(
      `[${i + 1}:a]adelay=${delay}:all=1,volume=1.35,highpass=f=90,lowpass=f=9800[v${i}]`
    );
    mixInputs.push(`[v${i}]`);
  }

  filters.push(
    `${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=longest:normalize=0,alimiter=limit=0.94,volume=1.05[out]`
  );

  ffmpegArgs.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[out]",
    "-ar",
    String(sampleRate),
    "-ac",
    "2",
    mixPath
  );

  execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit" });
} else {
  await writeFile(mixPath, await import("node:fs/promises").then((fs) => fs.readFile(musicPath)));
}

console.log(`Rendered audio mix: ${mixPath}`);

function commandExists(name) {
  const result = spawnSync("which", [name], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function buildMusic(seconds, sr) {
  const frames = Math.ceil(seconds * sr);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  const chords = [
    [0, [261.63, 329.63, 392.0]],
    [13, [293.66, 369.99, 440.0]],
    [28, [246.94, 329.63, 392.0]],
    [44, [261.63, 349.23, 440.0]],
    [63, [293.66, 392.0, 493.88]],
    [78, [261.63, 329.63, 523.25]],
    [84, [261.63, 392.0, 523.25]]
  ];

  for (let i = 0; i < frames; i += 1) {
    const t = i / sr;
    const chord = currentChord(t, chords);
    let sample = 0;
    for (let j = 0; j < chord.length; j += 1) {
      const f = chord[j] / 2;
      sample += Math.sin(Math.PI * 2 * f * t + j * 0.7) * 0.032;
      sample += Math.sin(Math.PI * 2 * (f * 2.01) * t + j) * 0.012;
    }
    sample += Math.sin(Math.PI * 2 * 55 * t) * 0.018;
    const swell = 0.72 + Math.sin(Math.PI * 2 * t / 18) * 0.12;
    const noiseBreath = Math.sin(Math.PI * 2 * 0.23 * t) * 0.006;
    left[i] += (sample + noiseBreath) * swell;
    right[i] += (sample - noiseBreath) * swell;
  }

  const notes = [
    [0.2, 659.25, 0.11],
    [6.1, 493.88, 0.08],
    [13.1, 783.99, 0.1],
    [20.0, 1046.5, 0.16],
    [28.1, 659.25, 0.1],
    [36.2, 739.99, 0.1],
    [44.2, 880, 0.08],
    [45.0, 987.77, 0.07],
    [46.0, 1174.66, 0.07],
    [53.0, 932.33, 0.12],
    [63.1, 659.25, 0.1],
    [71.1, 783.99, 0.12],
    [78.0, 880, 0.1],
    [84.1, 1046.5, 0.18],
    [87.0, 783.99, 0.12]
  ];

  for (const [time, freq, amp] of notes) addBell(left, right, sr, time, freq, amp);

  normalize(left, right, 0.62);
  return { left, right };
}

function currentChord(t, chords) {
  let chord = chords[0][1];
  for (const [time, notes] of chords) {
    if (t >= time) chord = notes;
  }
  return chord;
}

function addBell(left, right, sr, start, freq, amp) {
  const startFrame = Math.floor(start * sr);
  const length = Math.floor(2.2 * sr);
  for (let i = 0; i < length && startFrame + i < left.length; i += 1) {
    const t = i / sr;
    const env = Math.exp(-t * 2.8) * Math.min(1, t * 24);
    const sample =
      Math.sin(Math.PI * 2 * freq * t) * 0.72 +
      Math.sin(Math.PI * 2 * freq * 2.01 * t) * 0.22 +
      Math.sin(Math.PI * 2 * freq * 3.02 * t) * 0.06;
    const value = sample * env * amp;
    left[startFrame + i] += value * 0.92;
    right[startFrame + i] += value;
  }
}

function normalize(left, right, target) {
  let peak = 0;
  for (let i = 0; i < left.length; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const gain = peak > 0 ? target / peak : 1;
  for (let i = 0; i < left.length; i += 1) {
    left[i] *= gain;
    right[i] *= gain;
  }
}

function writeWavStereo(file, { left, right }, sr) {
  const frames = left.length;
  const bytesPerSample = 2;
  const channels = 2;
  const dataSize = frames * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(sr * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < frames; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buffer.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }
  return writeFile(file, buffer);
}
