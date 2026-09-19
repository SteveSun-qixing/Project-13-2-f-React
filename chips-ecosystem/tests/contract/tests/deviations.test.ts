/**
 * 偏差注入用例：每个注入都必须让对应检查失败（检出预期偏差）。
 *
 * 覆盖两类偏差：
 * - 文档偏差：内存修改真实文档文本，驱动完整「解析 → 比对」管线；
 * - 实现偏差：在内存模型中注入未登记/漂移的 ID、权限、事件与错误码。
 *
 * 快照类偏差使用 `deepDiff` 对「真实模型 vs 偏差模型」直接断言差异，
 * 不写回任何快照文件。
 */

import { describe, it } from 'vitest';

import { appendUnknownCapability, appendUnknownErrorCode, appendUnknownPalCode, createDeviatedReader, loadDeviatedDocModels, removeHeadingSection, removeLineContaining, replaceOnce, driftCodeCapabilityPermissions, driftEventVisibility, appendUnknownEvent, removeCodeCapability } from '../src/fixtures/deviations.js';
import { checkCapabilities } from '../src/check/capabilities.js';
import { checkErrors } from '../src/check/errors.js';
import { checkEvents } from '../src/check/events.js';
import { checkFrameProtocol } from '../src/check/frame.js';
import { checkRoles } from '../src/check/roles.js';
import { CAPABILITY_SOURCE, EVENT_RESERVED_DOMAIN_SOURCE } from '../src/docs/sources.js';
import { loadDocModels } from '../src/docs/index.js';
import { deepDiff, stableStringify } from '../src/snapshot.js';
import {
  buildEventSnapshotData,
  buildFrameSnapshotData,
  buildRoleSnapshotData,
} from '../src/snapshot-data.js';
import { DOCS_ROOT } from '../src/paths.js';
import { formatViolations, type ContractViolation } from '../src/violations.js';
import { bridgeCode, bridgeRetryable, docs, hostCode } from './helpers.js';

const EVENT_DOC_VISIBILITY = '05-接口与契约/05.09-05-事件契约规范-四、标准事件-4.5 配置.md';
const EVENT_DOC_DOCUMENT = '05-接口与契约/05.06-05-事件契约规范-四、标准事件-4.2 文档.md';
const BRIDGE_ERROR_DOC = '01-架构设计/01-子系统设计/02.09-02-Bridge三层设计-九、错误归一.md';
const ROLE_APP_DOC = '05-接口与契约/07.02-07-应用插件接口-二、接口总览.md';
const SDK_EXPORT_DOC = '05-接口与契约/02.02-02-SDK-API规范-二、导出入口.md';
const FRAME_DOC = '01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md';

function expectViolation(
  violations: readonly ContractViolation[],
  code: string,
  subjectIncludes?: string,
): void {
  const matched = violations.filter(
    (item) => item.code === code && (subjectIncludes === undefined || item.subject.includes(subjectIncludes)),
  );
  if (matched.length === 0) {
    throw new Error(
      `注入偏差未被检出：预期 ${code}${subjectIncludes === undefined ? '' : `（subject 含 ${subjectIncludes}）`}\n实际偏差：\n${formatViolations(violations)}`,
    );
  }
}

