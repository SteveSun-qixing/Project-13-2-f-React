/**
 * 测试公共装载：文档模型与实现侧登记表在整个进程内缓存一次。
 *
 * 文档库是单一事实源；缓存只影响测试执行效率，不影响判定结果。
 */

import { loadBridgeCodeModel, type BridgeCodeModel } from '../src/code/bridge.js';
import { loadHostCodeModel, type HostCodeModel } from '../src/code/host.js';
import { loadSdkGeneratedCodeModel, type SdkGeneratedCodeModel } from '../src/code/sdk.js';
import { parseErrorRetryable } from '../src/docs/errors.js';
import { loadDocModels, type DocModels } from '../src/docs/index.js';
import { createFileReader } from '../src/docs/reader.js';
import { BRIDGE_ERROR_SOURCE } from '../src/docs/sources.js';
import { DOCS_ROOT } from '../src/paths.js';

let docsCache: DocModels | undefined;
let bridgeCache: BridgeCodeModel | undefined;
let hostCache: HostCodeModel | undefined;
let sdkCache: SdkGeneratedCodeModel | undefined;
let retryableCache: ReadonlyMap<string, boolean> | undefined;

export function docs(): DocModels {
  docsCache ??= loadDocModels(createFileReader(DOCS_ROOT));
  return docsCache;
}

export function bridgeCode(): BridgeCodeModel {
  bridgeCache ??= loadBridgeCodeModel();
  return bridgeCache;
}

export function hostCode(): HostCodeModel {
  hostCache ??= loadHostCodeModel();
  return hostCache;
}

export function sdkCode(): SdkGeneratedCodeModel {
  sdkCache ??= loadSdkGeneratedCodeModel();
  return sdkCache;
}

export function bridgeRetryable(): ReadonlyMap<string, boolean> {
  retryableCache ??= parseErrorRetryable(createFileReader(DOCS_ROOT), BRIDGE_ERROR_SOURCE);
  return retryableCache;
}
