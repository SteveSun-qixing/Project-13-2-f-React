'use strict';
/**
 * 文档解析域「行为面」替身夹具（仅测试使用，金链路刀4a 组合根装载段正向臂）。
 *
 * 与 `parser-available.js`（仅过装载闸、不承载语义）不同，本夹具为组合根端到端用例
 * 提供确定性的解析行为：17 项必备导出在位（元信息 2 + §6.4 冻结 13 + 工单034 正式化 2），
 * ABI 返回宿主期望 1，`createNativeDocumentParserPort` 的真实调用链
 * （`openCard` / `openDocument` → `documentMetadata` → `documentRevision` →
 * `documentStructure` / `documentContent` → `documentClose`）逐调用可观察。
 *
 * @remarks
 * - 夹具不实现任何 `.card` 字节解析语义（解析算法权威在 chips-parser，工单015）：
 *   文档内容以内置登记表按本地路径直给，成员指纹集合与内容字节一一对应，保证
 *   `fingerprint` 复合臂与 `open` 基线指纹逐项一致（`sourceFingerprintsEqual` 可过）。
 * - `__calls` 记录逐次调用（导出名 + 标量参数；句柄以路径标识），供正向用例断言
 *   「四条能力真实路由到 createDocumentService → 原生端口」的调用形态。
 * - `serialize` 无原生对应物（刀6 裁决：落盘序列化权威归 W3 chips-resource），
 *   夹具无需提供——适配器 `IDocumentParserPort.serialize` 自带诚实拒绝臂。
 * - `buildDocumentView(handle, session)`（任务 #108 刀5 段A 起为已消费面）：按 §6.6
 *   CardRenderView 冻结形状从登记表投影，调用记录含数值会话入参。
 * - 其余未消费的冻结面（`documentReadResource` / `documentValidate` /
 *   `documentEntries` / `documentLayoutConfig`）以契约形状的错误诚实拒绝（卡片句柄
 *   误用即点名），不伪造成功。
 */

const CARD_ID = 'Ab3dEf6Gh8';
const NODE_ID_ONE = 'Cd1eFg2Hi3';
const NODE_ID_TWO = 'Jk4lMn5Op6';
const CARD_PATH = '/fake/prod-card.card';

const metadata = {
  chip_standards_version: '1.0.0',
  card_id: CARD_ID,
  name: '生产接线卡片',
  created_at: '2026-01-02T03:04:05Z',
  modified_at: '2026-01-02T03:04:05Z',
};

const structure = {
  structure: [
    { id: NODE_ID_ONE, type: 'text', title: '第一块' },
    { id: NODE_ID_TWO, type: 'image', title: '第二块' },
  ],
  manifest: { card_count: 2, resource_count: 0 },
};

const contents = new Map([
  [NODE_ID_ONE, { text: '第一块内容' }],
  [NODE_ID_TWO, { text: '第二块内容' }],
]);

function member(path, payload) {
  return {
    path,
    size: Buffer.byteLength(JSON.stringify(payload), 'utf8'),
    modifiedMillis: 1700000000000,
    crc32: null,
  };
}

/** 磁盘基线成员集合（与 metadata/structure/contents 一一对应；目录态 crc32 恒为 null）。 */
function revisionMembers() {
  return [
    member('meta.yaml', metadata),
    member('structure.yaml', structure),
    member(`content/${NODE_ID_ONE}.yaml`, contents.get(NODE_ID_ONE)),
    member(`content/${NODE_ID_TWO}.yaml`, contents.get(NODE_ID_TWO)),
  ];
}

/** 内置文档登记表：本地路径 → 解析结果（夹具唯一的「磁盘」）。 */
const documents = new Map([
  [CARD_PATH, { kind: 'card', documentId: CARD_ID, title: metadata.name, idField: 'card_id' }],
]);

/** 打开句柄登记表：句柄对象 → 本地路径（关闭后移除，伪造句柄即点名）。 */
const opened = new Map();
const calls = [];
let nextHandleId = 0;

function fail(code, message) {
  return Promise.reject(Object.assign(new Error(message), { code, retryable: false }));
}

function record(exportName, args) {
  calls.push({ export: exportName, args });
}

function documentOfPath(path, exportName) {
  const doc = documents.get(path);
  if (doc === undefined) {
    return null;
  }
  return { path, ...doc };
}

function openAt(exportName, path) {
  record(exportName, { path });
  const found = documentOfPath(path, exportName);
  if (found === null) {
    return fail('DOCUMENT_NOT_FOUND', `夹具未登记的文档路径：${path}`);
  }
  if (exportName === 'openCard' && found.kind !== 'card') {
    return fail('DOCUMENT_FORMAT_UNKNOWN', 'openCard 入口收到非卡片文档');
  }
  if (exportName === 'openBox' && found.kind !== 'box') {
    return fail('DOCUMENT_FORMAT_UNKNOWN', 'openBox 入口收到非箱子文档');
  }
  nextHandleId += 1;
  const handle = { nativeDocumentHandleBrand: 'chips-native.document', id: nextHandleId, path };
  opened.set(handle, found);
  return Promise.resolve(handle);
}