describe('能力表偏差注入', () => {
  it('删除登记行 → 报告文档未登记能力（实现侧多余）与计数漂移', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: CAPABILITY_SOURCE.file,
        description: '删除 file:read 登记行',
        mutate: (text) => removeLineContaining(text, '| `file:read` / `file:list` / `file:watch` |'),
      },
    ]);
    const violations = checkCapabilities({
      docs: deviated.capabilities,
      docPermissions: deviated.permissions,
      code: bridgeCode(),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_EXTRA', 'file:read');
    expectViolation(violations, 'CONTRACT_CAPABILITY_COUNT');
  });

  it('修改权限列 → 报告权限映射不一致', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: CAPABILITY_SOURCE.file,
        description: 'file:read 权限改为 filesystem:write',
        mutate: (text) =>
          replaceOnce(
            text,
            '| `file:read` / `file:list` / `file:watch` | `filesystem:read` |',
            '| `file:read` / `file:list` / `file:watch` | `filesystem:write` |',
          ),
      },
    ]);
    const violations = checkCapabilities({
      docs: deviated.capabilities,
      docPermissions: deviated.permissions,
      code: bridgeCode(),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_PERMISSIONS', 'file:read');
  });

  it('修改计数声明 → 计数断言失败', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: CAPABILITY_SOURCE.file,
        description: '计数改为 59',
        mutate: (text) => replaceOnce(text, '本表的 60 项计数', '本表的 59 项计数'),
      },
    ]);
    const violations = checkCapabilities({
      docs: deviated.capabilities,
      docPermissions: deviated.permissions,
      code: bridgeCode(),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_COUNT');
  });

  it('实现侧追加未登记能力 → 报告多余能力', () => {
    const violations = checkCapabilities({
      docs: docs().capabilities,
      docPermissions: docs().permissions,
      code: appendUnknownCapability(bridgeCode(), 'phantom:capability'),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_EXTRA', 'phantom:capability');
  });

  it('实现侧移除能力 → 报告能力缺失', () => {
    const violations = checkCapabilities({
      docs: docs().capabilities,
      docPermissions: docs().permissions,
      code: removeCodeCapability(bridgeCode(), 'file:read'),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_MISSING', 'file:read');
  });

  it('实现侧权限映射漂移 → 报告不一致', () => {
    const violations = checkCapabilities({
      docs: docs().capabilities,
      docPermissions: docs().permissions,
      code: driftCodeCapabilityPermissions(bridgeCode(), 'file:read', ['filesystem:write']),
    });
    expectViolation(violations, 'CONTRACT_CAPABILITY_PERMISSIONS', 'file:read');
  });
});

describe('事件表偏差注入', () => {
  it('删除事件章节 → 报告文档未登记事件（实现侧多余）与逐域计数漂移', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: '05-接口与契约/05.05-05-事件契约规范-四、标准事件-4.1 插件生命周期.md',
        description: '删除 plugin:loaded 章节',
        mutate: (text) => removeHeadingSection(text, 'plugin:loaded'),
      },
    ]);
    const violations = checkEvents({ docs: deviated.events, code: bridgeCode() });
    expectViolation(violations, 'CONTRACT_EVENT_EXTRA', 'plugin:loaded');
    expectViolation(violations, 'CONTRACT_EVENT_DOMAIN_COUNT', 'plugin');
  });

  it('修改可见性 → 报告可见性不一致', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: EVENT_DOC_VISIBILITY,
        description: 'config:changed 可见性改为公开',
        mutate: (text) =>
          replaceOnce(
            text,
            '可见性：`platform` 命名空间的事件对持有 `config:read:platform` 的插件可见；`plugins.<pluginId>` 命名空间的事件只对该插件与平台可见。',
            '可见性：公开；`platform` 命名空间的事件对持有 `config:read:platform` 的插件可见；`plugins.<pluginId>` 命名空间的事件只对该插件与平台可见。',
          ),
      },
    ]);
    const violations = checkEvents({ docs: deviated.events, code: bridgeCode() });
    expectViolation(violations, 'CONTRACT_EVENT_VISIBILITY', 'config:changed');
  });

  it('不可归一的可见性表述 → 报告未知判定键', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: EVENT_DOC_VISIBILITY,
        description: 'config:changed 可见性改为无法归一表述',
        mutate: (text) =>
          replaceOnce(
            text,
            '可见性：`platform` 命名空间的事件对持有 `config:read:platform` 的插件可见；`plugins.<pluginId>` 命名空间的事件只对该插件与平台可见。',
            '可见性：按订阅关系决定。',
          ),
      },
    ]);
    const violations = checkEvents({ docs: deviated.events, code: bridgeCode() });
    expectViolation(violations, 'CONTRACT_EVENT_VISIBILITY_UNKNOWN', 'config:changed');
  });

  it('保留域计数漂移 → 逐域计数失败', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: EVENT_RESERVED_DOMAIN_SOURCE.file,
        description: 'plugin 域计数改为 8',
        mutate: (text) => replaceOnce(text, '4.1（7 个）', '4.1（8 个）'),
      },
    ]);
    const violations = checkEvents({ docs: deviated.events, code: bridgeCode() });
    expectViolation(violations, 'CONTRACT_EVENT_DOMAIN_COUNT', 'plugin');
  });

  it('实现侧追加未登记事件 → 报告多余事件', () => {
    const violations = checkEvents({
      docs: docs().events,
      code: appendUnknownEvent(bridgeCode(), 'phantom:event'),
    });
    expectViolation(violations, 'CONTRACT_EVENT_EXTRA', 'phantom:event');
  });

  it('实现侧可见性漂移 → 报告可见性不一致', () => {
    const violations = checkEvents({
      docs: docs().events,
      code: driftEventVisibility(bridgeCode(), 'config:changed', 'public'),
    });
    expectViolation(violations, 'CONTRACT_EVENT_VISIBILITY', 'config:changed');
  });

  it('事件 payload 漂移 → 事件快照必须出现差异', () => {
    const baseline = buildEventSnapshotData(docs().events);
    const deviated = loadDeviatedDocModels([
      {
        file: EVENT_DOC_DOCUMENT,
        description: 'document:opened title 类型改为 number',
        mutate: (text) =>
          replaceOnce(
            text,
            '| `title` | string | 是 | 文档标题（metadata 声明） |',
            '| `title` | number | 是 | 文档标题（metadata 声明） |',
          ),
      },
    ]);
    const actual = buildEventSnapshotData(deviated.events);
    if (deepDiff(baseline, actual).length === 0) {
      throw new Error('注入的 payload 偏差未被快照检出');
    }
  });
});

