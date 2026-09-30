import { useEffect, useRef } from 'react';
import { InteractionManager } from '../interaction/interaction-manager';
import type { PageDirection, ReadingBoundary } from '../engine/types';
import type { DocumentController } from '../engine/document-controller';
import type { EpubBook } from '../domain/epub/types';
import type { AppCommandId } from '../commands/appCommands';
import { clampContentWidth, clampFontScale, type ReaderPreferences } from '../core/book-model';

export interface UseReaderInteractionParams {
  book: EpubBook | null;
  controller: DocumentController | null;
  frameDocument: Document | null;
  activePanel: string | null;
  preferences: ReaderPreferences;
  sectionIndexByPath: Map<string, number>;
  onNavigate: (direction: PageDirection) => void;
  onNavigateBoundary: (boundary: ReadingBoundary) => void;
  onInvokeCommand?: (commandId: AppCommandId) => void;
  onToggleChrome: () => void;
  onClosePanel: () => void;
  onSelectSection: (sectionIndex: number, fragment?: string) => void;
  onOpenExternalLink: (url: string) => void | Promise<void>;
  onUpdatePreferences: (preferences: ReaderPreferences) => void;
}

export function useReaderInteraction(params: UseReaderInteractionParams): void {
  const latestRef = useRef(params);
  const managerRef = useRef<InteractionManager | null>(null);
  const controllerRef = useRef<DocumentController | null>(params.controller);

  latestRef.current = params;
  controllerRef.current = params.controller;

  useEffect(() => {
    if (!params.book && params.activePanel === null) {
      managerRef.current?.destroy();
      managerRef.current = null;
      return;
    }

    const manager = new InteractionManager({
      callbacks: {
        onNavigate: (direction) => latestRef.current.onNavigate(direction),
        onNavigateBoundary: (boundary) => latestRef.current.onNavigateBoundary(boundary),
        onInvokeCommand: (commandId) => latestRef.current.onInvokeCommand?.(commandId),
        onToggleChrome: () => latestRef.current.onToggleChrome(),
        onClosePanel: () => latestRef.current.onClosePanel(),
        onOpenLink: (href, isExternal) => {
          if (isExternal) {
            void latestRef.current.onOpenExternalLink(href);
          }
        },
        onEpubLink: (path, fragment) => {
          const sectionIndex = latestRef.current.sectionIndexByPath.get(path);
          if (typeof sectionIndex === 'number') {
            latestRef.current.onSelectSection(sectionIndex, fragment);
          }
        },
        onAdjustFont: (delta) => {
          latestRef.current.onUpdatePreferences({
            ...latestRef.current.preferences,
            fontScale: clampFontScale(latestRef.current.preferences.fontScale + delta),
          });
        },
        onAdjustWidth: (delta) => {
          latestRef.current.onUpdatePreferences({
            ...latestRef.current.preferences,
            contentWidth: clampContentWidth(latestRef.current.preferences.contentWidth + delta),
          });
        },
      },
      getReadingMode: () => latestRef.current.preferences.readingMode,
      getController: () => controllerRef.current,
      hasActivePanel: () => latestRef.current.activePanel !== null,
    });

    manager.attachToHost(window);
    if (latestRef.current.frameDocument) {
      manager.attachToFrame(latestRef.current.frameDocument);
    }

    managerRef.current = manager;
    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [params.book]);

  useEffect(() => {
    if (!managerRef.current || !params.frameDocument) {
      return;
    }

    managerRef.current.attachToFrame(params.frameDocument);
  }, [params.frameDocument]);
}
