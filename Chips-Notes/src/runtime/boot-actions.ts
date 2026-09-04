import type { Client } from 'chips-sdk';
import { syncInstalledBasecardDescriptors } from '../basecard-runtime/registry';
import { workspaceService } from '../services/workspace-service';
import type { AnyWindowConfig, ToolWindowConfig } from '../types/window';
import { getToolWindowIcon } from '../icons/descriptors';

export interface DefaultToolWindowRuntime {
  windows: AnyWindowConfig[];
  createToolWindow(component: string, options?: Partial<ToolWindowConfig>): string;
  t(key: string): string;
  viewport: {
    width: number;
    height: number;
  };
}

export interface EditingEngineBootRuntime extends DefaultToolWindowRuntime {
  client: Client;
  setState(state: 'idle' | 'loading' | 'ready' | 'error'): void;
}

export function ensureDefaultToolWindows(runtime: DefaultToolWindowRuntime): void {
  if (runtime.windows.length > 0) {
    return;
  }

  runtime.createToolWindow('FileManager', {
    component: 'FileManager',
    title: runtime.t('app.tool_file_manager'),
    icon: getToolWindowIcon('FileManager'),
    position: { x: 20, y: 20 },
    size: { width: 280, height: 500 },
    closable: false,
  });

  runtime.createToolWindow('EditPanel', {
    component: 'EditPanel',
    title: runtime.t('app.tool_edit_panel'),
    icon: getToolWindowIcon('EditPanel'),
    position: { x: runtime.viewport.width - 340, y: 20 },
    size: { width: 320, height: 500 },
    closable: false,
  });

  runtime.createToolWindow('CardBoxLibrary', {
    component: 'CardBoxLibrary',
    title: runtime.t('app.tool_card_box_library'),
    icon: getToolWindowIcon('CardBoxLibrary'),
    position: { x: 20, y: runtime.viewport.height - 350 },
    size: { width: 400, height: 300 },
    closable: false,
  });
}

export async function bootEditingEngine(runtime: EditingEngineBootRuntime): Promise<void> {
  runtime.setState('loading');

  await syncInstalledBasecardDescriptors(runtime.client);
  await workspaceService.initialize();
  ensureDefaultToolWindows(runtime);

  runtime.setState('ready');
}

export function subscribeInstalledBasecardRefresh(client: Client): () => void {
  if (!client?.events || typeof client.events.on !== 'function') {
    return () => undefined;
  }

  const refreshInstalledBasecards = () => {
    void syncInstalledBasecardDescriptors(client).catch((error) => {
      console.error('[AppRuntime] Failed to refresh installed basecard descriptors.', error);
    });
  };

  const unsubscribeInstalled = client.events.on('plugin.installed', refreshInstalledBasecards);
  const unsubscribeEnabled = client.events.on('plugin.enabled', refreshInstalledBasecards);
  const unsubscribeDisabled = client.events.on('plugin.disabled', refreshInstalledBasecards);
  const unsubscribeUninstalled = client.events.on('plugin.uninstalled', refreshInstalledBasecards);

  return () => {
    unsubscribeInstalled();
    unsubscribeEnabled();
    unsubscribeDisabled();
    unsubscribeUninstalled();
  };
}
