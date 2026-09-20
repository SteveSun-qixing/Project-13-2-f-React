/**
 * `ChipsBridge.cliCommand` 只读扩展命名空间（02-SDK-API规范 §3.5；07-CLI完整参考 §5.6、§5.8）。
 *
 * 职责边界：只做类型化封装与转发，不新增传输通道、不缓存索引、不复算冲突、不判定参数合法性
 * （§11 约束 12）。三个方法的输入输出形状权威在 §5.6，路由名权威在 §5.8；查询参数非法
 * （`CLI_COMMAND_QUERY_INVALID`）与多匹配（`CLI_COMMAND_CONFLICT`）由平台返回，SDK 原样透传。
 *
 * 运行位置（§3.5 表）：`cli.command.*` 属平台内部服务路由，只对注入服务传输的客户端
 * （`@chips/cli` 与平台组件）可用；插件运行时的默认目标 `window.chips` 不承载发现路由。
 */

import type {
  CliCommandApi,
  CliCommandListResult,
  CliCommandQueryOptions,
  CliCommandResolveResult,
  CliCommandView,
} from '../types/cli/command.js';
import { invokeTarget, type TargetResolver } from './target-invocation.js';

/** 服务路由名：命令发现全量读取（07-CLI完整参考 §5.8 路由表）。 */
export const CLI_COMMAND_LIST_ROUTE = 'cli.command.list';

/** 服务路由名：单一命令读取（07-CLI完整参考 §5.8 路由表）。 */
export const CLI_COMMAND_GET_ROUTE = 'cli.command.get';

/** 服务路由名：命令路径解析与冲突透出（07-CLI完整参考 §5.8 路由表）。 */
export const CLI_COMMAND_RESOLVE_ROUTE = 'cli.command.resolve';

/**
 * 构造 CLI 命令发现命名空间。
 *
 * @param resolveTarget - 目标 Bridge 解析函数，由 `ChipsBridge` 注入
 * @returns 只读的 `cliCommand` 命名空间实现
 */
export function createCliCommandApi(resolveTarget: TargetResolver): CliCommandApi {
  return {
    list(options?: CliCommandQueryOptions): Promise<CliCommandListResult> {
      // §5.8：`cli.command.list` 的输入即查询参数对象；省略参数按全量读取当前索引。
      return invokeTarget<CliCommandListResult>(
        resolveTarget,
        CLI_COMMAND_LIST_ROUTE,
        options ?? {}
      );
    },
    get(options: CliCommandQueryOptions): Promise<CliCommandView | undefined> {
      // §5.8 的 `cli.command.get` 输出即 `CliCommandView` 本身（`{ command?, conflicts }` 信封
      // 只属于 `cli.command.resolve`）；无匹配即 undefined，SDK 不补默认值、不消解冲突。
      return invokeTarget<CliCommandView | undefined>(
        resolveTarget,
        CLI_COMMAND_GET_ROUTE,
        options
      );
    },
    resolve(options: CliCommandQueryOptions): Promise<CliCommandResolveResult> {
      return invokeTarget<CliCommandResolveResult>(
        resolveTarget,
        CLI_COMMAND_RESOLVE_ROUTE,
        options
      );
    },
  };
}
