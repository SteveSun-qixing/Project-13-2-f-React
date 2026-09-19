/**
 * 确定性 YAML 发射器：只覆盖 manifest 所需子集（映射、序列、标量），
 * 同一输入永远产出同一文本，保证脚手架生成结果字节级可复现。
 */

/** 可序列化的 YAML 值（manifest 子集）。 */
export type YamlValue =
  string | number | boolean | null | readonly YamlValue[] | { readonly [key: string]: YamlValue };

/** 不允许作为裸标量开头的指示符（保守策略：命中即加引号）。 */
const PLAIN_FORBIDDEN_PREFIX = /^[-?:,[\]{}#&*!|>'"%@`]/;
/** 裸标量中必须加引号的内容：冒号加空格、空格加井号、引号、反斜杠与控制字符。 */
// eslint-disable-next-line no-control-regex
const PLAIN_UNSAFE_CONTENT = /: | #|["\\]|[\u0000-\u001f\u007f]/;
const BOOLEAN_LIKE_PATTERN = /^(?:true|false|yes|no|on|off|null|~)$/i;
const NUMBER_LIKE_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

function isPlainMapping(value: YamlValue): value is { readonly [key: string]: YamlValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断标量是否必须以双引号包裹：保证输出可被 YAML 1.2 解析且语义不变。 */
export function needsQuoting(value: string): boolean {
  if (value.length === 0 || value !== value.trim()) {
    return true;
  }
  if (PLAIN_FORBIDDEN_PREFIX.test(value) || PLAIN_UNSAFE_CONTENT.test(value)) {
    return true;
  }
  return BOOLEAN_LIKE_PATTERN.test(value) || NUMBER_LIKE_PATTERN.test(value);
}

function quote(value: string): string {
  const escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  return `"${escaped}"`;
}

function emitScalar(value: string | number | boolean | null): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return needsQuoting(value) ? quote(value) : value;
}

function emitBlock(value: YamlValue, indentLevel: number): string[] {
  const indent = '  '.repeat(indentLevel);
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}[]`];
    }
    const lines: string[] = [];
    for (const item of value as readonly YamlValue[]) {
      if (isPlainMapping(item)) {
        const nested = emitBlock(item, indentLevel + 1);
        lines.push(`${indent}- ${nested[0]?.slice(indent.length + 2) ?? ''}`);
        lines.push(...nested.slice(1));
      } else if (Array.isArray(item)) {
        lines.push(`${indent}-`);
        lines.push(...emitBlock(item as readonly YamlValue[], indentLevel + 1));
      } else {
        lines.push(`${indent}- ${emitScalar(item as string | number | boolean | null)}`);
      }
    }
    return lines;
  }
  if (isPlainMapping(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [`${indent}{}`];
    }
    const lines: string[] = [];
    for (const [key, item] of entries) {
      const keyText = needsQuoting(key) ? quote(key) : key;
      if (Array.isArray(item)) {
        if (item.length === 0) {
          lines.push(`${indent}${keyText}: []`);
        } else {
          lines.push(`${indent}${keyText}:`);
          lines.push(...emitBlock(item, indentLevel + 1));
        }
      } else if (isPlainMapping(item)) {
        if (Object.keys(item).length === 0) {
          lines.push(`${indent}${keyText}: {}`);
        } else {
          lines.push(`${indent}${keyText}:`);
          lines.push(...emitBlock(item, indentLevel + 1));
        }
      } else {
        lines.push(`${indent}${keyText}: ${emitScalar(item as string | number | boolean | null)}`);
      }
    }
    return lines;
  }
  return [`${indent}${emitScalar(value as string | number | boolean | null)}`];
}

/** 把 YAML 值序列化为以换行结尾的文本。 */
export function emitYaml(value: YamlValue): string {
  return `${emitBlock(value, 0).join('\n')}\n`;
}
