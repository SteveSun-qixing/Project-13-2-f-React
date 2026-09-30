/**
 * 取色能力（content-image.pick-colors）：色彩分析核心（OKLab 加权 k-means 第一代，算法标识 `oklab-kmeans-v1`）。
 *
 * 迁移自旧模块 `Chips-ColorPicker/src/color-analysis.ts`（815 行），算法逐行对照保留：
 * sRGB ↔ 线性 ↔ OKLab ↔ OKLCH 换算、色域二分回缩、4bit 量化直方图（含 Alpha 权重、
 * 中心权重与边缘权重）、簇数自适应、贪心 farthest-point 初始化、12 轮加权 k-means、
 * 背景/强调打分、背景与强调的明度彩度调校、最终分离度保障、Alpha 覆盖诊断、
 * 调色板装配（至多 8 项）与元数据装配。
 *
 * 契约侧差异（04-能力契约规范 §8.3 / §8.6）：
 * - 输入不再有 `imagePath` / `sourceMeta`，采样元数据由解码端口产出的 `IDecodedImageInfo` 提供；
 * - 抛出错误统一为 `ChipsError`，码为已登记的 `IMAGE_EMPTY` / `IMAGE_ANALYSIS_FAILED`；
 * - `message` 一律简体中文。
 * 本模块是纯函数：不读路径、不取字节、不产生副作用（§8.3 约束 1）。
 */

import { analysisFailed, emptyImage } from './errors.js';
import type {
  ColorPaletteRole,
  IDecodedImageInfo,
  IColorPaletteEntry,
  IPickColorsMetadata,
  IPickColorsResult,
  IRgbaPixelSample,
} from './types.js';

/** 量化直方图桶：像素按 4bit/通道归并后的统计点。 */
interface QuantizedPoint {
  r: number;
  g: number;
  b: number;
  weight: number;
  centerWeight: number;
  edgeWeight: number;
  labL: number;
  labA: number;
  labB: number;
  lightness: number;
  chroma: number;
  hue: number | undefined;
}

/** 量化桶累加器。 */
interface MutableQuantizedPoint {
  rSum: number;
  gSum: number;
  bSum: number;
  weight: number;
  centerWeight: number;
  edgeWeight: number;
}

/** OKLab 空间聚类中心。 */
interface Centroid {
  l: number;
  a: number;
  b: number;
}

/** 聚类结果。 */
interface Cluster {
  r: number;
  g: number;
  b: number;
  weight: number;
  centerWeight: number;
  edgeWeight: number;
  labL: number;
  labA: number;
  labB: number;
  lightness: number;
  chroma: number;
  hue: number | undefined;
}

/** 八位整数 RGB 颜色（浮点域）。 */
interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** OKLab 颜色。 */
interface OklabColor {
  l: number;
  a: number;
  b: number;
}

/** OKLCH 极坐标颜色：`h` 为 `undefined` 表示无色调（近中性色）。 */
interface PolarColor {
  l: number;
  c: number;
  h: number | undefined;
}

