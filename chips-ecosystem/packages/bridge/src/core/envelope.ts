/**
 * 二进制信封拆分与合并（02-Bridge三层设计 §3.6、04-能力契约规范 §2.4）。
 *
 * - 拆分：按能力 schema 的 `x-chips-binary` 字段收集字节，`json` 中对应位置替换为 `bin` 表键（JSON Pointer）；
 * - 校验对象：`json` 段走 Schema 校验（二进制字段只校验键存在）；字节长度按 schema 声明的上限校验；
 *   缺键、多余键或超限返回 `BRIDGE_INVALID_INPUT`；
 * - 合并：执行 `execute(input, ctx)` 前把 `bin` 按键合并回输入（`Uint8Array`），能力作者不感知信封形态。
 */

import { BRIDGE_ERROR_CODES, createBridgeError } from '../protocol/errors.js';
import type { IBinaryEnvelope, IBinaryFieldDescriptor } from '../protocol/envelope.js';
import type { ICompiledSchema } from '../schema/compile.js';
import { escapePointerSegment } from '../schema/validate.js';

function invalidInput(message: string, details: Record<string, unknown>): Error {
  return createBridgeError(BRIDGE_ERROR_CODES.invalidInput, { message, details, retryable: false });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toBytes(value: unknown): Uint8Array | undefined {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  return undefined;
}

function descriptorMap(compiled: ICompiledSchema): ReadonlyMap<string, IBinaryFieldDescriptor> {
  return new Map(compiled.binaryFields.map((field) => [field.pointer, field]));
}

/**
 * 按输入侧 JSON Pointer 查找二进制字段描述符：精确匹配优先；
 * 数组元素下标段（`/0`、`/12`）在描述符中以 `*` 记录，故存在数字段时回退到通配形式。
 */
function createDescriptorLookup(
  compiled: ICompiledSchema,
): (pointer: string) => IBinaryFieldDescriptor | undefined {
  const descriptors = descriptorMap(compiled);
  if (descriptors.size === 0) {
    return () => undefined;
  }
  return (pointer: string): IBinaryFieldDescriptor | undefined => {
    const exact = descriptors.get(pointer);
    if (exact !== undefined) {
      return exact;
    }
    if (!/\/\d+(\/|$)/.test(pointer)) {
      return undefined;
    }
    return descriptors.get(pointer.replace(/\/\d+(?=\/|$)/g, '/*'));
  };
}

function splitValue(
  value: unknown,
  pointer: string,
  lookup: (pointer: string) => IBinaryFieldDescriptor | undefined,
  bin: Record<string, Uint8Array>,
): unknown {
  const descriptor = lookup(pointer);
  if (descriptor !== undefined) {
    const bytes = toBytes(value);
    if (bytes === undefined) {
      throw invalidInput('二进制字段必须为字节数据', { pointer });
    }
    if (descriptor.maxBytes !== undefined && bytes.byteLength > descriptor.maxBytes) {
      throw invalidInput('二进制数据超出上限', {
        pointer,
        maxBytes: descriptor.maxBytes,
        size: bytes.byteLength,
      });
    }
    if (Object.prototype.hasOwnProperty.call(bin, pointer)) {
      throw invalidInput('二进制表键重复', { pointer });
    }
    bin[pointer] = bytes;
    return pointer;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      splitValue(item, `${pointer}/${String(index)}`, lookup, bin),
    );
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = splitValue(child, `${pointer}/${escapePointerSegment(key)}`, lookup, bin);
    }
    return result;
  }
  return value;
}

/** 按 schema 拆分输入为 `{ json, bin }` 信封；二进制字段缺失时不产生表项（由 schema 校验判定必填）。 */
export function splitEnvelope(input: unknown, compiled: ICompiledSchema): IBinaryEnvelope {
  const bin: Record<string, Uint8Array> = {};
  const json = splitValue(input, '', createDescriptorLookup(compiled), bin);
  return { json, bin };
}

function mergeValue(
  value: unknown,
  pointer: string,
  lookup: (pointer: string) => IBinaryFieldDescriptor | undefined,
  bin: Record<string, Uint8Array>,
  referenced: Set<string>,
): unknown {
  const descriptor = lookup(pointer);
  if (descriptor !== undefined) {
    if (typeof value !== 'string') {
      throw invalidInput('二进制字段缺少表键', { pointer });
    }
    const bytes = bin[value];
    if (bytes === undefined) {
      throw invalidInput('二进制表中缺少对应数据', { pointer });
    }
    referenced.add(value);
    return bytes;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      mergeValue(item, `${pointer}/${String(index)}`, lookup, bin, referenced),
    );
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      result[key] = mergeValue(child, `${pointer}/${escapePointerSegment(key)}`, lookup, bin, referenced);
    }
    return result;
  }
  return value;
}

/** 把 `{ json, bin }` 合并回能力输入；出现未引用表项或键缺失时返回 `BRIDGE_INVALID_INPUT`。 */
export function mergeEnvelope(envelope: IBinaryEnvelope, compiled: ICompiledSchema): unknown {
  const lookup = createDescriptorLookup(compiled);
  const referenced = new Set<string>();
  const merged = mergeValue(envelope.json, '', lookup, envelope.bin, referenced);
  for (const key of Object.keys(envelope.bin)) {
    if (!referenced.has(key)) {
      throw invalidInput('二进制表包含未使用的条目', { key });
    }
  }
  return merged;
}
