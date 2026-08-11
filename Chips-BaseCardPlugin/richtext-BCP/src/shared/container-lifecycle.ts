const containerCleanups = new WeakMap<HTMLElement, () => void>();

export function runPreviousContainerCleanup(container: HTMLElement): void {
  containerCleanups.get(container)?.();
}

export function registerContainerCleanup(
  container: HTMLElement,
  cleanup: () => void,
): () => void {
  const wrapped = () => {
    containerCleanups.delete(container);
    cleanup();
  };
  containerCleanups.set(container, wrapped);
  return wrapped;
}
