import type { PDFDocumentProxy } from "pdfjs-dist";

export type FormWidgetKind = "text" | "checkbox" | "radio" | "choice";

export interface FormWidget {
  id: string;
  fieldName: string;
  kind: FormWidgetKind;
  pageIndex: number;
  rect: [number, number, number, number];
  value: string;
  checked: boolean;
  multiLine: boolean;
  readOnly: boolean;
  required: boolean;
  maxLen: number | null;
  password: boolean;
  comb: boolean;
  textAlignment: "left" | "center" | "right";
  /** radio：此按钮的导出值 */
  buttonValue: string;
  /** choice：选项列表 */
  options: { exportValue: string; displayValue: string }[];
}

export interface FormField {
  name: string;
  kind: FormWidgetKind;
  pageIndex: number;
  value: string;
  checked: boolean;
  required: boolean;
  readOnly: boolean;
  options: string[];
}

export interface FormCatalog {
  widgets: FormWidget[];
  fields: Map<string, FormField>;
  byPage: Map<number, FormWidget[]>;
}

/** 用户当前可见页序中的可编辑控件 */
export function visibleFormWidgets(
  catalog: FormCatalog | null,
  visiblePages: readonly number[],
): FormWidget[] {
  const pageOrder = new Map(visiblePages.map((pageIndex, index) => [pageIndex, index]));
  const widgets = catalog?.widgets ?? [];
  const widgetOrder = new Map(widgets.map((widget, index) => [widget.id, index]));
  return widgets
    .filter((widget) => !widget.readOnly && pageOrder.has(widget.pageIndex))
    .sort(
      (a, b) =>
        (pageOrder.get(a.pageIndex) ?? 0) - (pageOrder.get(b.pageIndex) ?? 0) ||
        (widgetOrder.get(a.id) ?? 0) - (widgetOrder.get(b.id) ?? 0),
    );
}

export interface RawFormAnnotation {
  id?: string;
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  fieldValue?: unknown;
  buttonValue?: string;
  rect?: number[];
  readOnly?: boolean;
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  multiLine?: boolean;
  required?: boolean;
  maxLen?: number;
  password?: boolean;
  comb?: boolean;
  textAlignment?: number;
  options?: { exportValue?: unknown; displayValue?: unknown }[];
}

function fieldValueStr(value: unknown): string {
  const scalar = Array.isArray(value) ? value[0] : value;
  return typeof scalar === "string" ? scalar : "";
}

const textAlignmentOf = (value: number | undefined): FormWidget["textAlignment"] =>
  value === 1 ? "center" : value === 2 ? "right" : "left";

/** 将一页 pdf.js Widget 批注数据转换为渲染层模型 */
export function widgetsFromAnnotations(annots: RawFormAnnotation[], pageIndex = 0): FormWidget[] {
  const out: FormWidget[] = [];
  for (const [annotationIndex, annotation] of annots.entries()) {
    if (
      annotation.subtype !== "Widget" ||
      !annotation.fieldName ||
      !Array.isArray(annotation.rect) ||
      annotation.rect.length !== 4 ||
      annotation.pushButton
    ) {
      continue;
    }
    const base = {
      id: annotation.id ?? `${pageIndex}:${annotationIndex}:${annotation.fieldName}`,
      fieldName: annotation.fieldName,
      pageIndex,
      rect: annotation.rect as FormWidget["rect"],
      checked: false,
      multiLine: false,
      readOnly: Boolean(annotation.readOnly),
      required: Boolean(annotation.required),
      maxLen:
        typeof annotation.maxLen === "number" &&
        Number.isFinite(annotation.maxLen) &&
        annotation.maxLen > 0
          ? Math.floor(annotation.maxLen)
          : null,
      password: Boolean(annotation.password),
      comb: Boolean(annotation.comb),
      textAlignment: textAlignmentOf(annotation.textAlignment),
      buttonValue: "",
      options: [] as FormWidget["options"],
    };
    if (annotation.fieldType === "Tx") {
      out.push({
        ...base,
        kind: "text",
        value: fieldValueStr(annotation.fieldValue),
        multiLine: Boolean(annotation.multiLine),
      });
    } else if (annotation.fieldType === "Btn" && annotation.checkBox) {
      out.push({
        ...base,
        kind: "checkbox",
        value: "",
        checked:
          typeof annotation.fieldValue === "string" &&
          annotation.fieldValue !== "Off" &&
          annotation.fieldValue !== "",
      });
    } else if (annotation.fieldType === "Btn" && annotation.radioButton) {
      out.push({
        ...base,
        kind: "radio",
        value: fieldValueStr(annotation.fieldValue),
        buttonValue: typeof annotation.buttonValue === "string" ? annotation.buttonValue : "",
      });
    } else if (annotation.fieldType === "Ch") {
      out.push({
        ...base,
        kind: "choice",
        value: fieldValueStr(annotation.fieldValue),
        options: (annotation.options ?? [])
          .filter(
            (option) =>
              typeof option?.exportValue === "string" || typeof option?.displayValue === "string",
          )
          .map((option) => ({
            exportValue: String(option.exportValue ?? option.displayValue),
            displayValue: String(option.displayValue ?? option.exportValue),
          })),
      });
    }
  }

  // pdf.js 批注顺序不可靠：按 PDF 坐标自上而下、再自左向右归一化 Tab 次序
  return out
    .map((widget, index) => ({ widget, index }))
    .sort(
      (a, b) =>
        b.widget.rect[3] - a.widget.rect[3] ||
        a.widget.rect[0] - b.widget.rect[0] ||
        a.index - b.index,
    )
    .map(({ widget }) => widget);
}

/** 一次性构建全文表单目录，供表单层与保存链路共享字段语义 */
export async function buildFormCatalog(doc: PDFDocumentProxy): Promise<FormCatalog> {
  const widgets: FormWidget[] = [];
  const fields = new Map<string, FormField>();
  const byPage = new Map<number, FormWidget[]>();

  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    const annotations = (await page.getAnnotations()) as RawFormAnnotation[];
    const pageWidgets = widgetsFromAnnotations(annotations, pageIndex);
    byPage.set(pageIndex, pageWidgets);
    widgets.push(...pageWidgets);

    for (const widget of pageWidgets) {
      const existing = fields.get(widget.fieldName);
      if (existing) {
        existing.required = existing.required || widget.required;
        existing.readOnly = existing.readOnly && widget.readOnly;
        if (widget.kind === "radio" && widget.buttonValue && !existing.options.includes(widget.buttonValue)) {
          existing.options.push(widget.buttonValue);
        }
        continue;
      }
      fields.set(widget.fieldName, {
        name: widget.fieldName,
        kind: widget.kind,
        pageIndex,
        value: widget.value,
        checked: widget.checked,
        required: widget.required,
        readOnly: widget.readOnly,
        options:
          widget.kind === "radio"
            ? widget.buttonValue
              ? [widget.buttonValue]
              : []
            : widget.options.map((option) => option.exportValue),
      });
    }
  }

  return { widgets, fields, byPage };
}

/** 提交给保存链路的表单值 */
export interface FormValueInput {
  name: string;
  kind: "text" | "checkbox" | "radio" | "choice";
  /** radio：选中的导出值；choice：选中的选项；空串表示清除选择 */
  value?: string;
  checked?: boolean;
}
