/**
 * Konva 渲染适配器单元测试
 * 验证 RenderTree → Konva 配置的纯数据映射：几何/填充/描边/阴影/文本坐标与缺省字段兜底。
 * 坐标契约依据引擎 pptx-render：
 *   - text-layout.ts layoutAll：baseline = 行顶y + (leadAbove ?? 0) + 行ascent，
 *     run.baselineY / run.x 均为文本内容区绝对坐标（内边距除外）；
 *   - render-tree.ts：ascentPx 为 run 字体真实 ascent，缺省时按 0.8em 兜底；
 *   - leadAbove 仅在非 0 时写入（缺省 ⟺ 0），且已折叠进 baselineY。
 */
import { describe, expect, it } from "vitest";
import type {
  ChartRenderNode,
  ChipRenderNode,
  GlyphRun,
  GroupRenderNode,
  PictureRenderNode,
  PlacedBox,
  RenderTextLayout,
  ShapeRenderNode,
  TableCellRender,
  TableRenderNode,
  TextLine,
} from "../../src/engine/pptx-render/src/index";
import {
  calculatePolygonPoints,
  createChartNodeConfig,
  createChipNodeConfig,
  createGroupNodeConfig,
  createNodeConfig,
  createPictureNodeConfig,
  createShapeNodeConfig,
  createTableNodeConfig,
  getNodeBounds,
  isNodeInteractive,
  isNodeSelectable,
  normalizeColor,
  resolveFillConfig,
  resolveShadowConfig,
  resolveStrokeConfig,
  resolveTextConfig,
} from "../../src/apps/slide/konva/render-adapter";

// ── 测试数据构造（以引擎真实类型为准） ──────────────────────────────

function makeBox(overrides: Partial<PlacedBox> = {}): PlacedBox {
  return {
    x: 10,
    y: 20,
    w: 120,
    h: 60,
    rotationDeg: 0,
    flipH: false,
    flipV: false,
    centerX: 70,
    centerY: 50,
    ...overrides,
  };
}

function makeShapeNode(overrides: Partial<ShapeRenderNode> = {}): ShapeRenderNode {
  return {
    id: "shape-1",
    type: "shape",
    box: makeBox(),
    sourceId: "src-shape-1",
    fill: { kind: "none" },
    ...overrides,
  };
}

function makePictureNode(overrides: Partial<PictureRenderNode> = {}): PictureRenderNode {
  return {
    id: "pic-1",
    type: "picture",
    box: makeBox(),
    sourceId: "src-pic-1",
    ...overrides,
  };
}

function makeGroupNode(overrides: Partial<GroupRenderNode> = {}): GroupRenderNode {
  return {
    id: "group-1",
    type: "group",
    box: makeBox(),
    sourceId: "src-group-1",
    children: [],
    ...overrides,
  };
}

function makeTableCell(overrides: Partial<TableCellRender> = {}): TableCellRender {
  return {
    x: 0,
    y: 0,
    w: 60,
    h: 30,
    row: 0,
    col: 0,
    fill: { kind: "solid", color: "FFFFFF" },
    ...overrides,
  };
}

function makeTableNode(overrides: Partial<TableRenderNode> = {}): TableRenderNode {
  return {
    id: "table-1",
    type: "table",
    box: makeBox(),
    sourceId: "src-table-1",
    cells: [makeTableCell()],
    gridX: [0, 60],
    gridY: [0, 30],
    ...overrides,
  };
}

function makeChartNode(overrides: Partial<ChartRenderNode> = {}): ChartRenderNode {
  return {
    id: "chart-1",
    type: "chart",
    box: makeBox(),
    sourceId: "src-chart-1",
    gridLines: [],
    axisLines: [],
    labels: [],
    bars: [],
    polylines: [],
    markers: [],
    swatches: [],
    ...overrides,
  };
}

function makeChipNode(overrides: Partial<ChipRenderNode> = {}): ChipRenderNode {
  return {
    id: "chip-1",
    type: "placeholder-chip",
    box: makeBox(),
    sourceId: "src-chip-1",
    kind: "chart",
    label: "图表占位",
    ...overrides,
  };
}

