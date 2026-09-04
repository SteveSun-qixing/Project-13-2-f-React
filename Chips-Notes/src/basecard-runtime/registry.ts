import type { Client, PluginRecord } from 'chips-sdk';
import type { BasecardConfigRecord, BasecardDescriptor, EditorValidationResult } from './contracts';
import { imageBasecardDescriptor } from './registrations/image';
import { richtextBasecardDescriptor } from './registrations/richtext';
import { webpageBasecardDescriptor } from './registrations/webpage';

const builtinBasecardDescriptors = [
  imageBasecardDescriptor,
  richtextBasecardDescriptor,
  webpageBasecardDescriptor,
] satisfies BasecardDescriptor[];

type BasecardDefinitionModule = {
  basecardDefinition?: BasecardDescriptor;
};

type BasecardModuleLoader = (moduleUrl: string) => Promise<BasecardDefinitionModule>;

const descriptorMap = new Map<string, BasecardDescriptor>();
const aliasMap = new Map<string, string>();
const installedDescriptorMap = new Map<string, BasecardDescriptor>();
const registryListeners = new Set<() => void>();
let availableBasecardDescriptors = [...builtinBasecardDescriptors];
let registryVersion = 0;

function isIconDescriptor(icon: unknown): icon is { name: string } {
  return Boolean(icon)
    && typeof icon === 'object'
    && typeof (icon as { name?: unknown }).name === 'string'
    && (icon as { name: string }).name.trim().length > 0;
}

function isPreviewPointerEventsValue(value: unknown): value is 'native' | 'shielded' {
  return value === 'native' || value === 'shielded';
}

function toFileModuleUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }
  return encodeURI(`file://${normalized.startsWith('/') ? normalized : `/${normalized}`}`);
}

async function defaultBasecardModuleLoader(moduleUrl: string): Promise<BasecardDefinitionModule> {
  return import(/* @vite-ignore */ moduleUrl) as Promise<BasecardDefinitionModule>;
}

function applyDescriptors(nextDescriptors: BasecardDescriptor[]): void {
  descriptorMap.clear();
  aliasMap.clear();
  const availableDescriptorMap = new Map<string, BasecardDescriptor>();

  for (const descriptor of nextDescriptors) {
    descriptorMap.set(descriptor.cardType, descriptor);
    availableDescriptorMap.set(descriptor.cardType, descriptor);
    aliasMap.set(descriptor.cardType, descriptor.cardType);
    for (const alias of descriptor.aliases ?? []) {
      aliasMap.set(alias, descriptor.cardType);
    }
  }

  availableBasecardDescriptors = [...availableDescriptorMap.values()];
  registryVersion += 1;
  registryListeners.forEach((listener) => listener());
}

function rebuildDescriptorRegistry(): void {
  applyDescriptors([
    ...builtinBasecardDescriptors,
    ...installedDescriptorMap.values(),
  ]);
}

function toInstalledDescriptor(
  plugin: PluginRecord,
  module: BasecardDefinitionModule,
): BasecardDescriptor {
  const definition = module.basecardDefinition;
  if (!definition) {
    throw new Error(`基础卡片插件未导出 basecardDefinition: ${plugin.id}`);
  }
  if (typeof definition.cardType !== 'string' || definition.cardType.trim().length === 0) {
    throw new Error(`基础卡片插件缺少 cardType: ${plugin.id}`);
  }
  if (!plugin.capabilities?.includes(definition.cardType)) {
    throw new Error(`基础卡片插件 cardType 未声明在 manifest.capabilities.cardTypes 中: ${plugin.id}`);
  }
  if (typeof definition.renderView !== 'function') {
    throw new Error(`基础卡片插件缺少 renderView: ${plugin.id}`);
  }
  if (typeof definition.createInitialConfig !== 'function') {
    throw new Error(`基础卡片插件缺少 createInitialConfig: ${plugin.id}`);
  }
  if (typeof definition.normalizeConfig !== 'function') {
    throw new Error(`基础卡片插件缺少 normalizeConfig: ${plugin.id}`);
  }
  if (typeof definition.validateConfig !== 'function') {
    throw new Error(`基础卡片插件缺少 validateConfig: ${plugin.id}`);
  }
  if (definition.icon !== undefined && !isIconDescriptor(definition.icon)) {
    throw new Error(`基础卡片插件 icon 必须为正式 IconDescriptor: ${plugin.id}`);
  }
  if (
    definition.previewPointerEvents !== undefined
    && !isPreviewPointerEventsValue(definition.previewPointerEvents)
  ) {
    throw new Error(`基础卡片插件 previewPointerEvents 必须为 native 或 shielded: ${plugin.id}`);
  }

  return {
    ...definition,
    pluginId: definition.pluginId || plugin.id,
    displayName: definition.displayName || plugin.name,
    description: definition.description || plugin.description,
  };
}

