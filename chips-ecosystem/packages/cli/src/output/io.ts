/**
 * 输出端口：stdout 只承载最终结果，stderr 承载进度、阶段与提示（[CLI 完整参考] §2.4）。
 */

/** 输出出口；`isTTY` 决定进度行的原地刷新形态。 */
export interface IOutputSink {
  readonly isTTY: boolean;
  writeOut(text: string): void;
  writeErr(text: string): void;
}

/** Node 进程输出出口。 */
export function createNodeOutputSink(): IOutputSink {
  const stdout = process.stdout;
  const stderr = process.stderr;
  return {
    get isTTY(): boolean {
      return stdout.isTTY === true && stderr.isTTY === true;
    },
    writeOut(text: string): void {
      stdout.write(text);
    },
    writeErr(text: string): void {
      stderr.write(text);
    },
  };
}