/** 分析上下文：解码端口回填的采样信息。 */
export interface IColorAnalysisContext {
  /** 采样边长（像素）。 */
  sampleSize?: number;
  /** 原图信息。 */
  info?: IDecodedImageInfo;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const roundChannel = (value: number): number => {
  return Math.round(clamp(value, 0, 255));
};

const srgbToLinear = (channel: number): number => {
  const normalized = clamp(channel / 255, 0, 1);
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
};

const linearToSrgb = (channel: number): number => {
  if (channel <= 0.0031308) {
    return channel * 12.92;
  }
  return 1.055 * channel ** (1 / 2.4) - 0.055;
};

const rgbToOklab = ({ r, g, b }: RgbColor): OklabColor => {
  const red = srgbToLinear(r);
  const green = srgbToLinear(g);
  const blue = srgbToLinear(b);

  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
};

const oklabToRgbFloat = ({ l, a, b }: OklabColor): RgbColor => {
  const lComponent = l + 0.3963377774 * a + 0.2158037573 * b;
  const mComponent = l - 0.1055613458 * a - 0.0638541728 * b;
  const sComponent = l - 0.0894841775 * a - 1.291485548 * b;

  const lCube = lComponent ** 3;
  const mCube = mComponent ** 3;
  const sCube = sComponent ** 3;

  const red = linearToSrgb(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube);
  const green = linearToSrgb(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube);
  const blue = linearToSrgb(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube);

  return { r: red * 255, g: green * 255, b: blue * 255 };
};

const oklabToRgb = ({ l, a, b }: OklabColor): RgbColor => {
  const rgb = oklabToRgbFloat({ l, a, b });
  return {
    r: roundChannel(rgb.r),
    g: roundChannel(rgb.g),
    b: roundChannel(rgb.b),
  };
};

const oklabToOklch = ({ l, a, b }: OklabColor): PolarColor => {
  const c = Math.sqrt(a * a + b * b);
  if (c < 1e-7) {
    return { l, c: 0, h: undefined };
  }
  return { l, c, h: Math.atan2(b, a) };
};

const oklchToRgb = ({ l, c, h }: PolarColor): RgbColor => {
  if (h === undefined || c <= 1e-7) {
    return oklabToRgb({ l, a: 0, b: 0 });
  }

  return oklabToRgb({
    l,
    a: Math.cos(h) * c,
    b: Math.sin(h) * c,
  });
};

const isInRgbGamut = (color: PolarColor): boolean => {
  const hue = color.h;
  const rgb =
    hue === undefined || color.c <= 1e-7
      ? oklabToRgbFloat({ l: color.l, a: 0, b: 0 })
      : oklabToRgbFloat({
          l: color.l,
          a: Math.cos(hue) * color.c,
          b: Math.sin(hue) * color.c,
        });
  return rgb.r >= 0 && rgb.r <= 255 && rgb.g >= 0 && rgb.g <= 255 && rgb.b >= 0 && rgb.b <= 255;
};

/** 把超出 sRGB 色域的 OKLCH 颜色沿彩度轴二分回缩到色域内。 */
const fitOklchToRgb = (color: PolarColor): RgbColor => {
  const hue = color.h;
  if (hue === undefined || color.c <= 1e-7) {
    return oklchToRgb({ l: color.l, c: 0, h: undefined });
  }

  if (isInRgbGamut(color)) {
    return oklchToRgb(color);
  }

  let low = 0;
  let high = color.c;
  let best = oklchToRgb({ l: color.l, c: 0, h: hue });

  for (let iteration = 0; iteration < 18; iteration += 1) {
    const mid = (low + high) / 2;
    const candidateColor: PolarColor = { l: color.l, c: mid, h: hue };
    const candidateRgb = oklchToRgb(candidateColor);
    if (isInRgbGamut(candidateColor)) {
      low = mid;
      best = candidateRgb;
    } else {
      high = mid;
    }
  }

  return best;
};

const rgbToHex = ({ r, g, b }: RgbColor): string => {
  return `#${roundChannel(r).toString(16).padStart(2, '0')}${roundChannel(g)
    .toString(16)
    .padStart(2, '0')}${roundChannel(b).toString(16).padStart(2, '0')}`;
};

const roundRatio = (value: number): number => {
  return Math.round(clamp(value, 0, 1) * 1000) / 1000;
};

const labDistance = (
  left: Pick<Cluster, 'labL' | 'labA' | 'labB'>,
  right: Pick<Cluster, 'labL' | 'labA' | 'labB'>
): number => {
  const deltaL = left.labL - right.labL;
  const deltaA = left.labA - right.labA;
  const deltaB = left.labB - right.labB;
  return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
};

const closeness = (value: number, target: number, tolerance: number): number => {
  if (tolerance <= 0) {
    return 0;
  }
  return clamp(1 - Math.abs(value - target) / tolerance, 0, 1);
};

const normalizeChroma = (value: number): number => {
  return clamp(value / 0.22, 0, 1);
};

const isNeutralLike = (color: Pick<PolarColor, 'c' | 'h'>): boolean => {
  return color.h === undefined || color.c < 0.028;
};

/** 建 4bit/通道量化直方图：跳过近透明像素，按 Alpha 加权累计权重、中心度与边缘度。 */
const collectQuantizedPoints = (sample: IRgbaPixelSample): QuantizedPoint[] => {
  const bins = new Map<string, MutableQuantizedPoint>();
  const edgeThresholdX = Math.max(1, sample.width * 0.14);
  const edgeThresholdY = Math.max(1, sample.height * 0.14);
  const maxDistance = Math.sqrt(0.5 * 0.5 + 0.5 * 0.5);

  for (let y = 0; y < sample.height; y += 1) {
    for (let x = 0; x < sample.width; x += 1) {
      const pixelOffset = (y * sample.width + x) * 4;
      const alpha = (sample.pixels[pixelOffset + 3] ?? 0) / 255;

      if (alpha < 0.08) {
        continue;
      }

      const red = sample.pixels[pixelOffset] ?? 0;
      const green = sample.pixels[pixelOffset + 1] ?? 0;
      const blue = sample.pixels[pixelOffset + 2] ?? 0;
      const quantizedRed = red >> 4;
      const quantizedGreen = green >> 4;
      const quantizedBlue = blue >> 4;
      const key = `${quantizedRed}:${quantizedGreen}:${quantizedBlue}`;

      const normalizedX = (x + 0.5) / sample.width - 0.5;
      const normalizedY = (y + 0.5) / sample.height - 0.5;
      const centerWeight =
        1 -
        clamp(Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY) / maxDistance, 0, 1);
      const edgeWeight =
        x < edgeThresholdX ||
        x >= sample.width - edgeThresholdX ||
        y < edgeThresholdY ||
        y >= sample.height - edgeThresholdY
          ? 1
          : 0;

      const bucket = bins.get(key) ?? {
        rSum: 0,
        gSum: 0,
        bSum: 0,
        weight: 0,
        centerWeight: 0,
        edgeWeight: 0,
      };

      bucket.rSum += red * alpha;
      bucket.gSum += green * alpha;
      bucket.bSum += blue * alpha;
      bucket.weight += alpha;
      bucket.centerWeight += centerWeight * alpha;
      bucket.edgeWeight += edgeWeight * alpha;
      bins.set(key, bucket);
    }
  }

