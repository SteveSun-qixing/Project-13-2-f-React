import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { App as AntdApp, Button, ColorPicker, Input, Modal, Slider, Tabs } from "antd";
import type { Color } from "antd/es/color-picker";
import {
  DEFAULT_STAMP_CONFIG,
  type StampConfig,
} from "../pdf/use-document-viewer";
import { DEFAULT_HEADER_FOOTER, DEFAULT_WATERMARK, headerFooterUsed } from "../pdf/stamps";
import type { HeaderFooterConfig, WatermarkConfig } from "../pdf/stamps";
import { formatMessage } from "../lib/messages";

const ANGLE_MIN = -90;
const ANGLE_MAX = 90;
const OPACITY_MIN = 5;
const OPACITY_MAX = 100;
const SIZE_MIN = 4;
const SIZE_MAX = 22;
const PREVIEW_FONT_SCALE = 236;

/** 水印 / 页眉页脚配置对话框；确认后进入待保存印章配置，随保存写入文件 */
export function StampDialog({
  open,
  config,
  onCancel,
  onApply,
  onClear,
}: {
  open: boolean;
  config: StampConfig | null;
  onCancel: () => void;
  onApply: (config: StampConfig) => void;
  onClear: () => void;
}): ReactElement {
  const { message } = AntdApp.useApp();
  const base = config ?? DEFAULT_STAMP_CONFIG;
  const [wm, setWm] = useState<WatermarkConfig>(base.wm ?? DEFAULT_WATERMARK);
  const [hf, setHf] = useState<HeaderFooterConfig>(base.hf ?? DEFAULT_HEADER_FOOTER);

  useEffect(() => {
    if (!open) return;
    setWm(config?.wm ?? DEFAULT_WATERMARK);
    setHf(config?.hf ?? DEFAULT_HEADER_FOOTER);
  }, [config, open]);

  const hfUsed = headerFooterUsed(hf);
  const canApply = wm.text.trim().length > 0 || hfUsed;
  const hasExisting = config !== null;

  const field = (key: keyof HeaderFooterConfig, label: string): ReactElement => (
    <label className="pdf-stamp-field">
      <span className="pdf-stamp-field-label">{label}</span>
      <Input
        value={String(hf[key] ?? "")}
        onChange={(e) => setHf({ ...hf, [key]: e.target.value })}
      />
    </label>
  );

  const onWatermarkColor = (color: Color): void => {
    setWm({ ...wm, color: color.toHexString() });
  };

  const onFooterColor = (color: Color): void => {
    setHf({ ...hf, color: color.toHexString() });
  };

  return (
    <Modal
      className="pdf-stamp-dialog"
      title={formatMessage("pdf.dialog.stamp.title")}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
      width={520}
    >
      <Tabs
        defaultActiveKey="watermark"
        items={[
          {
            key: "watermark",
            label: formatMessage("pdf.dialog.stamp.tab.watermark"),
            children: (
              <div className="pdf-stamp-pane">
                <label className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.watermarkText")}</span>
                  <Input
                    value={wm.text}
                    placeholder={formatMessage("pdf.dialog.stamp.watermarkPlaceholder")}
                    onChange={(e) => setWm({ ...wm, text: e.target.value })}
                  />
                </label>
                <label className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.watermarkAngle")}</span>
                  <Slider
                    min={ANGLE_MIN}
                    max={ANGLE_MAX}
                    value={wm.angle}
                    onChange={(v) => setWm({ ...wm, angle: v })}
                  />
                  <em>{wm.angle}°</em>
                </label>
                <label className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.watermarkOpacity")}</span>
                  <Slider
                    min={OPACITY_MIN}
                    max={OPACITY_MAX}
                    value={Math.round(wm.opacity * 100)}
                    onChange={(v) => setWm({ ...wm, opacity: v / 100 })}
                  />
                  <em>{Math.round(wm.opacity * 100)}%</em>
                </label>
                <label className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.watermarkSize")}</span>
                  <Slider
                    min={SIZE_MIN}
                    max={SIZE_MAX}
                    value={Math.round(wm.sizeRatio * 100)}
                    onChange={(v) => setWm({ ...wm, sizeRatio: v / 100 })}
                  />
                  <em>{Math.round(wm.sizeRatio * 100)}%</em>
                </label>
                <div className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.color")}</span>
                  <ColorPicker value={wm.color} onChange={onWatermarkColor} showText />
                </div>
                <div className="pdf-stamp-preview">
                  <span data-angle={-wm.angle} data-size={Math.round(wm.sizeRatio * PREVIEW_FONT_SCALE)}>
                    {wm.text || formatMessage("pdf.dialog.stamp.watermarkPlaceholder")}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "hf",
            label: formatMessage("pdf.dialog.stamp.tab.headerFooter"),
            children: (
              <div className="pdf-stamp-pane">
                <div className="pdf-stamp-grid">
                  {field("headerLeft", formatMessage("pdf.dialog.stamp.headerLeft"))}
                  {field("headerCenter", formatMessage("pdf.dialog.stamp.headerCenter"))}
                  {field("headerRight", formatMessage("pdf.dialog.stamp.headerRight"))}
                  {field("footerLeft", formatMessage("pdf.dialog.stamp.footerLeft"))}
                  {field("footerCenter", formatMessage("pdf.dialog.stamp.footerCenter"))}
                  {field("footerRight", formatMessage("pdf.dialog.stamp.footerRight"))}
                </div>
                <label className="pdf-stamp-field">
                  <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.color")}</span>
                  <ColorPicker value={hf.color} onChange={onFooterColor} showText />
                </label>
                <label className="pdf-stamp-check">
                  <input
                    type="checkbox"
                    checked={hf.pageNumber}
                    onChange={(e) => setHf({ ...hf, pageNumber: e.target.checked })}
                  />
                  <span>{formatMessage("pdf.dialog.stamp.pageNumber")}</span>
                </label>
                {hf.pageNumber ? (
                  <label className="pdf-stamp-field">
                    <span className="pdf-stamp-field-label">{formatMessage("pdf.dialog.stamp.startAt")}</span>
                    <Input
                      type="number"
                      min={1}
                      value={hf.startAt}
                      onChange={(e) =>
                        setHf({ ...hf, startAt: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                ) : null}
                <div className="pdf-stamp-hint">{formatMessage("pdf.dialog.stamp.tokenHint")}</div>
              </div>
            ),
          },
        ]}
      />
      <div className="pdf-stamp-actions">
        {hasExisting ? (
          <Button
            danger
            onClick={() => {
              onClear();
              message.success(formatMessage("pdf.message.stampCleared"));
            }}
          >
            {formatMessage("pdf.dialog.stamp.clearWatermark")}
          </Button>
        ) : null}
        <div className="pdf-stamp-actions-spacer" />
        <Button onClick={onCancel}>{formatMessage("pdf.dialog.password.cancel")}</Button>
        <Button
          type="primary"
          disabled={!canApply}
          onClick={() =>
            onApply({
              wm: wm.text.trim() ? wm : null,
              hf: hfUsed ? hf : null,
            })
          }
        >
          {formatMessage("pdf.note.save")}
        </Button>
      </div>
    </Modal>
  );
}
