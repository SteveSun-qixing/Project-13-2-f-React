import {
  collectReferences,
  createDefaultCoverHtml,
  createImageHtml,
  normalizeRatio,
  validateRatio,
} from './cover';

export type { DEFAULT_COVER_RATIO } from './cover';

const moduleDefinition = {
  providers: [
    {
      capability: 'cover.html.generate',
      methods: {
        createDefaultHtml(ctx: unknown, input: { name: string }): string {
          void ctx;
          return createDefaultCoverHtml(input);
        },
        createImageHtml(ctx: unknown, input: { imageSrc: string }): string {
          void ctx;
          return createImageHtml(input);
        },
        collectReferences(ctx: unknown, input: { html: string }): string[] {
          void ctx;
          return collectReferences(input);
        },
      },
    },
    {
      capability: 'cover.ratio',
      methods: {
        normalize(ctx: unknown, input: { value?: unknown }): string {
          void ctx;
          return normalizeRatio(input);
        },
        validate(ctx: unknown, input: { value?: unknown }): { valid: boolean; normalized?: string } {
          void ctx;
          return validateRatio(input);
        },
      },
    },
  ],
};

export default moduleDefinition;