  const points: QuantizedPoint[] = [];
  for (const bucket of bins.values()) {
    if (bucket.weight <= 0) {
      continue;
    }

    const rgb = {
      r: bucket.rSum / bucket.weight,
      g: bucket.gSum / bucket.weight,
      b: bucket.bSum / bucket.weight,
    };
    const lab = rgbToOklab(rgb);
    const lch = oklabToOklch(lab);

    points.push({
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      weight: bucket.weight,
      centerWeight: bucket.centerWeight,
      edgeWeight: bucket.edgeWeight,
      labL: lab.l,
      labA: lab.a,
      labB: lab.b,
      lightness: lch.l,
      chroma: lch.c,
      hue: lch.h,
    });
  }

  if (points.length === 0) {
    throw emptyImage('采样图像不含任何可见像素。');
  }

  return points;
};

/** 簇数自适应：1 点→1 簇，≤4 点→2 至点数，其余按 sqrt(点数/3) 取 3–8。 */
const selectClusterCount = (points: QuantizedPoint[]): number => {
  if (points.length <= 1) {
    return 1;
  }
  if (points.length <= 4) {
    return Math.max(2, points.length);
  }
  return Math.min(8, Math.max(3, Math.round(Math.sqrt(points.length / 3))));
};

/** 贪心 farthest-point 初始化：首簇取「权重 × 彩度」最优点，其后取加权最近距离最远点。 */
const initializeCentroids = (points: QuantizedPoint[], clusterCount: number): Centroid[] => {
  const centroids: Centroid[] = [];
  const first = [...points].sort((left, right) => {
    const leftScore = left.weight * (1 + normalizeChroma(left.chroma));
    const rightScore = right.weight * (1 + normalizeChroma(right.chroma));
    return rightScore - leftScore;
  })[0];

  if (!first) {
    return centroids;
  }

  centroids.push({ l: first.labL, a: first.labA, b: first.labB });

  while (centroids.length < clusterCount) {
    let bestPoint: QuantizedPoint | undefined;
    let bestScore = -1;

    for (const point of points) {
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const centroid of centroids) {
        const deltaL = point.labL - centroid.l;
        const deltaA = point.labA - centroid.a;
        const deltaB = point.labB - centroid.b;
        const distance = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
        nearestDistance = Math.min(nearestDistance, distance);
      }

      const score = point.weight * nearestDistance;
      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }

    if (!bestPoint) {
      break;
    }

    centroids.push({ l: bestPoint.labL, a: bestPoint.labA, b: bestPoint.labB });
  }

  return centroids;
};

