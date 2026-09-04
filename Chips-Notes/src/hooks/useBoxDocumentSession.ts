import { useEffect, useState } from 'react';
import { boxDocumentService, type BoxDocumentSessionSnapshot } from '../services/box-document-service';
import { workspaceService } from '../services/workspace-service';
import { toDisplayErrorMessage } from '../utils/error';

interface BoxDocumentSessionState {
  session: BoxDocumentSessionSnapshot | null;
  isLoading: boolean;
  error: string | null;
}

export function useBoxDocumentSession(boxId: string | null | undefined, boxPath: string | null | undefined): BoxDocumentSessionState {
  const [session, setSession] = useState<BoxDocumentSessionSnapshot | null>(() => (
    boxId ? boxDocumentService.getSession(boxId) : null
  ));
  const [isLoading, setIsLoading] = useState<boolean>(() => Boolean(boxId && boxPath && !boxDocumentService.getSession(boxId)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boxId || !boxPath) {
      setSession(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let disposed = false;
    const eventName = `session:${boxId}`;
    const handleSessionChange = (next: BoxDocumentSessionSnapshot) => {
      if (!disposed) {
        setSession(next);
      }
    };

    boxDocumentService.on(eventName, handleSessionChange);
    setSession(boxDocumentService.getSession(boxId));
    setIsLoading(!boxDocumentService.getSession(boxId));
    setError(null);

    void boxDocumentService.openBox(
      boxPath,
      workspaceService.getState().rootPath,
      boxId,
    ).then((snapshot) => {
      if (!disposed) {
        setSession(snapshot);
        setIsLoading(false);
      }
    }).catch((reason) => {
      if (!disposed) {
        setError(toDisplayErrorMessage(reason, '箱子会话加载失败'));
        setIsLoading(false);
      }
    });

    return () => {
      disposed = true;
      boxDocumentService.off(eventName, handleSessionChange);
    };
  }, [boxId, boxPath]);

  return {
    session,
    isLoading,
    error,
  };
}
