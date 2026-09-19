/**
 * E2E 骨架自检用的受控 Electron 主进程。
 *
 * 目的：在不依赖 W1-HOST 构建产物的前提下，验证 `tests/e2e/src` 的启动器与断言工具
 * 在真实 Electron + contextBridge + IPC 边界上可用。只实现断言工具触达的契约子集
 * （`system:info` / `window:list` / `document:*` 与 `chips-resource://fixture/...`），
 * 不解析 `.card` / `.box`、不承载产品渲染，不进入产品链路。
 *
 * 夹具数据唯一来源：`fixtures/manifest.json`（与产品级 `.card` / `.box` 同源）。
 */

const { createHash } = require('node:crypto');
const { app, BrowserWindow, ipcMain } = require('electron');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const fixtureRoot = path.resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(fixtureRoot, 'manifest.json'), 'utf8'));
const card = manifest.card;

const workspacePath = readWorkspaceSwitch(process.argv.slice(1));
const state = {
  source: null,
  revision: 0,
  contentText: card.inlineText,
  modifiedAt: '2026-09-19T00:00:00.000Z',
};

function readWorkspaceSwitch(argv) {
  for (const argument of argv) {
    if (argument.startsWith('--workspace=')) {
      const value = argument.slice('--workspace='.length);
      return value.length > 0 ? path.resolve(value) : null;
    }
  }
  return null;
}

function digestOfState() {
  return `sha256:${createHash('sha256').update(JSON.stringify(state)).digest('hex')}`;
}

function fail(code, message) {
  const error = new Error(message);
  error.name = 'ChipsErrorLike';
  error.code = code;
  throw error;
}

function handleRequest(capabilityId, input) {
  if (capabilityId === 'system:info') {
    return {
      platform:
        process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'win32' : 'linux',
      osVersion: process.getSystemVersion === undefined ? '' : process.getSystemVersion(),
      arch: process.arch,
      appVersion: app.getVersion(),
      locale: app.getLocale(),
      paths: { temp: app.getPath('temp') },
    };
  }

  if (capabilityId === 'window:list') {
    return {
      windows: BrowserWindow.getAllWindows().map((window) => ({
        windowId: window.webContents.id,
        title: window.getTitle(),
        state: window.isMinimized() ? 'minimized' : 'normal',
        focused: window.isFocused(),
      })),
    };
  }

  if (capabilityId === 'document:open') {
    const source = typeof input?.source === 'string' ? input.source : null;
    if (source === null || source.length === 0) {
      return fail('BRIDGE_INVALID_INPUT', 'document:open 缺少 source。');
    }
    state.source = source;
    emit('document:opened', { uri: source, kind: 'card', title: card.name });
    return {
      documentId: card.id,
      source,
      kind: 'card',
      title: card.name,
      digest: digestOfState(),
    };
  }

  if (capabilityId === 'document:read') {
    assertDocumentId(input?.documentId);
    const part = input?.part;
    if (part === 'metadata') {
      return {
        part,
        value: {
          chip_standards_version: '1.0.0',
          card_id: card.id,
          name: card.name,
          created_at: '2026-09-19T00:00:00.000Z',
          modified_at: state.modifiedAt,
          cover_ratio: '3:4',
        },
        diagnostics: [],
      };
    }
    if (part === 'structure') {
      return {
        part,
        value: { structure: [{ id: card.nodeId, type: card.cardType }] },
        diagnostics: [],
      };
    }
    if (part === 'content') {
      if (input?.nodeId !== card.nodeId) {
        return fail('DOCUMENT_NODE_NOT_FOUND', `内容节点不存在：${String(input?.nodeId)}。`);
      }
      return {
        part,
        value: {
          card_type: card.cardType,
          content_format: 'markdown',
          content_source: 'inline',
          content_text: state.contentText,
          locale: 'zh-CN',
          markdown_capabilities: { commonmark: true, gfm: true },
        },
        diagnostics: [],
      };
    }
    return fail('BRIDGE_INVALID_INPUT', `未知的文档切片：${String(part)}。`);
  }

  if (capabilityId === 'document:write') {
    assertDocumentId(input?.documentId);
    if (input?.part !== 'content' || input?.nodeId !== card.nodeId) {
      return fail('DOCUMENT_STRUCTURE_INVALID', '自检应用只接受内容节点写入。');
    }
    const value = input?.value;
    if (value === null || typeof value !== 'object') {
      return fail('BRIDGE_INVALID_INPUT', 'document:write 缺少 value。');
    }
    state.contentText =
      typeof value.content_text === 'string' ? value.content_text : state.contentText;
    state.revision += 1;
    state.modifiedAt = new Date().toISOString();
    emit('document:changed', {
      uri: state.source,
      documentId: card.id,
      kind: 'card',
      digest: digestOfState(),
      size: state.contentText.length,
    });
    return { revision: state.revision };
  }

  if (capabilityId === 'document:save') {
    assertDocumentId(input?.documentId);
    if (workspacePath === null) {
      return fail('DOCUMENT_SAVE_FAILED', '未提供 --workspace，无法保存。');
    }
    const targetDir = path.join(workspacePath, `${card.name}.card`);
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(
      path.join(targetDir, 'harness-save.json'),
      `${JSON.stringify({ documentId: card.id, revision: state.revision, contentText: state.contentText }, null, 2)}\n`,
      'utf8'
    );
    const source = state.source ?? `chips-resource://harness/${encodeURIComponent(card.name)}.card`;
    emit('document:saved', { uri: source, kind: 'card' });
    return { source, digest: digestOfState() };
  }

  return fail('BRIDGE_CAPABILITY_NOT_FOUND', `自检应用未实现能力：${capabilityId}。`);
}