/** 12 轮加权 k-means：OKLab 空间分配、加权重心更新，未变化即提前收敛。 */
const clusterPoints = (points: QuantizedPoint[]): Cluster[] => {
  const clusterCount = selectClusterCount(points);
  const centroids = initializeCentroids(points, clusterCount);

  if (centroids.length === 0) {
    throw analysisFailed('代表色聚类初始化失败。');
  }

  const assignments = new Int32Array(points.length).fill(-1);

  for (let iteration = 0; iteration < 12; iteration += 1) {
    let changed = false;

    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (!point) {
        continue;
      }
      let bestClusterIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let centroidIndex = 0; centroidIndex < centroids.length; centroidIndex += 1) {
        const centroid = centroids[centroidIndex];
        if (!centroid) {
          continue;
        }
        const deltaL = point.labL - centroid.l;
        const deltaA = point.labA - centroid.a;
        const deltaB = point.labB - centroid.b;
        const distance = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;

        if (distance < bestDistance) {
          bestDistance = distance;
          bestClusterIndex = centroidIndex;
        }
      }

      if (assignments[index] !== bestClusterIndex) {
        assignments[index] = bestClusterIndex;
        changed = true;
      }
    }

    const nextCentroids = centroids.map(() => ({
      weight: 0,
      labL: 0,
      labA: 0,
      labB: 0,
    }));

    for (let index = 0; index < points.length; index += 1) {
      const clusterIndex = assignments[index];
      const point = points[index];
      if (clusterIndex === undefined || clusterIndex < 0 || !point) {
        continue;
      }
      const bucket = nextCentroids[clusterIndex];
      if (!bucket) {
        continue;
      }

      bucket.weight += point.weight;
      bucket.labL += point.labL * point.weight;
      bucket.labA += point.labA * point.weight;
      bucket.labB += point.labB * point.weight;
    }

    for (let index = 0; index < nextCentroids.length; index += 1) {
      const bucket = nextCentroids[index];
      if (!bucket) {
        continue;
      }
      if (bucket.weight > 0) {
        centroids[index] = {
          l: bucket.labL / bucket.weight,
          a: bucket.labA / bucket.weight,
          b: bucket.labB / bucket.weight,
        };
      }
    }

    if (!changed) {
      break;
    }
  }

  const clusterBuckets = centroids.map(() => ({
    rSum: 0,
    gSum: 0,
    bSum: 0,
    weight: 0,
    centerWeight: 0,
    edgeWeight: 0,
  }));

  for (let index = 0; index < points.length; index += 1) {
    const clusterIndex = assignments[index];
    const point = points[index];
    if (clusterIndex === undefined || clusterIndex < 0 || !point) {
      continue;
    }
    const bucket = clusterBuckets[clusterIndex];
    if (!bucket) {
      continue;
    }

    bucket.rSum += point.r * point.weight;
    bucket.gSum += point.g * point.weight;
    bucket.bSum += point.b * point.weight;
    bucket.weight += point.weight;
    bucket.centerWeight += point.centerWeight;
    bucket.edgeWeight += point.edgeWeight;
  }

  return clusterBuckets
    .filter((bucket) => bucket.weight > 0)
    .map((bucket) => {
      const rgb = {
        r: bucket.rSum / bucket.weight,
        g: bucket.gSum / bucket.weight,
        b: bucket.bSum / bucket.weight,
      };
      const lab = rgbToOklab(rgb);
      const lch = oklabToOklch(lab);

      return {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        weight: bucket.weight,
        centerWeight: bucket.centerWeight,
        edgeWeight: bucket.edgeWeight,
        labL: lab.l,
        labA: lab.a,
        labB: lab.b,
        lightness: lch.l,
        chroma: lch.c,
        hue: lch.h,
      };
    })
    .sort((left, right) => right.weight - left.weight);
};

