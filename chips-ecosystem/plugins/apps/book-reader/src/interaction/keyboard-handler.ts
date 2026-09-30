import { APP_COMMAND_IDS } from '../commands/appCommands';
import type { AppCommandId } from '../commands/appCommands';
import type { InteractionCallbacks, InteractionIntent } from './types';

function isEditableTarget(target: Element | null): boolean {
  const tagName = target?.tagName?.toLowerCase();
  const isContentEditable =
    typeof target?.hasAttribute === 'function' && target.hasAttribute('contenteditable');
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || isContentEditable;
}

export class KeyboardHandler {
  public constructor(private readonly callbacks: InteractionCallbacks) {}

  public attach(target: Window | Document): () => void {
    const handleKeyDown: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      const intent = this.resolveIntent(keyboardEvent);
      if (intent.type === 'none') {
        return;
      }

      keyboardEvent.preventDefault();

      const commandId = this.resolveCommandId(intent);
      if (commandId && this.callbacks.onInvokeCommand) {
        this.callbacks.onInvokeCommand(commandId);
        return;
      }

      switch (intent.type) {
        case 'navigate':
          this.callbacks.onNavigate(intent.direction);
          return;
        case 'navigate-boundary':
          this.callbacks.onNavigateBoundary(intent.boundary);
          return;
        case 'toggle-chrome':
          this.callbacks.onToggleChrome();
          return;
        case 'close-panel':
          this.callbacks.onClosePanel();
          return;
        case 'adjust-font':
          this.callbacks.onAdjustFont(intent.delta);
          return;
        case 'adjust-width':
          this.callbacks.onAdjustWidth(intent.delta);
          return;
        default:
          return;
      }
    };

    target.addEventListener('keydown', handleKeyDown);
    return () => {
      target.removeEventListener('keydown', handleKeyDown);
    };
  }

  public resolveIntent(event: KeyboardEvent): InteractionIntent {
    if (isEditableTarget(event.target as Element | null)) {
      return { type: 'none' };
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return { type: 'none' };
    }

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
      case 'PageUp':
        return { type: 'navigate', direction: 'previous' };
      case 'ArrowRight':
      case 'ArrowDown':
      case 'PageDown':
        return { type: 'navigate', direction: 'next' };
      case ' ':
        return { type: 'navigate', direction: event.shiftKey ? 'previous' : 'next' };
      case 'Home':
        return { type: 'navigate-boundary', boundary: 'start' };
      case 'End':
        return { type: 'navigate-boundary', boundary: 'end' };
      case '[':
        return { type: 'adjust-font', delta: -0.1 };
      case ']':
        return { type: 'adjust-font', delta: 0.1 };
      case '-':
      case '_':
        return { type: 'adjust-width', delta: -40 };
      case '=':
      case '+':
        return { type: 'adjust-width', delta: 40 };
      case 'Escape':
        return { type: 'close-panel' };
      default:
        return { type: 'none' };
    }
  }

  private resolveCommandId(intent: InteractionIntent): AppCommandId | null {
    switch (intent.type) {
      case 'navigate':
        return intent.direction === 'next'
          ? APP_COMMAND_IDS.nextPage
          : APP_COMMAND_IDS.previousPage;
      case 'navigate-boundary':
        return intent.boundary === 'end'
          ? APP_COMMAND_IDS.goSectionEnd
          : APP_COMMAND_IDS.goSectionStart;
      case 'close-panel':
        return APP_COMMAND_IDS.closePanel;
      case 'adjust-font':
        return intent.delta > 0 ? APP_COMMAND_IDS.increaseFont : APP_COMMAND_IDS.decreaseFont;
      case 'adjust-width':
        return intent.delta > 0 ? APP_COMMAND_IDS.widenContent : APP_COMMAND_IDS.narrowContent;
      default:
        return null;
    }
  }
}
