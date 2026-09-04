/**
 * 元素属性编辑器组件
 * 提供元素格式编辑功能
 */
import React, { useCallback, useMemo } from "react";
import { Tabs, Form, InputNumber, ColorPicker, Select, Slider, Divider, Empty, Space, Button } from "antd";
import type { Color } from "antd/es/color-picker";
import { DEFAULT_BODY_INSETS } from "../../../engine/pptx-engine/src/index";
import type { SlideElement, TextElement, Fill } from "../../../engine/pptx-engine/src/index";
import type { ElementType, PropertyPanelData } from "../types";

export interface ElementEditorProps {
  /** 当前选中的元素 */
  element: SlideElement | null;
  /** 元素类型 */
  elementType: ElementType | null;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 属性改变回调 */
  onPropertyChange?: (property: string, value: unknown) => void;
  /** 文本属性改变回调 */
  onTextChange?: (text: string) => void;
  /** 删除元素回调 */
  onDelete?: () => void;
  /** 复制元素回调 */
  onDuplicate?: () => void;
  /** 置顶回调 */
  onBringToFront?: () => void;
  /** 置底回调 */
  onSendToBack?: () => void;
}

/** 预定义颜色 */
const PRESET_COLORS = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#000080", "#808080",
];

/** 预定义线条样式 */
const LINE_STYLE_OPTIONS = [
  { label: "实线", value: "solid" },
  { label: "虚线", value: "dash" },
  { label: "点线", value: "dot" },
  { label: "Dash-Dot", value: "dashDot" },
];

/** 水平对齐方式 */
const HORIZONTAL_ALIGN_OPTIONS = [
  { label: "左对齐", value: "left" },
  { label: "居中", value: "center" },
  { label: "右对齐", value: "right" },
  { label: "两端对齐", value: "justify" },
];

/** 垂直对齐方式 */
const VERTICAL_ALIGN_OPTIONS = [
  { label: "顶部", value: "top" },
  { label: "居中", value: "middle" },
  { label: "底部", value: "bottom" },
];

/** 正文内边距字段（TextBody.insets，EMU） */
const BODY_INSET_FIELDS: Array<{ key: "l" | "t" | "r" | "b"; label: string }> = [
  { key: "l", label: "左" },
  { key: "t", label: "上" },
  { key: "r", label: "右" },
  { key: "b", label: "下" },
];

/** EMU 换算：1 厘米 = 360000 EMU，1 磅 = 12700 EMU */
const EMU_PER_CM = 360000;

/** 从 Fill 中取出可展示的单一颜色（solid 取色值，pattern 取前景色，gradient 取首个色标） */
function fillDisplayColor(fill: Fill | undefined): string | undefined {
  if (!fill) return undefined;
  switch (fill.type) {
    case "solid":
      return fill.color;
    case "pattern":
      return fill.fg;
    case "gradient":
      return fill.stops[0]?.color;
    default:
      return undefined;
  }
}

/** 引擎颜色（#RRGGBB / #RRGGBBAA）的不透明度百分比；无 alpha 通道或 none 视为不透明 */
function colorOpacityPercent(color: string | undefined): number {
  if (!color || color === "none" || color.length < 9) {
    return 100;
  }
  return Math.round((parseInt(color.slice(7, 9), 16) / 255) * 100);
}

/** 引擎虚线预设名（solid/sysDot/dash/lgDash…）映射到面板线条样式选项值 */
function dashOptionValue(dash: string | undefined): string {
  if (!dash || dash === "solid") return "solid";
  if (dash.includes("dashDot")) return "dashDot";
  if (dash.includes("dash")) return "dash";
  if (dash.includes("dot")) return "dot";
  return "solid";
}

