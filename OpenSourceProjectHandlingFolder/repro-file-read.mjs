// 复现 file.read binary 通道的字节往返：Host PAL(latin1) → IPC(JSON) → SDK normalizeBinaryPayload
import fs from "node:fs";
import path from "node:path";

const cpkPath = process.argv[2];
const original = fs.readFileSync(cpkPath);
console.log("原始字节长度:", original.length, "头部:", [...original.slice(0, 4)]);

// 第 1 步：模拟 Host PAL readFile（encoding binary → latin1 字符串）
const latin1String = fs.readFileSync(cpkPath, { encoding: "binary" });
console.log("PAL 返回字符串长度:", latin1String.length);

// 第 2 步：模拟 IPC JSON 序列化往返
const jsonRoundTrip = JSON.parse(JSON.stringify(latin1String));
console.log("IPC JSON 往返后长度:", jsonRoundTrip.length, "一致:", jsonRoundTrip === latin1String);

// 第 3 步：SDK normalizeBinaryPayload（从 Chips-SDK 源码复制的等价逻辑）
function shouldDecodeStringAsBase64(input) {
  const normalized = input.replace(/\s+/g, "");
  if (normalized.length === 0 || normalized.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return false;
  return normalized.includes("=") || normalized.includes("+") || normalized.includes("/") || /\s/.test(input);
}
function decodeByteString(input) {
  const bytes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) bytes[i] = input.charCodeAt(i) & 0xff;
  return bytes;
}
function normalizeBinaryPayload(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === "string") {
    return shouldDecodeStringAsBase64(value) ? Buffer.from(value, "base64") : decodeByteString(value);
  }
  throw new Error("not binary");
}

const bytes = normalizeBinaryPayload(jsonRoundTrip);
console.log("SDK 归一化后长度:", bytes.length);
const same = Buffer.compare(Buffer.from(bytes), original) === 0;
console.log("字节一致:", same);
if (!same) {
  let firstDiff = -1;
  for (let i = 0; i < Math.min(bytes.length, original.length); i += 1) {
    if (bytes[i] !== original[i]) { firstDiff = i; break; }
  }
  console.log("首个差异位置:", firstDiff, "原始:", original[firstDiff], "得到:", bytes[firstDiff]);
}