function makeGlyphRun(overrides: Partial<GlyphRun> = {}): GlyphRun {
  return {
    text: "薯片",
    x: 0,
    baselineY: 24,
    fontFamily: "Arial",
    fontSizePx: 20,
    color: "FF0000",
    bold: false,
    italic: false,
    underline: false,
    widthPx: 40,
    ...overrides,
  };
}

function makeTextLine(runs: GlyphRun[], overrides: Partial<Omit<TextLine, "runs">> = {}): TextLine {
  return {
    runs,
    top: 0,
    height: 28,
    ...overrides,
  };
}

function makeTextLayout(overrides: Partial<RenderTextLayout> = {}): RenderTextLayout {
  return {
    lines: [],
    insets: { l: 10, t: 6, r: 10, b: 6 },
    anchor: "top",
    fontScale: 1,
    contentHeight: 0,
    wrap: true,
    ...overrides,
  };
}

// ── 颜色格式转换 ────────────────────────────────────────────────────

describe("normalizeColor", () => {
  it("空值、none、transparent 统一映射为 transparent", () => {
    expect(normalizeColor("")).toBe("transparent");
    expect(normalizeColor("none")).toBe("transparent");
    expect(normalizeColor("transparent")).toBe("transparent");
  });

  it("裸十六进制补 # 前缀", () => {
    expect(normalizeColor("FF0000")).toBe("#FF0000");
    expect(normalizeColor("3366CC")).toBe("#3366CC");
  });

  it("已是 #、rgb、rgba 格式时保持原样", () => {
    expect(normalizeColor("#FF0000")).toBe("#FF0000");
    expect(normalizeColor("rgb(255, 0, 0)")).toBe("rgb(255, 0, 0)");
    expect(normalizeColor("rgba(0, 0, 0, 0.5)")).toBe("rgba(0, 0, 0, 0.5)");
  });
});

// ── 填充映射 ────────────────────────────────────────────────────────

describe("resolveFillConfig", () => {
  it("缺省与 none 填充关闭填充", () => {
    expect(resolveFillConfig(undefined)).toEqual({ fillEnabled: false });
    expect(resolveFillConfig({ kind: "none" })).toEqual({ fillEnabled: false });
  });

  it("纯色填充映射颜色并启用", () => {
    expect(resolveFillConfig({ kind: "solid", color: "FF0000" })).toEqual({
      fill: "#FF0000",
      fillEnabled: true,
    });
  });

  it("图案填充映射背景色", () => {
    expect(
      resolveFillConfig({ kind: "pattern", preset: "pct20", fg: "111111", bg: "EEEEEE", cellPx: 8 }),
    ).toEqual({ fillEnabled: true, fill: "#EEEEEE" });
  });

  it("图片填充：有 dataUrl 时启用并携带透明度，无 dataUrl 时关闭", () => {
    expect(
      resolveFillConfig({ kind: "image", dataUrl: "data:image/png;base64,QQ==", mode: "stretch", alpha: 0.6 }),
    ).toEqual({ fillEnabled: true, opacity: 0.6 });
    expect(resolveFillConfig({ kind: "image", mode: "stretch" })).toEqual({ fillEnabled: false });
  });

  it("线性渐变映射角度方向与交错色标数组", () => {
    const config = resolveFillConfig({
      kind: "gradient",
      angleDeg: 90,
      stops: [
        { pos: 0, color: "FF0000" },
        { pos: 1, color: "00FF00" },
      ],
    });
    expect(config.fillEnabled).toBe(true);
    expect(config.fillLinearGradientStartPointX).toBe(0);
    expect(config.fillLinearGradientStartPointY).toBe(0);
    expect(config.fillLinearGradientEndPointX).toBeCloseTo(0, 6);
    expect(config.fillLinearGradientEndPointY).toBe(1);
    // Konva 色标为 [offset, color, ...] 交错数组
    expect(config.fillLinearGradientColorStops).toEqual([0, "#FF0000", 1, "#00FF00"]);
  });

  it("径向渐变映射中心（缺省 0.5/0.5）与半径", () => {
    const config = resolveFillConfig({
      kind: "gradient",
      angleDeg: 0,
      radial: true,
      stops: [{ pos: 0.5, color: "3366CC" }],
    });
    expect(config.fillRadialGradientStartPointX).toBe(0.5);
    expect(config.fillRadialGradientStartPointY).toBe(0.5);
    expect(config.fillRadialGradientStartRadius).toBe(0);
    expect(config.fillRadialGradientEndRadius).toBe(1);
    expect(config.fillRadialGradientColorStops).toEqual([0.5, "#3366CC"]);

    const offset = resolveFillConfig({
      kind: "gradient",
      angleDeg: 0,
      radial: true,
      center: { x: 0.25, y: 0.75 },
      stops: [],
    });
    expect(offset.fillRadialGradientStartPointX).toBe(0.25);
    expect(offset.fillRadialGradientStartPointY).toBe(0.75);
  });
});

