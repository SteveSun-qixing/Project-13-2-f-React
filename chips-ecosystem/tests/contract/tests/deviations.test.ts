/**
 * 偏差注入用例：每个注入都必须让对应检查失败（检出预期偏差）。
 *
 * 覆盖两类偏差：
 * - 文档偏差：内存修改真实文档文本，驱动完整「解析 → 比对」管线；
 * - 实现偏差：在内存模型中注入未登记/漂移的 ID、权限、事件与错误码。
 *
 * 快照类偏差使用 `deepDiff` 对「真实模型 vs 偏差模型」直接断言差异，
 * 不写回任何快照文件。
 *
 * 表格行锚一律走空格不敏感匹配（`removeLineContainingIgnoringSpacing` /
 * `replaceOnceIgnoringSpacing`）：文档库表格随时可能经生态 prettier 列宽归一，
 * 含空格整行锚会被列宽填充击碎（工单046 同根因判例）；锚点与排版解耦、
 * 与语义偏差（改名/删行/缺失）保持必红，见「prettier 展开形锚点双向臂锁测」。
 */

import { describe, it } from 'vitest';

import {
  appendUnknownCapability,
  appendUnknownErrorCode,
  appendUnknownPalCode,
  createDeviatedReader,
  loadDeviatedDocModels,
  removeHeadingSection,
  removeLineContaining,
  removeLineContainingIgnoringSpacing,
  replaceOnce,
  replaceOnceIgnoringSpacing,
  driftCodeCapabilityPermissions,
  driftEventVisibility,
  appendUnknownEvent,
  removeCodeCapability,
} from '../src/fixtures/deviations.js';
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
const FRAME_DOC =
  '01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md';

/** 按未转义 `|` 切分表格行为区段（保留转义 `\|`，与 src/markdown.ts 的切分口径一致）。 */
function splitTableCellSegments(line: string): string[] {
  const segments: string[] = [];
  let buffer = '';
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index] ?? '';
    if (char === '\\' && line[index + 1] === '|') {
      buffer += '\\|';
      index += 1;
      continue;
    }
    if (char === '|') {
      segments.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  segments.push(buffer);
  return segments;
}

/**
 * prettier 表格列宽展开形模拟器：对表格行（含分隔行）的每个单元格内容右侧补固定空格，
 * 复刻「列宽对齐只增空白、不动语义」的击碎面；围栏代码块与表格外行原样保留。
 * 仅供锚点双向臂锁测在内存中使用，不回写、不依赖真实文档当前排版。
 */
function padTableSpacing(text: string): string {
  let inFence = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence || !line.trim().startsWith('|')) {
        return line;
      }
      return splitTableCellSegments(line)
        .map((segment) => {
          const trimmed = segment.trim();
          if (trimmed === '') {
            return segment;
          }
          return ` ${trimmed}${' '.repeat(5)} `;
        })
        .join('|');
    })
    .join('\n');
}

function expectViolation(
  violations: readonly ContractViolation[],
  code: string,
  subjectIncludes?: string
): void {
  const matched = violations.filter(
    (item) =>
      item.code === code &&
      (subjectIncludes === undefined || item.subject.includes(subjectIncludes))
  );
  if (matched.length === 0) {
    throw new Error(
      `注入偏差未被检出：预期 ${code}${subjectIncludes === undefined ? '' : `（subject 含 ${subjectIncludes}）`}\n实际偏差：\n${formatViolations(violations)}`
    );
  }
}

