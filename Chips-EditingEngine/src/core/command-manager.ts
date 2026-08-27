/**
 * 命令历史适配层（undo/redo）
 * @module core/command-manager
 * @description
 * task034 M2 改造：本地命令模式历史栈已上移 Host（card.session.undo/redo/history），
 * 本模块保留 CommandManager 公开接口（getState/getHistory/getRedoHistory/undo/redo/clear），
 * 内部代理到当前活跃卡片的会话历史，供命令层与历史面板消费。
 */

import { getCardService } from './card-service';
import { globalEventEmitter } from './event-emitter';

export interface CommandManagerState {
    canUndo: boolean;
    canRedo: boolean;
}

export interface CommandHistoryEntry {
    id: string;
    label: string;
    recordedAt: number;
}

function toHistoryEntry(label: string, recordedAt: number): CommandHistoryEntry {
    return { id: String(recordedAt), label, recordedAt };
}

let commandManagerInstance: CommandManager | null = null;

export class CommandManager {
    private state: CommandManagerState = {
        canUndo: false,
        canRedo: false,
    };

    private async refreshState(): Promise<void> {
        try {
            const history = await getCardService().getHistory();
            this.state = {
                canUndo: history.undoAvailable,
                canRedo: history.redoAvailable,
            };
            globalEventEmitter.emit('command:state-changed', this.state);
        } catch {
            this.state = { canUndo: false, canRedo: false };
            globalEventEmitter.emit('command:state-changed', this.state);
        }
    }

    getState(): CommandManagerState {
        return { ...this.state };
    }

    subscribe(listener: (state: CommandManagerState) => void): () => void {
        const handler = (state: CommandManagerState): void => listener(state);
        globalEventEmitter.on('command:state-changed', handler as never);
        return () => globalEventEmitter.off('command:state-changed', handler as never);
    }

    async undo(): Promise<boolean> {
        const result = await getCardService().undo();
        await this.refreshState();
        globalEventEmitter.emit('command:undo', { success: result });
        return result;
    }

    async redo(): Promise<boolean> {
        const result = await getCardService().redo();
        await this.refreshState();
        globalEventEmitter.emit('command:redo', { success: result });
        return result;
    }

    async getHistory(maxItems?: number): Promise<CommandHistoryEntry[]> {
        const history = await getCardService().getHistory();
        const entries = history.undoStack.map((entry) => toHistoryEntry(entry.label, entry.recordedAt));
        return maxItems ? entries.slice(0, maxItems) : entries;
    }

    async getRedoHistory(): Promise<CommandHistoryEntry[]> {
        const history = await getCardService().getHistory();
        return history.redoStack.map((entry) => toHistoryEntry(entry.label, entry.recordedAt));
    }

    /** 跳转到指定历史点（按 recordedAt 定位撤销深度） */
    async goToHistory(historyId: string): Promise<boolean> {
        const history = await getCardService().getHistory();
        const targetIndex = history.undoStack.findIndex((entry) => String(entry.recordedAt) === historyId);
        if (targetIndex === -1) {
            return false;
        }
        for (let index = 0; index <= targetIndex; index += 1) {
            await getCardService().undo();
        }
        await this.refreshState();
        return true;
    }

    async clear(): Promise<void> {
        this.state = { canUndo: false, canRedo: false };
        globalEventEmitter.emit('command:state-changed', this.state);
    }
}

export function createCommandManager(): CommandManager {
    return new CommandManager();
}

export function useCommandManager(): CommandManager {
    if (!commandManagerInstance) {
        commandManagerInstance = createCommandManager();
    }
    return commandManagerInstance;
}

export function getCommandManager(): CommandManager {
    return useCommandManager();
}

export function resetCommandManager(): void {
    commandManagerInstance = null;
}
