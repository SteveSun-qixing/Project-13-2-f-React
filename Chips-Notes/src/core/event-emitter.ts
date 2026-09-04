/**
 * 事件发射器 - 增强版
 * @module core/event-emitter
 * @description 提供完整的事件发布/订阅功能
 */

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface Subscription {
    id: string;
    handler: EventHandler;
    once: boolean;
}

export interface EventEmitter {
    on<T>(event: string, handler: EventHandler<T>): string;
    once<T>(event: string, handler: EventHandler<T>): string;
    off(event: string, handlerOrId?: EventHandler | string): void;
    emit<T>(event: string, payload: T): void;
    waitFor<T>(event: string, timeout?: number): Promise<T>;
    hasListeners(event: string): boolean;
    listenerCount(event: string): number;
    eventNames(): string[];
    clear(): void;
}

let subscriptionId = 0;

export function createEventEmitter(): EventEmitter {
    const subscriptions = new Map<string, Subscription[]>();

    const generateId = () => `sub-${++subscriptionId}`;

    const getSubscriptions = (event: string): Subscription[] => {
        if (!subscriptions.has(event)) {
            subscriptions.set(event, []);
        }
        return subscriptions.get(event)!;
    };

    return {
        on<T>(event: string, handler: EventHandler<T>): string {
            const id = generateId();
            const subscription: Subscription = { id, handler: handler as EventHandler, once: false };
            getSubscriptions(event).push(subscription);
            return id;
        },

        once<T>(event: string, handler: EventHandler<T>): string {
            const id = generateId();
            const subscription: Subscription = { id, handler: handler as EventHandler, once: true };
            getSubscriptions(event).push(subscription);
            return id;
        },

        off(event: string, handlerOrId?: EventHandler | string): void {
            if (!handlerOrId) {
                subscriptions.delete(event);
                return;
            }

            const subs = subscriptions.get(event);
            if (!subs) return;

            const index = subs.findIndex(sub =>
                typeof handlerOrId === 'string'
                    ? sub.id === handlerOrId
                    : sub.handler === handlerOrId
            );

            if (index !== -1) {
                subs.splice(index, 1);
            }

            if (subs.length === 0) {
                subscriptions.delete(event);
            }
        },

        emit<T>(event: string, payload: T): void {
            const subs = subscriptions.get(event) ?? [];
            const wildcardSubs = subscriptions.get('*') ?? [];
            const allSubs = [...subs, ...wildcardSubs];

            const toRemove: Array<{ event: string; id: string }> = [];

            allSubs.forEach(sub => {
                try {
                    const result = sub.handler(payload);
                    if (result && typeof (result as PromiseLike<void>).then === 'function') {
                        void (result as Promise<void>).catch((error) => {
                            console.error(`[EventEmitter] Async handler error for ${event}:`, error);
                        });
                    }
                    if (sub.once) {
                        const targetEvent = subs.includes(sub) ? event : '*';
                        toRemove.push({ event: targetEvent, id: sub.id });
                    }
                } catch (error) {
                    console.error(`[EventEmitter] Handler error for ${event}:`, error);
                }
            });

            toRemove.forEach(({ event: e, id }) => this.off(e, id));
        },

        waitFor<T>(event: string, timeout = 30000): Promise<T> {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    this.off(event, id);
                    reject(new Error(`Timeout waiting for event: ${event}`));
                }, timeout);

                const id = this.once<T>(event, (data) => {
                    clearTimeout(timer);
                    resolve(data);
                });
            });
        },

        hasListeners(event: string): boolean {
            return (subscriptions.get(event)?.length ?? 0) > 0;
        },

        listenerCount(event: string): number {
            return subscriptions.get(event)?.length ?? 0;
        },

        eventNames(): string[] {
            return Array.from(subscriptions.keys());
        },

        clear(): void {
            subscriptions.clear();
        }
    };
}

export const globalEventEmitter = createEventEmitter();
