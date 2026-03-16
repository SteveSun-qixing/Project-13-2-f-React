import type { BasecardDescriptor, BasecardConfigRecord, EditorValidationResult } from '../contracts';
import {
  collectReferencedResources,
  createInitialBasecardConfig,
  getBasecardDescriptor,
  normalizeBasecardConfig as normalizeRuntimeConfig,
  renderBasecardEditor,
  renderBasecardView,
  validateBasecardConfig,
} from '../../../../../../Chips-BaseCardPlugin/richtext-BCP/src/index';
import type { BasecardConfig } from '../../../../../../Chips-BaseCardPlugin/richtext-BCP/src/schema/card-config';
const runtimeDescriptor = getBasecardDescriptor();

function normalizeRichtextConfig(input: BasecardConfigRecord, baseCardId: string): BasecardConfigRecord {
  return normalizeRuntimeConfig(
    input as Partial<BasecardConfig> & Record<string, unknown>,
    baseCardId,
  ) as unknown as BasecardConfigRecord;
}

function validateRichtextConfig(config: BasecardConfigRecord): EditorValidationResult {
  const normalizedConfig = normalizeRuntimeConfig(
    config as Partial<BasecardConfig> & Record<string, unknown>,
    typeof config.id === 'string' ? config.id : '',
  );
  const result = validateBasecardConfig(normalizedConfig);

  return {
    valid: result.valid,
    errors: Object.fromEntries(result.issues.map((issue) => [issue.path, issue.message])),
  };
}

export const richtextBasecardDescriptor: BasecardDescriptor = {
  pluginId: 'chips.basecard.richtext',
  cardType: runtimeDescriptor.cardType,
  displayName: runtimeDescriptor.displayName,
  commitDebounceMs: runtimeDescriptor.commitDebounceMs,
  createInitialConfig(baseCardId) {
    return createInitialBasecardConfig(baseCardId) as unknown as BasecardConfigRecord;
  },
  normalizeConfig(input, baseCardId) {
    return normalizeRichtextConfig(input, baseCardId);
  },
  validateConfig: validateRichtextConfig,
  collectResourcePaths(config) {
    return collectReferencedResources(
      normalizeRuntimeConfig(
        config as Partial<BasecardConfig> & Record<string, unknown>,
        typeof config.id === 'string' ? config.id : '',
      ),
    );
  },
  renderView(ctx) {
    return renderBasecardView({
      container: ctx.container,
      config: ctx.config as unknown as BasecardConfig,
      themeCssText: ctx.themeCssText,
      resolveResourceUrl: ctx.resolveResourceUrl,
      releaseResourceUrl: ctx.releaseResourceUrl,
    });
  },
  renderEditor(ctx) {
    return renderBasecardEditor({
      container: ctx.container,
      initialConfig: normalizeRuntimeConfig(
        ctx.initialConfig as Partial<BasecardConfig> & Record<string, unknown>,
        typeof ctx.initialConfig.id === 'string' ? ctx.initialConfig.id : '',
      ),
      onChange(nextConfig) {
        ctx.onChange(nextConfig as unknown as BasecardConfigRecord);
      },
      resolveResourceUrl: ctx.resolveResourceUrl,
      releaseResourceUrl: ctx.releaseResourceUrl,
      importResource: ctx.importResource,
      deleteResource: ctx.deleteResource,
    });
  },
};
