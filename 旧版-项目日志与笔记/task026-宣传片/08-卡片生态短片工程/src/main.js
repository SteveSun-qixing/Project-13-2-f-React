import * as THREE from "three";

const params = new URLSearchParams(window.location.search);
const film = {
  width: Number(params.get("w") || 1920),
  height: Number(params.get("h") || 1080),
  fps: Number(params.get("fps") || 25),
  duration: 90
};

const stage = document.getElementById("stage");
stage.width = film.width;
stage.height = film.height;

const renderer = new THREE.WebGLRenderer({
  canvas: stage,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true
});
renderer.setPixelRatio(1);
renderer.setSize(film.width, film.height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 2;

const filmCanvas = document.createElement("canvas");
filmCanvas.width = film.width;
filmCanvas.height = film.height;
const ctx = filmCanvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = "high";

const texture = new THREE.CanvasTexture(filmCanvas);
texture.colorSpace = THREE.SRGBColorSpace;
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.MeshBasicMaterial({ map: texture })
);
scene.add(plane);

const W = film.width;
const H = film.height;
const S = W / 3840;
const CX = W / 2;
const CY = H / 2;
const PI = Math.PI;

const palette = {
  bg: "#F6F7FA",
  bgCool: "#EEF1F6",
  bgSoft: "#EDF1F7",
  text: "#20242C",
  body: "#394150",
  muted: "#667085",
  faint: "#98A2B3",
  blue: "#2F6FEB"
};

const fragments = makeFragments();
const orbitCards = makeOrbitCards();
const boxCards = makeBoxCards();

function renderAt(time) {
  drawFilmFrame(ctx, time);
  texture.needsUpdate = true;
  renderer.render(scene, camera);
}

function drawFilmFrame(c, t) {
  c.save();
  c.clearRect(0, 0, W, H);
  drawBackground(c, t);

  if (t < 6) scene01(c, t);
  else if (t < 13) scene02(c, t);
  else if (t < 20) scene03(c, t);
  else if (t < 28) scene04(c, t);
  else if (t < 36) scene05(c, t);
  else if (t < 44) scene06(c, t);
  else if (t < 53) scene07(c, t);
  else if (t < 63) scene08(c, t);
  else if (t < 71) scene09(c, t);
  else if (t < 78) scene10(c, t);
  else if (t < 84) scene11(c, t);
  else scene12(c, t);

  c.restore();
}

function drawBackground(c, t) {
  let mix = 0;
  if (t < 20) mix = smoothstep(8, 20, t);
  const base = lerpColor(hexToRgb(palette.bgCool), hexToRgb(palette.bg), mix);
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, rgbToCss(lerpColor(base, [255, 255, 255], 0.5)));
  g.addColorStop(0.45, rgbToCss(base));
  g.addColorStop(1, rgbToCss(lerpColor(base, hexToRgb(palette.bgSoft), 0.32)));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  c.globalAlpha = 0.018;
  for (let y = 0; y < H; y += 5 * S) {
    for (let x = (y % 2) * 2 * S; x < W; x += 7 * S) {
      const n = fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
      c.fillStyle = n > 0.48 ? "#1F2937" : "#FFFFFF";
      c.fillRect(x, y, 1 * S, 1 * S);
    }
  }
  c.globalAlpha = 1;
}

function scene01(c, t) {
  const p = t / 6;
  c.save();
  const zoom = lerp(0.98, 1.06, easeInOut(p));
  c.translate(CX, CY);
  c.scale(zoom, zoom);
  c.translate(-CX, -CY);
  for (const f of fragments) {
    const alpha = easeOut(saturate((t - f.delay) / 0.8)) * (f.depth === "far" ? 0.46 : f.depth === "near" ? 0.68 : 0.84);
    const drift = Math.sin(t * f.speed + f.seed) * f.amp * S;
    const centerPull = easeIn(saturate((t - 5.55) / 0.45)) * 26 * S;
    drawFragment(c, f, f.x + drift - Math.sign(f.x - CX) * centerPull, f.y + Math.cos(t * f.speed * 0.8 + f.seed) * f.amp * 0.5 * S, alpha, 1);
  }
  c.restore();
}

function scene02(c, t) {
  const q = t - 6;
  for (const f of fragments) {
    const win = windowTarget(f.kind);
    const a = saturate(q / 1.2);
    const move = easeInOut(saturate((q - 0.7 - f.index * 0.018) / 2.8));
    const x = lerp(f.x, win.x + (f.index % 3 - 1) * 70 * S, move);
    const y = lerp(f.y, win.y + (Math.floor(f.index / 3) % 2 - 0.5) * 54 * S, move);
    drawFragment(c, f, x, y, lerp(0.75, 0.48, move), lerp(1, 0.72, move));
  }

  const appear = easeOut(saturate(q / 1.3));
  const spread = easeInOut(saturate((q - 3.0) / 2.0));
  for (const w of windows) {
    const x = CX + (w.x - CX) * (1 + spread * 0.07);
    const y = CY + (w.y - CY) * (1 + spread * 0.05);
    drawWindow(c, x, y, w.w, w.h, appear * lerp(1, 0.3, smoothstep(6.1, 7, q)));
  }

  c.save();
  c.globalAlpha = easeOut(saturate((q - 3.1) / 1.2)) * 0.55 * (1 - smoothstep(6.4, 7, q));
  c.strokeStyle = "rgba(32,36,44,0.10)";
  c.lineWidth = 1.4 * S;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    const x = CX + (i - 2) * 330 * S;
    c.moveTo(x, 190 * S);
    c.lineTo(x, H - 260 * S);
    c.stroke();
  }
  c.restore();

  drawSubtitle(c, "信息被格式分开，也被软件分开。", t, 7.4, 12.4, "bottom");
}