// ── 描边与阴影映射 ──────────────────────────────────────────────────

describe("resolveStrokeConfig", () => {
  it("缺省描边关闭", () => {
    expect(resolveStrokeConfig(undefined, 120, 60)).toEqual({ strokeEnabled: false });
  });

  it("实线描边映射颜色、宽度、端帽与拐角", () => {
    expect(
      resolveStrokeConfig(
        { color: "3366CC", widthPx: 2.5, widthPt: 1.875, dash: [6, 3], cap: "round", join: "bevel" },
        120,
        60,
      ),
    ).toEqual({
      stroke: "#3366CC",
      strokeEnabled: true,
      strokeWidth: 2.5,
      strokeScaleEnabled: false,
      dashEnabled: true,
      dash: [6, 3],
      lineCap: "round",
      lineJoin: "bevel",
    });
  });

  it("无虚线时 dashEnabled 为 false，cap/join 缺省为 undefined", () => {
    const config = resolveStrokeConfig({ color: "000000", widthPx: 1, widthPt: 0.75 }, 10, 10);
    expect(config.dashEnabled).toBe(false);
    expect(config.dash).toBeUndefined();
    expect(config.lineCap).toBeUndefined();
    expect(config.lineJoin).toBeUndefined();
  });
});

describe("resolveShadowConfig", () => {
  it("缺省阴影关闭", () => {
    expect(resolveShadowConfig(undefined)).toEqual({ shadowEnabled: false });
  });

  it("阴影映射颜色、模糊与偏移", () => {
    expect(resolveShadowConfig({ color: "444444", blurPx: 4, offsetX: 2, offsetY: 3 })).toEqual({
      shadowColor: "#444444",
      shadowBlur: 4,
      shadowOffsetX: 2,
      shadowOffsetY: 3,
      shadowEnabled: true,
      shadowOpacity: 1,
    });
  });
});

// ── 多边形点换算 ────────────────────────────────────────────────────

describe("calculatePolygonPoints", () => {
  it("按宽高把归一化点展开为扁平像素数组", () => {
    expect(calculatePolygonPoints([0, 0, 1, 0, 0.5, 1], 100, 50)).toEqual([0, 0, 100, 0, 50, 50]);
  });
});

// ── 文本映射（核心坐标契约） ────────────────────────────────────────

