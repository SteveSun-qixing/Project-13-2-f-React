import type { ReactElement } from 'react';
import React from 'react';
import { HeartFilled, Progress, Rate, theme } from '@chips/ui';
import {
  formatScoreNumber,
  getScoreRatio,
  isSymbolScoreStyle,
  readConfig,
} from './config';
import type { IScoreConfig } from './config';

/**
 * 查看态视图（08-基础卡片插件接口 §2.4.1）。
 *
 * 四种展示样式自旧族 score-BCP 语义迁移：星星/爱心为五分制只读 Rate（爱心用
 * HeartFilled 与主题错误色），分数为大数字分数对（超过 9 字符进入紧凑排布），
 * 进度条为 Progress 加分数元信息行。颜色、间距一律走主题 token，不落硬编码样式。
 */

/** 进度条本体高度与紧凑阈值（结构常量，非视觉令牌）。 */
const PROGRESS_BAR_HEIGHT = 14;

/** 分数对进入紧凑排布的字符阈值（自旧族迁移：分数文本 + 总分文本长度合计）。 */
const NUMERIC_COMPACT_THRESHOLD = 9;

interface INumericPairProps {
  config: IScoreConfig;
  ariaLabel: string;
}

function ScoreNumericPair({ config, ariaLabel }: INumericPairProps): ReactElement {
  const { token } = theme.useToken();
  const scoreText = formatScoreNumber(config.score);
  const totalText = formatScoreNumber(config.total_score);
  const compact = scoreText.length + totalText.length >= NUMERIC_COMPACT_THRESHOLD;
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={[
        'chips-score-card__numeric',
        compact ? 'chips-score-card__numeric--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: '100%',
        minWidth: 0,
        color: token.colorText,
      }}
    >
      <span
        aria-hidden="true"
        className="chips-score-card__numeric-score"
        style={{
          fontSize: compact ? 30 : 42,
          fontWeight: 700,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {scoreText}
      </span>
      <span
        aria-hidden="true"
        className="chips-score-card__numeric-separator"
        style={{
          margin: '0 8px',
          fontSize: compact ? 17 : 24,
          fontWeight: 600,
          color: token.colorText,
          opacity: 0.36,
        }}
      >
        /
      </span>
      <span
        aria-hidden="true"
        className="chips-score-card__numeric-total"
        style={{
          color: token.colorTextSecondary,
          fontSize: compact ? 15 : 22,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {totalText}
      </span>
    </div>
  );
}

interface ISymbolsProps {
  config: IScoreConfig;
  ariaLabel: string;
  labelId: string;
}

function ScoreSymbols({ config, ariaLabel, labelId }: ISymbolsProps): ReactElement {
  const { token } = theme.useToken();
  const isHearts = config.style === 'hearts';
  return (
    <>
      <span className="chips-score-card__sr-only" id={labelId}>
        {ariaLabel}
      </span>
      <Rate
        aria-labelledby={labelId}
        className={[
          'chips-score-card__rating',
          isHearts ? 'chips-score-card__rating--hearts' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        count={config.total_score}
        character={isHearts ? <HeartFilled /> : undefined}
        disabled
        {...(isHearts ? { style: { color: token.colorError } } : {})}
        value={config.score}
      />
    </>
  );
}

interface IProgressProps {
  config: IScoreConfig;
  ratio: number;
  ariaLabel: string;
  labelId: string;
}

function ScoreProgress({ config, ratio, ariaLabel, labelId }: IProgressProps): ReactElement {
  const { token } = theme.useToken();
  const scoreText = formatScoreNumber(config.score);
  const totalText = formatScoreNumber(config.total_score);
  const percentText = formatScoreNumber(ratio * 100);
  return (
    <div className="chips-score-card__progress" style={{ display: 'grid', gap: 10, width: '100%' }}>
      <span className="chips-score-card__sr-only" id={labelId}>
        {ariaLabel}
      </span>
      <Progress
        aria-labelledby={labelId}
        aria-valuetext={`${percentText}%`}
        className="chips-score-card__progress-control"
        // aria-valuenow 统一取 Math.round 整值，完整精度保留在 aria-valuetext
        aria-valuenow={Math.round(ratio * 100)}
        percent={ratio * 100}
        showInfo={false}
        size={['100%', PROGRESS_BAR_HEIGHT]}
      />
      <div
        className="chips-score-card__progress-meta"
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          color: token.colorTextSecondary,
          fontSize: token.fontSizeSM,
          lineHeight: 1.3,
        }}
      >
        <span
          className="chips-score-card__progress-score"
          style={{ color: token.colorText, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
        >
          {scoreText} / {totalText}
        </span>
        <span
          className="chips-score-card__progress-percent"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percentText}%
        </span>
      </div>
    </div>
  );
}

export interface IScoreViewProps {
  /** 节点内容 `config` 字段的原始值；缺失或非法时回退默认配置（08 §7.1 规则 2）。 */
  config: unknown;
}

/** 查看态 React 组件：由 `renderView` 挂载，四种评分样式只读呈现。 */
export function ScoreView({ config }: IScoreViewProps): ReactElement {
  const resolved = readConfig(config);
  const ratio = getScoreRatio(resolved);
  const ariaLabel = `${formatScoreNumber(resolved.score)} / ${formatScoreNumber(
    resolved.total_score
  )} 分`;
  const ratingLabelId = React.useId();
  const progressLabelId = React.useId();
  return (
    <div
      className="chips-score-card"
      data-card-type="base.score"
      data-score-style={resolved.style}
      style={{ width: '100%', minWidth: 0 }}
    >
      <div
        className={[
          'chips-score-card__surface',
          isSymbolScoreStyle(resolved.style) ? 'chips-score-card__surface--symbols' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{
          width: '100%',
          minWidth: 0,
          display: isSymbolScoreStyle(resolved.style) ? 'flex' : 'block',
          justifyContent: isSymbolScoreStyle(resolved.style) ? 'center' : undefined,
        }}
      >
        {isSymbolScoreStyle(resolved.style) ? (
          <ScoreSymbols config={resolved} ariaLabel={ariaLabel} labelId={ratingLabelId} />
        ) : null}
        {resolved.style === 'score' ? (
          <ScoreNumericPair config={resolved} ariaLabel={ariaLabel} />
        ) : null}
        {resolved.style === 'progress' ? (
          <ScoreProgress
            config={resolved}
            ratio={ratio}
            ariaLabel={ariaLabel}
            labelId={progressLabelId}
          />
        ) : null}
      </div>
    </div>
  );
}
