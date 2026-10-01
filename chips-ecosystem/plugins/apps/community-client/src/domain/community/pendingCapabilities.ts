/**
 * 候前置件登记表（本起步臂的诚实降级登记，唯一事实源；界面按此渲染，不铺替代数据）。
 *
 * 权威口径：W5 派单行表 #8——骨架/页面/领域臂零宿主耦合先行；端到端候三域宿主处理器
 * （`http:request`、`credential:manage`、`transfer:*`，契约在册、处理器缺位）。
 * 本臂不假接线：依赖域就绪前，对应页面如实呈现「候前置件」登记（依赖域 + 落波去向），
 * 不伪造数据、不设不可用控件。登记项与落波去向：
 * - `http:*` 域宿主处理器未注册（G6 后续批）——网络请求臂（浏览/认证/详情数据面）；
 * - `credential:*` 域宿主处理器未注册——会话持久化（refreshToken 凭证存取）；
 * - `config:*` 域宿主处理器未注册（工单066 在册）——服务器地址持久化；
 * - `transfer:*` 传输链路（16-卡片传输协议编排）未落波——上传/完整下载/本地查看；
 * - `dialog:*` / `shell:external` 域宿主处理器未注册——文件选择/保存与系统浏览器入口；
 * - 社区平台服务端 W6 未迁移——联调面（端到端联调候服务端落波）。
 */

/** 一条候前置件登记（领域数据；界面如实呈现，简体中文直写）。 */
export interface CommunityPendingCapability {
  /** 稳定登记标识（路由/测试锚点用）。 */
  readonly id: string;
  /** 登记面名称（简体中文）。 */
  readonly title: string;
  /** 缺失的宿主能力域（Bridge 契约在册、宿主处理器缺位；或服务端波次）。 */
  readonly domain: string;
  /** 登记说明（本臂如何诚实降级）。 */
  readonly pendingBecause: string;
  /** 落波去向（解锁条件与后续臂）。 */
  readonly unlockWave: string;
}

/** 浏览数据面（欢迎页以外的数据加载臂全部候 `http:request`）。 */
const NETWORK_FACE: CommunityPendingCapability = {
  id: 'network',
  title: '社区网络请求臂',
  domain: 'http:request（宿主处理器未注册，G6 后续批）',
  pendingBecause: '本臂未接线网络请求：不私建 fetch、不伪造页面数据，浏览/认证/详情数据面整体候前置件。',
  unlockWave: '候 `http:*` 域宿主处理器注册（G6 后续批）与服务端 W6 迁移后开「网络数据臂」。',
};

/** 会话面（登录/注册/恢复/登出）。 */
const SESSION_FACE: CommunityPendingCapability = {
  id: 'session',
  title: '社区会话臂',
  domain: 'http:request + credential:manage（宿主处理器未注册）',
  pendingBecause: 'accessToken 仅内存、refreshToken 经凭证能力存取（§5.1）；域处理器缺位期间会话如实呈现「未登录」，不伪造登录态。',
  unlockWave: '候 `http:*` 与 `credential:*` 域宿主处理器注册后开「会话臂」。',
};

/** 配置持久化面（服务器地址落盘）。 */
const CONFIG_FACE: CommunityPendingCapability = {
  id: 'config',
  title: '服务器地址持久化',
  domain: 'config:*（宿主处理器未注册，工单066 在册）',
  pendingBecause: '服务器地址校验与生效在本窗口会话内存完成，生效层如实标记「会话内存（未持久化）」。',
  unlockWave: '候 `config:*` 域宿主处理器注册（工单066）后换接 `config:get/set` 与 `config:changed` 订阅，消费面零改动。',
};

/** 传输面（上传/完整下载/本地查看）。 */
const TRANSFER_FACE: CommunityPendingCapability = {
  id: 'transfer',
  title: '卡片传输编排臂',
  domain: 'transfer:*（16-卡片传输协议编排，宿主链路未落波）',
  pendingBecause: '客户端不实现传输协议（§2.3）；本臂已把卡片路径归一与 YAML/cover.html 资源改写还原逻辑纯函数化迁入领域层（传输引擎同源实现材料），传输编排入口候前置件。',
  unlockWave: '候 `transfer:*` 链路落波后开「上传/完整下载/本地查看臂」；打开入口按 14-契约路由本地卡片查看器。',
};

/** 文件选择/保存与系统浏览器入口面。 */
const DIALOG_SHELL_FACE: CommunityPendingCapability = {
  id: 'dialog-shell',
  title: '文件选择与浏览器入口臂',
  domain: 'dialog:open / dialog:save / shell:openExternal（宿主处理器未注册）',
  pendingBecause: '上传选择、下载保存与「在浏览器中打开」（含 /admin 后台入口）不设不可用控件，候前置件。',
  unlockWave: '候对应域宿主处理器注册并随网络臂在 manifest 声明 `dialogs:use` 与 `shell:external` 后逐项启用。',
};

/** 服务端联调面。 */
const SERVER_FACE: CommunityPendingCapability = {
  id: 'server',
  title: '社区平台服务端联调',
  domain: '服务端（W6 未迁移）',
  pendingBecause: '社区平台服务端属 W6 迁移批次，联调面（端到端浏览/认证/传输验证）全部候服务端落波。',
  unlockWave: '候服务端 W6 迁移后随「网络数据臂」一并联调验收。',
};

/** 候前置件登记表（顺序即界面呈现顺序；测试锁定稳定性）。 */
export const COMMUNITY_PENDING_CAPABILITIES: readonly CommunityPendingCapability[] = [
  NETWORK_FACE,
  SESSION_FACE,
  TRANSFER_FACE,
  CONFIG_FACE,
  DIALOG_SHELL_FACE,
  SERVER_FACE,
];

/** 按登记标识取登记项（未知标识返回 `null`，调用方不静默回退）。 */
export function findPendingCapability(id: string): CommunityPendingCapability | null {
  return COMMUNITY_PENDING_CAPABILITIES.find((item) => item.id === id) ?? null;
}
