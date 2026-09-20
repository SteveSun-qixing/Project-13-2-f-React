/**
 * 渲染层公共面：卡片渲染入口与帧协议承载（构建产物直接装载，不经 `src/index.ts` 聚合——
 * 见 `src/index.ts` 头注既有口径）。
 *
 * 权威：`05-渲染引擎设计` §2.4（会话模型）、§3.3（渲染层模块结构）、§9（宿主-内容通信协议）、
 * §11（错误模型）。
 */

export { RENDER_ERROR_CODES, RENDER_ERROR_MESSAGES, RENDER_ERROR_RETRYABLE, createRenderError, isRenderErrorCode } from './codes.js';
export type { RenderErrorCode } from './codes.js';

export {
  FRAME_PROTOCOL,
  FRAME_READY_TIMEOUT_MS,
  FRAME_ACTION_TIMEOUT_MS,
  FRAME_DISPOSE_ACK_TIMEOUT_MS,
  FRAME_HEIGHT_MIN_DELTA_PX,
  createFrameEnvelope,
  createHandshakeTransfer,
  parseFrameEnvelope,
  envelopeMatchesSession,
  asFrameHeight,
  asFrameAction,
  isFrameReady,
  isFrameDisposeAck,
  isFrameError,
  isFrameEntryRequest,
} from './frame-protocol.js';
export type {
  DesignTokens,
  FrameActionPayload,
  FrameCapability,
  FrameEnvelope,
  FrameHeight,
  FrameInitPayload,
  FrameLimits,
  FrameNodeInit,
  FrameOutboundMessage,
  FrameReady,
  FrameRole,
  FrameView,
  HostOutboundMessage,
  IBoxCoverView,
  IBoxRenderView,
  ICardRenderView,
  IFrameHandshakeTransfer,
} from './frame-protocol.js';

export { FrameChannel } from './frame-channel.js';
export type {
  IFrameChannelDeps,
  IFrameChannelEnvironment,
  IFrameChannelHandlers,
  IFrameChannelEvents,
  IFramePortLike,
  IFramePortPair,
  IFrameReadyInfo,
} from './frame-channel.js';

export { FrameHeightCache, FrameHeightController, frameHeightCacheKey } from './frame-height.js';
export type { IFrameHeightCacheKeyInput, IFrameHeightControllerDeps, FrameHeightOutcome } from './frame-height.js';

export {
  createBridgeDocumentGateway,
  createServiceDocumentGateway,
  normalizeDocumentFailure,
} from './document-gateway.js';
export type { IChipsRequestFacade, IRenderDocumentGateway, IServiceDocumentGatewayOptions } from './document-gateway.js';

export { CardFrameHost } from './card-frame-host.js';
export type { ICardFrameHostLike, ICardFrameHostOptions } from './card-frame-host.js';

export { createRenderEngine } from './render-engine.js';
export type {
  IDocumentViewBuilder,
  IRenderEngine,
  IRenderSession,
  IRenderSubscription,
  IRenderFrameEnvironment,
  IRenderEngineBindings,
  RenderEventMap,
  RenderEventName,
  RenderMode,
  RenderRequest,
  RenderSessionState,
} from './render-engine.js';

export { NATIVE_DOCUMENT_VIEW_FROZEN_EXPORTS, createDocumentViewBuilder } from './document-view-builder.js';
export type {
  DocumentViewSessionResolver,
  IDocumentViewBuildInput,
  IDocumentViewBuilderOptions,
  IDocumentViewBuilderService,
  IDocumentViewResourceRequest,
  IDocumentViewSessionBinding,
  INativeDocumentViewHandle,
  INativeDocumentViewModule,
  INativeDocumentViewResourceRange,
} from './document-view-builder.js';

export {
  DOCUMENT_VIEW_PROTOCOL,
  DOCUMENT_VIEW_REQUEST_CHANNEL,
  DOCUMENT_VIEW_MESSAGE_TYPES,
  DOCUMENT_VIEW_CHANNEL_KINDS,
  DOCUMENT_VIEW_CHANNEL_ERROR_CODES,
  isDocumentViewChannelErrorCode,
  createDocumentViewBuildRequest,
  createDocumentViewBuildResult,
  createDocumentViewBuildFailure,
  isDocumentViewBuildResult,
  isDocumentViewBuildFailure,
  normalizeDocumentViewChannelError,
  guardDocumentViewCardRenderView,
  validateDocumentViewChannelRequest,
  validateDocumentViewChannelResponse,
} from './document-view-channel.js';
export type {
  DocumentViewMessageType,
  DocumentViewChannelErrorCode,
  IDocumentViewChannelInput,
  IDocumentViewBuildRequest,
  IDocumentViewBuildResult,
  IDocumentViewBuildFailure,
  DocumentViewBuildResponse,
  DocumentViewChannelMessage,
} from './document-view-channel.js';

export { createDocumentViewChannelBuilder } from './document-view-channel-client.js';
export type {
  IDocumentViewChannelInvoke,
  IDocumentViewChannelClientOptions,
} from './document-view-channel-client.js';

export {
  createBridgeDocumentWritePort,
  createDocumentReflowCoordinator,
} from './document-reflow.js';
export type {
  IDocumentWritePort,
  IDocumentReflowSubscription,
  DocumentReflowEventSubscribe,
  DocumentReflowAction,
  IDocumentReflowBindings,
  IDocumentReflowCoordinator,
} from './document-reflow.js';

export { useRenderSession } from './use-render-session.js';
export type { IUseRenderSessionResult } from './use-render-session.js';

export { CardRenderer } from './card-renderer.js';
export type { CardRendererProps } from './card-renderer.js';
