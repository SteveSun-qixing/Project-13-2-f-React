/**
 * 能力调用二进制信封（02-Bridge三层设计 §3.6、04-能力契约规范 §2.4）。
 *
 * `{ json, bin }` 两段由 Bridge 层在能力调用链路上拆分与合并：
 * schema 中标记 `x-chips-binary` 的字段，其值在 `json` 中替换为 `bin` 表键；
 * 键为二进制字段的稳定路径（默认取字段的 JSON Pointer，如 `/data`）。
 */

export interface IBinaryEnvelope<TJson = unknown> {
  json: TJson;
  /** 二进制表：键 → 字节；键由 Bridge 层生成，同一输入内唯一。 */
  bin: Record<string, Uint8Array>;
}

/** 编译期收集的二进制字段描述符。 */
export interface IBinaryFieldDescriptor {
  /** 字段的 JSON Pointer（如 `/data`、`/resource/data`）。 */
  readonly pointer: string;
  /** `x-chips-binary` 声明的字节上限；省略表示不额外限制。 */
  readonly maxBytes?: number;
}
