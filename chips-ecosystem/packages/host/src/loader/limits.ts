/**
 * `.cpk` 体积与数量限额、生命周期超时常量（壳侧结构视图）。
 *
 * 权威：`04-文件格式规范/03-插件包格式` §四（资源与体积限制）、
 * `01-架构设计/01-子系统设计/01-薯片内核设计` §6.7（生命周期超时常量唯一定义处）。
 *
 * @remarks 与 `@chips/cli` 同名表逐项一致由 `tests/loader-contract.test.ts` 对文档口径与
 * 生成面漂移锁共同锁定；消费方一律引用本模块常量。
 */

/** 归档限额（《03-插件包格式》§四）。 */
export const CPK_LIMITS = {
  /** 归档字节上限。 */
  archiveBytes: 50 * 1024 * 1024,
  /** 解包后总字节上限。 */
  totalBytes: 50 * 1024 * 1024,
  /** 文件成员数上限。 */
  members: 512,
  /** 单文件字节上限。 */
  singleFileBytes: 16 * 1024 * 1024,
  /** `manifest.yaml` 字节上限。 */
  manifestBytes: 256 * 1024,
  /** 入口文件字节上限。 */
  entryFileBytes: 8 * 1024 * 1024,
  /** 成员路径字符上限。 */
  pathLength: 180,
  /** 成员目录深度上限。 */
  depth: 8,
} as const;

/** 生命周期超时常量（《01-薯片内核设计》§6.7；毫秒）。 */
export const LIFECYCLE_TIMEOUTS = {
  /** `PluginRunner.apply` 上限。 */
  applyMs: 30_000,
  /** `PluginRunner.stop` 上限。 */
  stopMs: 10_000,
} as const;
