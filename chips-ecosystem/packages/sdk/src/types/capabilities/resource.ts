/**
 * `resource:*` 能力契约类型（04-能力契约规范 §7.2）。
 *
 * `resource:read` / `resource:write` 是单次读取与写入路径，`data` 单次上限 8 MiB；
 * 更大资源必须使用资源句柄的 `readRange()` / `stream()`。
 * 资源打开与槽位编目的输入输出类型见 `types/resource-open.ts`。
 */

export interface IResourceReadInput {
  uri: string;
}

export interface IResourceReadOutput {
  uri: string;
  mimeType: string;
  size: number;
  data: Uint8Array;
}

export interface IResourceWriteInput {
  uri: string;
  data: Uint8Array;
}

export interface IResourceWriteOutput {
  uri: string;
  size: number;
  version: string;
}
