/**
 * 偏差注入夹具：在内存中修改文档文本或实现侧模型，驱动完整的解析 → 比对管线。
 *
 * 偏差用例的验收标准是「必须失败」：每个注入都必须让对应检查产出预期偏差；
 * 夹具只替换内容，不写回真实文档。
 */

import type { BridgeCodeModel } from '../code/bridge.js';
import type { HostCodeModel } from '../code/host.js';
import { loadDocModels, type DocModels } from '../docs/index.js';
import { createFileReader, type DocReader } from '../docs/reader.js';
import { DOCS_ROOT } from '../paths.js';

export interface DocMutation {
  readonly file: string;
  readonly mutate: (text: string) => string;
  /** 偏差说明（测试名与报告）。 */
  readonly description: string;
}

/** 必须在文本中命中一次，否则夹具自身失败（防止偏差注入静默失效）。 */
export function replaceOnce(text: string, find: string, replace: string): string {
  const index = text.indexOf(find);
  if (index < 0) {
    throw new Error(`偏差注入失败：未找到目标文本 ${JSON.stringify(find)}`);
  }
  return `${text.slice(0, index)}${replace}${text.slice(index + find.length)}`;
}

/** 删除包含指定文本的整行。 */
export function removeLineContaining(text: string, needle: string): string {
  const lines = text.split('\n');
  const filtered = lines.filter((line) => !line.includes(needle));
  if (filtered.length === lines.length) {
    throw new Error(`偏差注入失败：未找到包含 ${JSON.stringify(needle)} 的行`);
  }
  return filtered.join('\n');
}

/** 去除全部空白（空格、制表符），用于与表格列宽填充形解耦的归一比较。 */
function stripWhitespace(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * 空格不敏感版 `removeLineContaining`：needle 与行双方先去空白再比对，锚点不再依赖
 * prettier 表格列宽对齐的填充形（工单046 同根因判例：列宽归一必然击碎含空格整行锚）。
 * 判定强度不降：目标行改名、整行删除或单元格缺失时归一后仍不命中，夹具照旧抛错，
 * 杜绝静默失效。
 */
export function removeLineContainingIgnoringSpacing(text: string, needle: string): string {
  const target = stripWhitespace(needle);
  if (target.length === 0) {
    throw new Error('偏差注入失败：needle 不能为空');
  }
  const lines = text.split('\n');
  const filtered = lines.filter((line) => !stripWhitespace(line).includes(target));
  if (filtered.length === lines.length) {
    throw new Error(`偏差注入失败：空格归一后未找到包含 ${JSON.stringify(needle)} 的行`);
  }
  return filtered.join('\n');
}

/** 将字面文本转义为可嵌入 `RegExp` 的形。 */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 空格不敏感版 `replaceOnce`：`find` 按空白切分为 token，token 之间允许任意行内空白
 * （`[ \t]*`，不含换行、不跨行），命中列宽填充展开形的同时保持行内精确语义。
 * 判定强度不降：token 序列被打断（改名、删行、单元格缺失、单元格插词）即不命中，
 * 未命中照旧抛错，杜绝静默失效。`replace` 以给定形整体替换命中区段（偏差注入只在
 * 内存中生效、不回写真实文档，列宽形不影响后续解析判定）。
 */
export function replaceOnceIgnoringSpacing(text: string, find: string, replace: string): string {
  const tokens = find.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    throw new Error('偏差注入失败：find 不能为空');
  }
  const pattern = new RegExp(tokens.map(escapeRegExp).join('[ \\t]*'));
  const match = pattern.exec(text);
  if (match === null) {
    throw new Error(`偏差注入失败：空格归一后未找到目标文本 ${JSON.stringify(find)}`);
  }
  return `${text.slice(0, match.index)}${replace}${text.slice(match.index + match[0].length)}`;
}

/** 删除一个 `#### <heading>` 级章节（到下一个 `####`/`###` 标题为止）。 */
export function removeHeadingSection(text: string, heading: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === `#### ${heading}`);
  if (start < 0) {
    throw new Error(`偏差注入失败：未找到标题 #### ${heading}`);
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,4}\s+/.test(lines[index] ?? '')) {
      end = index;
      break;
    }
  }
  return [...lines.slice(0, start), ...lines.slice(end)].join('\n');
}

/**
 * 构造带偏差的文档读取器：命中偏差的文件返回修改后的文本，其余文件读真实文档。
 * 被删除的文件在读取时抛出 `ENOENT` 语义错误。
 */
export function createDeviatedReader(mutations: readonly DocMutation[]): DocReader {
  const real = createFileReader(DOCS_ROOT);
  const byFile = new Map<string, DocMutation[]>();
  for (const mutation of mutations) {
    const list = byFile.get(mutation.file) ?? [];
    list.push(mutation);
    byFile.set(mutation.file, list);
  }
  return {
    read(relativePath: string): string {
      const list = byFile.get(relativePath);
      if (list === undefined) {
        return real.read(relativePath);
      }
      let text: string | null = null;
      for (const mutation of list) {
        if (text === null) {
          text = real.read(relativePath);
        }
        text = mutation.mutate(text);
      }
      return text ?? real.read(relativePath);
    },
  };
}

export function loadDeviatedDocModels(mutations: readonly DocMutation[]): DocModels {
  return loadDocModels(createDeviatedReader(mutations));
}

/** 实现侧偏差：追加一个未登记能力。 */
export function appendUnknownCapability(model: BridgeCodeModel, id: string): BridgeCodeModel {
  return {
    ...model,
    capabilities: [
      ...model.capabilities,
      { id, permissions: [], targets: [], ownerBound: false },
    ].sort((left, right) => left.id.localeCompare(right.id)),
  };
}

/** 实现侧偏差：移除一个能力。 */
export function removeCodeCapability(model: BridgeCodeModel, id: string): BridgeCodeModel {
  return { ...model, capabilities: model.capabilities.filter((capability) => capability.id !== id) };
}

/** 实现侧偏差：修改一个能力的权限映射。 */
export function driftCodeCapabilityPermissions(
  model: BridgeCodeModel,
  id: string,
  permissions: readonly string[],
): BridgeCodeModel {
  return {
    ...model,
    capabilities: model.capabilities.map((capability) =>
      capability.id === id ? { ...capability, permissions: [...permissions] } : capability,
    ),
  };
}

/** 实现侧偏差：追加一个未登记事件。 */
export function appendUnknownEvent(model: BridgeCodeModel, id: string): BridgeCodeModel {
  return { ...model, events: [...model.events, { id, visibility: 'public' }] };
}

/** 实现侧偏差：修改事件可见性。 */
export function driftEventVisibility(
  model: BridgeCodeModel,
  id: string,
  visibility: string,
): BridgeCodeModel {
  return {
    ...model,
    events: model.events.map((event) => (event.id === id ? { ...event, visibility } : event)),
  };
}

/** 实现侧偏差：追加一个未登记错误码。 */
export function appendUnknownErrorCode(model: BridgeCodeModel, code: string): BridgeCodeModel {
  return { ...model, errors: { ...model.errors, channel: [...model.errors.channel, code] } };
}

/** 实现侧偏差：追加一个未登记 PAL 错误码。 */
export function appendUnknownPalCode(model: HostCodeModel, code: string): HostCodeModel {
  return { ...model, palErrorCodes: [...model.palErrorCodes, code] };
}