/** 背景簇打分：占比主导 + 适度彩度 + 明度贴近 0.54 + 边缘加权，罚极低占比与极端明度。 */
const chooseBackgroundCluster = (clusters: Cluster[], totalWeight: number): Cluster => {
  const initialCluster = clusters[0];
  if (!initialCluster) {
    throw analysisFailed('未产生任何代表色簇。');
  }

  let bestCluster = initialCluster;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const cluster of clusters) {
    const share = cluster.weight / totalWeight;
    const edgeRatio = cluster.edgeWeight / Math.max(cluster.weight, 1e-6);
    const score =
      share * 4.2 +
      normalizeChroma(cluster.chroma) * 2 +
      closeness(cluster.lightness, 0.54, 0.2) * 2.7 +
      edgeRatio * 0.45 -
      (share < 0.04 ? 1.1 : 0) -
      (cluster.lightness < 0.24 ? 1.5 : 0) -
      (cluster.lightness > 0.78 ? 1.2 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  return bestCluster;
};

/** 强调簇打分：彩度主导 + 明度贴近 0.58 + 与背景分离度，罚极低占比、极端明度与零分离。 */
const chooseAccentCluster = (
  clusters: Cluster[],
  background: Cluster,
  totalWeight: number
): Cluster | undefined => {
  let bestCluster: Cluster | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const cluster of clusters) {
    if (cluster === background && clusters.length > 1) {
      continue;
    }

    const share = cluster.weight / totalWeight;
    const centerRatio = cluster.centerWeight / Math.max(cluster.weight, 1e-6);
    const separation = labDistance(cluster, background);
    const score =
      normalizeChroma(cluster.chroma) * 3.4 +
      closeness(cluster.lightness, 0.58, 0.2) * 2.1 +
      Math.min(share, 0.2) * 1.5 +
      centerRatio * 0.35 +
      Math.min(separation / 0.16, 1) * 1.1 -
      (share < 0.008 ? 1.1 : 0) -
      (cluster.lightness < 0.18 ? 1.4 : 0) -
      (cluster.lightness > 0.84 ? 0.45 : 0) -
      (separation < 0.05 ? 1.5 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestCluster = cluster;
    }
  }

  return bestCluster;
};

/** 背景色调校：明度压向 0.48–0.62，彩度中性≤0.045、彩色夹到 0.11–0.2。 */
const tuneBackgroundColor = (cluster: Cluster): RgbColor => {
  const color: PolarColor = oklabToOklch({
    l: cluster.labL,
    a: cluster.labA,
    b: cluster.labB,
  });

  if (isNeutralLike(color)) {
    return fitOklchToRgb({
      l: clamp(color.l * 0.7 + 0.16, 0.48, 0.62),
      c: clamp(color.c, 0, 0.045),
      h: color.h,
    });
  }

  const tuned: PolarColor = {
    l: clamp(color.l * 0.72 + 0.14, 0.48, 0.62),
    c: clamp(Math.max(color.c * 1.08, 0.11), 0.11, 0.2),
    h: color.h,
  };

  return fitOklchToRgb(tuned);
};

