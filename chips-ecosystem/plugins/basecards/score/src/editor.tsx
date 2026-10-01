import type { KeyboardEvent, ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HeartFilled, InputNumber, Progress, Rate, Segmented, theme } from '@chips/ui';
import {
  collectConfigErrors,
  formatScoreNumber,
  getScoreRatio,
  isSymbolScoreStyle,
  MAX_TOTAL_SCORE,
  MIN_TOTAL_SCORE,
  readConfig,
  SCORE_STYLES,
  STYLE_LABELS,
  SYMBOL_SCORE_TOTAL,
} from './config';
import type { IScoreConfig, ScoreStyle } from './config';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：字段级错误以行内简体中文提示呈现，
 * 仅当整份配置合法时才由编辑器句柄向编辑链路发布 replace 变更。
 *
 * 数值输入语义自旧族 score-BCP 迁移：星星/爱心为五分制 Rate（Home/End 键盘语义），
 * 分数/进度条为「总分 + 获得分数」双 InputNumber（总分 1–100000、步进 0.1，
 * 分数 0–总分、步进 0.1）；样式切到符号样式时总分强制五分制、分数钳制取整。
 */

/** 编辑器发布变更前要求的最小完整性：整份配置合法（schema 同口径 + 符号样式业务约束）。 */
export function isEditorConfigComplete(config: IScoreConfig): boolean {
  return Object.keys(collectConfigErrors(config)).length === 0;
}

export interface IScoreEditorViewProps {
  config: IScoreConfig;
  onChange: (next: IScoreConfig) => void;
}

interface IFieldRowProps {
  label: string;
  hint?: string | undefined;
  htmlFor?: string | undefined;
  children: ReactElement;
}

function FieldRow({ label, hint, htmlFor, children }: IFieldRowProps): ReactElement {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gap: token.marginXXS,
        padding: `${token.paddingSM}px 0`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <label
        htmlFor={htmlFor}
        style={{ color: token.colorText, fontSize: token.fontSizeSM, fontWeight: 600 }}
      >
        {label}
      </label>
      {hint ? (
        <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>{hint}</span>
      ) : null}
      {children}
    </div>
  );
}

export function ScoreEditorView({ config, onChange }: IScoreEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IScoreConfig>(() => readConfig(config));
  const draftRef = useRef(draft);

  useEffect(() => {
    const next = readConfig(config);
    draftRef.current = next;
    setDraft(next);
  }, [config]);

  const commit = (patch: Partial<IScoreConfig>): void => {
    const next = readConfig({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const ratio = useMemo(() => getScoreRatio(draft), [draft]);
  const errors = useMemo(() => collectConfigErrors(draft), [draft]);
  const errorEntries = Object.entries(errors);
  const isHearts = draft.style === 'hearts';
  const symbolStyle = isSymbolScoreStyle(draft.style);
  const scoreText = formatScoreNumber(draft.score);
  const totalText = formatScoreNumber(draft.total_score);
  const percentText = formatScoreNumber(ratio * 100);
  const totalScoreInputId = 'chips-score-editor-total-score';
  const scoreValueInputId = 'chips-score-editor-score-value';

  const handleRatingKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Home') {
      event.preventDefault();
      commit({ score: 1, total_score: SYMBOL_SCORE_TOTAL });
    } else if (event.key === 'End') {
      event.preventDefault();
      commit({ score: SYMBOL_SCORE_TOTAL, total_score: SYMBOL_SCORE_TOTAL });
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      <FieldRow label="样式" hint="星星与爱心固定五分制，分数与进度条可自定义总分">
        <Segmented
          style={{ width: '100%' }}
          options={SCORE_STYLES.map((style: ScoreStyle) => ({
            value: style,
            label: STYLE_LABELS[style],
          }))}
          value={draft.style}
          onChange={(style) => {
            commit({
              style,
              total_score:
                isSymbolScoreStyle(style) ? SYMBOL_SCORE_TOTAL : draftRef.current.total_score,
            });
          }}
        />
      </FieldRow>

      <FieldRow label="获得分数">
        {symbolStyle ? (
          <div
            className="chips-score-editor__rating-wrap"
            onKeyDown={handleRatingKeyDown}
            style={{ display: 'flex', justifyContent: 'center', padding: `${token.paddingXXS}px 0` }}
          >
            <Rate
              className={[
                'chips-score-editor__rating',
                isHearts ? 'chips-score-editor__rating--hearts' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              count={SYMBOL_SCORE_TOTAL}
              character={isHearts ? <HeartFilled /> : undefined}
              {...(isHearts ? { style: { color: token.colorError } } : {})}
              value={draft.score}
              onChange={(score) => {
                commit({ score, total_score: SYMBOL_SCORE_TOTAL });
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: token.marginSM }}>
            <div style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
              <label
                htmlFor={totalScoreInputId}
                style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
              >
                总分
              </label>
              <InputNumber
                className="chips-score-editor__number-input"
                id={totalScoreInputId}
                max={MAX_TOTAL_SCORE}
                min={MIN_TOTAL_SCORE}
                step={0.1}
                style={{ width: '100%' }}
                value={draft.total_score}
                onChange={(value) => {
                  commit({ total_score: value ?? MIN_TOTAL_SCORE });
                }}
              />
            </div>
            <div style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
              <label
                htmlFor={scoreValueInputId}
                style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}
              >
                分数
              </label>
              <InputNumber
                className="chips-score-editor__number-input"
                id={scoreValueInputId}
                max={draft.total_score}
                min={0}
                step={0.1}
                style={{ width: '100%' }}
                value={draft.score}
                onChange={(value) => {
                  commit({ score: value ?? 0 });
                }}
              />
            </div>
          </div>
        )}
      </FieldRow>

      {draft.style === 'progress' ? (
        <FieldRow label="进度预览" hint={`${scoreText} / ${totalText}，${percentText}%`}>
          <Progress
            aria-valuetext={`${percentText}%`}
            aria-valuenow={Math.round(ratio * 100)}
            percent={ratio * 100}
            showInfo={false}
            size={['100%', 12]}
          />
        </FieldRow>
      ) : null}

      {draft.style === 'score' ? (
        <FieldRow label="分数预览">
          <div
            role="img"
            aria-label={`${scoreText} / ${totalText} 分`}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              width: '100%',
              color: token.colorText,
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {scoreText}
            </span>
            <span
              style={{
                margin: '0 8px',
                fontSize: 22,
                fontWeight: 600,
                color: token.colorText,
                opacity: 0.36,
              }}
            >
              /
            </span>
            <span
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: token.colorTextSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {totalText}
            </span>
          </div>
        </FieldRow>
      ) : null}

      <div role="alert" aria-live="polite" style={{ minHeight: 0, paddingTop: token.paddingSM }}>
        {errorEntries.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 18, color: token.colorError, fontSize: token.fontSizeSM }}>
            {errorEntries.map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
