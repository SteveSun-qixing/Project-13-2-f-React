/**
 * TUI 终端端口（[CLI 完整参考] §3.1.2）。
 *
 * 界面为纯终端字符界面：进入时使用备用屏幕并隐藏光标，退出恢复；不使用彩色前景/背景
 * 与闪烁样式。Node 实现只做 ANSI 与 raw mode 包装，状态机与渲染保持为纯函数。
 */

/** 按键。 */
export interface ITuiKey {
  readonly name:
    | 'up'
    | 'down'
    | 'left'
    | 'right'
    | 'enter'
    | 'space'
    | 'backspace'
    | 'escape'
    | 'ctrl-c'
    | 'ctrl-backslash'
    | 'char'
    | 'unknown';
  readonly char?: string;
}

/** 终端端口。 */
export interface ITerminal {
  readonly isTTY: boolean;
  readonly columns: number;
  readonly rows: number;
  write(text: string): void;
  enter(): void;
  exit(): void;
  onKey(handler: (key: ITuiKey) => void): () => void;
  onResize(handler: () => void): () => void;
}

/** 解析输入块为按键序列（可一次输入多键）。 */
export function parseKeys(input: string): readonly ITuiKey[] {
  const keys: ITuiKey[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === undefined) {
      continue;
    }
    if (char === '\u001b') {
      const sequence = input.slice(index, index + 3);
      if (sequence === '\u001b[A') {
        keys.push({ name: 'up' });
        index += 2;
        continue;
      }
      if (sequence === '\u001b[B') {
        keys.push({ name: 'down' });
        index += 2;
        continue;
      }
      if (sequence === '\u001b[C') {
        keys.push({ name: 'right' });
        index += 2;
        continue;
      }
      if (sequence === '\u001b[D') {
        keys.push({ name: 'left' });
        index += 2;
        continue;
      }
      keys.push({ name: 'escape' });
      continue;
    }
    if (char === '\r' || char === '\n') {
      keys.push({ name: 'enter' });
      continue;
    }
    if (char === ' ') {
      keys.push({ name: 'space' });
      continue;
    }
    if (char === '\u007f' || char === '\b') {
      keys.push({ name: 'backspace' });
      continue;
    }
    if (char === '\u0003') {
      keys.push({ name: 'ctrl-c' });
      continue;
    }
    if (char === '\u001c') {
      keys.push({ name: 'ctrl-backslash' });
      continue;
    }
    keys.push({ name: 'char', char });
  }
  return keys;
}

/** Node 终端实现。 */
export function createNodeTerminal(): ITerminal {
  const input = process.stdin;
  const output = process.stdout;
  const keyHandlers = new Set<(key: ITuiKey) => void>();
  const resizeHandlers = new Set<() => void>();
  let dataListener: ((chunk: Buffer | string) => void) | undefined;
  let resizeListener: (() => void) | undefined;

  return {
    get isTTY(): boolean {
      return input.isTTY === true && output.isTTY === true;
    },
    get columns(): number {
      return output.columns ?? 80;
    },
    get rows(): number {
      return output.rows ?? 24;
    },
    write(text: string): void {
      output.write(text);
    },
    enter(): void {
      output.write('\u001b[?1049h\u001b[?25l');
      if (input.isTTY === true) {
        input.setRawMode(true);
        input.resume();
        input.setEncoding('utf8');
      }
      dataListener = (chunk: Buffer | string): void => {
        const keys = parseKeys(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        for (const key of keys) {
          for (const handler of keyHandlers) {
            handler(key);
          }
        }
      };
      input.on('data', dataListener);
      resizeListener = (): void => {
        for (const handler of resizeHandlers) {
          handler();
        }
      };
      output.on('resize', resizeListener);
    },
    exit(): void {
      if (dataListener !== undefined) {
        input.off('data', dataListener);
        dataListener = undefined;
      }
      if (resizeListener !== undefined) {
        output.off('resize', resizeListener);
        resizeListener = undefined;
      }
      if (input.isTTY === true) {
        input.setRawMode(false);
        input.pause();
      }
      output.write('\u001b[?25h\u001b[?1049l');
    },
    onKey(handler: (key: ITuiKey) => void): () => void {
      keyHandlers.add(handler);
      return () => keyHandlers.delete(handler);
    },
    onResize(handler: () => void): () => void {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
  };
}