function scene03(c, t) {
  const q = t - 13;
  const spread = easeOut(saturate(q / 2.2));
  const small = fragments.slice(0, 12);
  for (const f of small) {
    const angle = (f.index / small.length) * PI * 2 + 0.3;
    const rx = 680 * S;
    const ry = 300 * S;
    const x = lerp(windowTarget(f.kind).x, CX + Math.cos(angle) * rx, spread);
    const y = lerp(windowTarget(f.kind).y, CY + Math.sin(angle) * ry, spread);
    drawFragment(c, f, x, y, 0.42 + 0.1 * Math.sin(t + f.seed), 0.68);
  }

  const glow = smoothstep(6.0, 7.0, q);
  if (glow > 0) drawSoftGlow(c, CX, CY, 190 * S * glow, `rgba(255,255,255,${0.85 * glow})`);
  drawSubtitle(c, "如果信息本身，能成为一个独立的载体呢？", t, 14.6, 19.1, "center-question");
}

function scene04(c, t) {
  const q = t - 20;
  const cardP = easeOut(saturate(q / 0.9));
  drawSoftGlow(c, CX, CY, 240 * S * (1 - cardP) + 80 * S, "rgba(255,255,255,0.72)");

  for (const f of fragments.slice(0, 12)) {
    const angle = (f.index / 12) * PI * 2 + 0.3;
    const startX = CX + Math.cos(angle) * 680 * S;
    const startY = CY + Math.sin(angle) * 300 * S;
    const target = contentTarget(f.kind);
    const p = easeInOut(saturate((q - 0.8 - f.index * 0.06) / 2.7));
    const alpha = (1 - p) * 0.55;
    drawFragment(c, f, lerp(startX, target.x, p), lerp(startY, target.y, p), alpha, lerp(0.68, 0.18, p));
    if (p > 0.06 && p < 0.96) drawParticles(c, startX, startY, target.x, target.y, p, f.seed);
  }

  const scale = lerp(0.92, 1, cardP);
  const w = 1620 * S * scale;
  const h = 1012 * S * scale;
  drawMainCard(c, CX, CY - 20 * S, w, h, cardP, (cc) => {
    drawCompositeContent(cc, CX - w / 2, CY - 20 * S - h / 2, w, h, easeOut(saturate((q - 2.4) / 2.2)), "birth");
  });

  const shineP = smoothstep(3.4, 4.4, q) * (1 - smoothstep(4.6, 5.2, q));
  if (shineP > 0) drawAurora(c, CX + w * 0.2, CY - h * 0.36, w * 0.26, 12 * S, shineP);
}

function scene05(c, t) {
  const q = t - 28;
  const zoom = easeOut(saturate(q / 1.4));
  const margin = lerp(1110 * S, 170 * S, zoom);
  const x = margin;
  const y = lerp(520 * S, 128 * S, zoom);
  const w = W - margin * 2;
  const h = H - y * 2;
  drawMainCard(c, x + w / 2, y + h / 2, w, h, 1, (cc) => {
    const pText = easeOut(saturate((q - 1.4) / 1.4));
    drawTextImageLayout(cc, x, y, w, h, pText, easeOut(saturate((q - 2.2) / 1.6)));
  });
  drawSubtitle(c, "文字和图片，可以在同一个载体里。", t, 29.9, 35.2, "lower-left");
}

function scene06(c, t) {
  const q = t - 36;
  const y = 128 * S;
  const x = 170 * S;
  const w = W - x * 2;
  const h = H - y * 2;
  const pull = easeInOut(saturate((q - 6.0) / 2.0));
  drawMainCard(c, CX, CY, lerp(w, 1160 * S, pull), lerp(h, 725 * S, pull), 1, (cc) => {
    drawMediaLayout(cc, lerp(x, CX - 580 * S, pull), lerp(y, CY - 362 * S, pull), lerp(w, 1160 * S, pull), lerp(h, 725 * S, pull), q);
  });
  drawSubtitle(c, "视频和音乐，也可以成为卡片的一部分。", t, 37.4, 43.3, "lower-left");
}

function scene07(c, t) {
  const q = t - 44;
  const p = easeOut(saturate(q / 1.6));
  const cam = 1 - 0.02 * Math.sin(q * 0.6);
  c.save();
  c.translate(CX, CY);
  c.scale(cam, cam);
  c.translate(-CX, -CY);
  drawSmallCard(c, CX, CY + 10 * S, 780 * S, 488 * S, 1, "素材记录", "media");
  orbitCards.forEach((card, i) => {
    const appear = easeOut(saturate((q - 1.2 - i * 0.24) / 0.9));
    const prep = smoothstep(7.5, 9, q) * (card.pick ? 1 : 0);
    const x = lerp(CX + card.x * S, CX + card.pickX * S, prep);
    const y = lerp(CY + card.y * S + (1 - appear) * 38 * S, CY + card.pickY * S, prep);
    drawSmallCard(c, x, y, card.w * S, card.h * S, appear * lerp(1, card.pick ? 1 : 0.72, prep), card.title, card.kind);
  });
  c.restore();
  if (q > 1.6 && q < 7.2) {
    const idx = q < 3.5 ? 0 : q < 5.4 ? 1 : 2;
    const texts = ["文字是卡片。", "图片是卡片。", "一个作品，也可以是卡片。"];
    drawCenterPhrase(c, texts[idx], easeOut(saturate(((q - 1.6) % 1.9) / 0.4)) * (1 - smoothstep(1.45, 1.85, ((q - 1.6) % 1.9))));
  }
}

