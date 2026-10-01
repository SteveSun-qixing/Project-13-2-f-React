/**
 * 编辑链路契约镜像锁的源码提取器（仅测试代码）。
 *
 * @remarks
 * - 形制与职责同 `packages/host/tests/helpers/contract-source.ts` 判例：不建立测试对实现包
 *   之外的依赖边，而是直接读取文档库契约分件原文与 SDK 源码原文做结构解析比对；
 *   任一侧漂移即确定性翻红（双源不漂移锁）。
 * - 文档库路径相对 `tests/` 目录书写（与 host 判例口径一致）：`tests/helpers/` 内以
 *   `../` 回到 `tests/`，再按 host 判例的四级相对路径取仓库根下的 `薯片生态文档库/`。
 * - 提取前一律先剥注释，避免契约解说文字被当成成员（`index.test.ts` 的
 *   `stripComments` 同族实现）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 读取文档库契约分件原文（相对路径以 `tests/` 目录为基准）。 */
export function readDocSource(relativeFromTests: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeFromTests, new URL('../', import.meta.url))),
    'utf8'
  );
}

/** 读取 SDK 包内源码原文（相对路径以 `tests/` 目录为基准，如 `../src/edit/session.ts`）。 */
export function readSdkSource(relativeFromTests: string): string {
  return readDocSource(relativeFromTests);
}

/** 去掉块注释与行注释（含成员尾随的行内 `//` 注释），避免契约解说与 JSDoc 被当成类型成员。 */
export function stripTypeComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** 取 Markdown 原文里全部 ```typescript 围栏块的正文拼接。 */
export function extractTypeScriptBlocks(markdown: string): string {
  const blocks = [...markdown.matchAll(/```typescript\r?\n([\s\S]*?)```/g)].map(
    (match) => match[1] ?? ''
  );
  if (blocks.length === 0) {
    throw new Error('契约分件中未找到 typescript 围栏块，提取器与文档形制漂移');
  }
  return blocks.join('\n');
}

/** 定位 `interface NAME {` 的配平体；未声明时返回 `undefined`。 */
function findInterfaceBody(source: string, typeName: string): string | undefined {
  const match = new RegExp(`\\binterface\\s+${typeName}\\s*\\{`).exec(source);
  if (match === null) {
    return undefined;
  }
  const start = match.index + match[0].length;
  let depth = 1;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i);
      }
    }
  }
  return undefined;
}

/** 成员名：标识符或引号键，后随可选 `?`，再随 `:`（属性）、`(`（方法）或 `<`（泛型方法）。 */
const MEMBER_NAME_PATTERN =
  /^\s*(?:readonly\s+)?(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*\??\s*[:<(]/;

/**
 * 提取接口的深度 1 成员名清单（保持原文顺序）。
 *
 * 成员段以体内深度 0 的 `;` 分隔；嵌套 `{}`（对象字面量载荷）不计成员。
 */
export function extractInterfaceMembers(source: string, typeName: string): readonly string[] {
  const body = findInterfaceBody(stripTypeComments(source), typeName);
  if (body === undefined) {
    throw new Error(`未找到 interface ${typeName} 声明（提取器与原文漂移）`);
  }
  const members: string[] = [];
  let depth = 0;
  let segmentStart = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === ';' && depth === 0) {
      const segment = body.slice(segmentStart, i);
      const match = MEMBER_NAME_PATTERN.exec(segment);
      const name = match?.[1] ?? match?.[2] ?? match?.[3];
      if (name !== undefined && name.length > 0) {
        members.push(name);
      }
      segmentStart = i + 1;
    }
  }
  return members;
}

/** 定位 `type NAME =` 的联合体正文（终止于深度 0 的 `;`）。 */
function findTypeAliasBody(source: string, typeName: string): string | undefined {
  const match = new RegExp(`\\btype\\s+${typeName}\\s*=`).exec(source);
  if (match === null) {
    return undefined;
  }
  const start = match.index + match[0].length;
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    } else if (char === ';' && depth === 0) {
      return source.slice(start, i);
    }
  }
  return undefined;
}

/** 类型别名联合体各对象变体内的字段名（去重、保持首现顺序）。 */
export function extractUnionObjectFields(source: string, typeName: string): readonly string[] {
  const body = stripTypeComments(findTypeAliasBody(stripTypeComments(source), typeName) ?? '');
  if (body.length === 0) {
    throw new Error(`未找到 type ${typeName} 声明（提取器与原文漂移）`);
  }
  const fields: string[] = [];
  for (const match of body.matchAll(/([A-Za-z_$][\w$]*)\s*\??\s*:/g)) {
    const field = match[1] ?? '';
    if (!fields.includes(field)) {
      fields.push(field);
    }
  }
  return fields;
}

/** 取围栏块内声明的全部类型名（`interface NAME` / `type NAME`，保持首现顺序）。 */
export function extractDeclaredTypeNames(source: string): readonly string[] {
  const blocks = extractTypeScriptBlocks(source);
  const names: string[] = [];
  for (const match of blocks.matchAll(/\b(?:interface|type)\s+([A-Za-z_$][\w$]*)/g)) {
    const name = match[1] ?? '';
    if (!names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/** 解析源码中 `export type { ... } from '<specifier>';` 块的在册名单（保持原文顺序）。 */
export function parseExportTypeNames(source: string, specifier: string): readonly string[] {
  const escaped = specifier.replace(/[.*+?${}()|[\]\\]/g, String.raw`\$&`);
  const pattern = new RegExp(`export type \\{([^}]*)\\} from '${escaped}';`, 'g');
  const names: string[] = [];
  for (const block of source.matchAll(pattern)) {
    for (const entry of (block[1] ?? '').split(',')) {
      const name = entry.trim();
      if (name.length > 0) {
        names.push(name);
      }
    }
  }
  return names;
}

/** 从 Markdown 指定切片内提取反引号错误码（全大写下划线，保持首现顺序、去重）。 */
export function extractErrorCodes(
  markdown: string,
  fromMarker: string,
  toMarker: string
): readonly string[] {
  const start = markdown.indexOf(fromMarker);
  const end = markdown.indexOf(toMarker, start === -1 ? 0 : start);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('错误码切片标记未命中，提取器与文档形制漂移');
  }
  const section = markdown.slice(start, end);
  const codes: string[] = [];
  for (const match of section.matchAll(/`([A-Z][A-Z0-9_]*)`/g)) {
    const code = match[1] ?? '';
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  return codes;
}