function requireHandle(handle, exportName) {
  record(exportName, { path: typeof handle === 'object' && handle !== null ? handle.path : '<伪造句柄>' });
  const found = opened.get(handle);
  if (found === undefined) {
    throw Object.assign(new Error('夹具句柄不存在或已关闭'), { code: 'DOCUMENT_NOT_FOUND', retryable: false });
  }
  return found;
}

function envelope(kind, value) {
  return { kind, value, diagnostics: [] };
}

module.exports = {
  __calls: calls,
  coreVersion() {
    return '0.1.0';
  },
  coreAbiVersion() {
    return 1;
  },
  openDocument(path) {
    const found = documentOfPath(path, 'openDocument');
    if (found !== null && found.kind !== 'card') {
      return fail('DOCUMENT_FORMAT_UNKNOWN', '自动识别入口收到夹具不认识的格式');
    }
    return openAt('openDocument', path);
  },
  openCard: openAt.bind(null, 'openCard'),
  openBox(path) {
    return openAt('openBox', path);
  },
  documentMetadata(handle) {
    try {
      requireHandle(handle, 'documentMetadata');
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(envelope('card', JSON.parse(JSON.stringify(metadata))));
  },
  documentStructure(handle) {
    try {
      requireHandle(handle, 'documentStructure');
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve(envelope('card', JSON.parse(JSON.stringify(structure))));
  },
  documentContent(handle, nodeId) {
    try {
      requireHandle(handle, 'documentContent');
    } catch (error) {
      return Promise.reject(error);
    }
    const value = contents.get(nodeId);
    if (value === undefined) {
      return fail('DOCUMENT_STRUCTURE_INVALID', `夹具不存在内容节点：${String(nodeId)}`);
    }
    return Promise.resolve(envelope('card', JSON.parse(JSON.stringify(value))));
  },
  documentEntries(handle) {
    try {
      requireHandle(handle, 'documentEntries');
    } catch (error) {
      return Promise.reject(error);
    }
    return fail('DOCUMENT_PART_UNSUPPORTED', '卡片句柄不支持条目分页');
  },
  documentReadResource(handle) {
    try {
      requireHandle(handle, 'documentReadResource');
    } catch (error) {
      return Promise.reject(error);
    }
    return fail('DOCUMENT_STRUCTURE_INVALID', '夹具不提供资源字节窗口');
  },
  documentValidate(handle) {
    try {
      requireHandle(handle, 'documentValidate');
    } catch (error) {
      return Promise.reject(error);
    }
    return fail('DOCUMENT_STRUCTURE_INVALID', '夹具不提供严格校验报告');
  },
  buildDocumentView(handle, session) {
    let found;
    try {
      found = requireHandle(handle, 'buildDocumentView');
    } catch (error) {
      return Promise.reject(error);
    }
    // 任务 #108（刀5 段A）：按 §6.6 CardRenderView 冻结形状从登记表投影真实视图，
    // 使组合根端到端用例能走完「通道 → 构建器 → 加载闸 → 本导出」全链（含数值会话
    // 入参消费）；基线修订恒为 0（磁盘基线，无会话覆盖层的原生侧语义由后端承载）。
    calls[calls.length - 1].args.session = session;
    if (found.kind !== 'card') {
      return fail('DOCUMENT_STRUCTURE_INVALID', '夹具仅登记卡片视图');
    }
    const contentNodes = structure.structure.map((entry) => ({
      node_id: entry.id,
      card_type: entry.type,
      content: JSON.parse(JSON.stringify(contents.get(entry.id) ?? {})),
    }));
    return Promise.resolve({
      kind: 'card',
      revision: 0,
      card_id: found.documentId,
      name: metadata.name,
      chip_standards_version: metadata.chip_standards_version,
      cover_ratio: '1:1',
      tags: [],
      cover: { entry: structure.structure[0].id, ratio: '1:1' },
      content_nodes: contentNodes,
    });
  },
  documentClose(handle) {
    const found = opened.get(handle);
    record('documentClose', { path: found === undefined ? '<伪造句柄>' : found.path });
    opened.delete(handle);
    return Promise.resolve();
  },
  createCancelToken() {
    record('createCancelToken', {});
    return { nativeCancelTokenHandleBrand: 'chips-native.cancel-token' };
  },
  cancelTokenCancel() {
    record('cancelTokenCancel', {});
  },
  documentRevision(handle) {
    try {
      requireHandle(handle, 'documentRevision');
    } catch (error) {
      return Promise.reject(error);
    }
    return Promise.resolve({
      source: { kind: 'directory', members: revisionMembers() },
      chipStandardsVersion: '1.0.0',
      indexDigest: 'fixture-index-digest',
    });
  },
  documentLayoutConfig(handle) {
    try {
      requireHandle(handle, 'documentLayoutConfig');
    } catch (error) {
      return Promise.reject(error);
    }
    return fail('DOCUMENT_PART_UNSUPPORTED', '卡片句柄不支持布局配置切片');
  },
};
