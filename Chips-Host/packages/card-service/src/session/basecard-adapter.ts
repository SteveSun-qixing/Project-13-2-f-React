/**
 * 基础卡片描述符适配器：为卡片编辑会话提供配置归一/校验/资源引用收集/初始配置
 *
 * 语义基线：Chips-EditingEngine `src/basecard-runtime/registry.ts`（task034 M2 上移）。
 * 优先消费插件导出的 `basecardDefinition`；未导出时回退到最小语义
 * （normalize 仅注入 id、collectResourcePaths 为空、createInitialConfig 返回 { id }）。
 */

import type { PluginRuntime } from '../../../../src/runtime';
import type { CardService } from '../card-service';
import type { CardSessionOptions } from './types';

type BasecardDefinition = NonNullable<CardSessionOptions['basecard']>;

export interface BasecardAdapter {
  normalizeConfig(cardType: string, baseCardId: string, config: Record<string, unknown>): Promise<Record<string, unknown>>;
  collectResourcePaths(cardType: string, config: Record<string, unknown>): Promise<string[]>;
  createInitialConfig(cardType: string, baseCardId: string): Promise<Record<string, unknown>>;
  validateConfig(cardType: string, config: Record<string, unknown>): Promise<{ valid: boolean; errors: Record<string, string> }>;
}

export interface PluginBasecardDefinitionModule {
  basecardDefinition?: {
    normalizeConfig?(baseCardId: string, config: Record<string, unknown>): Record<string, unknown>;
    validateConfig?(config: Record<string, unknown>): { valid: boolean; errors: Record<string, string> };
    collectResourcePaths?(config: Record<string, unknown>): string[];
    createInitialConfig?(baseCardId: string): Record<string, unknown>;
  };
}

export const createBasecardAdapter = (
  cardService: Pick<CardService, 'resolveCardPlugin' | 'loadPluginModule'>,
): BasecardAdapter => {
  const definitionByType = new Map<string, Promise<PluginBasecardDefinitionModule['basecardDefinition'] | null>>();

  const loadDefinition = async (cardType: string): Promise<PluginBasecardDefinitionModule['basecardDefinition'] | null> => {
    const cached = definitionByType.get(cardType);
    if (cached) {
      return cached;
    }

    const pending = (async () => {
      const plugin = cardService.resolveCardPlugin(cardType);
      if (!plugin) {
        return null;
      }
      try {
        const module = await cardService.loadPluginModule(plugin);
        return module?.basecardDefinition ?? null;
      } catch {
        return null;
      }
    })();

    definitionByType.set(cardType, pending);
    return pending;
  };

  const fallbackNormalize = (baseCardId: string, config: Record<string, unknown>): Record<string, unknown> => ({
    ...config,
    id: baseCardId,
  });

  return {
    async normalizeConfig(cardType, baseCardId, config) {
      const definition = await loadDefinition(cardType);
      return definition?.normalizeConfig
        ? definition.normalizeConfig(baseCardId, config)
        : fallbackNormalize(baseCardId, config);
    },
    async collectResourcePaths(cardType, config) {
      const definition = await loadDefinition(cardType);
      return definition?.collectResourcePaths ? definition.collectResourcePaths(config) : [];
    },
    async createInitialConfig(cardType, baseCardId) {
      const definition = await loadDefinition(cardType);
      return definition?.createInitialConfig ? definition.createInitialConfig(baseCardId) : { id: baseCardId };
    },
    async validateConfig(cardType, config) {
      const definition = await loadDefinition(cardType);
      return definition?.validateConfig ? definition.validateConfig(config) : { valid: true, errors: {} };
    },
  };
};
