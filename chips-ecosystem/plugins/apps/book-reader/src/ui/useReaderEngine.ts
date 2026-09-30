import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { DocumentController } from '../engine/document-controller';
import type { EngineOptions, PageDirection, ReadingBoundary } from '../engine/types';
import type { RenderedSectionDocument, EpubThemePalette } from '../domain/epub/types';
import type { ReaderPreferences } from '../core/book-model';

export interface UseReaderEngineParams {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  renderedSection: RenderedSectionDocument | null;
  preferences: ReaderPreferences;
  themePalette: EpubThemePalette;
  currentFragment?: string | undefined;
  pendingBoundary: ReadingBoundary | null;
  section: {
    index: number;
    count: number;
    title: string;
    weights?: number[];
  };
  onInitialLocationSettled?: (() => void) | undefined;
}

export interface UseReaderEngineReturn {
  controller: DocumentController | null;
  frameDocument: Document | null;
  isFrameLoading: boolean;
  navigatePage: (direction: PageDirection) => ReturnType<DocumentController['turnPage']> | null;
  navigateToBoundary: (boundary: ReadingBoundary) => void;
  seekToFraction: (fraction: number) => void;
}

function createEngineOptions(
  preferences: ReaderPreferences,
  themePalette: EpubThemePalette,
  section: UseReaderEngineParams['section']
): EngineOptions {
  return {
    preferences,
    theme: themePalette,
    section,
  };
}

export function useReaderEngine(params: UseReaderEngineParams): UseReaderEngineReturn {
  const {
    iframeRef,
    renderedSection,
    preferences,
    themePalette,
    currentFragment,
    pendingBoundary,
    section,
    onInitialLocationSettled,
  } = params;

  const controllerRef = useRef<DocumentController | null>(null);
  const [controller, setController] = useState<DocumentController | null>(null);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [isFrameLoading, setIsFrameLoading] = useState(false);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !renderedSection) {
      setFrameDocument(null);
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setController(null);
      return;
    }

    let cancelled = false;

    const cleanupController = (): void => {
      controllerRef.current?.destroy();
      controllerRef.current = null;
      setController(null);
      setFrameDocument(null);
    };

    const handleLoad = (): void => {
      const nextDocument = frame.contentDocument;
      if (!nextDocument) {
        setIsFrameLoading(false);
        return;
      }

      cleanupController();

      const nextController = new DocumentController(
        nextDocument,
        createEngineOptions(preferences, themePalette, section)
      );
      controllerRef.current = nextController;
      setController(nextController);
      setFrameDocument(nextDocument);

      void (async () => {
        try {
          await nextController.mount();

          if (cancelled) {
            return;
          }

          if (currentFragment) {
            await nextController.goToFragment(currentFragment);
          } else if (pendingBoundary) {
            nextController.goToBoundary(pendingBoundary, 'auto');
          } else {
            nextController.goToBoundary('start', 'auto');
          }

          onInitialLocationSettled?.();
        } finally {
          if (!cancelled) {
            setIsFrameLoading(false);
          }
        }
      })();
    };

    frame.addEventListener('load', handleLoad);
    setIsFrameLoading(true);
    cleanupController();
    frame.srcdoc = renderedSection.html;

    return () => {
      cancelled = true;
      frame.removeEventListener('load', handleLoad);
      cleanupController();
    };
  }, [iframeRef, renderedSection?.html, renderedSection?.sectionPath]);

  useEffect(() => {
    const current = controllerRef.current;
    if (!current || !renderedSection) {
      return;
    }

    void current.update(createEngineOptions(preferences, themePalette, section));
  }, [
    preferences,
    themePalette,
    section.index,
    section.count,
    section.title,
    renderedSection?.sectionPath,
  ]);

  useEffect(() => {
    const current = controllerRef.current;
    if (!current || !renderedSection) {
      return;
    }

    void current.goToFragment(currentFragment);
  }, [currentFragment, renderedSection?.sectionPath]);

  return {
    controller,
    frameDocument,
    isFrameLoading,
    navigatePage: (direction) => controllerRef.current?.turnPage(direction) ?? null,
    navigateToBoundary: (boundary) => {
      controllerRef.current?.goToBoundary(boundary, 'smooth');
    },
    seekToFraction: (fraction) => {
      controllerRef.current?.goToProgress(fraction, 'auto');
    },
  };
}
