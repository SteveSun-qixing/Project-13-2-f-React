/// 工作簿编辑契约：由旧仓 `Chips-Office/src/apps/sheet/shared/desktop-api.ts` 逐字抽取的
/// 纯数据 schema 面（zod schema + z.infer 类型）。私有 IPC 桥面（通道表、PdfApi 等）按
/// 矩阵裁决废弃不迁移；此处仅保留 sheet gateway 消费的编辑计划契约，
/// 消费方：xlsx-gateway / xlsx-chart / xlsx-drawing-edit / xlsx-structure / xlsx-styles。
/// 字段与校验规则为迁移原文，语义见各字段行内注释。
import { z } from 'zod'

export const richRunSchema = z
  .object({
    text: z.string(),
    bold: z.boolean(),
    italic: z.boolean(),
    underline: z.boolean(),
    strikethrough: z.boolean(),
    color: z.string().optional(),
    size: z.number().positive().optional(),
    family: z.string().optional(),
    vertAlign: z.enum(['subscript', 'superscript']).optional(),
  })
  .strict()

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/)

/// OOXML border line styles the editor can write.
export const editableBorderStyleSchema = z.enum([
  'thin',
  'medium',
  'thick',
  'dashed',
  'dotted',
  'double',
  'hair',
  'dashDot',
  'dashDotDot',
  'mediumDashed',
  'mediumDashDot',
  'mediumDashDotDot',
  'slantDashDot',
])

/// One border edge delta: an object sets the edge, null removes it.
const styleEditBorderSchema = z.union([
  z
    .object({
      style: editableBorderStyleSchema,
      color: hexColorSchema.optional(),
    })
    .strict(),
  z.null(),
])

/// Renderer-neutral style delta: only keys the user changed are present.
/// `false` means "remove this attribute from the cell's style".
export const workbookStyleEditSchema = z
  .object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    underlineStyle: z.enum(['single', 'double']).optional(),
    strikethrough: z.boolean().optional(),
    fontFamily: z.string().min(1).max(128).optional(),
    fontSize: z.number().positive().max(409).optional(),
    /// null removes the explicit font color (back to the theme default).
    fontColor: z.union([hexColorSchema, z.null()]).optional(),
    /// null clears the fill back to the default "none" pattern.
    fillColor: z.union([hexColorSchema, z.null()]).optional(),
    horizontalAlignment: z.enum(['left', 'center', 'right', 'justify', 'distributed']).optional(),
    verticalAlignment: z.enum(['top', 'center', 'bottom']).optional(),
    wrapText: z.boolean().optional(),
    /// OOXML textRotation: 0-90 counterclockwise, 91-180 clockwise (value-90),
    /// 255 stacked vertical; 0 clears the rotation.
    textRotation: z.union([z.number().int().min(0).max(180), z.literal(255)]).optional(),
    /// OOXML alignment indent steps; 0 clears. Renders on screen as left cell
    /// padding (INDENT_STEP_PX per step).
    indent: z.number().int().min(0).max(250).optional(),
    /// Cell protection flags (xf <protection>); meaningful once the sheet is
    /// protected. true = OOXML default for locked, false for hidden.
    protectionLocked: z.boolean().optional(),
    protectionHidden: z.boolean().optional(),
    numberFormat: z.string().min(1).max(255).optional(),
    borderTop: styleEditBorderSchema.optional(),
    borderBottom: styleEditBorderSchema.optional(),
    borderLeft: styleEditBorderSchema.optional(),
    borderRight: styleEditBorderSchema.optional(),
  })
  .strict()


