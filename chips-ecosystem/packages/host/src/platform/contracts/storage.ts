import type { PortCallContext } from './call.js';

/**
 * 文件读写编码；与能力契约 `file:*` 的 `encoding` 枚举一致。
 *
 * 权威：`04-能力契约规范` §7.1。
 */
export type StorageFileEncoding = 'utf-8' | 'base64';

/** 读取选项。 */
export interface StorageReadOptions extends PortCallContext {
  /** 编码；默认 `utf-8`。 */
  readonly encoding?: StorageFileEncoding;
}

/** 写入选项。 */
export interface StorageWriteOptions extends PortCallContext {
  /** 编码；默认 `utf-8`。 */
  readonly encoding?: StorageFileEncoding;
}

/** 目录列举选项。 */
export interface StorageListOptions extends PortCallContext {
  /** 是否递归；默认 `false`。 */
  readonly recursive?: boolean;
}

/** 目录创建选项。 */
export interface StorageMkdirOptions extends PortCallContext {
  /** 是否递归创建；`true` 等价 `mkdir -p`；默认 `false`。 */
  readonly recursive?: boolean;
}

/** 删除选项。 */
export interface StorageDeleteOptions extends PortCallContext {
  /** 是否删除非空目录；默认 `false`（非空目录返回 `FILE_NOT_EMPTY`）。 */
  readonly recursive?: boolean;
}

/** 移动选项。 */
export interface StorageMoveOptions extends PortCallContext {
  /** 目标存在时是否覆盖；默认 `false`（返回 `FILE_ALREADY_EXISTS`）。 */
  readonly overwrite?: boolean;
}

/** 复制选项。 */
export interface StorageCopyOptions extends PortCallContext {
  /** 目标存在时是否覆盖；默认 `false`（返回 `FILE_ALREADY_EXISTS`）。 */
  readonly overwrite?: boolean;
}

/** 监视选项。 */
export interface StorageWatchOptions extends PortCallContext {
  /** 是否递归监视；默认 `false`。 */
  readonly recursive?: boolean;
}

/** 监视事件类型；对应 `fs.watch` 的 `rename` / `change`。 */
export type StorageWatchEventType = 'rename' | 'change';

/** 文件监视原始事件；路径为绝对路径，能力层负责映射为资源 URI 与 `file:changed`。 */
export interface StorageWatchEvent {
  /** 事件类型。 */
  readonly type: StorageWatchEventType;
  /** 发生变化的路径（绝对路径）。 */
  readonly path: string;
  /** 事件时间（Unix 毫秒）。 */
  readonly timestamp: number;
}

/** 文件监视句柄。 */
export interface StorageWatchSubscription {
  /** 释放监视；幂等。 */
  dispose(): void;
}

/** 读取结果。 */
export interface StorageReadResult {
  /** 文本内容（`utf-8`）或 base64 字符串（`base64`）。 */
  readonly content: string;
  /** 实际使用的编码。 */
  readonly encoding: StorageFileEncoding;
}

/**
 * 文件存储端口；方法与非插件可见的 `file:*` 能力动作一一对应。
 *
 * 权威：`04-能力契约规范` §7.1、`17-跨端Shell与平台抽象设计` §4.3。
 *
 * @remarks
 * - 端口只接收已解析的绝对路径；目录变量由壳在调用端口前展开。
 * - `write` 使用临时文件 + 原子替换，不自动创建父目录。
 * - 端口不做路径安全判定（PathGuard 在核心）；端口只保证系统级行为与错误归一。
 */
export interface IPalStoragePort {
  /** 读取文件并解码为文本或 base64。 */
  read(path: string, options?: StorageReadOptions): Promise<StorageReadResult>;
  /** 原子写入文件（同目录临时文件 + rename）。 */
  write(path: string, data: string, options?: StorageWriteOptions): Promise<void>;
  /** 列举目录；返回相对目录、`/` 分隔、字典序升序的路径数组，不跟随符号链接。 */
  list(directory: string, options?: StorageListOptions): Promise<readonly string[]>;
  /** 创建目录。 */
  mkdir(path: string, options?: StorageMkdirOptions): Promise<void>;
  /** 删除文件或目录。 */
  delete(path: string, options?: StorageDeleteOptions): Promise<void>;
  /** 移动（重命名）文件或目录；跨设备时回退为复制 + 删除。 */
  move(source: string, target: string, options?: StorageMoveOptions): Promise<void>;
  /** 复制文件或目录；目录递归、符号链接不跟随。 */
  copy(source: string, target: string, options?: StorageCopyOptions): Promise<void>;
  /** 监视文件或目录；原始事件交给壳映射为 `file:changed`。 */
  watch(
    path: string,
    onEvent: (event: StorageWatchEvent) => void,
    options?: StorageWatchOptions,
  ): Promise<StorageWatchSubscription>;
}
