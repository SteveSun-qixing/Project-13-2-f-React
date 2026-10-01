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
 *   `scope` 五成员与生产端口形状逐一对齐（`normalizeSource` / `registerScope` 回执
 *   `nativeSession` / `unregisterScope`，工单036 波 A2b-α 端口扩员 + 波 A2b-β 回执形与
 *   释放臂接线；`localPathOf` / `scopeRootOf`，工单036 波 B2 #241 点位三消费臂端口
 *   扩员的 tests/ 面随动——工单070 收口，宿主侧交付形状探针见
 *   `packages/host/src/main/e2e-app.ts`）：
 *   - `localPathOf(managedUri, nativeSession)`：记录存续期的本地路径单源取回（点位三
 *     正向消费臂）。宿主文档服务自此不再自存 `localPath`（写入链指纹复查、序列化、
 *     落盘提交的路径入参全部现取），本替身在归一时把路径事实入在册账、取回时核验
 *     会话绑定闸（会话未绑定 `RESOURCE_PERMISSION_DENIED`、作用域不在册
 *     `RESOURCE_NOT_FOUND`，与生产适配器/端口头注登记码同面）。
 *   - `scopeRootOf(managedUri)`：受管引用的资源作用域根（`chips-resource://<scope>/`）
 *     的在册账单源查询（同步）；未在册返回 `null`，调用方据此如实拒收（卡片窗口装载
 *     投递的 `resourceBase` 口径，服务不再词法切片自算作用域根）。
 *   `commit`（受控提交）与 `listMembers`（目录态枚举）不在 W2 金链路可达面内，
 *   以登记码 `RESOURCE_NOT_SUPPORTED` 诚实拒绝——保存落盘权威归 W3（金链路刀6）。
 *
 * 解析域无替身：`chips-native.node` 由装载段缺省路径经解析域必备名 fail-closed 闸
 * 真实装载（必备名与导出面权威清单见
 * `packages/host/src/capabilities/document/adapters/native-parser-module.ts`），本模块不触碰。
 */

'use strict';

const path = require('node:path');
const fsPromises = require('node:fs/promises');

/** 受控工作区根环境变量（绝对路径；scope 替身的来源边界）。 */
const DOCUMENT_ROOT_ENV = 'CHIPS_E2E_DOCUMENT_ROOT';
/** E2E 受管作用域段（符合 `chips-resource://` 作用域段词法与工单036 登记命名前缀）。 */
const MANAGED_SCOPE = 'e2e-workspace';
/** 受管引用协议头（《06.02》§2.1 authority 段 = scope；与生产适配器同一字面）。 */
const MANAGED_URI_PREFIX = 'chips-resource://';

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

/**
 * 作用域端口替身：受控工作区根内归档态单文件 → 受管引用映射 + 作用域在册账簿记。
 *
 * @remarks 在册账以受管引用为键（生产 `DocumentScopeLedger` 同型的单源簿记形态）：
 * `normalizeSource` 归一成功即入账（挂载前置事实），`registerScope` 在账上挂载
 * （登记 `nativeSession`），`unregisterScope` 随记录驱逐销账（销账后 `scopeRootOf`
 * 返回 `null`、`localPathOf` 按 `RESOURCE_NOT_FOUND` 拒绝，与生产适配器「已随注销
 * 销账的引用」口径一致）。路径事实只在归一跳入账一次，此后记录存续期一律经
 * `localPathOf` 现取——替身不随宿主记录面缓存路径（波 B2 消费面「无双份事实源」
 * 在 tests/ 面的同型落实）。
 */
