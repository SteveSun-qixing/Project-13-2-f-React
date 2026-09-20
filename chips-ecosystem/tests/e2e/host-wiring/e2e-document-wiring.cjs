/**
 * E2E 文档能力接线模块（金链路刀7 / 任务 #114 段B；工单 036 §六「测试注入仅限 tests/
 * 交付面」在真实进程链路上的承载）。
 *
 * 由宿主 E2E 入口 `dist/main/e2e-app.js` 经环境变量
 * `CHIPS_E2E_DOCUMENT_WIRING_MODULE`（本文件绝对路径）装载，交付组合根文档装载段
 * （`createDocumentCapabilityWiring`）的两项注入：
 *
 * - `guardSessionSource`：Bridge 会话注册表快照视图的测试替身——按壳侧真实会话标识
 *   词法（`session:<webContentsId>:main`）枚举存活 webContents 并镜像平台会话
 *   供给器的全量授权（`['*']`，`createPlatformSessionProvisioner` 同口径）。
 *   正式快照提供者随内核会话表接管接入（工单 025 剩余项 / §5.5–§5.7），本替身
 *   仅存在于 tests/ 面，不进生产组合根。
 * - `resourcePorts`（scope / storage）：W3 chips-resource 正式适配器的 tests/ 面替身——
 *   受控工作区根（`CHIPS_E2E_DOCUMENT_ROOT`）内的归档态单文件映射为受管引用
 *   （`chips-resource://e2e-workspace/<编码文件名>`，作用域段符合资源 URI 词法）。
 *   `commit`（受控提交）与 `listMembers`（目录态枚举）不在 W2 金链路可达面内，
 *   以登记码 `RESOURCE_NOT_SUPPORTED` 诚实拒绝——保存落盘权威归 W3（金链路刀6）。
 *
 * 解析域无替身：`chips-native.node`（34 项导出）由装载段缺省路径经 17 必备名
 * fail-closed 闸真实装载，本模块不触碰。
 */

'use strict';

const path = require('node:path');
const fsPromises = require('node:fs/promises');

/** 受控工作区根环境变量（绝对路径；scope 替身的来源边界）。 */
const DOCUMENT_ROOT_ENV = 'CHIPS_E2E_DOCUMENT_ROOT';
/** E2E 受管作用域段（符合 `chips-resource://` 作用域段词法与工单036 登记命名前缀）。 */
const MANAGED_SCOPE = 'e2e-workspace';

/**
 * 以登记 `RESOURCE_*` 码构造端口失败（`IDocumentScopePort` / `IDocumentStoragePort`
 * 头注口径：失败以已登记码抛出，能力层原样透传；`isChipsError` 三判据形状满足
 * `@chips/bridge` `normalizeError` 还原，不触达打包依赖）。
 */
function resourceFailure(code, message) {
  const error = new Error(message);
  error.code = code;
  error.retryable = false;
  return error;
}

/** 把输入来源归一为本地绝对路径（仅受理 `file://` 与 POSIX 绝对路径；其余拒绝）。 */
function localPathFromSource(source) {
  if (typeof source !== 'string' || source.length === 0) {
    return null;
  }
  if (source.startsWith('file://')) {
    const rest = source.slice('file://'.length);
    // 本 E2E 面不承载远端主机名形态（`file://host/path` 拒绝）。
    if (rest.startsWith('/')) {
      return decodeURIComponent(rest);
    }
    const winMatch = /^\/([A-Za-z]:[/\\].*)$/.exec(rest);
    if (winMatch !== null) {
      return decodeURIComponent(winMatch[1]);
    }
    return null;
  }
  if (source.startsWith('/')) {
    return source;
  }
  return null;
}

