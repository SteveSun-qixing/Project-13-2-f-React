import { useEffect, useState } from 'react';
import type { DocumentController } from '../engine/document-controller';
import type { ReadingProgress } from '../engine/types';

export interface UseReaderProgressParams {
  controller: DocumentController | null;
}

export interface UseReaderProgressReturn {
  progress: ReadingProgress | null;
}

export function useReaderProgress(params: UseReaderProgressParams): UseReaderProgressReturn {
  const { controller } = params;
  const [progress, setProgress] = useState<ReadingProgress | null>(null);

  useEffect(() => {
    if (!controller) {
      setProgress(null);
      return;
    }

    let timeoutId: number | null = null;
    let latestProgress = controller.getProgress();
    setProgress(latestProgress);

    const unsubscribe = controller.on('progress-updated', (event) => {
      if (event.type !== 'progress-updated') {
        return;
      }

      latestProgress = event.progress;
      if (timeoutId !== null) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        setProgress(latestProgress);
      }, 200);
    });

    return () => {
      unsubscribe();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [controller]);

  return {
    progress,
  };
}
