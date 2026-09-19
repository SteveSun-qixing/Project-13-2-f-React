/**
 * TUI 渲染（纯函数）：顶部命令框、动态交互区、底部提示栏三段
 * （[CLI 完整参考] §3.1.2）。只使用终端字符，不使用颜色与闪烁样式。
 */

import type { ITuiState } from './state.js';

const HINT_BAR =
  '↑/↓ 移动 · ←/→ 光标或调节 · Space 多选 · Enter 确认或执行 · Backspace 删除 · Ctrl+C 清空或取消 · Ctrl+\\ 退出';

/** 渲染一帧（不含清屏控制字符，由运行器负责定位）。 */
export function renderFrame(state: ITuiState, columns: number): string {
  const width = Math.max(40, columns);
  const lines: string[] = [];
  lines.push(`chips > ${state.buffer}`);
  lines.push('─'.repeat(width));
  lines.push(...renderPanel(state, width));
  lines.push('─'.repeat(width));
  lines.push(HINT_BAR);
  return lines.map((line) => line.slice(0, width)).join('\n');
}

function renderPanel(state: ITuiState, width: number): readonly string[] {
  switch (state.panel) {
    case 'compose': {
      const lines: string[] = ['命令输入：'];
      if (state.candidates.length === 0) {
        lines.push('  （无候选）');
        return lines;
      }
      state.candidates.forEach((candidate, index) => {
        const marker = index === state.candidateIndex ? '>' : ' ';
        lines.push(`  ${marker} ${candidate}`);
      });
      return lines;
    }
    case 'form': {
      const lines: string[] = [`参数：${state.commandPath ?? ''}`];
      if (state.fields.length === 0) {
        lines.push('  （无参数，按 Enter 执行）');
        return lines;
      }
      state.fields.forEach((field, index) => {
        const marker = index === state.fieldIndex ? '>' : ' ';
        const control = field.declaration.ui?.control ?? field.declaration.type;
        const required = field.declaration.required === true ? '必填' : '可选';
        lines.push(
          `  ${marker} ${field.declaration.name} [${control}/${required}]: ${field.value.length === 0 ? '（空）' : field.value}`,
        );
      });
      return lines;
    }
    case 'running':
      return [`执行中：${state.commandPath ?? ''}`];
    case 'result': {
      const result = state.result;
      if (result === undefined) {
        return ['（无结果）'];
      }
      const lines: string[] = [
        result.ok ? '成功' : '失败',
        `退出码: ${result.exitCode}`,
        `耗时: ${result.durationMs} ms`,
      ];
      if (result.errorCode !== undefined) {
        lines.push(`错误码: ${result.errorCode}`);
        lines.push(`错误信息: ${result.errorMessage ?? ''}`);
      }
      if (result.output.trim().length > 0) {
        lines.push('输出:');
        for (const line of result.output.trimEnd().split('\n').slice(0, 12)) {
          lines.push(`  ${line}`);
        }
      }
      lines.push('按 Enter 返回命令输入，按 R 重跑上一条');
      return lines.map((line) => line.slice(0, width));
    }
  }
}