function scene08(c, t) {
  const q = t - 53;
  const combine = easeInOut(saturate(q / 3.0));
  const shell = easeInOut(saturate((q - 1.8) / 2.2));
  const insert = easeInOut(saturate((q - 5.0) / 2.0));
  const grow = easeInOut(saturate((q - 6.55) / 0.65));
  const cardW = 1460 * S;
  const cardH = (910 + grow * 210) * S;
  const cardX = CX;
  const cardY = CY - 20 * S + grow * 30 * S;

  orbitCards.forEach((card) => {
    if (card.pick) return;
    drawSmallCard(c, CX + card.x * S, CY + card.y * S, card.w * S, card.h * S, 0.18 * (1 - shell), card.title, card.kind);
  });

  const picks = orbitCards.filter((card) => card.pick);
  picks.forEach((card, i) => {
    const x = lerp(CX + card.pickX * S, cardX + (i - 1) * 240 * S, combine);
    const y = lerp(CY + card.pickY * S, cardY - 220 * S + i * 220 * S, combine);
    drawSmallCard(c, x, y, lerp(card.w * S, 820 * S, combine), lerp(card.h * S, 210 * S, combine), 1 - shell * 0.65, card.title, card.kind);
  });

  drawMainCard(c, cardX, cardY, cardW, cardH, shell, (cc) => {
    drawCompositeContent(cc, cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, shell, "nested", grow);
  });

  const smallStartX = W + 80 * S;
  const smallStartY = CY + 10 * S;
  const smallEndX = cardX;
  const smallEndY = cardY + cardH * 0.31;
  const sx = lerp(smallStartX, smallEndX, insert);
  const sy = lerp(smallStartY, smallEndY, insert);
  if (q > 4.5 && insert < 0.98) {
    drawSmallCard(c, sx, sy, 390 * S, 250 * S, easeOut(saturate((q - 4.4) / 0.7)), "补充资料", "web");
  }
  const lineA = smoothstep(5.7, 6.1, q) * (1 - smoothstep(6.8, 7.25, q));
  if (lineA > 0) drawInsertLine(c, cardX, cardY + cardH * 0.25, cardW * 0.76, lineA);
  drawSubtitle(c, "卡片可以组合，也可以嵌套。", t, 54.0, 61.4, "lower-left");
}

function scene09(c, t) {
  const q = t - 63;
  const fold = easeInOut(saturate(q / 1.1));
  const library = easeOut(saturate((q - 1.3) / 1.8));
  const click = easeOut(saturate((q - 4.0) / 0.7));
  const open = easeInOut(saturate((q - 4.7) / 1.0));
  const coverW = lerp(1400 * S, 430 * S, fold);
  const coverH = lerp(980 * S, 573 * S, fold);
  const mainX = lerp(CX, CX - 60 * S, library);
  const mainY = CY - 10 * S;

  const titles = ["阅读摘记", "作品合集", "网页收藏", "准备清单", "声音素材"];
  const positions = [
    [-520, -10],
    [-900, 30],
    [480, -5],
    [850, 20],
    [1160, -25]
  ];
  positions.forEach((pos, i) => {
    drawCoverCard(c, CX + pos[0] * S, CY + pos[1] * S, 330 * S, 440 * S, library * 0.72, titles[i], i + 2);
  });

  if (open < 0.98) {
    drawCoverCard(c, mainX, mainY, coverW, coverH, 1, "旅行记录", 1);
  }

  if (q > 3.3 && q < 5.0) {
    const px = lerp(mainX - 280 * S, mainX + 120 * S, click);
    const py = lerp(mainY - 250 * S, mainY - 80 * S, click);
    drawPointer(c, px, py, smoothstep(4.05, 4.25, q) * (1 - smoothstep(4.45, 4.9, q)));
  }

  if (open > 0) {
    const w = lerp(coverW, 1180 * S, open);
    const h = lerp(coverH, 738 * S, open);
    drawMainCard(c, mainX, mainY, w, h, open, (cc) => drawCompositeContent(cc, mainX - w / 2, mainY - h / 2, w, h, open, "open"));
  }

  drawSubtitle(c, "像打开图片一样，打开复杂内容。", t, 64.1, 70.1, "bottom");
}

function scene10(c, t) {
  const q = t - 71;
  const line = easeOut(saturate((q - 1.1) / 0.8));
  const move = easeInOut(saturate((q - 2.2) / 2.7));
  const receive = easeOut(saturate((q - 4.6) / 1.2));
  const leftX = CX - 540 * S;
  const rightX = CX + 520 * S;
  const y = CY - 20 * S;

  drawDevice(c, rightX, y, 650 * S, 430 * S, easeOut(saturate(q / 1.0)), receive);
  drawTransferLine(c, leftX + 170 * S, y, rightX - 280 * S, y, line, move);

  const mx = lerp(leftX, rightX - 70 * S, move);
  const mw = lerp(300 * S, 220 * S, move);
  const mh = lerp(380 * S, 292 * S, move);
  if (move < 0.98) drawFileCard(c, mx, y, mw, mh, 1, move);
  if (receive > 0) drawCoverCard(c, rightX, y, lerp(210 * S, 440 * S, receive), lerp(280 * S, 275 * S, receive), receive, "旅行记录", 1);
  drawSubtitle(c, "保存。发送。打开。", t, 72.0, 77.1, "lower-left", true);
}

function scene11(c, t) {
  const q = t - 78;
  const arrange = easeOut(saturate(q / 1.5));
  const zoom = easeInOut(saturate((q - 2.8) / 2.0));
  const fade = smoothstep(5.0, 6.0, q);
  c.save();
  c.translate(CX, CY);
  c.scale(lerp(1, 0.72, zoom), lerp(1, 0.72, zoom));
  c.translate(-CX, -CY);
  drawBoxRegion(c, CX, CY, 980 * S, 610 * S, arrange * (1 - fade * 0.35), "资料", 0);
  if (zoom > 0.02) {
    drawBoxRegion(c, CX - 770 * S, CY - 10 * S, 850 * S, 560 * S, zoom * (1 - fade), "知识", 1);
    drawBoxRegion(c, CX + 760 * S, CY + 10 * S, 850 * S, 560 * S, zoom * (1 - fade), "作品", 2);
  }
  c.restore();
  drawSubtitle(c, "卡片组成箱子。箱子组成空间。", t, 80.5, 83.5, "center-question");
}

