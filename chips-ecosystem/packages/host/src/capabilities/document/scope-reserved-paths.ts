/**
 * 工作区保留区登记面（W5 T-ws 工作区作用域臂，工单036 残段收尾波）。
 *
 * 权威：`13-工作区设计` §三（13.03）——§3.1 目录布局（`.chips/` 平台保留目录及其
 * state/cache 子树）、§3.2「不进入扫描的条目」表（保留目录 / 平台保留前缀 / 系统生成物 /
 * 临时物四类清单）、§3.3 命名与冲突规则第 3 条（保留前缀禁止：创建/重命名/移动到保留前缀
 * 一律返回 `WORKSPACE_RESERVED_PATH`）；`13.06` §6.3（保留区保护：只由平台组件访问，
 * 插件触碰保留路径一律 `WORKSPACE_RESERVED_PATH` 并记录审计）。
 *
 * @remarks
 * - **host 域单源（禁第二套保留区判定）**：本模块是平台保留前缀/保留名清单常量与
 *   `isReservedPath` 判据在宿主侧的唯一落点（派单蓝图 §〇.5：`WORKSPACE_RESERVED_PATH`
 *   全库无实现面，保留区检查臂归 T-ws，禁造第二套判定）。消费方（`document:create` 的
 *   `parent` 落点闸、`document:export` 的 `target` 落点闸，13.04 §4.2 规则 3）一律引用
 *   本模块判据，不得自建清单或自写前缀比对。
 * - **与目标注册臂的分工（13.06 §6.3.3 同构）**：`isReservedPath` 是能力服务层对
 *   **用户落点**（create 的 `parent`、export 的 `target`）的输入闸；平台自持的暂存物
 *   （`.chips-export-<随机>` 导出暂存、`.chips-save-<随机>` 保存临时物、
 *   `.chips-unpack-<随机>` 解包工作目录）合法地落在保留前缀之下——
 *   {@link ./adapters/scope-adapter.js} 的目标注册臂（ensureTargetScope）因此**不做**
 *   保留区判定，否则导出暂存链路自锁。
 * - **判定口径（fail-closed，不放宽）**：按路径段逐段判定（根或任意层级，§3.2 平台保留
 *   前缀行「根或任意层级」）；任一段命中保留清单即整路径保留。段级判据两支：
 *   ① 以 `.` 开头的隐藏条目（系统生成物行的上位判据——同时涵盖保留目录 `.chips`、
 *   保留前缀族 `.chips-*`、`.DS_Store` 与其他隐藏条目）；② 不带前导点的系统生成物保留名
 *   （`__MACOSX` / `Thumbs.db` / `desktop.ini`，卷语义大小写折叠，§3.3 第 6 条）。
 * - **不属本判据的面**：导航段（`.` / `..`）与空输入的拒收属调用方路径合法性闸与输入闸，
 *   本判据只回答「是否落 13.03 保留清单」，不代管、不误判；受管引用（`chips-resource://`）
 *   须由调用方先换算/解码为本地路径再判定（本判据是纯路径段判定，不解协议）。
 * - `.chips` 字面量在文档域 src 内唯一落点即本文件（存在性锁见
 *   `tests/document-scope-reserved-paths.test.ts`）。
 */

/** 平台保留目录名（§3.1 布局：`<workspace>/.chips/`，整棵子树保留）。 */
export const WORKSPACE_RESERVED_DIRECTORY_NAME = '.chips';

/** 平台保留前缀（§3.2：根或任意层级以 `.chips` 开头的条目；保留目录是其最小实例）。 */
export const WORKSPACE_RESERVED_PLATFORM_PREFIX = '.chips';

/**
 * 在册平台临时物前缀族（§3.2 平台保留前缀行括注逐字：保存临时物、导出暂存、解包工作目录）。
 *
 * @remarks 判据上它们被 `.` 前缀上位判据覆盖，在册 enumeration 供平台组件按族构造与
 * 识别临时物（13.04 §4.2 规则 8 导出暂存、§4.5 解包工作目录、11 §5.3 保存临时物），
 * 供审计与启动恢复登记按同一清单对账——禁在消费方散落第二份前缀字面量。
 */
export const WORKSPACE_RESERVED_TEMP_ITEM_PREFIXES = ['.chips-save-', '.chips-export-', '.chips-unpack-'] as const;

/**
 * 系统生成物保留名（§3.2 系统生成物行逐字点名项；不带前导点的三项不经理 `.`
 * 上位判据，须显式在册）。
 */
export const WORKSPACE_RESERVED_SYSTEM_GENERATED_NAMES = ['__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini'] as const;

/** 导航段（路径操作符，非条目名）：不属 13.03 保留清单，拒收归调用方路径合法性闸。 */
const NAVIGATION_SEGMENTS = new Set(['.', '..']);

/** 路径段切分（POSIX `/` 与 win32 `\` 同判；空段——连续分隔符与尾分隔符——跳过）。 */
function splitSegments(path: string): readonly string[] {
  return path.split(/[/\\]/u).filter((segment) => segment.length > 0);
}

/** 单段判定：`.` 前缀隐藏条目上位判据 + 系统生成物保留名（卷语义大小写折叠）。 */
function isReservedSegment(segment: string): boolean {
  if (NAVIGATION_SEGMENTS.has(segment)) {
    return false;
  }
  if (segment.startsWith('.')) {
    return true;
  }
  const folded = segment.toLowerCase();
  return WORKSPACE_RESERVED_SYSTEM_GENERATED_NAMES.some((name) => name.toLowerCase() === folded);
}

/**
 * 判定路径是否落工作区保留区/保留前缀（13.03 §三 清单的逐条判据）。
 *
 * @param path 本地文件系统路径（绝对或相对，POSIX 与 win32 分隔符同判）或包内相对路径；
 * 受管引用须由调用方先换算为本地路径（见头注「不属本判据的面」）。
 * @returns 任一路径段命中保留清单即 `true`（创建/重命名/移动/落点到该路径应返回
 * `WORKSPACE_RESERVED_PATH`，13.03 §3.3 规则 3、13.06 §6.3.1）；否则 `false`。
 */
export function isReservedPath(path: string): boolean {
  if (typeof path !== 'string') {
    return false;
  }
  return splitSegments(path).some(isReservedSegment);
}
