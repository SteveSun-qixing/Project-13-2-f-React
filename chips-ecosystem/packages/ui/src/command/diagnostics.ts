/**
 * 命令运行时的结构化诊断出口。
 *
 * 诊断不是平台错误码：只用于本窗口内的开发期观测（缺失处理器、处理器异常、Bridge 不可用等），
 * 不写入平台审计、不面向用户展示。
 */

import type { ICommandDiagnostic } from './contract';

/**
 * 输出结构化诊断（控制台告警）。
 *
 * @param diagnostic 诊断记录
 */
export function reportCommandDiagnostic(diagnostic: ICommandDiagnostic): void {
  console.warn(`[chips/ui] ${diagnostic.message}`, diagnostic);
}