function scene12(c, t) {
  const q = t - 84;
  const cardOut = smoothstep(2.0, 3.0, q);
  const brandIn = easeOut(saturate((q - 2.0) / 0.72));
  const sloganIn = easeOut(saturate((q - 2.32) / 0.72));
  const cardA = 1 - cardOut;
  if (cardA > 0.01) {
    for (let i = 0; i < 6; i++) {
      const angle = i * PI * 2 / 6;
      drawSmallCard(c, CX + Math.cos(angle) * 400 * S, CY + Math.sin(angle) * 190 * S, 360 * S, 225 * S, 0.08 * cardA, " ", "text");
    }
    drawMainCard(c, CX, CY - 10 * S, 1040 * S, 650 * S, cardA, () => {});
    drawText(c, "我的信息，我来保存。", CX, CY, 62 * S, "500", palette.text, "center", cardA);
    drawText(c, "信息回到自己手里。", CX, CY + 420 * S, 42 * S, "400", palette.muted, "center", cardA * (1 - smoothstep(1.5, 2.2, q)));
  }

  if (brandIn > 0) {
    drawText(c, "薯片卡片生态", CX, CY - 80 * S, 132 * S, "600", palette.text, "center", brandIn);
  }
  if (sloganIn > 0) {
    drawText(c, "让信息脱离软件，自由保存。", CX, CY + 60 * S, 64 * S, "400", palette.muted, "center", sloganIn);
  }
  const shineP = smoothstep(3.0, 3.45, q) * (1 - smoothstep(3.45, 4.0, q));
  if (shineP > 0) drawAurora(c, CX + 230 * S, CY - 155 * S, 320 * S, 10 * S, shineP);
}

function drawMainCard(c, x, y, w, h, alpha, content) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  roundedShadow(c, x - w / 2, y - h / 2, w, h, 44 * S);
  roundedRect(c, x - w / 2, y - h / 2, w, h, 44 * S);
  c.fillStyle = "rgba(255,255,255,0.86)";
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.10)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  const top = c.createLinearGradient(0, y - h / 2, 0, y - h / 2 + 40 * S);
  top.addColorStop(0, "rgba(255,255,255,0.55)");
  top.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = top;
  c.fill();
  c.save();
  roundedRect(c, x - w / 2, y - h / 2, w, h, 44 * S);
  c.clip();
  content(c);
  c.restore();
  c.restore();
}

function drawCompositeContent(c, x, y, w, h, p, mode, grow = 0) {
  if (p <= 0) return;
  const pad = 68 * S * Math.min(1, w / (1460 * S));
  const innerX = x + pad;
  const innerY = y + pad;
  drawText(c, mode === "birth" ? "一次灵感记录" : mode === "open" ? "旅行记录" : "项目资料", innerX, innerY + 42 * S, 46 * S, "600", palette.text, "left", p);
  drawText(c, "文字 · 图片 · 视频 · 音频", innerX, innerY + 88 * S, 24 * S, "400", palette.muted, "left", p * 0.9);
  drawMiniParagraph(c, innerX, innerY + 145 * S, w * 0.42, p, [
    "清晨的光从窗边落下来。",
    "我把路线、照片和想法放在一起。",
    "一张卡片，就能保存这段经历。"
  ]);
  drawImageBlock(c, x + w * 0.58, innerY + 126 * S, w * 0.28, h * 0.22, p, "landscape");
  drawVideoBlock(c, x + w * 0.58, innerY + h * 0.43, w * 0.28, h * 0.18, p, 0.3);
  drawAudioBlock(c, innerX, y + h - (mode === "nested" ? 170 * S + grow * 90 * S : 118 * S), w * 0.72, 70 * S, p, 0.2);
  if (mode === "nested" && grow > 0.08) {
    drawSmallEmbedded(c, innerX, y + h - 155 * S, w - pad * 2, 96 * S, grow);
  }
}

function drawTextImageLayout(c, x, y, w, h, textP, imageP) {
  const left = x + 260 * S;
  const top = y + 170 * S;
  drawText(c, "一次旅行记录", left, top, 58 * S, "600", palette.text, "left", textP);
  const lines = [
    "清晨的光从窗边落下来。",
    "我把路线、照片和想法放在一起。",
    "它们不再散落在不同地方。",
    "一张卡片，就能保存这段经历。"
  ];
  lines.forEach((line, i) => drawText(c, line, left, top + (92 + i * 62) * S, 34 * S, "400", palette.body, "left", textP * easeOut(saturate((textP * 2.2 - i * 0.25)))));
  ["地点 / 海边", "时间 / 春季", "记录 / 灵感"].forEach((tag, i) => drawTag(c, left + i * 160 * S, top + 380 * S, tag, textP));
  const imgW = 760 * S;
  const imgH = 570 * S;
  const imgX = x + w - 1010 * S + (1 - imageP) * 36 * S;
  const imgY = y + 200 * S;
  drawImageBlock(c, imgX, imgY, imgW, imgH, imageP, "photo");
  drawText(c, "海边的早晨", imgX, imgY + imgH + 44 * S, 28 * S, "400", palette.muted, "left", imageP);
}

function drawMediaLayout(c, x, y, w, h, q) {
  const p = easeOut(saturate(q / 1.2));
  const vX = x + 165 * S;
  const vY = y + 135 * S;
  drawVideoBlock(c, vX, vY, w * 0.56, w * 0.315, p, q);
  drawAudioBlock(c, vX, vY + w * 0.315 + 80 * S, w * 0.56, 120 * S, easeOut(saturate((q - 2.2) / 1.2)), smoothstep(2.8, 6.0, q));
  const tx = x + w * 0.72;
  const ty = y + 170 * S;
  drawText(c, "素材说明", tx, ty, 42 * S, "600", palette.text, "left", p);
  ["一段视频，记录现场。", "一条声音，保存当时的环境。", "它们和文字、图片一起留在同一张卡片里。"].forEach((line, i) => {
    drawText(c, line, tx, ty + (70 + i * 58) * S, 30 * S, "400", palette.muted, "left", easeOut(saturate((q - 2.3 - i * 0.18) / 0.8)));
  });
}

function drawSmallCard(c, x, y, w, h, alpha, title, kind) {
  if (alpha <= 0) return;
  drawMainCard(c, x, y, w, h, alpha, (cc) => {
    const bx = x - w / 2 + 34 * S;
    const by = y - h / 2 + 36 * S;
    drawText(cc, title, bx, by + 26 * S, Math.min(30 * S, w * 0.08), "600", palette.text, "left", 1);
    if (kind === "image" || kind === "portfolio") drawImageBlock(cc, bx, by + 58 * S, w - 68 * S, h * 0.48, 1, kind);
    else if (kind === "video") drawVideoBlock(cc, bx, by + 58 * S, w - 68 * S, h * 0.42, 1, 0.5);
    else if (kind === "music") drawAudioBlock(cc, bx, by + 80 * S, w - 68 * S, h * 0.26, 1, 0.4);
    else drawMiniParagraph(cc, bx, by + 72 * S, w - 68 * S, 1, ["记录想法", "保存内容", "组合资料"]);
  });
}

