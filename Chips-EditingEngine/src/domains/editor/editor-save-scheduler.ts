export interface EditorSaveRequest {
  nodeId: string;
  config: Record<string, unknown>;
}

interface EditorSaveSchedulerOptions<T> {
  delayMs: number;
  save(request: EditorSaveRequest): Promise<T>;
  onScheduled?(request: EditorSaveRequest): void;
  onBeforeSave?(request: EditorSaveRequest): void;
  onSaved?(request: EditorSaveRequest, result: T): Promise<void> | void;
  onSaveFailed?(request: EditorSaveRequest, error: unknown): Promise<void> | void;
}

export interface EditorSaveScheduler<T> {
  schedule(request: EditorSaveRequest): void;
  flush(): Promise<void>;
  cancel(): void;
  dispose(): Promise<void>;
  hasPendingRequest(): boolean;
  isSaving(): boolean;
}

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function cloneRequest(request: EditorSaveRequest): EditorSaveRequest {
  return {
    nodeId: request.nodeId,
    config: cloneConfig(request.config),
  };
}

export function createEditorSaveScheduler<T>(
  options: EditorSaveSchedulerOptions<T>,
): EditorSaveScheduler<T> {
  let timerId: ReturnType<typeof globalThis.setTimeout> | null = null;
  let queuedRequest: EditorSaveRequest | null = null;
  let activeRequest: Promise<void> | null = null;
  let disposed = false;

  const clearTimer = () => {
    if (timerId !== null) {
      globalThis.clearTimeout(timerId);
      timerId = null;
    }
  };

  const runSave = async (request: EditorSaveRequest) => {
    options.onBeforeSave?.(request);
    try {
      const result = await options.save(request);
      await options.onSaved?.(request, result);
    } catch (error) {
      await options.onSaveFailed?.(request, error);
    } finally {
      if (activeRequest) {
        activeRequest = null;
      }
      if (disposed) {
        queuedRequest = null;
        clearTimer();
        return;
      }
      if (queuedRequest) {
        const nextRequest = cloneRequest(queuedRequest);
        queuedRequest = null;
        timerId = globalThis.setTimeout(() => {
          timerId = null;
          activeRequest = runSave(nextRequest);
        }, options.delayMs);
      }
    }
  };

  const schedule = (request: EditorSaveRequest) => {
    if (disposed) {
      return;
    }
    queuedRequest = cloneRequest(request);
    options.onScheduled?.(queuedRequest);
    clearTimer();
    if (activeRequest) {
      return;
    }
    timerId = globalThis.setTimeout(() => {
      timerId = null;
      const nextRequest = queuedRequest ? cloneRequest(queuedRequest) : null;
      queuedRequest = null;
      if (!nextRequest) {
        return;
      }
      activeRequest = runSave(nextRequest);
    }, options.delayMs);
  };

  const flush = async () => {
    clearTimer();
    if (activeRequest) {
      await activeRequest;
      if (!queuedRequest) {
        return;
      }
    }
    const nextRequest = queuedRequest ? cloneRequest(queuedRequest) : null;
    queuedRequest = null;
    if (!nextRequest || disposed) {
      return;
    }
    activeRequest = runSave(nextRequest);
    await activeRequest;
  };

  const cancel = () => {
    clearTimer();
    queuedRequest = null;
  };

  const dispose = async () => {
    await flush();
    disposed = true;
    cancel();
  };

  return {
    schedule,
    flush,
    cancel,
    dispose,
    hasPendingRequest() {
      return queuedRequest !== null || timerId !== null;
    },
    isSaving() {
      return activeRequest !== null;
    },
  };
}