describe("resolveTextConfig", () => {
  it("多 run 的加粗/斜体/下划线/删除线/字号/字体/颜色映射正确", () => {
    const layout = makeTextLayout({
      lines: [
        makeTextLine([
          makeGlyphRun({ text: "粗斜", bold: true, italic: true, color: "3366CC", fontSizePx: 20, fontFamily: "SimSun" }),
          makeGlyphRun({
            text: "线删",
            x: 45,
            underline: true,
            strike: true,
            color: "#00AA00",
            widthPx: 30,
            letterSpacingPx: 1.5,
          }),
          makeGlyphRun({ text: "普通", x: 80, color: "rgb(9, 9, 9)", widthPx: 25, kerningOff: true }),
        ]),
      ],
    });

    const configs = resolveTextConfig(layout, 200, 100);
    expect(configs).toHaveLength(3);

    expect(configs[0]).toMatchObject({
      text: "粗斜",
      fontStyle: "bold italic",
      textDecoration: "",
      fontSize: 20,
      fontFamily: "SimSun",
      fill: "#3366CC",
    });

    expect(configs[1]).toMatchObject({
      text: "线删",
      fontStyle: "normal",
      textDecoration: "underline line-through",
      fill: "#00AA00",
      letterSpacing: 1.5,
      kerningEnabled: true,
      width: 30,
    });

    expect(configs[2]).toMatchObject({
      text: "普通",
      fontStyle: "normal",
      textDecoration: "",
      fill: "rgb(9, 9, 9)",
      kerningEnabled: false,
      letterSpacing: undefined,
    });
  });

  it("坐标映射：内边距只补一次，引擎绝对坐标不再累加行顶/行高/run 宽度", () => {
    const layout = makeTextLayout({
      insets: { l: 10, t: 6, r: 10, b: 6 },
      lines: [
        makeTextLine([makeGlyphRun({ text: "AB", x: 12, baselineY: 22, fontSizePx: 20, ascentPx: 16, widthPx: 45 })], {
          top: 0,
          height: 28,
        }),
        makeTextLine([makeGlyphRun({ text: "CD", x: 57, baselineY: 50, fontSizePx: 20, ascentPx: 16, widthPx: 30 })], {
          top: 28,
          height: 28,
        }),
      ],
    });

    const configs = resolveTextConfig(layout, 200, 100);
    expect(configs).toHaveLength(2);

    // 第一行：x = insets.l + run.x，y = insets.t + baselineY − ascentPx
    expect(configs[0]!.x).toBe(22);
    expect(configs[0]!.y).toBe(12);

    // 第二行：baselineY 已含行顶与 leadAbove；行高 28 不得再次累加（否则 y=68）
    expect(configs[1]!.x).toBe(67);
    expect(configs[1]!.y).toBe(40);
  });

  it("同 run 依次映射，前一个 run 的宽度不得叠加到后一个 run 的 x 上", () => {
    const layout = makeTextLayout({
      lines: [
        makeTextLine([
          makeGlyphRun({ text: "甲", x: 5, widthPx: 40, baselineY: 24, ascentPx: 16 }),
          makeGlyphRun({ text: "乙", x: 45, widthPx: 40, baselineY: 24, ascentPx: 16 }),
        ]),
      ],
    });

    const configs = resolveTextConfig(layout, 200, 100);
    // run.x 已含行内推进：第二个 run 的 x = 10 + 45 = 55，而非 55 + 40
    expect(configs[0]!.x).toBe(15);
    expect(configs[1]!.x).toBe(55);
  });

  it("对齐映射：显式对齐透传，缺省左对齐", () => {
    const make = (align: TextLine["align"]) =>
      resolveTextConfig(
        makeTextLayout({ lines: [makeTextLine([makeGlyphRun()], { align })] }),
        200,
        100,
      );

    expect(make("center")[0]!.align).toBe("center");
    expect(make("right")[0]!.align).toBe("right");
    expect(make("justify")[0]!.align).toBe("justify");
    expect(make(undefined)[0]!.align).toBe("left");
  });

  it("旋转映射：rotate90 → 90°，rotate270 → −90°，缺省无 rotation", () => {
    const configs = resolveTextConfig(
      makeTextLayout({
        lines: [
          makeTextLine([
            makeGlyphRun({ text: "竖", rotate90: true }),
            makeGlyphRun({ text: "倒", x: 30, rotate270: true }),
            makeGlyphRun({ text: "正", x: 60 }),
          ]),
        ],
      }),
      200,
      100,
    );

    expect(configs[0]!.rotation).toBe(90);
    expect(configs[1]!.rotation).toBe(-90);
    expect(configs[2]!.rotation).toBeUndefined();
  });

  it("项目符号 run 不参与绘制映射", () => {
    const configs = resolveTextConfig(
      makeTextLayout({
        lines: [
          makeTextLine([
            makeGlyphRun({ text: "•", isBullet: true, widthPx: 12 }),
            makeGlyphRun({ text: "正文", x: 20 }),
          ]),
        ],
      }),
      200,
      100,
    );

    expect(configs).toHaveLength(1);
    expect(configs[0]!.text).toBe("正文");
  });

  it("ascentPx 缺省时按 0.8em 兜底，显式真实 ascent 正常参与基线换算", () => {
    const fallback = resolveTextConfig(
      makeTextLayout({ lines: [makeTextLine([makeGlyphRun({ fontSizePx: 20, baselineY: 50 })])] }),
      200,
      100,
    );
    // y = insets.t + baselineY − 0.8 × fontSizePx = 6 + 50 − 16
    expect(fallback[0]!.y).toBe(40);

    // 兜底值与引擎启发式 metrics 的 ascent（0.8em）完全一致
    const explicit = resolveTextConfig(
      makeTextLayout({
        lines: [makeTextLine([makeGlyphRun({ fontSizePx: 20, baselineY: 50, ascentPx: 16 })])],
      }),
      200,
      100,
    );
    expect(explicit[0]!.y).toBe(40);
    expect(explicit[0]).toEqual(fallback[0]);

    // 非默认字体（真实 ascent 0.92em）按真实值换算
    const realFont = resolveTextConfig(
      makeTextLayout({
        lines: [makeTextLine([makeGlyphRun({ fontSizePx: 20, baselineY: 50, ascentPx: 18.4 })])],
      }),
      200,
      100,
    );
    expect(realFont[0]!.y).toBeCloseTo(37.6, 10);
  });

  it("leadAbove 缺省（⟺0）不改变绘制坐标，且不得在 baselineY 之上二次叠加", () => {
    const run = makeGlyphRun({ x: 5, baselineY: 50, fontSizePx: 20, ascentPx: 16, widthPx: 40 });
    const lineBase = { top: 28, height: 28 };

    // 引擎已把行顶与 leadAbove 折叠进 run.baselineY（layoutAll：
    // baseline = 行顶y + (leadAbove ?? 0) + 行ascent），适配层固定同一 baselineY，
    // 验证 leadAbove 缺省、为 0、为正值时绘制坐标完全一致（不得二次叠加）。
    const without = resolveTextConfig(
      makeTextLayout({ lines: [makeTextLine([run], lineBase)] }),
      200,
      100,
    );
    const withZero = resolveTextConfig(
      makeTextLayout({ lines: [makeTextLine([run], { ...lineBase, leadAbove: 0 })] }),
      200,
      100,
    );
    const withPositive = resolveTextConfig(
      makeTextLayout({ lines: [makeTextLine([run], { ...lineBase, leadAbove: 4 })] }),
      200,
      100,
    );

    const expectedY = 6 + 50 - 16; // insets.t + baselineY − ascentPx
    expect(without[0]!.y).toBe(expectedY);
    expect(withZero[0]).toEqual(without[0]);
    expect(withPositive[0]).toEqual(without[0]);
  });
});