describe('错误码表偏差注入', () => {
  it('文档错误码改名 → 集合差异被检出', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: BRIDGE_ERROR_DOC,
        description: 'BRIDGE_TIMEOUT 改名为 BRIDGE_TIMEOUT_V2',
        mutate: (text) => replaceOnce(text, '| `BRIDGE_TIMEOUT` |', '| `BRIDGE_TIMEOUT_V2` |'),
      },
    ]);
    const violations = checkErrors({
      docs: deviated.errors,
      code: bridgeCode(),
      host: hostCode(),
      bridgeRetryable: bridgeRetryable(),
    });
    expectViolation(violations, 'CONTRACT_ERROR_DOMAIN_MISSING', 'BRIDGE_TIMEOUT_V2');
    expectViolation(violations, 'CONTRACT_ERROR_DOMAIN_EXTRA', 'Bridge 通道错误码:BRIDGE_TIMEOUT');
  });

  it('实现侧追加未登记错误码 → 报告未登记', () => {
    const violations = checkErrors({
      docs: docs().errors,
      code: appendUnknownErrorCode(bridgeCode(), 'BRIDGE_PHANTOM'),
      host: hostCode(),
      bridgeRetryable: bridgeRetryable(),
    });
    expectViolation(violations, 'CONTRACT_ERROR_UNREGISTERED', 'BRIDGE_PHANTOM');
  });

  it('实现侧追加未登记 PAL 错误码 → 报告未登记', () => {
    const violations = checkErrors({
      docs: docs().errors,
      code: bridgeCode(),
      host: appendUnknownPalCode(hostCode(), 'PAL_PHANTOM'),
      bridgeRetryable: bridgeRetryable(),
    });
    expectViolation(violations, 'CONTRACT_ERROR_UNREGISTERED', 'PAL_PHANTOM');
  });
});