function drawCoverCard(c, x, y, w, h, alpha, title, variant) {
  drawMainCard(c, x, y, w, h, alpha, (cc) => {
    const px = x - w / 2 + 34 * S;
    const py = y - h / 2 + 34 * S;
    drawImageBlock(cc, px, py, w - 68 * S, h * 0.46, 1, variant % 2 ? "photo" : "portfolio");
    drawText(cc, title, px, py + h * 0.56, Math.min(38 * S, w * 0.095), "600", palette.text, "left", 1);
    drawText(cc, "2026.04", px, py + h * 0.64, 24 * S, "400", palette.muted, "left", 1);
    drawTag(cc, px, py + h * 0.72, "记录", 1);
    drawTag(cc, px + 86 * S, py + h * 0.72, "图片", 1);
    drawTag(cc, px + 172 * S, py + h * 0.72, "声音", 1);
  });
}

function drawFileCard(c, x, y, w, h, alpha, morph) {
  drawMainCard(c, x, y, w, h, alpha, (cc) => {
    const px = x - w / 2 + 28 * S;
    const py = y - h / 2 + 32 * S;
    drawImageBlock(cc, px, py, w - 56 * S, h * 0.48, 1, "photo");
    drawText(cc, morph < 0.55 ? ".card" : "旅行记录", x, y + h * 0.18, 34 * S, "600", morph < 0.55 ? palette.blue : palette.text, "center", 1);
    drawText(cc, "旅行记录.card", x, y + h * 0.34, 24 * S, "400", palette.muted, "center", 1 - morph * 0.8);
  });
}

function drawDevice(c, x, y, w, h, alpha, lit) {
  c.save();
  c.globalAlpha = alpha;
  roundedShadow(c, x - w / 2, y - h / 2, w, h, 36 * S);
  roundedRect(c, x - w / 2, y - h / 2, w, h, 36 * S);
  c.fillStyle = `rgba(255,255,255,${0.72 + lit * 0.12})`;
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.12)";
  c.lineWidth = 1.4 * S;
  c.stroke();
  c.restore();
}

function drawBoxRegion(c, x, y, w, h, alpha, title, seed) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  roundedRect(c, x - w / 2, y - h / 2, w, h, 36 * S);
  c.fillStyle = "rgba(255,255,255,0.34)";
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.06)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  drawText(c, title, x - w / 2 + 42 * S, y - h / 2 + 54 * S, 34 * S, "500", palette.muted, "left", 1);
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    drawCoverCard(c, x - w * 0.29 + col * w * 0.29, y - h * 0.18 + row * h * 0.24, w * 0.19, h * 0.22, 0.94, boxCards[(i + seed) % boxCards.length], i);
  }
  c.restore();
}

function drawFragment(c, f, x, y, alpha, scale) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.rotate(f.rot + Math.sin(f.seed) * 0.01);
  c.scale(scale, scale);
  roundedRect(c, -f.w / 2, -f.h / 2, f.w, f.h, f.r);
  c.fillStyle = "rgba(255,255,255,0.72)";
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.06)";
  c.lineWidth = 1 * S;
  c.stroke();
  if (f.kind === "text") drawMiniParagraph(c, -f.w * 0.35, -f.h * 0.18, f.w * 0.7, 1, ["会议记录", "项目灵感", "图片说明"], true);
  if (f.kind === "image") drawGeneratedImage(c, -f.w * 0.36, -f.h * 0.32, f.w * 0.72, f.h * 0.64, f.seed);
  if (f.kind === "video") drawTimeline(c, -f.w * 0.35, -f.h * 0.2, f.w * 0.7, f.h * 0.4);
  if (f.kind === "music") drawWave(c, -f.w * 0.38, 0, f.w * 0.76, f.h * 0.42, 0.4);
  if (f.kind === "book") drawBook(c, -f.w * 0.34, -f.h * 0.28, f.w * 0.68, f.h * 0.56);
  if (f.kind === "web") drawWeb(c, -f.w * 0.37, -f.h * 0.28, f.w * 0.74, f.h * 0.56);
  if (f.kind === "list") drawChecklist(c, -f.w * 0.36, -f.h * 0.25, f.w * 0.72, f.h * 0.5);
  if (f.kind === "file") drawText(c, "文件", 0, 8 * S, 24 * S, "500", palette.muted, "center", 1);
  if (f.kind === "map") drawMap(c, -f.w * 0.35, -f.h * 0.25, f.w * 0.7, f.h * 0.5);
  if (f.kind === "code") drawCode(c, -f.w * 0.35, -f.h * 0.2, f.w * 0.7, f.h * 0.4);
  c.restore();
}

function drawImageBlock(c, x, y, w, h, alpha, type) {
  c.save();
  c.globalAlpha *= alpha;
  roundedRect(c, x, y, w, h, 22 * S);
  c.clip();
  drawGeneratedImage(c, x, y, w, h, type.length);
  c.restore();
  c.save();
  c.globalAlpha *= alpha;
  roundedRect(c, x, y, w, h, 22 * S);
  c.strokeStyle = "rgba(32,36,44,0.08)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  c.restore();
}

function drawVideoBlock(c, x, y, w, h, alpha, time) {
  drawImageBlock(c, x, y, w, h, alpha, "video");
  c.save();
  c.globalAlpha *= alpha;
  roundedRect(c, x, y + h - 34 * S, w, 34 * S, 0);
  c.fillStyle = "rgba(255,255,255,0.35)";
  c.fill();
  c.fillStyle = palette.blue;
  roundedRect(c, x + 18 * S, y + h - 18 * S, w * (0.14 + 0.12 * smoothstep(0, 7, time)), 4 * S, 2 * S);
  c.fill();
  c.beginPath();
  c.moveTo(x + 34 * S, y + h - 58 * S);
  c.lineTo(x + 34 * S, y + h - 36 * S);
  c.lineTo(x + 52 * S, y + h - 47 * S);
  c.closePath();
  c.fillStyle = "rgba(255,255,255,0.84)";
  c.fill();
  c.restore();
}

