import { useEffect, useState } from 'react';
import { getChipsClient } from './bridge-client';
import type { CardTypeDefinition } from '../components/CardBoxLibrary/types';

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const definitions = new Map<string, T>();
  for (const item of items) {
    if (!definitions.has(item.id)) {
      definitions.set(item.id, item);
    }
  }
  return [...definitions.values()];
}

function resolveIcon(): string {
  return '🧩';
}

export async function listInstalledCardTypes(): Promise<CardTypeDefinition[]> {
  const plugins = await getChipsClient().plugin.query({ type: 'card' });

  return dedupeById(
    plugins
      .filter((plugin) => plugin.enabled)
      .flatMap((plugin) => {
        const cardTypeIds = Array.isArray(plugin.capabilities)
          ? plugin.capabilities
              .map((value) => String(value).trim())
              .filter(Boolean)
          : [];

        return cardTypeIds.map((cardTypeId) => ({
          id: cardTypeId,
          name: plugin.name?.trim() || plugin.id,
          icon: resolveIcon(),
          description: plugin.description?.trim() || '',
          keywords: [
            plugin.name ?? '',
            plugin.description ?? '',
            plugin.id,
            cardTypeId,
          ]
            .filter(Boolean)
            .map((item) => String(item)),
        }));
      }),
  ).sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export function useInstalledCardTypes() {
  const [cardTypes, setCardTypes] = useState<CardTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const client = getChipsClient();
    let disposed = false;

    const sync = async () => {
      try {
        const nextCardTypes = await listInstalledCardTypes();
        if (disposed) {
          return;
        }
        setCardTypes(nextCardTypes);
      } catch (error) {
        if (!disposed) {
          console.warn('[CardPluginCatalog] Failed to load installed base card plugins.', error);
          setCardTypes([]);
        }
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void sync();

    const unsubscribeInstalled = client.events.on('plugin.installed', () => {
      void sync();
    });
    const unsubscribeEnabled = client.events.on('plugin.enabled', () => {
      void sync();
    });
    const unsubscribeDisabled = client.events.on('plugin.disabled', () => {
      void sync();
    });
    const unsubscribeUninstalled = client.events.on('plugin.uninstalled', () => {
      void sync();
    });

    return () => {
      disposed = true;
      unsubscribeInstalled();
      unsubscribeEnabled();
      unsubscribeDisabled();
      unsubscribeUninstalled();
    };
  }, []);

  return {
    cardTypes,
    loading,
  };
}
