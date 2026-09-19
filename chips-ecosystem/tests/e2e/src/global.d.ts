import type { ChipsWindowBridge } from './types';

declare global {
  interface Window {
    readonly chips: ChipsWindowBridge;
  }
}

export {};