function assertDocumentId(documentId) {
  if (documentId !== card.id) {
    fail('DOCUMENT_NOT_OPEN', `文档会话不存在：${String(documentId)}。`);
  }
}

function emit(eventId, payload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('harness:event', eventId, payload);
    }
  }
}

function readFixtureResource(uri) {
  const parsed = new URL(uri);
  if (parsed.protocol !== 'chips-resource:' || parsed.hostname !== 'fixture') {
    fail('RESOURCE_NOT_FOUND', `自检应用只读 chips-resource://fixture/ 资源：${uri}。`);
  }
  const relativePath = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  const target = path.resolve(fixtureRoot, relativePath);
  const relativeToRoot = path.relative(fixtureRoot, target);
  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    fail('RESOURCE_PERMISSION_DENIED', `资源越出夹具根目录：${uri}。`);
  }
  if (!existsSync(target)) {
    fail('RESOURCE_NOT_FOUND', `资源不存在：${uri}。`);
  }
  const bytes = readFileSync(target);
  return { target, bytes };
}

const MIME_BY_EXTENSION = {
  '.json': 'application/json',
  '.yaml': 'application/yaml',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.card': 'application/vnd.chips.card',
  '.box': 'application/vnd.chips.box',
};

function mimeOf(target) {
  return MIME_BY_EXTENSION[path.extname(target)] ?? 'application/octet-stream';
}

ipcMain.handle('harness:request', async (_event, capabilityId, input) => {
  try {
    return { ok: true, value: await handleRequest(capabilityId, input) };
  } catch (error) {
    return {
      ok: false,
      error: { code: error.code ?? 'HARNESS_FAILURE', message: error.message },
    };
  }
});

ipcMain.handle('harness:resource-meta', async (_event, uri) => {
  try {
    const { target, bytes } = readFixtureResource(uri);
    return {
      ok: true,
      value: {
        uri,
        size: bytes.byteLength,
        mimeType: mimeOf(target),
        version: createHash('sha256').update(bytes).digest('hex').slice(0, 16),
        scope: 'platform',
      },
    };
  } catch (error) {
    return { ok: false, error: { code: error.code ?? 'HARNESS_FAILURE', message: error.message } };
  }
});

ipcMain.handle('harness:resource-read', async (_event, uri) => {
  try {
    const { bytes } = readFixtureResource(uri);
    return { ok: true, value: bytes.toString('base64') };
  } catch (error) {
    return { ok: false, error: { code: error.code ?? 'HARNESS_FAILURE', message: error.message } };
  }
});

function createWindow() {
  const window = new BrowserWindow({
    width: 960,
    height: 720,
    title: card.name,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void window.loadFile(path.join(__dirname, 'renderer', 'shell.html'), {
    query: {
      documentId: card.id,
      nodeId: card.nodeId,
      cardType: card.cardType,
      name: card.name,
      text: card.inlineText,
    },
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