/** 作用域端口替身：受控工作区根内归档态单文件 → 受管引用映射 + 作用域登记簿记。 */
function createScopePort() {
  /** documentId → { managedUri, kind } 登记簿记（观察面，不解释语义）。 */
  const registry = new Map();
  return {
    async normalizeSource(source) {
      const root = process.env[DOCUMENT_ROOT_ENV];
      if (root === undefined || root.length === 0) {
        throw resourceFailure(
          'RESOURCE_PATH_INVALID',
          'E2E 文档受控工作区根未配置（CHIPS_E2E_DOCUMENT_ROOT 缺位）'
        );
      }
      const local = localPathFromSource(source);
      if (local === null) {
        throw resourceFailure('RESOURCE_PATH_INVALID', 'E2E 作用域仅受理 file:// 来源与绝对路径');
      }
      const localPath = path.resolve(local);
      const rootPath = path.resolve(root);
      const relative = path.relative(rootPath, localPath);
      if (relative.length === 0 || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw resourceFailure('RESOURCE_PERMISSION_DENIED', 'E2E 文档来源越出受控工作区根目录');
      }
      let stats = null;
      try {
        stats = await fsPromises.stat(localPath);
      } catch {
        throw resourceFailure('RESOURCE_NOT_FOUND', 'E2E 文档来源不存在或不可达');
      }
      if (!stats.isFile()) {
        throw resourceFailure(
          'RESOURCE_NOT_SUPPORTED',
          'E2E W2 面仅受理归档态单文件（目录态随 W3 资源管理器开通）'
        );
      }
      const extension = path.extname(localPath).toLowerCase();
      if (extension !== '.card' && extension !== '.box') {
        throw resourceFailure('RESOURCE_NOT_SUPPORTED', 'E2E W2 面仅受理 .card / .box 归档文档');
      }
      return {
        managedUri: `chips-resource://${MANAGED_SCOPE}/${encodeURIComponent(path.basename(localPath))}`,
        localPath,
        form: 'archive',
      };
    },
    async registerScope(input) {
      registry.set(input.documentId, { managedUri: input.managedUri, kind: input.kind });
    },
  };
}

/** 受控写端口替身：仅摘要复算读臂为真实现；提交与目录枚举诚实拒绝（保存归 W3，刀6）。 */
function createStoragePort() {
  return {
    async commit() {
      throw resourceFailure(
        'RESOURCE_NOT_SUPPORTED',
        '受控提交路径归 W3 chips-resource（金链路刀6）；本替身不承载落盘'
      );
    },
    async listMembers() {
      throw resourceFailure(
        'RESOURCE_NOT_SUPPORTED',
        '目录态成员枚举不在 E2E W2 归档面内（保存与目录态摘要复算归 W3）'
      );
    },
    readFileBytes(localPath) {
      return fsPromises.readFile(localPath);
    },
  };
}

/**
 * 守卫会话快照提供者替身：逐调用枚举存活 webContents 的主框架会话身份，镜像平台会话
 * 供给器的全量授权口径（`['*']` 通配，`08-权限系统设计` §7.2 判定本体不变）。
 *
 * @remarks 会话标识词法与壳侧运行时一致（`session:<webContentsId>:<frameLeg>`）；主框架
 * 在壳侧路由的归一口径为 `frameId === null` → `main`，而 `resolveIpcSession` 读取
 * `event.senderFrame.routingId` 的实值随 Electron 运行期形态，故本替身对**同一物理主框架
 * 身份**交付两种在册词法投影（`:main` 与 `:mainFrame.routingId`），不构成跨窗口授权。
 * 内核会话表接管后本注入位切换到正式快照提供者（判定适配器零改动）。
 */
function createGuardSessionSource() {
  return () => {
    const { webContents } = require('electron');
    const snapshots = [];
    for (const contents of webContents.getAllWebContents()) {
      if (typeof contents.isDestroyed === 'function' && contents.isDestroyed()) {
        continue;
      }
      const grantedPermissions = new Set(['*']);
      snapshots.push({
        sessionId: `session:${contents.id}:main`,
        state: 'active',
        grantedPermissions,
      });
      const mainFrame = contents.mainFrame;
      const routingId = mainFrame === undefined || mainFrame === null ? null : mainFrame.routingId;
      if (typeof routingId === 'number' && Number.isInteger(routingId)) {
        snapshots.push({
          sessionId: `session:${contents.id}:${String(routingId)}`,
          state: 'active',
          grantedPermissions,
        });
      }
    }
    return snapshots;
  };
}

/**
 * 工厂：交付组合根文档装载段的两项注入（守卫快照来源 + 资源侧端口）。
 *
 * @returns `{ guardSessionSource, resourcePorts: { scope, storage } }`。
 */
function createE2EDocumentWiring() {
  return {
    guardSessionSource: createGuardSessionSource(),
    resourcePorts: {
      scope: createScopePort(),
      storage: createStoragePort(),
    },
  };
}

module.exports = {
  createE2EDocumentWiring,
  DOCUMENT_ROOT_ENV,
  MANAGED_SCOPE,
};