// ── 节点配置映射 ────────────────────────────────────────────────────

describe("createShapeNodeConfig", () => {
  it("矩形几何、填充描边阴影与交互选项映射正确", () => {
    const node = makeShapeNode({
      id: "sp1",
      box: makeBox({
        x: 5,
        y: 6,
        w: 120,
        h: 60,
        rotationDeg: 30,
        flipH: true,
        flipV: true,
        centerX: 65,
        centerY: 36,
      }),
      fill: { kind: "solid", color: "FF0000" },
      stroke: { color: "000000", widthPx: 2, widthPt: 1.5 },
      shadow: { color: "444444", blurPx: 4, offsetX: 2, offsetY: 3 },
      cornerRadiusPx: 8,
    });

    const config = createShapeNodeConfig(node, { idPrefix: "slide3", draggable: true });

    expect(config.id).toBe("slide3_sp1");
    expect(config.x).toBe(5);
    expect(config.y).toBe(6);
    expect(config.width).toBe(120);
    expect(config.height).toBe(60);
    expect(config.rotation).toBe(30);
    expect(config.scaleX).toBe(-1);
    expect(config.scaleY).toBe(-1);
    expect(config.fill).toBe("#FF0000");
    expect(config.fillEnabled).toBe(true);
    expect(config.stroke).toBe("#000000");
    expect(config.strokeWidth).toBe(2);
    expect(config.shadowColor).toBe("#444444");
    expect(config.cornerRadius).toBe(8);
    expect(config.draggable).toBe(true);
  });

  it("缺省选项：id 前缀 node、不可拖拽、无旋转不翻转", () => {
    const config = createShapeNodeConfig(makeShapeNode({ id: "sp2" }));
    expect(config.id).toBe("node_sp2");
    expect(config.rotation).toBe(0);
    expect(config.scaleX).toBe(1);
    expect(config.scaleY).toBe(1);
    expect(config.draggable).toBe(false);
  });

  it("闭合多边形点按节点宽高展开并标记 closed", () => {
    const config = createShapeNodeConfig(
      makeShapeNode({ polygonPoints: [0, 0, 1, 0, 0.5, 1] }),
    );
    expect(config.points).toEqual([0, 0, 120, 0, 60, 60]);
    expect(config.closed).toBe(true);
  });

  it("连接线：折线点透传并标记 bezier", () => {
    const config = createShapeNodeConfig(
      makeShapeNode({ line: { points: [0, 0, 100, 20], bezier: [10, 0, 90, 0, 100, 20] } }),
    );
    expect(config.points).toEqual([0, 0, 100, 20]);
    expect(config.bezier).toBe(true);
  });

  it("自定义路径：SVG data 透传并携带节点宽高", () => {
    const config = createShapeNodeConfig(
      makeShapeNode({ pathData: "M 0 0 L 10 10 Z" }),
    );
    expect(config.data).toBe("M 0 0 L 10 10 Z");
    expect(config.width).toBe(120);
    expect(config.height).toBe(60);
  });
});