describe('能力表偏差注入', () => {
  it('删除登记行 → 报告文档未登记能力（实现侧多余）与计数漂移', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: CAPABILITY_SOURCE.file,
        description: '删除 file:read 登记行',
        // 锚点随 4247b7914 落文后的表格列宽对齐（prettier padding）更新：
        // 旧锚「| …/ `file:watch` |」的收尾管道在补齐宽度的行内不再与单元格内容相邻；
        // 改用行内唯一子串定位整行，注入语义（删除该行）不变。
        mutate: (text) => removeLineContaining(text, '`file:read` / `file:list` / `file:watch`'),
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
        // 锚点随 4247b7914 落文后的整行 padding 更新：改用文档中首次出现即位于
        // file:read / file:list / file:watch 行的权限单元格 token 定位，注入语义
        // （该行权限列 read → write）不变；锚缺失时夹具自身抛错，不会静默失效。
        mutate: (text) => replaceOnce(text, '`filesystem:read`', '`filesystem:write`'),
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
        description: '计数改为 63',
        // 计数锚随 4247b7914 落文 60→64 随动（工单046 注册表随及波）；注入语义
        // （声明计数与实际登记数错开）不变。
        mutate: (text) => replaceOnce(text, '本表的 64 项计数', '本表的 63 项计数'),
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
            '可见性：公开；`platform` 命名空间的事件对持有 `config:read:platform` 的插件可见；`plugins.<pluginId>` 命名空间的事件只对该插件与平台可见。'
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
            '可见性：按订阅关系决定。'
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
        // 表格行锚取空格不敏感匹配（#168 解耦）：锚不再依赖单元格两侧的列宽填充形，
        // 改名/删行/单元格缺失等语义偏差形照样不命中、照样抛错，注入语义不变。
        mutate: (text) =>
          replaceOnceIgnoringSpacing(
            text,
            '| `title` | string | 是 | 文档标题（metadata 声明） |',
            '| `title` | number | 是 | 文档标题（metadata 声明） |'
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
        // 表格单元格锚取空格不敏感匹配（#168 解耦），列宽填充形与紧凑形同命中。
        mutate: (text) =>
          replaceOnceIgnoringSpacing(text, '| `BRIDGE_TIMEOUT` |', '| `BRIDGE_TIMEOUT_V2` |'),
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
        mutate: (text) =>
          removeLineContaining(text, 'handleCommand?(command: string, args: unknown)'),
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
        // 含空格整行锚改空格不敏感匹配（#168，工单046 同根因判例）：02.02 经生态
        // prettier 列宽归一后，旧锚「| 插件角色 |」的收尾空格必然与管道不相邻而失效；
        // 归一比较下，行列缺失/改名/整行删除照样不命中并抛错，注入语义与强度不变。
        mutate: (text) => removeLineContainingIgnoringSpacing(text, '| 插件角色 |'),
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
        // 表格方向列锚取空格不敏感匹配（#168 解耦），列宽填充形与紧凑形同命中。
        mutate: (text) =>
          replaceOnceIgnoringSpacing(
            text,
            '| `frame:height` | 子 → 父 |',
            '| `frame:height` | 父 → 子 |'
          ),
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
        mutate: (text) =>
          replaceOnce(
            text,
            "const FRAME_PROTOCOL = 'chips-frame/1';",
            "const FRAME_PROTOCOL = 'chips-frame/2';"
          ),
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
        // 含空格整行锚改空格不敏感匹配（#168，同「插件角色」行注记）。
        mutate: (text) => removeLineContainingIgnoringSpacing(text, '| `chips` | 常量 |'),
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

describe('prettier 展开形锚点双向臂锁测', () => {
  it('展开形模拟只动空白：02.02 列宽填充后 SDK 解析模型与真实文档逐项一致', () => {
    const real = createDeviatedReader([]).read(SDK_EXPORT_DOC);
    const padded = padTableSpacing(real);
    if (padded === real) {
      throw new Error('展开形模拟未生效：文本零变化');
    }
    if (padded.replace(/\s+/g, '') !== real.replace(/\s+/g, '')) {
      throw new Error('展开形模拟改动了非空白内容');
    }
    const paddedModels = loadDeviatedDocModels([
      { file: SDK_EXPORT_DOC, description: '展开形模拟（仅列宽填充）', mutate: padTableSpacing },
    ]);
    if (stableStringify(paddedModels.sdk) !== stableStringify(docs().sdk)) {
      throw new Error('表格列宽填充改变了 SDK 导出解析模型（展开形应零扰动）');
    }
  });

  it('展开形下删除「插件角色」行 → 入口缺失偏差仍被检出（空格不敏感锚仍绿）', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: SDK_EXPORT_DOC,
        description: '展开形注入：删除「插件角色」导出行',
        mutate: (text) =>
          removeLineContainingIgnoringSpacing(padTableSpacing(text), '| 插件角色 |'),
      },
    ]);
    const violations = checkRoles({ docs: deviated.roles, sdk: deviated.sdk });
    expectViolation(violations, 'CONTRACT_SDK_ROLE_ENTRY_MISSING', 'IAppPlugin');
  });

  it('展开形下删除 chips 值导出行 → 值清单偏差仍被解析反映', () => {
    const deviated = loadDeviatedDocModels([
      {
        file: SDK_EXPORT_DOC,
        description: '展开形注入：删除 chips 值导出行',
        mutate: (text) =>
          removeLineContainingIgnoringSpacing(padTableSpacing(text), '| `chips` | 常量 |'),
      },
    ]);
    if (stableStringify(deviated.sdk.values) === stableStringify(docs().sdk.values)) {
      throw new Error('展开形注入的 SDK 值导出偏差未被解析结果反映');
    }
    if (deviated.sdk.values.some((value) => value.name === 'chips')) {
      throw new Error('展开形偏差注入未生效：chips 仍在导出清单');
    }
  });

  it('语义偏差形仍红：行列改名、目标缺失时空格不敏感整行锚抛错', () => {
    const real = createDeviatedReader([]).read(SDK_EXPORT_DOC);
    const padded = padTableSpacing(real);
    const renamed = replaceOnceIgnoringSpacing(padded, '| 插件角色 |', '| 角色导出 |');
    let renamedThrows = false;
    try {
      removeLineContainingIgnoringSpacing(renamed, '| 插件角色 |');
    } catch {
      renamedThrows = true;
    }
    if (!renamedThrows) {
      throw new Error('行列改名后空格不敏感锚仍命中（判定强度下降）');
    }
    let missingThrows = false;
    try {
      removeLineContainingIgnoringSpacing(padded, '| 不存在的导出分类 |');
    } catch {
      missingThrows = true;
    }
    if (!missingThrows) {
      throw new Error('目标行缺失时空格不敏感锚未抛错（静默失效）');
    }
  });

  it('空格不敏感 replaceOnce：展开形命中、语义缺失抛错、锚不跨行', () => {
    const table = '| 错误码 | 说明 |\n| --- | --- |\n| `BRIDGE_TIMEOUT` | 请求超时 |\n';
    const paddedTable = padTableSpacing(table);
    if (paddedTable === table) {
      throw new Error('展开形模拟未生效');
    }
    const replaced = replaceOnceIgnoringSpacing(
      paddedTable,
      '| `BRIDGE_TIMEOUT` |',
      '| `BRIDGE_TIMEOUT_V2` |'
    );
    if (!replaced.includes('| `BRIDGE_TIMEOUT_V2` |') || !replaced.includes('请求超时')) {
      throw new Error('展开形单元格替换未命中或波及相邻列');
    }
    let missingThrows = false;
    try {
      replaceOnceIgnoringSpacing(replaced, '| `BRIDGE_TIMEOUT` |', '| X |');
    } catch {
      missingThrows = true;
    }
    if (!missingThrows) {
      throw new Error('改名后原锚仍命中（判定强度下降）');
    }
    let crossRowThrows = false;
    try {
      replaceOnceIgnoringSpacing(table, '| 错误码 | `BRIDGE_TIMEOUT` |', '| X |');
    } catch {
      crossRowThrows = true;
    }
    if (!crossRowThrows) {
      throw new Error('空格不敏感锚跨行命中（匹配域越界）');
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
