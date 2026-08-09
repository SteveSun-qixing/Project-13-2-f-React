export interface PlaylistEngine<T> {
  items(): readonly T[];
  currentIndex(): number;
  current(): T | null;
  setQueue(items: T[], startIndex?: number): void;
  append(items: T[]): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  clear(): void;
  goNext(): void;
  goPrevious(): void;
  canGoPrevious(): boolean;
  canGoNext(): boolean;
}

export function createPlaylistEngine<T>(): PlaylistEngine<T> {
  let items: T[] = [];
  let currentIndex = -1;

  function syncIndexFromItem(): void {
    const currentItem = currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : undefined;
    currentIndex = currentItem === undefined ? -1 : items.indexOf(currentItem);
  }

  function clampStartIndex(startIndex: number, length: number): number {
    if (length === 0) {
      return -1;
    }
    if (startIndex < -1) {
      return -1;
    }
    if (startIndex >= length) {
      return length - 1;
    }
    return startIndex;
  }

  return {
    items() {
      return items;
    },
    currentIndex() {
      return currentIndex;
    },
    current() {
      return currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : null;
    },
    setQueue(nextItems: T[], startIndex = 0) {
      items = Array.isArray(nextItems) ? [...nextItems] : [];
      currentIndex = clampStartIndex(startIndex, items.length);
    },
    append(nextItems: T[]) {
      const additions = Array.isArray(nextItems) ? nextItems : [];
      if (additions.length === 0) {
        return;
      }

      if (items.length === 0) {
        items = [...additions];
        currentIndex = 0;
        return;
      }

      items.push(...additions);
    },
    removeAt(index: number) {
      if (index < 0 || index >= items.length) {
        return;
      }

      items.splice(index, 1);

      if (index < currentIndex) {
        currentIndex -= 1;
      } else if (currentIndex >= items.length) {
        currentIndex = items.length - 1;
      }
    },
    move(from: number, to: number) {
      if (from === to) {
        return;
      }
      if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
        return;
      }

      const currentItem = currentIndex >= 0 && currentIndex < items.length ? items[currentIndex] : undefined;
      const [moved] = items.splice(from, 1);
      items.splice(to, 0, moved);

      if (currentItem === undefined) {
        currentIndex = -1;
      } else {
        currentIndex = items.indexOf(currentItem);
      }
    },
    clear() {
      items = [];
      currentIndex = -1;
    },
    goNext() {
      if (currentIndex < 0 || currentIndex >= items.length - 1) {
        return;
      }
      currentIndex += 1;
    },
    goPrevious() {
      if (currentIndex <= 0) {
        return;
      }
      currentIndex -= 1;
    },
    canGoPrevious() {
      return currentIndex > 0;
    },
    canGoNext() {
      return currentIndex >= 0 && currentIndex < items.length - 1;
    },
  };
}
