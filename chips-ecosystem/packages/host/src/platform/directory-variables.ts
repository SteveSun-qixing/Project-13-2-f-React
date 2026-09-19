import { isAbsolute } from 'node:path';
import { DIRECTORY_VARIABLE_NAMES, type DirectoryVariableName } from './contracts/system.js';

/**
 * 目录变量展开。
 *
 * 权威：`08-权限系统设计` §7.3（目录变量清单与匹配步骤）、`17-跨端Shell与平台抽象设计` §3.4。
 *
 * @remarks
 * - 目录变量由壳解析为具体路径；插件、核心权限判定与资源层一律使用变量形式。
 * - 展开发生在能力层调用存储端口之前；存储端口只接收绝对路径。
 */

/** 目录变量名正则；仅接受 `DIRECTORY_VARIABLE_NAMES` 中的名字。 */
const DIRECTORY_VARIABLE_PATTERN = /\$\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** 目录变量解析失败错误（壳内部错误，不跨越 Bridge）。 */
export class DirectoryVariableError extends Error {
  /** 固定错误码（壳内部）。 */
  readonly code = 'PAL_DIRECTORY_VARIABLE_INVALID';
  /** 结构化诊断。 */
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'DirectoryVariableError';
    this.details = details;
  }
}

/** 目录变量解析器。 */
export interface DirectoryVariableResolver {
  /** 目录变量解析结果（键为目录变量名）。 */
  readonly paths: Readonly<Record<DirectoryVariableName, string>>;
  /**
   * 展开输入中的目录变量并校验结果为绝对路径。
   *
   * @param input 目录变量形式（如 `${userDocuments}/chips/notes.md`）或绝对路径。
   * @returns 展开后的绝对路径（不做 `..` 折叠与符号链接解析，由核心 PathGuard 完成）。
   * @throws {DirectoryVariableError} 未知变量、空变量或结果不是绝对路径时抛出。
   */
  expand(input: string): string;
}

/**
 * 创建目录变量解析器。
 *
 * @param paths 目录变量到绝对路径的映射；必须覆盖全部 {@link DIRECTORY_VARIABLE_NAMES}。
 * @throws {DirectoryVariableError} 缺少任一目录变量或映射值不是绝对路径时抛出。
 */
export function createDirectoryVariableResolver(paths: Readonly<Record<string, string>>): DirectoryVariableResolver {
  const resolved = {} as Record<DirectoryVariableName, string>;
  for (const name of DIRECTORY_VARIABLE_NAMES) {
    const value = paths[name];
    if (typeof value !== 'string' || value.length === 0) {
      throw new DirectoryVariableError(`目录变量缺失：${name}`, { variable: name });
    }
    if (!isAbsolute(value)) {
      throw new DirectoryVariableError(`目录变量不是绝对路径：${name}`, { variable: name });
    }
    resolved[name] = value;
  }

  return {
    paths: resolved,
    expand(input: string): string {
      if (typeof input !== 'string' || input.length === 0) {
        throw new DirectoryVariableError('路径不能为空');
      }
      const expanded = input.replace(DIRECTORY_VARIABLE_PATTERN, (_match, rawName: string) => {
        if (!(rawName in resolved)) {
          throw new DirectoryVariableError(`未知目录变量：${rawName}`, { variable: rawName });
        }
        return resolved[rawName as DirectoryVariableName];
      });
      if (expanded.includes('${')) {
        throw new DirectoryVariableError('路径包含非法目录变量');
      }
      if (!isAbsolute(expanded)) {
        throw new DirectoryVariableError('展开结果不是绝对路径');
      }
      return expanded;
    },
  };
}
