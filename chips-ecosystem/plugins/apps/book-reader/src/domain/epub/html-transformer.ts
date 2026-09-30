import type { EpubBook, EpubLink } from './types';

export interface EpubHtmlTransformContext {
  book: EpubBook;
  link: EpubLink;
}

export type EpubHtmlTransformFunction = (
  context: EpubHtmlTransformContext,
  source: string
) => Promise<string> | string;

// Inspired by Readium/Thorium `TransformerHTML`, but trimmed to the Chips reader's internal contract.
export class EpubHtmlTransformer {
  public constructor(private readonly transformHtml: EpubHtmlTransformFunction) {}

  public supports(link: EpubLink): boolean {
    const mediaType = link.mediaType?.trim().toLowerCase() ?? '';
    return mediaType.includes('html') || mediaType.includes('xhtml') || mediaType.includes('xml');
  }

  public async transform(context: EpubHtmlTransformContext, source: string): Promise<string> {
    if (!this.supports(context.link)) {
      return source;
    }

    return Promise.resolve(this.transformHtml(context, source));
  }
}