describe("createPictureNodeConfig", () => {
  it("图片几何与填充描边阴影映射正确", () => {
    const config = createPictureNodeConfig(
      makePictureNode({
        id: "pic9",
        box: makeBox({ x: 1, y: 2, w: 80, h: 40, rotationDeg: 15, flipV: true }),
        fill: { kind: "solid", color: "FFFFFF" },
        stroke: { color: "666666", widthPx: 1, widthPt: 0.75 },
      }),
      { idPrefix: "s1", draggable: true },
    );

    expect(config.id).toBe("s1_pic9");
    expect(config.x).toBe(1);
    expect(config.y).toBe(2);
    expect(config.width).toBe(80);
    expect(config.height).toBe(40);
    expect(config.rotation).toBe(15);
    expect(config.scaleY).toBe(-1);
    expect(config.fill).toBe("#FFFFFF");
    expect(config.stroke).toBe("#666666");
    expect(config.draggable).toBe(true);
    expect("image" in config).toBe(true);
  });
});

describe("createGroupNodeConfig", () => {
  it("组节点映射位置旋转与裁剪区域", () => {
    const config = createGroupNodeConfig(
      makeGroupNode({
        id: "g1",
        box: makeBox({ x: 7, y: 8, w: 200, h: 100, rotationDeg: 5, flipH: true }),
      }),
    );

    expect(config.id).toBe("node_g1");
    expect(config.x).toBe(7);
    expect(config.y).toBe(8);
    expect(config.rotation).toBe(5);
    expect(config.scaleX).toBe(-1);
    expect(config.clipX).toBe(0);
    expect(config.clipY).toBe(0);
    expect(config.clipWidth).toBe(200);
    expect(config.clipHeight).toBe(100);
  });
});