function drawAudioBlock(c, x, y, w, h, alpha, progress) {
  c.save();
  c.globalAlpha *= alpha;
  roundedRect(c, x, y, w, h, 22 * S);
  c.fillStyle = "rgba(255,255,255,0.58)";
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.07)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  c.beginPath();
  c.arc(x + 50 * S, y + h / 2, 21 * S, 0, PI * 2);
  c.fillStyle = "rgba(47,111,235,0.10)";
  c.fill();
  c.fillStyle = palette.blue;
  c.beginPath();
  c.moveTo(x + 45 * S, y + h / 2 - 9 * S);
  c.lineTo(x + 45 * S, y + h / 2 + 9 * S);
  c.lineTo(x + 60 * S, y + h / 2);
  c.closePath();
  c.fill();
  drawWave(c, x + 96 * S, y + h / 2, w - 220 * S, h * 0.46, progress);
  drawText(c, "环境录音", x + w - 96 * S, y + h / 2 + 8 * S, 24 * S, "400", palette.muted, "center", 1);
  c.restore();
}

function drawSmallEmbedded(c, x, y, w, h, alpha) {
  c.save();
  c.globalAlpha *= alpha;
  roundedRect(c, x, y, w, h, 18 * S);
  c.fillStyle = "rgba(47,111,235,0.055)";
  c.fill();
  c.strokeStyle = "rgba(47,111,235,0.18)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  drawText(c, "补充资料", x + 30 * S, y + 58 * S, 28 * S, "500", palette.text, "left", 1);
  drawText(c, "参考链接 · 网页收藏", x + w - 210 * S, y + 58 * S, 24 * S, "400", palette.muted, "left", 1);
  c.restore();
}

function drawMiniParagraph(c, x, y, w, alpha, lines, compact = false) {
  c.save();
  c.globalAlpha *= alpha;
  lines.forEach((line, i) => {
    const yy = y + i * (compact ? 18 : 42) * S;
    drawText(c, line, x, yy, (compact ? 18 : 28) * S, "400", compact ? palette.faint : palette.body, "left", 1);
  });
  c.restore();
}

function drawGeneratedImage(c, x, y, w, h, seed) {
  const g = c.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#DCE8F2");
  g.addColorStop(0.45, "#F8FAFC");
  g.addColorStop(1, seed % 2 ? "#E6EFE7" : "#E7EAF6");
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.globalAlpha *= 0.55;
  c.fillStyle = "#FFFFFF";
  c.beginPath();
  c.ellipse(x + w * 0.28, y + h * 0.32, w * 0.18, h * 0.16, 0, 0, PI * 2);
  c.fill();
  c.strokeStyle = "rgba(47,111,235,0.18)";
  c.lineWidth = 3 * S;
  c.beginPath();
  c.moveTo(x + w * 0.08, y + h * 0.72);
  c.bezierCurveTo(x + w * 0.32, y + h * 0.38, x + w * 0.55, y + h * 0.86, x + w * 0.92, y + h * 0.52);
  c.stroke();
  c.globalAlpha = 1;
}

function drawWave(c, x, y, w, h, progress) {
  const bars = 64;
  for (let i = 0; i < bars; i += 1) {
    const p = i / (bars - 1);
    const bh = h * (0.18 + 0.72 * fract(Math.sin(i * 29.31) * 12.3));
    c.strokeStyle = p < progress ? palette.blue : "#6B8FBF";
    c.globalAlpha *= p < progress ? 1 : 0.65;
    c.lineWidth = 2.4 * S;
    c.beginPath();
    c.moveTo(x + p * w, y - bh / 2);
    c.lineTo(x + p * w, y + bh / 2);
    c.stroke();
    c.globalAlpha = 1;
  }
}

function drawTimeline(c, x, y, w, h) {
  drawGeneratedImage(c, x, y, w * 0.35, h, 3);
  c.fillStyle = "rgba(47,111,235,0.32)";
  roundedRect(c, x + w * 0.42, y + h * 0.45, w * 0.48, 5 * S, 2 * S);
  c.fill();
}

function drawBook(c, x, y, w, h) {
  drawText(c, "电子书页", x, y + 20 * S, 18 * S, "500", palette.muted, "left", 1);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = "rgba(102,112,133,0.32)";
    roundedRect(c, x, y + (48 + i * 18) * S, w * (0.5 + 0.08 * (i % 2)), 4 * S, 2 * S);
    c.fill();
  }
}

function drawWeb(c, x, y, w, h) {
  drawText(c, "网页收藏", x, y + 16 * S, 18 * S, "500", palette.muted, "left", 1);
  drawGeneratedImage(c, x + w * 0.68, y + 4 * S, w * 0.26, h * 0.62, 5);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = "rgba(102,112,133,0.28)";
    roundedRect(c, x, y + (42 + i * 18) * S, w * 0.52, 4 * S, 2 * S);
    c.fill();
  }
}

function drawChecklist(c, x, y, w, h) {
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = "rgba(47,111,235,0.38)";
    c.lineWidth = 2 * S;
    c.strokeRect(x, y + i * 24 * S, 12 * S, 12 * S);
    c.fillStyle = "rgba(102,112,133,0.38)";
    roundedRect(c, x + 22 * S, y + i * 24 * S + 4 * S, w * 0.65, 5 * S, 2 * S);
    c.fill();
  }
}

function drawMap(c, x, y, w, h) {
  c.strokeStyle = "rgba(47,111,235,0.35)";
  c.lineWidth = 2 * S;
  c.beginPath();
  c.moveTo(x + w * 0.1, y + h * 0.75);
  c.bezierCurveTo(x + w * 0.4, y + h * 0.15, x + w * 0.65, y + h * 0.95, x + w * 0.9, y + h * 0.3);
  c.stroke();
  c.fillStyle = palette.blue;
  c.beginPath();
  c.arc(x + w * 0.68, y + h * 0.48, 6 * S, 0, PI * 2);
  c.fill();
}

