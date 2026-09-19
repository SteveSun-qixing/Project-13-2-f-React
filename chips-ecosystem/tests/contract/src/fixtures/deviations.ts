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