/** 元素编辑器组件 */
export const ElementEditor = React.memo(function ElementEditor({
  element,
  elementType,
  disabled = false,
  readOnly = false,
  onPropertyChange,
  onTextChange,
  onDelete,
  onDuplicate,
  onBringToFront,
  onSendToBack,
}: ElementEditorProps) {
  const [form] = Form.useForm();

  const handleColorChange = useCallback(
    (property: string, color: Color) => {
      onPropertyChange?.(property, color.toHexString());
    },
    [onPropertyChange],
  );

  const handleNumberChange = useCallback(
    (property: string, value: number | null) => {
      onPropertyChange?.(property, value);
    },
    [onPropertyChange],
  );

  const handleSelectChange = useCallback(
    (property: string, value: unknown) => {
      onPropertyChange?.(property, value);
    },
    [onPropertyChange],
  );

  const handlePropertyChange = useCallback(
    (property: string, value: unknown) => {
      onPropertyChange?.(property, value);
    },
    [onPropertyChange],
  );

  const elementName = useMemo(() => {
    switch (elementType) {
      case "text":
        return "文本框";
      case "shape":
        return "形状";
      case "picture":
        return "图片";
      case "table":
        return "表格";
      case "chart":
        return "图表";
      case "group":
        return "组合";
      default:
        return "元素";
    }
  }, [elementType]);

  const tabItems = useMemo(() => {
    if (!element || !elementType) {
      return [];
    }

    const items = [
      {
        key: "position",
        label: "位置与大小",
        children: (
          <Form form={form} layout="vertical" size="small">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Form.Item label="X" style={{ marginBottom: 8 }}>
                <InputNumber
                  value={(element.transform?.offset.x ?? 0) / 914400}
                  onChange={(v) => handleNumberChange("x", v)}
                  min={0}
                  step={0.1}
                  disabled={readOnly}
                  addonAfter="英寸"
                />
              </Form.Item>
              <Form.Item label="Y" style={{ marginBottom: 8 }}>
                <InputNumber
                  value={(element.transform?.offset.y ?? 0) / 914400}
                  onChange={(v) => handleNumberChange("y", v)}
                  min={0}
                  step={0.1}
                  disabled={readOnly}
                  addonAfter="英寸"
                />
              </Form.Item>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Form.Item label="宽度" style={{ marginBottom: 8 }}>
                <InputNumber
                  value={(element.transform?.offset.cx ?? 0) / 914400}
                  onChange={(v) => handleNumberChange("width", v)}
                  min={0.1}
                  step={0.1}
                  disabled={readOnly}
                  addonAfter="英寸"
                />
              </Form.Item>
              <Form.Item label="高度" style={{ marginBottom: 8 }}>
                <InputNumber
                  value={(element.transform?.offset.cy ?? 0) / 914400}
                  onChange={(v) => handleNumberChange("height", v)}
                  min={0.1}
                  step={0.1}
                  disabled={readOnly}
                  addonAfter="英寸"
                />
              </Form.Item>
            </div>

            <Form.Item label="旋转角度" style={{ marginBottom: 8 }}>
              <Slider
                value={element.transform?.rot ? element.transform.rot / 60000 : 0}
                onChange={(v) => handleNumberChange("rotation", v)}
                min={0}
                max={360}
                disabled={readOnly}
                marks={{ 0: "0°", 90: "90°", 180: "180°", 270: "270°", 360: "360°" }}
              />
            </Form.Item>

            <Divider style={{ margin: "8px 0" }} />

            <Space direction="vertical" style={{ width: "100%" }}>
              <Button block onClick={onBringToFront} disabled={readOnly}>置顶</Button>
              <Button block onClick={onSendToBack} disabled={readOnly}>置底</Button>
            </Space>
          </Form>
        ),
      },
    ];

    if (element.type === "text" || element.type === "shape") {
      const textElement: TextElement = element;
      const firstParagraph = textElement.text?.paragraphs[0];
      const firstRun = firstParagraph?.runs[0];
      const bodyInsets = textElement.text?.insets ?? DEFAULT_BODY_INSETS;

      items.push({
        key: "fill",
        label: "填充",
        children: (
          <Form layout="vertical" size="small">
            <Form.Item label="填充颜色">
              <ColorPicker
                value={fillDisplayColor(textElement.fill) ?? "#ffffff"}
                onChange={(c) => handleColorChange("fill", c)}
                disabled={readOnly}
                showText
                presets={[
                  {
                    label: "预设颜色",
                    colors: PRESET_COLORS,
                  },
                ]}
              />
            </Form.Item>

            <Form.Item label="透明度">
              <Slider
                value={100 - colorOpacityPercent(fillDisplayColor(textElement.fill))}
                onChange={(v) => handleNumberChange("fillAlpha", 100 - v)}
                min={0}
                max={100}
                disabled={readOnly}
                tooltip={{ formatter: (v) => `${v}%` }}
              />
            </Form.Item>
          </Form>
        ),
      });

      items.push({
        key: "stroke",
        label: "边框",
        children: (
          <Form layout="vertical" size="small">
            <Form.Item label="边框颜色">
              <ColorPicker
                value={fillDisplayColor(textElement.stroke?.fill) ?? "#000000"}
                onChange={(c) => handleColorChange("strokeColor", c)}
                disabled={readOnly}
                showText
                presets={[
                  {
                    label: "预设颜色",
                    colors: PRESET_COLORS,
                  },
                ]}
              />
            </Form.Item>

            <Form.Item label="边框宽度">
              <Slider
                value={(textElement.stroke?.width ?? 12700) / 12700}
                onChange={(v) => handleNumberChange("strokeWidth", v * 12700)}
                min={0}
                max={10}
                disabled={readOnly}
                tooltip={{ formatter: (v) => `${v}pt` }}
              />
            </Form.Item>

            <Form.Item label="边框样式">
              <Select
                value={dashOptionValue(textElement.stroke?.dash)}
                onChange={(v) => handleSelectChange("strokeDash", v)}
                options={LINE_STYLE_OPTIONS}
                disabled={readOnly}
              />
            </Form.Item>
          </Form>
        ),
      });

      items.push({
        key: "text",
        label: "文本",
        children: (
          <Form layout="vertical" size="small">
            <Form.Item label="字体">
              <Select
                value={firstRun?.fontFamily ?? "Arial"}
                onChange={(v) => handleSelectChange("fontFamily", v)}
                options={[
                  { label: "Arial", value: "Arial" },
                  { label: "宋体", value: "SimSun" },
                  { label: "黑体", value: "SimHei" },
                  { label: "Times New Roman", value: "Times New Roman" },
                  { label: "Calibri", value: "Calibri" },
                ]}
                disabled={readOnly}
              />
            </Form.Item>

            <Form.Item label="字号">
              <InputNumber
                value={firstRun?.fontSize ?? 18}
                onChange={(v) => handleNumberChange("fontSize", v)}
                min={1}
                max={400}
                disabled={readOnly}
                addonAfter="pt"
              />
            </Form.Item>

            <Form.Item label="文本颜色">
              <ColorPicker
                value={firstRun?.color ?? "#000000"}
                onChange={(c) => handleColorChange("textColor", c)}
                disabled={readOnly}
                showText
                presets={[
                  {
                    label: "预设颜色",
                    colors: PRESET_COLORS,
                  },
                ]}
              />
            </Form.Item>

            <Form.Item label="粗细">
              <Select
                value={firstRun?.bold ? "bold" : "normal"}
                onChange={(v) => handleSelectChange("bold", v === "bold")}
                options={[
                  { label: "常规", value: "normal" },
                  { label: "粗体", value: "bold" },
                ]}
                disabled={readOnly}
              />
            </Form.Item>

            <Form.Item label="行距">
              <InputNumber
                value={firstParagraph?.lineHeight ?? 100}
                onChange={(v) => handleNumberChange("lineHeight", v)}
                min={10}
                max={1000}
                disabled={readOnly}
                addonAfter="%"
              />
            </Form.Item>

            <Form.Item label="水平对齐">
              <Select
                value={firstParagraph?.align ?? "left"}
                onChange={(v) => handleSelectChange("textAlign", v)}
                options={HORIZONTAL_ALIGN_OPTIONS}
                disabled={readOnly}
              />
            </Form.Item>

            <Form.Item label="垂直对齐">
              <Select
                value={textElement.text?.anchor ?? "top"}
                onChange={(v) => handleSelectChange("verticalAlign", v)}
                options={VERTICAL_ALIGN_OPTIONS}
                disabled={readOnly}
              />
            </Form.Item>

            <Divider style={{ margin: "8px 0" }} />

            <Form.Item label="内边距（厘米）">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {BODY_INSET_FIELDS.map((field) => (
                  <InputNumber
                    key={field.key}
                    value={bodyInsets[field.key] / EMU_PER_CM}
                    onChange={(v) => {
                      if (v == null) return;
                      handlePropertyChange("bodyInsets", {
                        ...bodyInsets,
                        [field.key]: Math.round(v * EMU_PER_CM),
                      });
                    }}
                    min={0}
                    step={0.1}
                    disabled={readOnly}
                    addonBefore={field.label}
                  />
                ))}
              </div>
            </Form.Item>
          </Form>
        ),
      });
    }

    return items;
  }, [element, elementType, form, handleColorChange, handleNumberChange, handleSelectChange, handlePropertyChange, onBringToFront, onSendToBack, readOnly]);

  if (!element || !elementType) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 24,
        }}
      >
        <Empty
          description="未选择元素"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div style={{ fontWeight: 500, marginBottom: 4 }}>{elementName}</div>
        <div style={{ fontSize: 12, color: "#999" }}>
          ID: {element.id}
        </div>
      </div>

      <Tabs
        items={tabItems}
        size="small"
        style={{ flex: 1, overflow: "auto" }}
      />

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid #f0f0f0",
          display: "flex",
          gap: 8,
        }}
      >
        <Button block onClick={onDuplicate} disabled={readOnly}>复制</Button>
        <Button block danger onClick={onDelete} disabled={readOnly}>删除</Button>
      </div>
    </div>
  );
});