function drawCode(c, x, y, w, h) {
  ["const card", "render()", "save()"].forEach((line, i) => {
    drawText(c, line, x, y + i * 22 * S, 18 * S, "400", i === 1 ? palette.blue : palette.muted, "left", 1);
  });
}

function drawWindow(c, x, y, w, h, alpha) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  roundedRect(c, x - w / 2, y - h / 2, w, h, 28 * S);
  c.fillStyle = "rgba(255,255,255,0.44)";
  c.fill();
  c.strokeStyle = "rgba(32,36,44,0.08)";
  c.lineWidth = 1.2 * S;
  c.stroke();
  c.fillStyle = "rgba(102,112,133,0.22)";
  roundedRect(c, x - w / 2 + 34 * S, y - h / 2 + 28 * S, w * 0.28, 7 * S, 3 * S);
  c.fill();
  c.restore();
}

function drawTransferLine(c, x1, y1, x2, y2, alpha, p) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = "rgba(47,111,235,0.36)";
  c.lineWidth = 2 * S;
  c.beginPath();
  c.moveTo(x1, y1);
  c.bezierCurveTo(lerp(x1, x2, 0.35), y1 - 70 * S, lerp(x1, x2, 0.65), y2 + 70 * S, x2, y2);
  c.stroke();
  c.fillStyle = "rgba(47,111,235,0.45)";
  c.beginPath();
  c.arc(lerp(x1, x2, p), lerp(y1, y2, p), 7 * S, 0, PI * 2);
  c.fill();
  c.restore();
}

function drawInsertLine(c, x, y, w, alpha) {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = palette.blue;
  c.lineWidth = 2.4 * S;
  c.shadowColor = "rgba(47,111,235,0.25)";
  c.shadowBlur = 9 * S;
  c.beginPath();
  c.moveTo(x - w / 2, y);
  c.lineTo(x + w / 2, y);
  c.stroke();
  c.restore();
}

function drawPointer(c, x, y, ring) {
  c.save();
  c.fillStyle = "rgba(32,36,44,0.62)";
  c.beginPath();
  c.arc(x, y, 12 * S, 0, PI * 2);
  c.fill();
  if (ring > 0) {
    c.globalAlpha = ring;
    c.strokeStyle = "rgba(47,111,235,0.35)";
    c.lineWidth = 2 * S;
    c.beginPath();
    c.arc(x, y, 32 * S * ring, 0, PI * 2);
    c.stroke();
  }
  c.restore();
}

function drawAurora(c, x, y, w, h, alpha) {
  c.save();
  c.globalAlpha = alpha;
  const g = c.createLinearGradient(x - w / 2, y, x + w / 2, y);
  g.addColorStop(0, "rgba(78,151,255,0)");
  g.addColorStop(0.25, "rgba(78,151,255,0.58)");
  g.addColorStop(0.45, "rgba(72,220,205,0.44)");
  g.addColorStop(0.62, "rgba(255,206,92,0.30)");
  g.addColorStop(0.8, "rgba(226,92,165,0.38)");
  g.addColorStop(1, "rgba(126,112,255,0)");
  roundedRect(c, x - w / 2, y - h / 2, w, h, h / 2);
  c.fillStyle = g;
  c.fill();
  c.restore();
}

function drawParticles(c, sx, sy, tx, ty, p, seed) {
  c.save();
  c.globalAlpha = Math.sin(p * PI) * 0.28;
  c.fillStyle = "rgba(47,111,235,0.32)";
  for (let i = 0; i < 8; i++) {
    const off = (fract(Math.sin(seed + i * 9.1) * 99) - 0.5) * 80 * S * Math.sin(p * PI);
    c.beginPath();
    c.arc(lerp(sx, tx, p) + off, lerp(sy, ty, p) - off * 0.3, 2.2 * S, 0, PI * 2);
    c.fill();
  }
  c.restore();
}

function drawSoftGlow(c, x, y, r, color) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, PI * 2);
  c.fill();
}

function drawSubtitle(c, text, t, start, end, pos, segmented = false) {
  const a = easeOut(saturate((t - start) / 0.45)) * (1 - easeIn(saturate((t - end) / 0.45)));
  if (a <= 0) return;
  let x = CX;
  let y = H - 190 * S;
  let align = "center";
  let size = pos === "center-question" ? 82 * S : 72 * S;
  if (pos === "lower-left") {
    x = 300 * S;
    y = H - 210 * S;
    align = "left";
    size = 64 * S;
  }
  if (pos === "center-question") y = CY + 20 * S;
  if (segmented) size = 82 * S;
  drawText(c, text, x, y - (1 - a) * 18 * S, size, segmented ? "500" : "400", palette.text, align, a);
}

function drawCenterPhrase(c, text, alpha) {
  if (alpha <= 0) return;
  drawText(c, text, CX, CY + 8 * S, 96 * S, "600", palette.text, "center", alpha);
}

function drawTag(c, x, y, text, alpha) {
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${24 * S}px "PingFang SC", "Source Han Sans SC", sans-serif`;
  const w = c.measureText(text).width + 28 * S;
  roundedRect(c, x, y - 24 * S, w, 40 * S, 16 * S);
  c.fillStyle = "rgba(47,111,235,0.06)";
  c.fill();
  drawText(c, text, x + 14 * S, y + 5 * S, 24 * S, "400", palette.muted, "left", 1);
  c.restore();
}

function drawText(c, text, x, y, size, weight, color, align, alpha) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha *= alpha;
  c.font = `${weight} ${size}px "PingFang SC", "Source Han Sans SC", "Noto Sans CJK SC", system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillStyle = color;
  c.fillText(text, x, y);
  c.restore();
}

