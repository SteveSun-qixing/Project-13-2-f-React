export {
  createBridgeClient,
  MAX_PENDING_EVENT_BUFFER,
  type IBridgeClient,
  type IBridgeClientOptions,
} from './bridge-client.js';
export { createRequestId } from './request-id.js';
export {
  createResourceHandleProxy,
  type IResourceHandleProxy,
  type IResourceHandleProxyOptions,
} from './resource-handle.js';
export { type IIpcTransport, type IResourceByteSource } from './transport.js';