/** 强调色调校：明度抬到 0.72–0.84，彩度中性≤0.065、彩色夹到 0.18–0.3。 */
const tuneAccentColor = (cluster: Cluster): RgbColor => {
  const color: PolarColor = oklabToOklch({
    l: cluster.labL,
    a: cluster.labA,
    b: cluster.labB,
  });

  if (isNeutralLike(color)) {
    return fitOklchToRgb({
      l: clamp(Math.max(color.l + 0.2, 0.72), 0.72, 0.84),
      c: clamp(color.c * 1.35, 0, 0.065),
      h: color.h,
    });
  }

  const tuned: PolarColor = {
    l: clamp(Math.max(color.l * 0.62 + 0.34, 0.72), 0.72, 0.84),
    c: clamp(Math.max(color.c * 1.62, 0.18), 0.18, 0.3),
    h: color.h,
  };

  return fitOklchToRgb(tuned);
};

/** 单簇图像的强调色派生：从背景簇沿明度/彩度轴抬升。 */
const createFallbackAccent = (background: Cluster): RgbColor => {
  const color: PolarColor = oklabToOklch({
    l: background.labL,
    a: background.labA,
    b: background.labB,
  });

  if (isNeutralLike(color)) {
    return fitOklchToRgb({
      l: clamp(Math.max(color.l + 0.22, 0.74), 0.74, 0.86),
      c: clamp(color.c * 1.4, 0, 0.07),
      h: color.h,
    });
  }

  const tuned: PolarColor = {
    l: clamp(Math.max(color.l + 0.18, 0.74), 0.74, 0.86),
    c: clamp(Math.max(color.c * 1.8, 0.18), 0.18, 0.3),
    h: color.h,
  };

  return fitOklchToRgb(tuned);
};

/** 终检：背景与强调 OKLab 距离不足 0.12 时重新抬升强调色。 */
const ensureFinalSeparation = (
  backgroundRgb: RgbColor,
  accentRgb: RgbColor,
  accentSource: Cluster
): RgbColor => {
  const backgroundLab = rgbToOklab(backgroundRgb);
  const accentLab = rgbToOklab(accentRgb);
  const separation = labDistance(
    { labL: backgroundLab.l, labA: backgroundLab.a, labB: backgroundLab.b },
    { labL: accentLab.l, labA: accentLab.a, labB: accentLab.b }
  );

  if (separation >= 0.12) {
    return accentRgb;
  }

  const accentLch: PolarColor = oklabToOklch({
    l: accentSource.labL,
    a: accentSource.labA,
    b: accentSource.labB,
  });

  if (isNeutralLike(accentLch)) {
    return fitOklchToRgb({
      l: clamp(Math.max(accentLch.l + 0.24, 0.76), 0.76, 0.88),
      c: clamp(accentLch.c * 1.4, 0, 0.07),
      h: accentLch.h,
    });
  }

  return fitOklchToRgb({
    l: clamp(Math.max(accentLch.l + 0.24, 0.78), 0.78, 0.88),
    c: clamp(Math.max(accentLch.c * 1.9, 0.2), 0.2, 0.32),
    h: accentLch.h,
  });
};

/** Alpha 覆盖诊断：可见（α≥0.08）与透明像素占比，千分位取整。 */
const inspectAlphaCoverage = (
  sample: IRgbaPixelSample
): { visiblePixelRatio: number; transparentPixelRatio: number } => {
  let visible = 0;
  let transparent = 0;
  const total = Math.max(sample.width * sample.height, 1);

  for (let index = 0; index < total; index += 1) {
    const alpha = (sample.pixels[index * 4 + 3] ?? 0) / 255;
    if (alpha >= 0.08) {
      visible += 1;
    } else {
      transparent += 1;
    }
  }

  return {
    visiblePixelRatio: roundRatio(visible / total),
    transparentPixelRatio: roundRatio(transparent / total),
  };
};

const createPaletteEntry = (
  color: string,
  role: ColorPaletteRole,
  cluster: Cluster,
  totalWeight: number
): IColorPaletteEntry => {
  return {
    color,
    role,
    population: roundRatio(cluster.weight / Math.max(totalWeight, 1e-6)),
    lightness: roundRatio(cluster.lightness),
    chroma: Math.round(cluster.chroma * 1000) / 1000,
  };
};