describe("createTableNodeConfig", () => {
  it("表格节点映射几何与交互选项", () => {
    const config = createTableNodeConfig(
      makeTableNode({ id: "t1", box: makeBox({ x: 3, y: 4, w: 180, h: 90 }) }),
      { draggable: true },
    );

    expect(config.id).toBe("node_t1");
    expect(config.x).toBe(3);
    expect(config.y).toBe(4);
    expect(config.width).toBe(180);
    expect(config.height).toBe(90);
    expect(config.draggable).toBe(true);
  });
});

describe("createChartNodeConfig", () => {
  it("图表节点映射几何", () => {
    const config = createChartNodeConfig(
      makeChartNode({ id: "c1", box: makeBox({ x: 9, y: 9, w: 240, h: 120 }) }),
    );

    expect(config.id).toBe("node_c1");
    expect(config.x).toBe(9);
    expect(config.y).toBe(9);
    expect(config.width).toBe(240);
    expect(config.height).toBe(120);
    expect(config.draggable).toBe(false);
  });
});

describe("createChipNodeConfig", () => {
  it("占位符节点映射标签与固定占位样式", () => {
    const config = createChipNodeConfig(
      makeChipNode({ id: "chip7", label: "表格占位", box: makeBox({ x: 2, y: 3, w: 100, h: 50 }) }),
    );

    expect(config.id).toBe("node_chip7");
    expect(config.x).toBe(2);
    expect(config.y).toBe(3);
    expect(config.width).toBe(100);
    expect(config.height).toBe(50);
    expect(config.text).toBe("表格占位");
    expect(config.fontSize).toBe(14);
    expect(config.fontFamily).toBe("Arial");
    expect(config.fill).toBe("#E0E0E0");
    expect(config.stroke).toBe("#999999");
    expect(config.strokeWidth).toBe(1);
    expect(config.align).toBe("center");
    expect(config.verticalAlign).toBe("middle");
    expect(config.draggable).toBe(false);
  });
});

describe("createNodeConfig", () => {
  it("按节点类型分发到对应配置函数", () => {
    const shape = makeShapeNode({ id: "a" });
    const text = makeShapeNode({ id: "b", type: "text" });
    const picture = makePictureNode({ id: "c" });
    const group = makeGroupNode({ id: "d" });
    const table = makeTableNode({ id: "e" });
    const chart = makeChartNode({ id: "f" });
    const chip = makeChipNode({ id: "g" });

    expect(createNodeConfig(shape)).toEqual(createShapeNodeConfig(shape));
    expect(createNodeConfig(text)).toEqual(createShapeNodeConfig(text));
    expect(createNodeConfig(picture)).toEqual(createPictureNodeConfig(picture));
    expect(createNodeConfig(group)).toEqual(createGroupNodeConfig(group));
    expect(createNodeConfig(table)).toEqual(createTableNodeConfig(table));
    expect(createNodeConfig(chart)).toEqual(createChartNodeConfig(chart));
    expect(createNodeConfig(chip)).toEqual(createChipNodeConfig(chip));
  });
});

// ── 节点元信息 ──────────────────────────────────────────────────────

describe("节点交互与边界", () => {
  it("装饰与背景节点不可交互不可选中", () => {
    const plain = makeShapeNode();
    const decoration = makeShapeNode({ decoration: true });
    const background = makeShapeNode({ background: true });

    expect(isNodeInteractive(plain)).toBe(true);
    expect(isNodeInteractive(decoration)).toBe(false);
    expect(isNodeInteractive(background)).toBe(false);

    expect(isNodeSelectable(plain)).toBe(true);
    expect(isNodeSelectable(decoration)).toBe(false);
    expect(isNodeSelectable(background)).toBe(false);
  });

  it("getNodeBounds 把 PlacedBox 展开为宽高边界", () => {
    expect(getNodeBounds(makeShapeNode({ box: makeBox({ x: 3, y: 4, w: 50, h: 25 }) }))).toEqual({
      x: 3,
      y: 4,
      width: 50,
      height: 25,
    });
  });
});
