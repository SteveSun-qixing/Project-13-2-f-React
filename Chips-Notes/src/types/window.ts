import type { IconDescriptor } from "chips-sdk";
import type { Position, Size } from './editor';

export type WindowPosition = Position;
export type WindowSize = Size;
export type { Position, Size } from './editor';

export type WindowState = 'normal' | 'minimized' | 'maximized' | 'collapsed' | 'cover';
export type WindowType = 'card' | 'box' | 'tool' | 'dialog';

export interface BaseWindowConfig {
    id: string;
    type: WindowType;
    title: string;
    icon?: IconDescriptor;
    position: WindowPosition;
    size: WindowSize;
    state: WindowState;
    zIndex: number;
    resizable?: boolean;
    draggable?: boolean;
    closable?: boolean;
    minimizable?: boolean;
    maximizable?: boolean;
}

export interface CardWindowConfig extends BaseWindowConfig {
    type: 'card';
    cardId: string;
    isEditing?: boolean;
    coverRatio?: string;
}

export interface BoxWindowConfig extends BaseWindowConfig {
    type: 'box';
    boxId: string;
    boxPath: string;
}

export interface ToolWindowConfig extends BaseWindowConfig {
    type: 'tool';
    component: string;
    dockable?: boolean;
}

export type AnyWindowConfig = CardWindowConfig | BoxWindowConfig | ToolWindowConfig;
