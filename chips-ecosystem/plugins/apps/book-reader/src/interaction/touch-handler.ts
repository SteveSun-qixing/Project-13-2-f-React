import { GestureRecognizer } from './gesture-recognizer';
import type { InteractionCallbacks, InteractionRuntime } from './types';

const TOUCH_NAVIGATION_LOCK_MS = 220;

export class TouchHandler {
  private readonly recognizer = new GestureRecognizer();

  public constructor(
    private readonly callbacks: InteractionCallbacks,
    private readonly runtime: InteractionRuntime
  ) {}

  public attach(target: Document): () => void {
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') {
        return;
      }

      this.recognizer.start(event.pointerId, event.clientX, event.clientY);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (!this.runtime.canNavigate()) {
        return;
      }

      const gesture = this.recognizer.finish(event.pointerId, event.clientX, event.clientY);
      if (!gesture) {
        return;
      }

      if (this.runtime.getReadingMode() === 'paginated') {
        if (
          Math.abs(gesture.deltaX) > 48 &&
          Math.abs(gesture.deltaX) > Math.abs(gesture.deltaY) * 1.15
        ) {
          this.callbacks.onNavigate(gesture.deltaX < 0 ? 'next' : 'previous');
          this.runtime.lockNavigation(TOUCH_NAVIGATION_LOCK_MS);
        }
        return;
      }

      if (
        Math.abs(gesture.deltaY) <= 64 ||
        Math.abs(gesture.deltaY) <= Math.abs(gesture.deltaX) * 1.1
      ) {
        return;
      }

      const controller = this.runtime.getController();
      if (!controller) {
        return;
      }

      if (gesture.deltaY < 0 && controller.isNearBoundary('next')) {
        this.callbacks.onNavigate('next');
        this.runtime.lockNavigation(TOUCH_NAVIGATION_LOCK_MS);
      } else if (gesture.deltaY > 0 && controller.isNearBoundary('previous')) {
        this.callbacks.onNavigate('previous');
        this.runtime.lockNavigation(TOUCH_NAVIGATION_LOCK_MS);
      }
    };

    const handlePointerCancel = (): void => {
      this.recognizer.cancel();
    };

    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerCancel);
    };
  }
}
