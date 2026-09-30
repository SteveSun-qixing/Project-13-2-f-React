import type { DocumentController } from '../engine/document-controller';
import type { ReadingMode } from '../engine/types';
import { ClickHandler } from './click-handler';
import { KeyboardHandler } from './keyboard-handler';
import { TouchHandler } from './touch-handler';
import type { InteractionCallbacks, InteractionRuntime } from './types';
import { WheelHandler } from './wheel-handler';

export interface InteractionManagerOptions {
  callbacks: InteractionCallbacks;
  getReadingMode: () => ReadingMode;
  getController: () => DocumentController | null;
  hasActivePanel: () => boolean;
}

export class InteractionManager {
  private readonly runtime: InteractionRuntime;
  private readonly keyboardHandler: KeyboardHandler;
  private readonly clickHandler: ClickHandler;
  private readonly wheelHandler: WheelHandler;
  private readonly touchHandler: TouchHandler;

  private hostCleanup: (() => void) | null = null;
  private frameCleanup: (() => void) | null = null;
  private navigationLockUntil = 0;

  public constructor(options: InteractionManagerOptions) {
    const guardedCallbacks: InteractionCallbacks = {
      ...options.callbacks,
      onNavigate: (direction) => {
        if (!this.canNavigate()) {
          return;
        }

        this.lockNavigation();
        options.callbacks.onNavigate(direction);
      },
      onNavigateBoundary: (boundary) => {
        if (!this.canNavigate()) {
          return;
        }

        this.lockNavigation();
        options.callbacks.onNavigateBoundary(boundary);
      },
    };

    this.runtime = {
      getReadingMode: options.getReadingMode,
      getController: options.getController,
      hasActivePanel: options.hasActivePanel,
      canNavigate: () => this.canNavigate(),
      lockNavigation: (durationMs?: number) => this.lockNavigation(durationMs),
    };
    this.keyboardHandler = new KeyboardHandler(guardedCallbacks);
    this.clickHandler = new ClickHandler(guardedCallbacks, this.runtime);
    this.wheelHandler = new WheelHandler(options.callbacks, this.runtime);
    this.touchHandler = new TouchHandler(options.callbacks, this.runtime);
  }

  public attachToHost(target: Window | Document): void {
    this.hostCleanup?.();
    this.hostCleanup = this.keyboardHandler.attach(target);
  }

  public attachToFrame(target: Document): void {
    this.frameCleanup?.();
    const cleanups = [
      this.keyboardHandler.attach(target),
      this.clickHandler.attach(target),
      this.wheelHandler.attach(target),
      this.touchHandler.attach(target),
    ];
    this.frameCleanup = () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }

  public canNavigate(): boolean {
    return Date.now() >= this.navigationLockUntil;
  }

  public lockNavigation(durationMs = 140): void {
    this.navigationLockUntil = Date.now() + durationMs;
  }

  public destroy(): void {
    this.hostCleanup?.();
    this.frameCleanup?.();
    this.hostCleanup = null;
    this.frameCleanup = null;
  }
}
