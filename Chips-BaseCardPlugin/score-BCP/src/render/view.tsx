import React from "react";
import { Progress, Rate } from "antd";
import { HeartFilled } from "@ant-design/icons";
import { getScoreRatio, isSymbolScoreStyle, type BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";

export const VIEW_STYLE_TEXT = `
.chips-score-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-score-card,
.chips-score-card * {
  box-sizing: border-box;
}

.chips-score-card__surface {
  width: 100%;
  min-width: 0;
}

.chips-score-card__surface--symbols {
  display: flex;
  justify-content: center;
}

.chips-score-card__sr-only {
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

.chips-score-card__rating {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
}

.chips-score-card__rating .ant-rate {
  font-size: 38px;
}

.chips-score-card__rating--hearts .ant-rate {
  color: #ff3b30;
}

.chips-score-card__numeric {
  display: inline-flex;
  align-items: baseline;
  min-width: 0;
  color: #1d1d1f;
}

.chips-score-card__numeric-score {
  font-size: 42px;
  font-weight: 750;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__numeric-separator {
  margin: 0 8px;
  color: rgba(0, 0, 0, 0.36);
  font-size: 24px;
  font-weight: 600;
}

.chips-score-card__numeric-total {
  color: #6e6e73;
  font-size: 22px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__progress {
  display: grid;
  gap: 10px;
  width: 100%;
}

.chips-score-card__progress-control {
  display: grid;
  gap: 6px;
  width: 100%;
}

.chips-score-card__progress-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.3;
}

.chips-score-card__progress-score {
  color: #1d1d1f;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.chips-score-card__progress-percent {
  color: #6e6e73;
  font-variant-numeric: tabular-nums;
}
`;

export interface BasecardViewProps {
  config: BasecardConfig;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getRatingShape(config: BasecardConfig): "heart" | "star" {
  return config.style === "hearts" ? "heart" : "star";
}

function renderSymbols(
  config: BasecardConfig,
  ariaLabel: string,
  labelId: string,
): React.ReactElement {
  const symbolKind = getRatingShape(config);
  const isHearts = symbolKind === "heart";

  return (
    <>
      <span className="chips-score-card__sr-only" id={labelId}>
        {ariaLabel}
      </span>
      <Rate
        aria-labelledby={labelId}
        className={[
          "chips-score-card__rating",
          isHearts ? "chips-score-card__rating--hearts" : "",
        ].filter(Boolean).join(" ")}
        count={config.total_score}
        character={isHearts ? <HeartFilled /> : undefined}
        disabled
        value={config.score}
      />
    </>
  );
}

export function BasecardView({ config }: BasecardViewProps) {
  const scoreText = formatNumber(config.score);
  const totalText = formatNumber(config.total_score);
  const ratio = getScoreRatio(config);
  const percentText = formatNumber(ratio * 100);
  const ariaLabel = formatMessage("score.accessible.value", {
    score: scoreText,
    total: totalText,
  });
  const progressLabelId = React.useId();
  const ratingLabelId = React.useId();

  return (
    <div className="chips-score-card" data-card-type={config.card_type} data-score-style={config.style}>
      <div
        className={[
          "chips-score-card__surface",
          isSymbolScoreStyle(config.style) ? "chips-score-card__surface--symbols" : "",
        ].filter(Boolean).join(" ")}
      >
        {isSymbolScoreStyle(config.style) ? renderSymbols(config, ariaLabel, ratingLabelId) : null}

        {config.style === "score" ? (
          <div className="chips-score-card__numeric" role="img" aria-label={ariaLabel}>
            <span aria-hidden="true" className="chips-score-card__numeric-score">
              {scoreText}
            </span>
            <span aria-hidden="true" className="chips-score-card__numeric-separator">
              /
            </span>
            <span aria-hidden="true" className="chips-score-card__numeric-total">
              {totalText}
            </span>
          </div>
        ) : null}

        {config.style === "progress" ? (
          <div className="chips-score-card__progress">
            <span className="chips-score-card__sr-only" id={progressLabelId}>
              {ariaLabel}
            </span>
            <Progress
              aria-labelledby={progressLabelId}
              aria-valuetext={formatMessage("score.progress.percent", { percent: percentText })}
              className="chips-score-card__progress-control"
              percent={ratio * 100}
              showInfo={false}
              size={["100%", 14]}
            />
            <div className="chips-score-card__progress-meta" aria-hidden="true">
              <span className="chips-score-card__progress-score">
                {scoreText} / {totalText}
              </span>
              <span className="chips-score-card__progress-percent">
                {formatMessage("score.progress.percent", { percent: percentText })}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
