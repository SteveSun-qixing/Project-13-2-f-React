/**
 * 任务进度展示（[CLI 完整参考] §3.10.4）：
 * - TTY：去重后的 `progress` 原地刷新行写 stderr（含 `percent` 显示百分比、含 `stage` 显示阶段名）；
 * - 非交互：默认静默，`CHIPS_CLI_JOB_PROGRESS=1` 时按行写 stderr。
 */

import type { IOutputSink } from './io.js';

/** 进度上报对象；`percent` 与 `stage` 参与展示，其余字段忽略。 */
export interface IProgressReport {
  readonly percent?: unknown;
  readonly stage?: unknown;
  readonly [key: string]: unknown;
}

/** 进度写出器。 */
export interface IProgressWriter {
  update(progress: IProgressReport): void;
  clear(): void;
}

/** 生成展示文本；无可展示字段时返回 null。 */
export function formatProgress(progress: IProgressReport): string | null {
  const stage =
    typeof progress.stage === 'string' && progress.stage.length > 0 ? progress.stage : null;
  const percent =
    typeof progress.percent === 'number' && Number.isFinite(progress.percent)
      ? ` ${Math.max(0, Math.min(100, Math.round(progress.percent)))}%`
      : '';
  if (stage === null && percent === '') {
    return null;
  }
  return `进度${percent}${stage === null ? '' : ` ${stage}`}`;
}

/** 构造进度写出器。 */
export function createProgressWriter(options: {
  readonly sink: IOutputSink;
  readonly env: Readonly<Record<string, string | undefined>>;
}): IProgressWriter {
  const lineMode = options.sink.isTTY || options.env.CHIPS_CLI_JOB_PROGRESS === '1';
  let last: string | null = null;
  let active = false;
  return {
    update(progress: IProgressReport): void {
      if (!lineMode) {
        return;
      }
      const text = formatProgress(progress);
      if (text === null || text === last) {
        return;
      }
      last = text;
      if (options.sink.isTTY) {
        options.sink.writeErr(`\r${text}\u001b[K`);
        active = true;
        return;
      }
      options.sink.writeErr(`${text}\n`);
    },
    clear(): void {
      if (active && options.sink.isTTY) {
        options.sink.writeErr('\r\u001b[K');
      }
      active = false;
      last = null;
    },
  };
}