describe('角色接口与 SDK 导出偏差注入', () => {
  it('删除角色接口成员 → 角色快照必须出现差异', () => {
    const baseline = buildRoleSnapshotData(docs().roles);
    const deviated = loadDeviatedDocModels([
      {
        file: ROLE_APP_DOC,
        description: '删除 IAppPlugin.handleCommand',
        mutate: (text) => removeLineContaining(text, 'handleCommand?(command: string, args: unknown)'),
      },
    ]);
    const actual = buildRoleSnapshotData(deviated.roles);
    if (deepDiff(baseline, actual).length === 0) {
      throw new Error('注入的角色成员偏差未被快照检出');
    }
  });

  it('删除 SDK 角色导出行 → 报告入口缺失', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: SDK_EXPORT_DOC,
        description: '删除「插件角色」导出行',
        mutate: (text) => removeLineContaining(text, '| 插件角色 |'),
      },
    ]);
    const violations = checkRoles({ docs: deviated.roles, sdk: deviated.sdk });
    expectViolation(violations, 'CONTRACT_SDK_ROLE_ENTRY_MISSING', 'IAppPlugin');
  });
});

describe('帧协议偏差注入', () => {
  it('消息方向漂移 → 报告方向不一致', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: FRAME_DOC,
        description: 'frame:height 方向改为父 → 子',
        mutate: (text) => replaceOnce(text, '| `frame:height` | 子 → 父 |', '| `frame:height` | 父 → 子 |'),
      },
    ]);
    const violations = checkFrameProtocol({ frame: deviated.frame });
    expectViolation(violations, 'CONTRACT_FRAME_DIRECTION', 'frame:height');
  });

  it('协议版本漂移 → 帧协议快照必须出现差异', () => {
    const baseline = buildFrameSnapshotData(docs().frame);
    const deviated = loadDeviatedDocModels([
      {
        file: FRAME_DOC,
        description: 'FRAME_PROTOCOL 版本改为 chips-frame/2',
        mutate: (text) => replaceOnce(text, "const FRAME_PROTOCOL = 'chips-frame/1';", "const FRAME_PROTOCOL = 'chips-frame/2';"),
      },
    ]);
    const actual = buildFrameSnapshotData(deviated.frame);
    if (deepDiff(baseline, actual).length === 0) {
      throw new Error('注入的帧协议版本偏差未被快照检出');
    }
  });

  it('SDK 导出结构偏差：删除值导出 → 检查报告差异', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: SDK_EXPORT_DOC,
        description: '删除 chips 值导出行',
        mutate: (text) => removeLineContaining(text, '| `chips` | 常量 |'),
      },
    ]);
    const baseline = stableStringify(deviated.sdk.values);
    if (baseline === stableStringify(docs().sdk.values)) {
      throw new Error('注入的 SDK 值导出偏差未被解析结果反映');
    }
    if (deviated.sdk.values.some((value) => value.name === 'chips')) {
      throw new Error('偏差注入未生效：chips 仍在导出清单');
    }
  });
});

describe('偏差注入夹具自身', () => {
  it('目标文本不存在时必须抛错（防止静默失效）', () => {
    let thrown = false;
    try {
      replaceOnce('原文', '不存在的片段', '替换');
    } catch {
      thrown = true;
    }
    if (!thrown) {
      throw new Error('replaceOnce 未在目标缺失时抛错');
    }
    if (!DOCS_ROOT.endsWith('薯片生态文档库')) {
      throw new Error(`文档库根路径异常：${DOCS_ROOT}`);
    }
  });

  it('偏差读取器未命中偏差的文件与真实文档一致', () => {
    const reader = createDeviatedReader([
      { file: CAPABILITY_SOURCE.file, description: '空操作', mutate: (text) => text },
    ]);
    const fromReader = loadDocModels(reader).capabilities.capabilities.length;
    const fromReal = loadDocModels(createDeviatedReader([])).capabilities.capabilities.length;
    if (fromReader !== fromReal) {
      throw new Error('空操作偏差改动了文档解析结果');
    }
  });
});
