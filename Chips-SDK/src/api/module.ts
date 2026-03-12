import type { CoreClient } from "../types/client";

export interface ModuleState {
  slot: string;
  module: Record<string, unknown>;
  mountedAt?: number;
  [key: string]: unknown;
}

export interface ModuleApi {
  mount(slot: string, module: Record<string, unknown>): Promise<void>;
  unmount(slot: string): Promise<void>;
  query(slot: string): Promise<ModuleState | undefined>;
  list(): Promise<ModuleState[]>;
}

export function createModuleApi(client: CoreClient): ModuleApi {
  return {
    async mount(slot, module) {
      await client.invoke("module.mount", { slot, module });
    },
    async unmount(slot) {
      await client.invoke("module.unmount", { slot });
    },
    async query(slot) {
      const { module } = await client.invoke<{ slot: string }, { module: ModuleState | null }>("module.query", { slot });
      return module ?? undefined;
    },
    async list() {
      const { modules } = await client.invoke<Record<string, never>, { modules: ModuleState[] }>("module.list", {});
      return modules;
    },
  };
}
