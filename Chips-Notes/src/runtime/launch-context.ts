import type { Client, PlatformLaunchContext, SurfaceContext } from 'chips-sdk';

export interface EditingEngineLaunchSnapshot {
  launchContext: PlatformLaunchContext | null;
  surfaceContext: SurfaceContext | null;
  sceneId: string;
  surfaceId?: string;
  launchParams: Record<string, unknown>;
  workspacePath?: string;
  workspaceContext?: Record<string, unknown>;
}

const DEFAULT_SCENE_ID = 'editing-engine.workspace';

function getStringRecordValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function resolveWorkspacePath(launchParams: Record<string, unknown>): string | undefined {
  const workspaceContext = launchParams.workspaceContext;
  if (workspaceContext && typeof workspaceContext === 'object' && !Array.isArray(workspaceContext)) {
    const context = workspaceContext as Record<string, unknown>;
    const contextPath = getStringRecordValue(context, 'rootPath') ?? getStringRecordValue(context, 'path');
    if (contextPath) {
      return contextPath;
    }
  }
  return getStringRecordValue(launchParams, 'workspacePath') ?? getStringRecordValue(launchParams, 'workspace');
}

function resolveWorkspaceContext(launchParams: Record<string, unknown>): Record<string, unknown> | undefined {
  const value = launchParams.workspaceContext;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return { ...(value as Record<string, unknown>) };
}

export function readLaunchContext(client: Client): EditingEngineLaunchSnapshot {
  const launchContext = client.platform?.getLaunchContext?.() ?? null;
  const surfaceContext = launchContext?.surfaceContext ?? null;
  const launchParams = {
    ...surfaceContext?.launchParams,
    ...launchContext?.launchParams,
  };
  const sceneId = surfaceContext?.sceneId ?? launchContext?.sceneId ?? DEFAULT_SCENE_ID;

  return {
    launchContext,
    surfaceContext,
    sceneId,
    surfaceId: surfaceContext?.surfaceId ?? launchContext?.surfaceId,
    launchParams,
    workspacePath: resolveWorkspacePath(launchParams),
    workspaceContext: resolveWorkspaceContext(launchParams),
  };
}