function createScopePort() {
  /**
   * managedUri → { scope, localPath, kind, mounted } 在册账。
   *
   * - `scope`：归一时合入账的作用域事实（本替身单一受管作用域 `e2e-workspace`），
   *   `scopeRootOf` 只从该事实合形基址，不做词法切片派生。
   * - `kind`：归一时按扩展名派生的种类提示（生产 `kindFromPackageName` 同位）。
   * - `mounted`：`{ documentId, nativeSession } | null`——挂载臂簿记；
   *   `nativeSession` 取值口径见下方 `registrationSeq` 头注。
   */
  const ledger = new Map();
  /**
   * 替身自有的登记序号（**面外独立口径**，裁决I-② 同型：替身面不随生产裁定翻正）。
   *
   * 生产路径的原生数值会话唯一来源是正式 scope 适配器对 `resourceOpenSession` 的返回值
   * （`packages/host/src/capabilities/document/adapters/scope-adapter.ts`，工单036 波 A2b-β
   * 已把记录面字段的源头翻正为该回执，本替身不触达原生会话面）。本序号只在 E2E 进程内
   * 充当记录面回执的**在册登记凭号**（视图构建臂只把它当关联号消费，原生侧不做会话归属
   * 校验），不构成生产语义、也不产生第二注销入口；幂等复用臂（同文档标识同种类重登记）
   * 回执同一序号，与生产适配器「回执既有活绑定的同一原生会话」窄形同构。
   */
  let registrationSeq = 0;
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
      const managedUri = `${MANAGED_URI_PREFIX}${MANAGED_SCOPE}/${encodeURIComponent(path.basename(localPath))}`;
      if (!ledger.has(managedUri)) {
        // 归一入账（幂等：同源再归一不重置既有挂载簿记，生产「账目在位即复用」同型）。
        ledger.set(managedUri, {
          scope: MANAGED_SCOPE,
          localPath,
          kind: extension === '.card' ? 'card' : 'box',
          mounted: null,
        });
      }
      return {
        managedUri,
        localPath,
        form: 'archive',
      };
    },
    async registerScope(input) {
      const entry = ledger.get(input.managedUri);
      if (entry === undefined) {
        // 归一前置闸（生产适配器同码同形）：未经 `normalizeSource` 入账的受管引用不挂载。
        throw resourceFailure(
          'RESOURCE_INVALID_URI',
          '作用域注册缺少归一前置（managedUri 未经 normalizeSource 归一）'
        );
      }
      if (entry.mounted !== null) {
        if (entry.mounted.documentId === input.documentId && entry.kind === input.kind) {
          // 幂等复用臂（窄形）：活绑定在位且同 owner（构造恒等）→ 回执既有登记序号。
          return { nativeSession: entry.mounted.nativeSession };
        }
        throw resourceFailure(
          'RESOURCE_ALREADY_EXISTS',
          '同一受管引用已绑定不同文档标识或种类（真冲突，禁抢占）'
        );
      }
      registrationSeq += 1;
      entry.mounted = { documentId: input.documentId, nativeSession: registrationSeq };
      // 端口回执形（工单036 波 A2b-β）：`nativeSession` 由适配器回执交付、服务原样落记录面；
      // 本替身的取值口径见上方 `registrationSeq` 头注（面外独立）。
      return { nativeSession: registrationSeq };
    },
    async unregisterScope(input) {
      const entry = ledger.get(input.managedUri);
      if (entry === undefined) {
        // 未在册 = 本替身从未建立该作用域（重复注销/未挂载文档）：已达口径收口，
        // 禁造第二注销通道（生产第 6 阶段 `RESOURCE_NOT_FOUND` 已达同型）。
        return;
      }
      // 两拍次序中的注销臂（INV-2）：本替身不触达原生挂载与会话，随记录驱逐销账即收口；
      // 生产路径的真两拍（`resourceUnregisterScope` → `resourceCloseSession`）在正式适配器内。
      ledger.delete(input.managedUri);
    },
    async localPathOf(managedUri, nativeSession) {
      const entry = ledger.get(managedUri);
      if (entry === undefined) {
        // 作用域不在册（未经归一、或已随注销销账的陈旧绑定形）：同生产适配器登记码。
        throw resourceFailure(
          'RESOURCE_NOT_FOUND',
          '受管引用未在本作用域适配器在册（无登记作用域可供换算）'
        );
      }
      if (entry.mounted === null || entry.mounted.nativeSession !== nativeSession) {
        // 会话绑定闸（点位三正向的归属门，生产由核心 `out_of_scope` 判定的替身镜像）：
        // 未挂载或回执会话与登记不符即拒绝，路径事实不交付给未绑定会话。
        throw resourceFailure(
          'RESOURCE_PERMISSION_DENIED',
          '会话未绑定该作用域（归属闸口径，路径换算拒绝）'
        );
      }
      return entry.localPath;
    },
    scopeRootOf(managedUri) {
      const entry = ledger.get(managedUri);
      // 在册账单源查询：在册（归一入账、未销账）即以入账作用域事实合形基址；
      // 未在册返回 `null`，调用方据此如实拒收、不猜测基址（端口头注口径）。
      return entry === undefined ? null : `${MANAGED_URI_PREFIX}${entry.scope}/`;
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
 * @returns `{ guardSessionSource, resourcePorts: { scope, storage } }`；scope 五成员与
 * storage 三成员构成宿主 E2E 入口交付形状闸（工单036 波 B2 #241 面）的完整交付集，
 * 形状随动锁见 `tests/e2e/tests/host-wiring.test.ts`。
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