export const workbookChartEditSchema = z
  .object({
    /// Constrained to the charts directory — the renderer chooses the path.
    chartPath: z.string().regex(/^xl\/charts\/[A-Za-z0-9._-]+\.xml$/),
    title: z.string().max(255).optional(),
    chartType: z.enum(['column', 'bar', 'line', 'area', 'pie', 'doughnut']).optional(),
    seriesColors: z.record(z.string().regex(/^[0-9]{1,3}$/), hexColorSchema).optional(),
    /// 'none' removes the legend; a side re-positions (creating it if needed).
    legend: z.enum(['none', 'right', 'bottom', 'top', 'left']).optional(),
    /// Plot-level data labels: values on bars/points, category+percent or
    /// percent on pie slices. 'none' removes them.
    dataLabels: z.enum(['none', 'value', 'percent', 'category-percent']).optional(),
    /// Placement and number format of the data labels (`c:dLblPos`/`c:numFmt`).
    dataLabelPosition: z.enum(['center', 'inside-end', 'outside-end']).optional(),
    dataLabelFormat: z.string().max(64).optional(),
    /// null removes that axis title. Axis-based charts only.
    axisTitles: z
      .object({
        category: z.string().max(255).nullable().optional(),
        value: z.string().max(255).nullable().optional(),
      })
      .strict()
      .optional(),
    /// Per-point fills (`c:dPt`), keyed series index → point index → color;
    /// how pie/doughnut slices get individual colors.
    pointColors: z
      .record(
        z.string().regex(/^[0-9]{1,3}$/),
        z.record(z.string().regex(/^[0-9]{1,3}$/), hexColorSchema),
      )
      .optional(),
    /// Bar/line/area stacking; 'clustered' means side-by-side (line/area
    /// write it as 'standard').
    grouping: z.enum(['clustered', 'stacked', 'percentStacked']).optional(),
    /// Value-axis major gridlines on/off (axis charts only).
    gridlines: z.boolean().optional(),
    /// Value-axis bounds; null resets that bound to auto.
    valueAxis: z
      .object({
        min: z.number().finite().nullable().optional(),
        max: z.number().finite().nullable().optional(),
      })
      .strict()
      .refine((axis) => axis.min !== undefined || axis.max !== undefined, {
        message: 'A value-axis edit needs min or max.',
      })
      .optional(),
    /// Bar family gap between categories, % of one bar width.
    gapWidthPct: z.number().int().min(0).max(500).optional(),
    /// Doughnut hole diameter, % of chart size.
    holeSizePct: z.number().int().min(10).max(90).optional(),
    /// Pie whole-ring explosion (series 0), % of radius.
    explosionPct: z.number().int().min(0).max(400).optional(),
    /// Pie per-slice explosion overrides (series 0), point index → %.
    pointExplosions: z
      .record(z.string().regex(/^[0-9]{1,3}$/), z.number().int().min(0).max(400))
      .optional(),
    /// Full series replacement (Select Data): existing series all drop and
    /// these are written in order. Wins over `series`/`seriesColors` edits.
    seriesSet: z
      .array(
        z
          .object({
            name: z.string().max(255),
            values: z.array(z.number().finite()).max(1_000),
            valuesRef: z.string().max(512).optional(),
            categories: z.array(z.string().max(255)).max(1_000).optional(),
            categoriesRef: z.string().max(512).optional(),
            color: hexColorSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(24)
      .optional(),
    /// Per-series rewrite of name and/or data (refs + caches travel together
    /// so the file and the on-screen render stay in sync).
    series: z
      .array(
        z
          .object({
            index: z.number().int().min(0).max(255),
            name: z.string().max(255).optional(),
            valuesRef: z.string().max(512).optional(),
            values: z.array(z.number().finite()).max(1_000).optional(),
            categoriesRef: z.string().max(512).optional(),
            categories: z.array(z.string().max(255)).max(1_000).optional(),
          })
          .strict()
          .refine(
            (entry) =>
              entry.name !== undefined ||
              entry.values !== undefined ||
              entry.categories !== undefined,
            { message: 'A series edit needs a name or data.' },
          ),
      )
      .max(24)
      .optional(),
  })
  .strict()
  .refine(
    (edit) =>
      edit.title !== undefined ||
      edit.chartType !== undefined ||
      (edit.seriesColors && Object.keys(edit.seriesColors).length > 0) ||
      (edit.pointColors && Object.keys(edit.pointColors).length > 0) ||
      edit.legend !== undefined ||
      edit.axisTitles !== undefined ||
      edit.dataLabels !== undefined ||
      edit.dataLabelPosition !== undefined ||
      edit.dataLabelFormat !== undefined ||
      edit.grouping !== undefined ||
      edit.gridlines !== undefined ||
      edit.valueAxis !== undefined ||
      edit.gapWidthPct !== undefined ||
      edit.holeSizePct !== undefined ||
      edit.explosionPct !== undefined ||
      (edit.pointExplosions && Object.keys(edit.pointExplosions).length > 0) ||
      (edit.seriesSet && edit.seriesSet.length > 0) ||
      (edit.series && edit.series.length > 0),
    { message: 'A chart edit needs at least one property.' },
  )


const drawingAnchorSchema = z
  .object({
    fromRow: z.number().int().nonnegative(),
    fromColumn: z.number().int().nonnegative(),
    fromRowOffset: z.number().int(),
    fromColumnOffset: z.number().int(),
    toRow: z.number().int().nonnegative(),
    toColumn: z.number().int().nonnegative(),
    toRowOffset: z.number().int(),
    toColumnOffset: z.number().int(),
    /// True when the file carried a real `<xdr:to>` marker: its offset
    /// clamps at the cell edge (Excel behavior for broken writers) instead
    /// of walking past it like synthesized oneCellAnchor/absoluteAnchor
    /// encodings.
    explicitTo: z.boolean().optional(),
  })
  .strict()

/// Edit to a visual that already lives in the file, located by the sidecar's
/// (drawingPath, anchor index) pair. `remove` deletes the anchor (charts
/// fail closed in the gateway); `anchor` rewrites its from/to markers.
export const workbookVisualEditSchema = z
  .object({
    drawingPath: z.string().regex(/^xl\/drawings\/[A-Za-z0-9._/-]+\.xml$/),
    drawingIndex: z.number().int().nonnegative().max(10_000),
    remove: z.literal(true).optional(),
    anchor: drawingAnchorSchema.optional(),
    /// New xfrm ext in EMU — sent with `anchor` when a rotated shape is
    /// resized (its anchor stores the rotated AABB, not the true frame).
    frameSize: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((edit) => edit.remove === true || edit.anchor !== undefined, {
    message: 'A visual edit needs a removal or a new anchor.',
  })

export type WorkbookStyleEdit = z.infer<typeof workbookStyleEditSchema>
export type WorkbookChartEdit = z.infer<typeof workbookChartEditSchema>
export type WorkbookVisualEdit = z.infer<typeof workbookVisualEditSchema>
export type WorkbookRichRun = z.infer<typeof richRunSchema>
