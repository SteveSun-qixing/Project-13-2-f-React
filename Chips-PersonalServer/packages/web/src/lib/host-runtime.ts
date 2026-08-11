import { apiClient } from '../api/client';

export interface WebPluginSessionView {
  sessionId: string;
  pluginId: string;
  title: string;
  launchParams: Record<string, unknown>;
  permissions: string[];
}

export interface WebResourceOpenPlan {
  mode: 'plugin' | 'external';
  pluginId?: string;
  matchedCapability?: string;
  resolved: {
    resourceId: string;
    mimeType?: string;
    extension?: string;
    fileName?: string;
  };
}

export interface HostSurfaceOpenRequest {
  kind?: 'window' | 'tab' | 'route' | 'modal' | 'sheet' | 'fullscreen';
  target:
    | {
        type: 'plugin';
        pluginId: string;
        launchParams?: Record<string, unknown>;
      }
    | {
        type: 'url';
        url: string;
      };
  presentation?: {
    title?: string;
  };
}

export interface HostResourceOpenRequest {
  intent?: string;
  resource: {
    resourceId: string;
    mimeType?: string;
    title?: string;
    fileName?: string;
    payload?: Record<string, unknown>;
  };
}

const HOST_PLUGIN_SESSION_BASE = '/host/plugins';

export function buildHostedPluginRoute(sessionId: string): string {
  return `${HOST_PLUGIN_SESSION_BASE}/${encodeURIComponent(sessionId)}`;
}

export function buildHostedPluginEntryUrl(sessionId: string): string {
  return `/api/v1/host/plugin-sessions/${encodeURIComponent(sessionId)}/entry`;
}

export async function createWebPluginSession(input: {
  pluginId: string;
  launchParams?: Record<string, unknown>;
}): Promise<WebPluginSessionView> {
  const response = await apiClient.post<{ data: WebPluginSessionView }>('/host/plugin-sessions', input);
  return response.data;
}

export async function getWebPluginSession(sessionId: string): Promise<WebPluginSessionView> {
  const response = await apiClient.get<{ data: WebPluginSessionView }>(`/host/plugin-sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
}

export async function closeWebPluginSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/host/plugin-sessions/${encodeURIComponent(sessionId)}`);
}

export async function resolveWebResourceOpenPlan(request: HostResourceOpenRequest): Promise<WebResourceOpenPlan> {
  const response = await apiClient.post<{ data: WebResourceOpenPlan }>('/host/resource-open-plan', request);
  return response.data;
}
