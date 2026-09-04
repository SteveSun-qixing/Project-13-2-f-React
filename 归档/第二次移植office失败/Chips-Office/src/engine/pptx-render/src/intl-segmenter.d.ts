/**
 * Type declarations for Intl.Segmenter (ES2022+)
 */
declare global {
  namespace Intl {
    class Segmenter {
      constructor(locales?: string | string[], options?: SegmenterOptions);
      segment(input: string): IterableIterator<SegmenterSegment>;
    }

    interface SegmenterOptions {
      granularity?: 'grapheme' | 'word' | 'sentence';
      localeMatcher?: 'lookup' | 'best fit';
    }

    interface SegmenterSegment {
      readonly segment: string;
      readonly index: number;
      readonly input: string;
      readonly isWordLike: boolean;
    }
  }
}

export {};
