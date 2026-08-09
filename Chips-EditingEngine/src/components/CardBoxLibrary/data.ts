import React from 'react';
import { getRegisteredBasecardDescriptors, subscribeBasecardRegistry } from '../../basecard-runtime/registry';
import type { BoxLayoutDescriptor } from 'chips-sdk';
import type { IconDescriptor } from 'chips-sdk';
import type { CardTypeDefinition, LayoutTypeDefinition } from './types';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { getChipsClient } from '../../services/bridge-client';

function createCardTypeDefinitions(): CardTypeDefinition[] {
  return getRegisteredBasecardDescriptors()
    .map((descriptor) => ({
      id: descriptor.cardType,
      name: descriptor.displayName,
      icon: descriptor.icon ?? ENGINE_ICONS.card,
      description: descriptor.description ?? '',
      keywords: [
        descriptor.displayName,
        descriptor.description ?? '',
        descriptor.cardType,
        descriptor.pluginId,
        ...(descriptor.aliases ?? []),
      ].filter(Boolean),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function toLayoutTypeDefinitions(descriptors: BoxLayoutDescriptor[]): LayoutTypeDefinition[] {
  return descriptors
    .map((descriptor) => ({
      id: descriptor.layoutType,
      name: descriptor.displayName,
      icon: isIconDescriptor(descriptor.icon) ? descriptor.icon : ENGINE_ICONS.layout,
      description: descriptor.description ?? '',
      keywords: [
        descriptor.displayName,
        descriptor.description ?? '',
        descriptor.layoutType,
        descriptor.pluginId,
      ].filter(Boolean),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

function isIconDescriptor(icon: unknown): icon is IconDescriptor {
  return (
    typeof icon === 'object' &&
    icon !== null &&
    typeof (icon as { name?: unknown }).name === 'string'
  );
}

export function useCardTypeDefinitions(): CardTypeDefinition[] {
  const [cardTypes, setCardTypes] = React.useState<CardTypeDefinition[]>(() => createCardTypeDefinitions());

  React.useEffect(() => {
    setCardTypes(createCardTypeDefinitions());
    return subscribeBasecardRegistry(() => {
      setCardTypes(createCardTypeDefinitions());
    });
  }, []);

  return cardTypes;
}

export function useLayoutTypeDefinitions(): LayoutTypeDefinition[] {
  const client = React.useMemo(() => getChipsClient(), []);
  const [layoutTypes, setLayoutTypes] = React.useState<LayoutTypeDefinition[]>([]);

  React.useEffect(() => {
    let disposed = false;

    const load = async () => {
      const descriptors = await client.box.listLayoutDescriptors();
      if (!disposed) {
        setLayoutTypes(toLayoutTypeDefinitions(descriptors));
      }
    };

    void load().catch((error) => {
      console.error('[CardBoxLibrary] Failed to load layout descriptors.', error);
      if (!disposed) {
        setLayoutTypes([]);
      }
    });

    if (!client.events || typeof client.events.on !== 'function') {
      return () => {
        disposed = true;
      };
    }

    const refresh = () => {
      void load().catch((error) => {
        console.error('[CardBoxLibrary] Failed to refresh layout descriptors.', error);
      });
    };

    const unsubscribeInstalled = client.events.on('plugin.installed', refresh);
    const unsubscribeEnabled = client.events.on('plugin.enabled', refresh);
    const unsubscribeDisabled = client.events.on('plugin.disabled', refresh);
    const unsubscribeUninstalled = client.events.on('plugin.uninstalled', refresh);

    return () => {
      disposed = true;
      unsubscribeInstalled();
      unsubscribeEnabled();
      unsubscribeDisabled();
      unsubscribeUninstalled();
    };
  }, [client]);

  return layoutTypes;
}

export function useSearchCardTypes() {
  const cardTypes = useCardTypeDefinitions();

  return React.useCallback((query: string): CardTypeDefinition[] => {
    if (!query.trim()) return cardTypes;

    const lowerQuery = query.toLowerCase();
    return cardTypes.filter((type) => {
      const name = type.name.toLowerCase();
      const description = type.description.toLowerCase();
      const keywords = type.keywords.map((keyword) => keyword.toLowerCase());
      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        keywords.some((keyword) => keyword.includes(lowerQuery))
      );
    });
  }, [cardTypes]);
}

export function useSearchLayoutTypes() {
  const layoutTypes = useLayoutTypeDefinitions();

  return React.useCallback((query: string): LayoutTypeDefinition[] => {
    if (!query.trim()) return layoutTypes;

    const lowerQuery = query.toLowerCase();
    return layoutTypes.filter((type) => {
      const name = type.name.toLowerCase();
      const description = type.description.toLowerCase();
      const keywords = type.keywords.map((keyword) => keyword.toLowerCase());
      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        keywords.some((keyword) => keyword.includes(lowerQuery))
      );
    });
  }, [layoutTypes]);
}
