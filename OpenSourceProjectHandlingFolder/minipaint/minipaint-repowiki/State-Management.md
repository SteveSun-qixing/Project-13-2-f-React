# State Management

> **Relevant source files**
> * [src/js/actions/autoresize-canvas.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/autoresize-canvas.js)
> * [src/js/actions/index.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/index.js)
> * [src/js/actions/init-canvas-zoom.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/init-canvas-zoom.js)
> * [src/js/actions/insert-layer.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js)
> * [src/js/actions/prepare-canvas.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/prepare-canvas.js)
> * [src/js/actions/reset-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/reset-selection.js)
> * [src/js/actions/select-layer.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/select-layer.js)
> * [src/js/actions/select-next-layer.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/select-next-layer.js)
> * [src/js/actions/select-previous-layer.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/select-previous-layer.js)
> * [src/js/actions/set-selection.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/set-selection.js)
> * [src/js/actions/stop-animation.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/stop-animation.js)
> * [src/js/actions/toggle-layer-visibility.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/toggle-layer-visibility.js)
> * [src/js/actions/update-layer.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/update-layer.js)
> * [src/js/core/base-state.js](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js)

## Purpose and Scope

The State Management system in miniPaint provides an action-based architecture that enables operations like undo/redo throughout the application. This page explains how the state management system works, the structure of actions, and how to use them to make application changes that can be undone and redone.

For information about the configuration system that holds the application state, see [Configuration System](/viliusle/miniPaint/2.2-configuration-system).

## Overview

miniPaint uses an action-based state management approach where all meaningful state changes are performed through action objects. These actions know how to perform a change (`do()`) and how to reverse it (`undo()`). The state management system tracks these actions in a history stack, enabling undo/redo functionality.

### State Management Architecture

```

```

Sources: [src/js/core/base-state.js L1-L222](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L1-L222)

## The Base State Class

The central component of the state management system is the `Base_state_class`, which is implemented as a singleton class that handles:

1. Tracking action history
2. Executing actions (do)
3. Undoing actions
4. Redoing actions
5. Managing memory usage

### Key State Manager Methods

| Method | Purpose |
| --- | --- |
| `do_action(action, options)` | Performs an action and adds it to history |
| `undo_action()` | Undoes the most recent action in history |
| `redo_action()` | Redoes a previously undone action |
| `free(memory_size, database_size)` | Frees action history to reclaim memory |

The state manager listens for keyboard shortcuts (Ctrl+Z and Ctrl+Y) to trigger undo and redo operations.

```

```

Sources: [src/js/core/base-state.js L41-L57](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L41-L57)

 [src/js/core/base-state.js L60-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L60-L118)

 [src/js/core/base-state.js L138-L145](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L138-L145)

 [src/js/core/base-state.js L127-L136](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L127-L136)

## Action System

The action system consists of a base action class and many specialized action implementations. Each action class is responsible for a specific type of state change and knows how to perform and reverse that change.

### Action Class Hierarchy

```

```

Sources: [src/js/actions/index.js L1-L26](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/index.js#L1-L26)

 [src/js/actions/insert-layer.js L6-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L6-L214)

 [src/js/actions/update-layer.js L5-L67](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/update-layer.js#L5-L67)

## Action Lifecycle

Every action in miniPaint follows a standard lifecycle from creation to execution:

```

```

Sources: [src/js/core/base-state.js L60-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L60-L118)

 [src/js/core/base-state.js L138-L145](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L138-L145)

### Executing Actions

Actions are performed using the `do_action()` method of the state manager:

```

```

The `do_action()` method:

1. Calls the action's `do()` method
2. Removes any redo actions if this is a new action (not a redo)
3. Adds the action to history
4. Manages memory if needed

Sources: [src/js/core/base-state.js L60-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L60-L118)

## Creating Actions

Each action in miniPaint must implement three key methods:

| Method | Purpose |
| --- | --- |
| `do()` | Performs the action and records state for undo |
| `undo()` | Reverses the action using previously recorded state |
| `free()` | Cleans up resources when action is no longer needed in history |

Actions should always call their parent method using `super.do()` or `super.undo()` at the beginning of their implementation.

### Example Action Implementation

The following is a simplified view of the `Update_layer_action`:

```

```

Sources: [src/js/actions/update-layer.js L5-L67](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/update-layer.js#L5-L67)

## Action Composition

Actions can compose other actions, which is a powerful pattern in miniPaint. For example, the `Insert_layer_action` might trigger an `Autoresize_canvas_action` and other related actions.

### Composite Actions Example

The `Insert_layer_action` demonstrates action composition:

```

```

In this pattern, the parent action:

1. Creates child actions during its `do()` method
2. Stores references to these child actions
3. Calls their `undo()` methods in its own `undo()` method
4. Frees them in its `free()` method

Sources: [src/js/actions/insert-layer.js L82-L83](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L82-L83)

 [src/js/actions/insert-layer.js L139-L140](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L139-L140)

 [src/js/actions/insert-layer.js L163-L168](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L163-L168)

 [src/js/actions/insert-layer.js L178-L194](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L178-L194)

## Memory Management

The state management system includes automatic memory management to prevent excessive memory usage:

1. Maximum history size is limited (default: 50 actions)
2. Oldest actions are freed when the limit is reached
3. Actions with large memory footprints are freed when memory pressure is high
4. The `free()` method in actions releases resources

```

```

Sources: [src/js/core/base-state.js L107-L112](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L107-L112)

 [src/js/core/base-state.js L155-L197](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L155-L197)

## Best Practices

When working with the miniPaint state management system, follow these best practices:

1. **Use actions for all state changes**: Any change that should be undoable should be implemented as an action.
2. **Store only what's needed for undo**: Only store the minimum state required to undo an action.
3. **Implement proper cleanup**: Always implement the `free()` method to release resources.
4. **Handle action failures gracefully**: Actions might throw errors if they shouldn't run (e.g., trying to delete a non-existent layer).
5. **Use action composition**: Split complex operations into multiple smaller actions when appropriate.
6. **Consider memory usage**: Be aware of actions that store large amounts of data.
7. **Chain related actions**: Use the `options.merge_with_history` parameter of `do_action()` to merge related actions.

Sources: [src/js/core/base-state.js L60-L118](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/core/base-state.js#L60-L118)

 [src/js/actions/insert-layer.js L6-L214](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/insert-layer.js#L6-L214)

 [src/js/actions/update-layer.js L5-L67](https://github.com/viliusle/miniPaint/blob/6d0b95e5/src/js/actions/update-layer.js#L5-L67)

## Conclusion

The state management system in miniPaint provides a robust foundation for implementing undoable operations. By using the action-based architecture, developers can create complex interactions while maintaining a reliable undo/redo functionality. The system's memory management features ensure that the application remains responsive even during extended editing sessions.