/** 调色板装配：背景 + 强调 + 至多 6 个去重代表色（上限 8 项）。 */
const buildPalette = (
  clusters: Cluster[],
  totalWeight: number,
  backgroundCluster: Cluster,
  accentCluster: Cluster,
  backgroundColor: string,
  accentColor: string
): IColorPaletteEntry[] => {
  const entries: IColorPaletteEntry[] = [
    createPaletteEntry(backgroundColor, 'background', backgroundCluster, totalWeight),
    createPaletteEntry(accentColor, 'accent', accentCluster, totalWeight),
  ];

  for (const cluster of clusters) {
    if (cluster === backgroundCluster || cluster === accentCluster) {
      continue;
    }

    const color = rgbToHex(cluster);
    if (entries.some((entry) => entry.color.toLowerCase() === color.toLowerCase())) {
      continue;
    }

    entries.push(createPaletteEntry(color, 'representative', cluster, totalWeight));
    if (entries.length >= 8) {
      break;
    }
  }

  return entries;
};

/** 元数据装配：原图信息缺省时按样本尺寸回填，采样边长缺省时取样本最长边。 */
const buildMetadata = (
  sample: IRgbaPixelSample,
  clusters: Cluster[],
  context: IColorAnalysisContext
): IPickColorsMetadata => {
  const alphaCoverage = inspectAlphaCoverage(sample);
  const info = context.info;
  const image: IDecodedImageInfo =
    info === undefined
      ? {
          width: sample.width,
          height: sample.height,
          animated: false,
          pageCount: 1,
          hasAlpha: true,
        }
      : {
          width: info.width,
          height: info.height,
          animated: info.animated,
          pageCount: info.pageCount,
          hasAlpha: info.hasAlpha,
          ...(info.format === undefined ? {} : { format: info.format }),
          ...(info.orientation === undefined ? {} : { orientation: info.orientation }),
        };

  return {
    algorithm: 'oklab-kmeans-v1',
    image,
    sample: {
      width: sample.width,
      height: sample.height,
      sampleSize: context.sampleSize ?? Math.max(sample.width, sample.height),
      visiblePixelRatio: alphaCoverage.visiblePixelRatio,
      transparentPixelRatio: alphaCoverage.transparentPixelRatio,
      clusterCount: clusters.length,
    },
  };
};

/**
 * 分析 RGBA 像素样本，产出背景色、强调色、调色板与元数据。
 *
 * @param sample - 解码端口产出的 RGBA 像素样本
 * @param context - 采样边长与原图信息（缺省时按样本自身回填）
 * @returns 取色结果
 * @throws `IMAGE_EMPTY` 无可见像素；`IMAGE_ANALYSIS_FAILED` 聚类不可用
 */
export const analyzeColorSample = (
  sample: IRgbaPixelSample,
  context: IColorAnalysisContext = {}
): IPickColorsResult => {
  const points = collectQuantizedPoints(sample);
  const totalWeight = points.reduce((sum, point) => sum + point.weight, 0);
  if (totalWeight <= 0) {
    throw emptyImage('采样图像不含任何可见颜色信息。');
  }

  const clusters = clusterPoints(points);
  const backgroundCluster = chooseBackgroundCluster(clusters, totalWeight);
  const accentCluster =
    chooseAccentCluster(clusters, backgroundCluster, totalWeight) ?? backgroundCluster;

  const backgroundRgb = tuneBackgroundColor(backgroundCluster);
  const accentRgb = ensureFinalSeparation(
    backgroundRgb,
    accentCluster === backgroundCluster
      ? createFallbackAccent(backgroundCluster)
      : tuneAccentColor(accentCluster),
    accentCluster
  );
  const backgroundColor = rgbToHex(backgroundRgb);
  const accentColor = rgbToHex(accentRgb);

  return {
    backgroundColor,
    accentColor,
    palette: buildPalette(
      clusters,
      totalWeight,
      backgroundCluster,
      accentCluster,
      backgroundColor,
      accentColor
    ),
    metadata: buildMetadata(sample, clusters, context),
  };
};
