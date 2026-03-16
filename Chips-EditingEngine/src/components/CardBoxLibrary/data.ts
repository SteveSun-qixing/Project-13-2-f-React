import yaml from 'yaml';
import type { LayoutTypeDefinition } from './types';
import { useTranslation } from '../../hooks/useTranslation';

interface PluginManifest {
  id?: string;
  name?: string;
  description?: string;
  icon?: string;
  tags?: string[];
  type?: string;
  layoutType?: string;
}

function resolveIcon(manifest: PluginManifest): string {
  const icon = manifest.icon ?? '';
  const isEmoji = icon && !icon.includes('/') && !icon.includes('.') && icon.length <= 3;
  if (isEmoji) {
    return icon;
  }
  return '🧩';
}

function parsePluginManifest(raw: unknown, path: string): PluginManifest | null {
  if (!raw) return null;
  try {
    if (path.endsWith('.json')) {
      return JSON.parse(raw as string) as PluginManifest;
    }
    return yaml.parse(raw as string) as PluginManifest;
  } catch {
    return null;
  }
}

const layoutManifestModules = {
  ...import.meta.glob('../../../../LayoutPlugin/**/manifest.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../../../LayoutPlugin/**/manifest.yaml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../../../LayoutPlugin/**/manifest.yml', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../../../layout-plugin/**/manifest.json', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

export const layoutTypes: LayoutTypeDefinition[] = Object.entries(layoutManifestModules)
  .map(([path, raw]) => parsePluginManifest(raw, path))
  .filter((manifest): manifest is PluginManifest => Boolean(manifest))
  .filter((manifest) => manifest.type === 'layout')
  .map((manifest) => {
    const id = manifest.layoutType ?? manifest.id ?? 'unknown';
    const name = manifest.name ?? id;
    const description = manifest.description ?? '';
    const keywords = [name, description, id, ...(manifest.tags ?? [])]
      .filter(Boolean)
      .map((item) => String(item));

    return {
      id,
      name,
      icon: resolveIcon(manifest),
      description,
      keywords,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

export function useSearchCardTypes() {
  useTranslation();

  return (_query: string) => {
    return [];
  };
}

export function useSearchLayoutTypes() {
  const { t } = useTranslation();

  return (query: string): LayoutTypeDefinition[] => {
    if (!query.trim()) return layoutTypes;

    const lowerQuery = query.toLowerCase();
    return layoutTypes.filter((type) => {
      const name = (t(type.name) || type.name).toLowerCase();
      const description = (t(type.description) || type.description).toLowerCase();
      const keywords = type.keywords.map((keyword) => (t(keyword) || keyword).toLowerCase());
      return (
        name.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        keywords.some((keyword) => keyword.includes(lowerQuery))
      );
    });
  };
}
