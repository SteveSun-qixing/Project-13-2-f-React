import type {
  BasecardConfigRecord,
  BasecardDescriptor,
  EditorValidationResult,
} from '../contracts';
import {
  collectReferencedResources,
  createInitialBasecardConfig,
  getBasecardDescriptor,
  normalizeBasecardConfig as normalizeRuntimeConfig,
  renderBasecardEditor,
  renderBasecardView,
} from '../../../../../../Chips-BaseCardPlugin/image-BCP/src/index';
import type { BasecardConfig } from '../../../../../../Chips-BaseCardPlugin/image-BCP/src/schema/card-config';
import { normalizeBasecardConfig } from '../../../../../../Chips-BaseCardPlugin/image-BCP/src/schema/card-config';
import { validateBasecardConfig } from '../../../../../../Chips-BaseCardPlugin/image-BCP/src/runtime-contract';

function normalizeImageConfig(input: BasecardConfigRecord): BasecardConfigRecord {
  return normalizeRuntimeConfig(input as Partial<BasecardConfig> & Record<string, unknown>, '') as unknown as BasecardConfigRecord;
}

function validateImageConfig(config: BasecardConfigRecord): EditorValidationResult {
  const normalizedConfig = normalizeBasecardConfig(config);
  const result = validateBasecardConfig(normalizedConfig);
  return {
    valid: result.valid,
    errors: Object.fromEntries(result.issues.map((issue) => [issue.path, issue.message])),
  };
}

const runtimeDescriptor = getBasecardDescriptor();

export const imageBasecardDescriptor: BasecardDescriptor = {
  pluginId: 'chips.basecard.image',
  cardType: runtimeDescriptor.cardType,
  displayName: runtimeDescriptor.displayName,
  commitDebounceMs: runtimeDescriptor.commitDebounceMs,
  createInitialConfig(baseCardId) {
    return createInitialBasecardConfig(baseCardId) as unknown as BasecardConfigRecord;
  },
  normalizeConfig(input, baseCardId) {
    return normalizeRuntimeConfig(input as Partial<BasecardConfig> & Record<string, unknown>, baseCardId) as unknown as BasecardConfigRecord;
  },
  validateConfig(config) {
    return validateImageConfig(config);
  },
  collectResourcePaths(config) {
    return collectReferencedResources(normalizeBasecardConfig(config));
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
      initialConfig: normalizeBasecardConfig(ctx.initialConfig) as unknown as BasecardConfig,
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
