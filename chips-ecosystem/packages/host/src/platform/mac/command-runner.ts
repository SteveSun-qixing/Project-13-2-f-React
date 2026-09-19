import { execFile } from 'node:child_process';

/** 命令执行结果。 */
export interface CommandResult {
  /** 标准输出。 */
  readonly stdout: string;
  /** 标准错误。 */
  readonly stderr: string;
  /** 退出码。 */
  readonly exitCode: number;
}

/**
 * 命令执行器；平台端口通过它调用系统命令（如 macOS `pmset`）。
 *
 * @remarks
 * 测试注入替身即可验证命令参数与输出解析，不依赖真实系统命令。
 */
export interface CommandRunner {
  /** 执行命令并收集输出。 */
  run(command: string, args: readonly string[]): Promise<CommandResult>;
}

/**
 * 创建基于 `child_process.execFile` 的命令执行器。
 *
 * @param timeoutMs 超时（默认 5s）；超时以拒绝结束。
 * @returns 真实命令执行器。
 */
export function createChildProcessCommandRunner(timeoutMs = 5_000): CommandRunner {
  return {
    run(command: string, args: readonly string[]): Promise<CommandResult> {
      return new Promise<CommandResult>((resolvePromise, rejectPromise) => {
        execFile(command, [...args], { timeout: timeoutMs, encoding: 'utf8' }, (error, stdout, stderr) => {
          if (error !== null) {
            // execFile 的失败参数在运行时始终是 Error 实例（测试以 rejects.toThrow 断言）。
            const failure: Error = error;
            rejectPromise(failure);
            return;
          }
          resolvePromise({ stdout, stderr, exitCode: 0 });
        });
      });
    },
  };
}
