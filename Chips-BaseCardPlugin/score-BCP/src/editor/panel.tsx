import React, { useEffect, useMemo, useRef, useState } from "react";
import { ConfigProvider, InputNumber, Progress, Rate, Segmented, theme } from "antd";
import { HeartFilled } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardArchiveImportRequest,
  BasecardArchiveImportResult,
  BasecardResourceImportRequest,
  BasecardResourceImportResult,
  BasecardTiffToPngRequest,
  BasecardTiffToPngResult,
} from "../index";
import {
  MAX_TOTAL_SCORE,
  SYMBOL_SCORE_TOTAL,
  getScoreRatio,
  isSymbolScoreStyle,
  normalizeBasecardConfig,
  scoreStyles,
  validateBasecardConfig,
  type BasecardConfig,
  type ScoreStyle,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (
    input: BasecardArchiveImportRequest,
  ) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (input: BasecardTiffToPngRequest) => Promise<BasecardTiffToPngResult>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.chips-basecard-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.6 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-basecard-editor,
.chips-basecard-editor * {
  box-sizing: border-box;
}

.chips-score-editor__group {
  display: grid;
  gap: 10px;
}

.chips-score-editor__label {
  color: #1d1d1f;
  font-weight: 650;
}

.chips-score-editor__segmented {
  width: 100%;
}

.chips-score-editor__rating {
  display: flex;
  align-items: center;
  min-width: 0;
  width: 100%;
}

.chips-score-editor__rating .ant-rate {
  display: inline-flex;
  justify-content: center;
  max-width: 100%;
  font-size: 32px;
}

.chips-score-editor__number-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.chips-score-editor__number-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-score-editor__number-input {
  width: 100%;
  min-height: 44px;
}

.chips-score-editor__preview {
  display: grid;
  gap: 8px;
}

.chips-score-editor__preview-value {
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: center;
  max-width: 100%;
  min-width: 0;
  color: #1d1d1f;
}

.chips-score-editor__preview-numeric-score {
  font-size: 42px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric-separator {
  margin: 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.chips-score-editor__preview-numeric-total {
  color: #6e6e73;
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-score {
  font-size: 30px;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-separator {
  margin: 0 6px;
  font-size: 17px;
}

.chips-score-editor__preview-numeric--compact .chips-score-editor__preview-numeric-total {
  font-size: 15px;
}

.chips-score-editor__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  padding: 0;
}

.chips-basecard-editor__errors {
  min-height: 0;
  font-size: 13px;
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}
`;

const styleTranslationKeys: Record<ScoreStyle, string> = {
  stars: "score.style.stars",
  hearts: "score.style.hearts",
  score: "score.style.score",
  progress: "score.style.progress",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getRatingShape(config: BasecardConfig): "heart" | "star" {
  return config.style === "hearts" ? "heart" : "star";
}

function BasecardEditor(props: BasecardEditorProps) {
  const { token } = theme.useToken();
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const configRef = useRef(config);
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors
  );
  const ratio = useMemo(() => getScoreRatio(config), [config]);
  const formattedScore = formatNumber(config.score);
  const formattedTotal = formatNumber(config.total_score);
  const progressPercent = formatNumber(ratio * 100);
  const numericCompact = formattedScore.length + formattedTotal.length >= 9;
  const styleLabelId = React.useId();
  const valueLabelId = React.useId();
  const previewLabelId = React.useId();
  const totalScoreInputId = React.useId();
  const scoreValueInputId = React.useId();

  useEffect(() => {
    const next = normalizeBasecardConfig(props.initialConfig);
    configRef.current = next;
    setConfig(next);
    setErrors(validateBasecardConfig(next).errors);
  }, [props.initialConfig]);

  function updateConfig(patch: Partial<BasecardConfig>) {
    const next = normalizeBasecardConfig({
      ...configRef.current,
      ...patch,
    });
    const validation = validateBasecardConfig(next);
    configRef.current = next;
    setConfig(next);
    setErrors(validation.errors);
    if (validation.valid) {
      props.onChange(next);
    }
  }

  const styleOptions = scoreStyles.map((style) => ({
    value: style,
    label: formatMessage(styleTranslationKeys[style]),
  }));

  const scoreValueText = formatMessage("score.accessible.value", {
    score: formattedScore,
    total: formattedTotal,
  });
  const isHearts = getRatingShape(config) === "heart";

  function handleRatingKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Home") {
      event.preventDefault();
      updateConfig({ score: 1, total_score: SYMBOL_SCORE_TOTAL });
    } else if (event.key === "End") {
      event.preventDefault();
      updateConfig({ score: SYMBOL_SCORE_TOTAL, total_score: SYMBOL_SCORE_TOTAL });
    }
  }

  return (
    <div className="chips-basecard-editor chips-basecard-editor--standard">
      <section className="chips-score-editor__group" aria-labelledby={styleLabelId}>
        <div className="chips-score-editor__label" id={styleLabelId}>
          {formatMessage("score.style")}
        </div>
        <Segmented
          aria-labelledby={styleLabelId}
          className="chips-score-editor__segmented"
          options={styleOptions}
          value={config.style}
          onChange={(value) => {
            const style = value as ScoreStyle;
            updateConfig({
              style,
              total_score: isSymbolScoreStyle(style) ? SYMBOL_SCORE_TOTAL : config.total_score,
            });
          }}
        />
      </section>

      <section className="chips-score-editor__group" aria-labelledby={valueLabelId}>
        <div className="chips-score-editor__label" id={valueLabelId}>
          {formatMessage("score.earnedScore")}
        </div>

        {isSymbolScoreStyle(config.style) ? (
          <div className="chips-score-editor__rating-wrap" onKeyDown={handleRatingKeyDown}>
            <Rate
              aria-labelledby={valueLabelId}
              className={[
                "chips-score-editor__rating",
                isHearts ? "chips-score-editor__rating--hearts" : "",
              ].filter(Boolean).join(" ")}
              count={SYMBOL_SCORE_TOTAL}
              character={isHearts ? <HeartFilled /> : undefined}
              style={isHearts ? { color: token.colorError } : undefined}
              value={config.score}
              onChange={(score) => {
                updateConfig({ score, total_score: SYMBOL_SCORE_TOTAL });
              }}
            />
          </div>
        ) : (
          <div className="chips-score-editor__number-grid">
            <div className="chips-score-editor__number-field">
              <label className="chips-score-editor__label" htmlFor={totalScoreInputId}>
                {formatMessage("score.totalScore")}
              </label>
              <InputNumber
                className="chips-score-editor__number-input"
                id={totalScoreInputId}
                max={MAX_TOTAL_SCORE}
                min={1}
                step={0.1}
                value={config.total_score}
                onChange={(value) => {
                  updateConfig({ total_score: value ?? 1 });
                }}
              />
            </div>
            <div className="chips-score-editor__number-field">
              <label className="chips-score-editor__label" htmlFor={scoreValueInputId}>
                {formatMessage("score.scoreValue")}
              </label>
              <InputNumber
                className="chips-score-editor__number-input"
                id={scoreValueInputId}
                max={config.total_score}
                min={0}
                step={0.1}
                value={config.score}
                onChange={(value) => {
                  updateConfig({ score: value ?? 0 });
                }}
              />
            </div>
          </div>
        )}

        {config.style === "progress" ? (
          <div className="chips-score-editor__preview">
            <span className="chips-score-editor__sr-only" id={previewLabelId}>
              {formatMessage("score.progressPreview", {
                score: formattedScore,
                total: formattedTotal,
                percent: progressPercent,
              })}
            </span>
            <Progress
              aria-labelledby={previewLabelId}
              aria-valuetext={formatMessage("score.progress.percent", { percent: progressPercent })}
              percent={ratio * 100}
              showInfo={false}
              size={["100%", 12]}
            />
            <div aria-hidden="true" className="chips-score-editor__preview-value">
              {formattedScore} / {formattedTotal}
            </div>
          </div>
        ) : null}

        {config.style === "score" ? (
          <div className="chips-score-editor__preview">
            <div
              className={[
                "chips-score-editor__preview-numeric",
                numericCompact ? "chips-score-editor__preview-numeric--compact" : "",
              ].filter(Boolean).join(" ")}
              role="img"
              aria-label={scoreValueText}
            >
              <span aria-hidden="true" className="chips-score-editor__preview-numeric-score">
                {formattedScore}
              </span>
              <span
                aria-hidden="true"
                className="chips-score-editor__preview-numeric-separator"
                style={{ color: token.colorTextBase, opacity: 0.36 }}
              >
                /
              </span>
              <span aria-hidden="true" className="chips-score-editor__preview-numeric-total">
                {formattedTotal}
              </span>
            </div>
          </div>
        ) : null}

        <div
          className="chips-basecard-editor__errors"
          role="alert"
          aria-live="polite"
          style={{ color: token.colorError }}
        >
          {Object.keys(errors).length > 0 ? (
            <ul className="chips-basecard-editor__errors-list">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}>{formatMessage(message, { max: MAX_TOTAL_SCORE })}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const rootElement = document.createElement("div") as EditorRoot;
  rootElement.setAttribute("data-chips-basecard-editor-root", "true");
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.minHeight = "0";

  const reactRoot: Root = createRoot(rootElement);

  flushSync(() => {
    reactRoot.render(
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <style>{EDITOR_STYLE_TEXT}</style>
        <BasecardEditor {...props} />
      </ConfigProvider>,
    );
  });

  rootElement.__chipsDispose = () => {
    reactRoot.unmount();
  };

  return rootElement;
}