function roundedShadow(c, x, y, w, h, r) {
  c.save();
  c.shadowColor = "rgba(15,23,42,0.08)";
  c.shadowBlur = 42 * S;
  c.shadowOffsetY = 18 * S;
  roundedRect(c, x, y, w, h, r);
  c.fillStyle = "rgba(255,255,255,0.82)";
  c.fill();
  c.restore();
  c.save();
  c.shadowColor = "rgba(15,23,42,0.05)";
  c.shadowBlur = 8 * S;
  c.shadowOffsetY = 2 * S;
  roundedRect(c, x, y, w, h, r);
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fill();
  c.restore();
}

function roundedRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + w - rr, y);
  c.quadraticCurveTo(x + w, y, x + w, y + rr);
  c.lineTo(x + w, y + h - rr);
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
}

function makeFragments() {
  const kinds = ["text", "image", "video", "music", "book", "web", "list", "file", "map", "code", "text", "image", "video", "music", "book", "web", "list", "file", "map", "code", "text", "image", "list", "web"];
  return kinds.map((kind, index) => {
    const angle = index * 2.399;
    const radiusX = (760 + (index % 5) * 145) * S;
    const radiusY = (330 + (index % 4) * 72) * S;
    const w = (kind === "music" ? 310 : kind === "file" ? 160 : 260 + (index % 3) * 56) * S;
    const h = (kind === "music" ? 100 : kind === "file" ? 190 : 130 + (index % 2) * 50) * S;
    return {
      kind,
      index,
      x: CX + Math.cos(angle) * radiusX,
      y: CY + Math.sin(angle * 1.15) * radiusY,
      w,
      h,
      r: 18 * S,
      rot: (fract(Math.sin(index * 12.3) * 8.9) - 0.5) * 0.08,
      speed: 0.25 + (index % 7) * 0.035,
      amp: 12 + (index % 5) * 6,
      seed: index * 10.17,
      delay: 0.08 + (index % 6) * 0.04,
      depth: index % 5 === 0 ? "near" : index % 4 === 0 ? "far" : "mid"
    };
  });
}

const windows = [
  { key: "text", x: CX - 420 * S, y: CY - 180 * S, w: 370 * S, h: 240 * S },
  { key: "image", x: CX - 420 * S, y: CY + 170 * S, w: 350 * S, h: 270 * S },
  { key: "music", x: CX - 115 * S, y: CY + 260 * S, w: 290 * S, h: 145 * S },
  { key: "web", x: CX + 155 * S, y: CY - 185 * S, w: 360 * S, h: 225 * S },
  { key: "video", x: CX + 460 * S, y: CY - 10 * S, w: 380 * S, h: 235 * S },
  { key: "list", x: CX + 425 * S, y: CY + 250 * S, w: 340 * S, h: 200 * S }
];

function windowTarget(kind) {
  const key = kind === "book" || kind === "code" || kind === "file" ? "text" : kind === "map" ? "web" : kind;
  return windows.find((w) => w.key === key) ?? windows[0];
}

function contentTarget(kind) {
  if (kind === "image" || kind === "map") return { x: CX + 330 * S, y: CY - 30 * S };
  if (kind === "video") return { x: CX + 330 * S, y: CY + 190 * S };
  if (kind === "music") return { x: CX, y: CY + 310 * S };
  return { x: CX - 260 * S, y: CY + 20 * S };
}

function makeOrbitCards() {
  const data = [
    ["阅读摘记", "text", -840, -230, 400, 250, true, -300, -170],
    ["光影参考", "image", -720, 210, 320, 420, true, 0, 10],
    ["现场片段", "video", 780, -120, 430, 270, true, 300, 190],
    ["环境声音", "music", 790, 260, 430, 210, false, 0, 0],
    ["网页收藏", "web", 250, -360, 390, 245, false, 0, 0],
    ["一本电子书", "book", -260, -350, 300, 400, false, 0, 0],
    ["准备清单", "list", -1030, 160, 340, 260, false, 0, 0],
    ["作品合集", "portfolio", 1030, 90, 350, 350, false, 0, 0]
  ];
  return data.map(([title, kind, x, y, w, h, pick, pickX, pickY]) => ({ title, kind, x, y, w, h, pick, pickX, pickY }));
}

function makeBoxCards() {
  return ["旅行记录", "阅读摘记", "作品合集", "网页收藏", "声音素材", "项目资料", "图片参考", "准备清单", "灵感记录"];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function saturate(v) {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0, edge1, x) {
  const t = saturate((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function easeOut(t) {
  return 1 - Math.pow(1 - saturate(t), 3);
}

function easeIn(t) {
  return Math.pow(saturate(t), 3);
}

function easeInOut(t) {
  t = saturate(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function fract(v) {
  return v - Math.floor(v);
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpColor(a, b, t) {
  return [Math.round(lerp(a[0], b[0], t)), Math.round(lerp(a[1], b[1], t)), Math.round(lerp(a[2], b[2], t))];
}

function rgbToCss(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

renderAt(0);
window.renderFilmFrame = (seconds) => {
  window.__recording = true;
  renderAt(Number(seconds) || 0);
};

let previewStart = performance.now();
function preview() {
  if (!window.__recording) {
    const elapsed = ((performance.now() - previewStart) / 1000) % film.duration;
    renderAt(elapsed);
  }
  requestAnimationFrame(preview);
}
requestAnimationFrame(preview);

window.recordFilm = async ({ seconds = 90, fps = 25 } = {}) => {
  window.__recording = true;
  previewStart = performance.now();
  const stream = stage.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm;codecs=vp8";
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 12_000_000
  });

  recorder.ondataavailable = async (event) => {
    if (!event.data || event.data.size === 0) return;
    const buffer = await event.data.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    await window.saveVideoChunk(btoa(binary));
  };

  const totalFrames = Math.round(seconds * fps);
  let frame = 0;

  return new Promise((resolve) => {
    recorder.onstop = () => {
      window.__recording = false;
      resolve();
    };
    recorder.start(1000);
    const interval = setInterval(() => {
      renderAt(frame / fps);
      frame += 1;
      if (frame > totalFrames) {
        clearInterval(interval);
        setTimeout(() => recorder.stop(), 150);
      }
    }, 1000 / fps);
  });
};
