/**
 * 壳自检页脚本。
 *
 * 权威：`17-跨端Shell与平台抽象设计` §2.4（壳自检）、`01-Bridge-API规范` §2（方法面冻结）。
 *
 * @remarks
 * - 本页只做诊断：验证 `window.chips` 方法面、IPC 调用链路与 `chips-resource://` 协议响应；
 *   不承载任何业务 UI（正式窗口界面由应用插件经 React + `@chips/ui` 提供）。
 * - 类型为壳侧结构视图；插件侧类型由 `@chips/sdk` 提供。
 */

interface ISelfCheckSubscription {
  dispose(): void;
}

interface ISelfCheckChips {
  request<TOutput>(capabilityId: string, input?: unknown): Promise<TOutput>;
  subscribe(eventId: string, handler: (payload: unknown) => void): ISelfCheckSubscription;
  resource(uri: string): unknown;
}

declare global {
  interface Window {
    chips?: ISelfCheckChips;
  }
}

type CheckState = 'ok' | 'fail';

/** 渲染一行检查结果。 */
function renderCheck(label: string, state: CheckState, detail: string): void {
  const list = document.getElementById('shell-checks');
  if (list === null) {
    return;
  }
  const item = document.createElement('li');
  const badge = document.createElement('span');
  badge.className = `state ${state === 'ok' ? 'state-ok' : 'state-fail'}`;
  badge.textContent = state === 'ok' ? '通过' : '失败';
  const text = document.createElement('span');
  text.textContent = `${label}：${detail}`;
  item.append(badge, text);
  list.append(item);
}

/** 检查 `window.chips` 方法面。 */
function checkBridgeSurface(): boolean {
  const chips = window.chips;
  const methods: readonly (keyof ISelfCheckChips)[] = ['request', 'subscribe', 'resource'];
  const missing = methods.filter((method) => typeof chips?.[method] !== 'function');
  if (chips === undefined || missing.length > 0) {
    renderCheck('preload 桥', 'fail', `window.chips 缺少方法：${missing.join('、') || '全部'}`);
    return false;
  }
  renderCheck('preload 桥', 'ok', 'request / subscribe / resource 已暴露');
  return true;
}

/** 检查 IPC 调用链路（自检运行时返回正式"未注册"错误码即视为链路可用）。 */
async function checkIpc(): Promise<void> {
  const chips = window.chips;
  if (chips === undefined) {
    renderCheck('IPC 通道', 'fail', 'window.chips 不可用');
    return;
  }
  try {
    await chips.request('system:info');
    renderCheck('IPC 通道', 'ok', '能力调用返回结果');
  } catch (error) {
    const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
    if (typeof code === 'string' && code.startsWith('BRIDGE_')) {
      renderCheck('IPC 通道', 'ok', `链路可用（${code}）`);
      return;
    }
    renderCheck('IPC 通道', 'fail', error instanceof Error ? error.message : '调用失败');
  }
}

/** 检查 `chips-resource://` 协议处理器响应。 */
async function checkResourceProtocol(): Promise<void> {
  try {
    const response = await fetch('chips-resource://platform/shell.html', { method: 'HEAD' });
    if (response.ok) {
      renderCheck('资源协议', 'ok', `HEAD 响应 ${response.status}`);
      return;
    }
    renderCheck('资源协议', 'fail', `HEAD 响应 ${response.status}`);
  } catch (error) {
    renderCheck('资源协议', 'fail', error instanceof Error ? error.message : '协议请求失败');
  }
}

/** 运行全部自检项。 */
async function runSelfCheck(): Promise<void> {
  const bridgeAvailable = checkBridgeSurface();
  if (!bridgeAvailable) {
    renderCheck('IPC 通道', 'fail', 'preload 桥不可用，跳过');
    renderCheck('资源协议', 'fail', 'preload 桥不可用，跳过');
    return;
  }
  await checkIpc();
  await checkResourceProtocol();
}

void runSelfCheck();