function isEnabledCardPlugin(record: PluginRecord): boolean {
  return record.type === 'card'
    && record.enabled
    && typeof record.entry === 'string'
    && record.entry.trim().length > 0
    && typeof record.installPath === 'string'
    && record.installPath.trim().length > 0;
}

export async function syncInstalledBasecardDescriptors(
  client: Client,
  moduleLoader: BasecardModuleLoader = defaultBasecardModuleLoader,
): Promise<void> {
  if (!client?.plugin || typeof client.plugin.query !== 'function') {
    installedDescriptorMap.clear();
    rebuildDescriptorRegistry();
    return;
  }

  const installedPlugins = await client.plugin.query({ type: 'card' });
  const nextInstalledDescriptors = new Map<string, BasecardDescriptor>();

  for (const plugin of installedPlugins.filter(isEnabledCardPlugin)) {
    try {
      const entryPath = `${plugin.installPath}/${plugin.entry}`.replace(/\\/g, '/').replace(/\/+/g, '/');
      const moduleUrl = toFileModuleUrl(entryPath);
      const loadedModule = await moduleLoader(moduleUrl);
      const descriptor = toInstalledDescriptor(plugin, loadedModule);
      nextInstalledDescriptors.set(plugin.id, descriptor);
    } catch (error) {
      console.error('[BasecardRegistry] Failed to load installed basecard plugin.', {
        pluginId: plugin.id,
        entry: plugin.entry,
        installPath: plugin.installPath,
        error,
      });
    }
  }

  installedDescriptorMap.clear();
  nextInstalledDescriptors.forEach((descriptor, pluginId) => {
    installedDescriptorMap.set(pluginId, descriptor);
  });
  rebuildDescriptorRegistry();
}

export function subscribeBasecardRegistry(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => {
    registryListeners.delete(listener);
  };
}

export function getBasecardRegistryVersion(): number {
  return registryVersion;
}

rebuildDescriptorRegistry();

export function getRegisteredBasecardDescriptors(): BasecardDescriptor[] {
  return availableBasecardDescriptors;
}

export function getInstalledBasecardDescriptors(): BasecardDescriptor[] {
  return [...installedDescriptorMap.values()];
}

export function normalizeBasecardType(cardType: string): string {
  return aliasMap.get(cardType) ?? cardType;
}

export function getBasecardDescriptor(cardType: string): BasecardDescriptor | null {
  return descriptorMap.get(normalizeBasecardType(cardType)) ?? null;
}

export function assertBasecardDescriptor(cardType: string): BasecardDescriptor {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    throw new Error(`未找到基础卡片描述符: ${cardType}`);
  }
  return descriptor;
}

export function createInitialBasecardConfig(cardType: string, baseCardId: string): BasecardConfigRecord {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return { id: baseCardId };
  }
  return descriptor.createInitialConfig(baseCardId);
}

export function normalizeBasecardConfig(
  cardType: string,
  baseCardId: string,
  input: BasecardConfigRecord,
): BasecardConfigRecord {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return {
      ...input,
      id: baseCardId,
    };
  }
  return descriptor.normalizeConfig(input, baseCardId);
}

export function validateBasecardConfig(cardType: string, config: BasecardConfigRecord): EditorValidationResult {
  const descriptor = getBasecardDescriptor(cardType);
  if (!descriptor) {
    return {
      valid: true,
      errors: {},
    };
  }
  return descriptor.validateConfig(config);
}
