import type { Client } from "chips-sdk";

export interface CardAst {
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contentFiles: string[];
}

export interface CardValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CardRenderView {
  title: string;
  body: string;
  contentFiles: string[];
  target: string;
  semanticHash: string;
}

export interface BoxInspection {
  path: string;
  type: "full" | "shell" | "mixed";
  cards: Array<{ path: string; type: "internal" | "external" }>;
  metadata?: Record<string, unknown>;
}

export interface RuntimeFileStat {
  path: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  mtimeMs: number;
}

export interface RecentWorkspaceTarget {
  path: string;
  kind: "card" | "box";
  title: string;
  openedAt: string;
}

export interface OpenFileDialogOptions {
  title: string;
  allowMultiple?: boolean;
  mustExist?: boolean;
}

export interface EditorRouteService {
  getConfig<T>(key: string): Promise<T | undefined>;
  setConfig<T>(key: string, value: T): Promise<void>;
  openFileDialog(options: OpenFileDialogOptions): Promise<string | null>;
  listFiles(dir: string): Promise<string[]>;
  statFile(path: string): Promise<RuntimeFileStat>;
  parseCard(cardFile: string): Promise<CardAst>;
  validateCard(cardFile: string): Promise<CardValidationResult>;
  renderCardPreview(cardFile: string): Promise<CardRenderView>;
  inspectBox(boxFile: string): Promise<BoxInspection>;
}

export function createEditorRouteService(client: Client): EditorRouteService {
  return {
    async getConfig<T>(key: string) {
      const result = await client.invoke<{ key: string }, { value?: T }>("config.get", { key });
      return result.value;
    },
    async setConfig<T>(key: string, value: T) {
      await client.invoke("config.set", { key, value });
    },
    async openFileDialog(options: OpenFileDialogOptions) {
      const result = await client.invoke<
        {
          options: {
            title: string;
            mode: "file";
            allowMultiple: boolean;
            mustExist: boolean;
          };
        },
        { filePaths: string[] | null }
      >("platform.dialogOpenFile", {
        options: {
          title: options.title,
          mode: "file",
          allowMultiple: options.allowMultiple === true,
          mustExist: options.mustExist !== false,
        },
      });

      return Array.isArray(result.filePaths) && result.filePaths.length > 0 ? result.filePaths[0] : null;
    },
    async listFiles(dir: string) {
      const result = await client.invoke<{ dir: string }, { entries: string[] }>("file.list", { dir });
      return result.entries;
    },
    async statFile(path: string) {
      const result = await client.invoke<{ path: string }, { meta: RuntimeFileStat }>("file.stat", { path });
      return result.meta;
    },
    async parseCard(cardFile: string) {
      const result = await client.invoke<{ cardFile: string }, { ast: CardAst }>("card.parse", { cardFile });
      return result.ast;
    },
    async validateCard(cardFile: string) {
      return client.invoke<{ cardFile: string }, CardValidationResult>("card.validate", { cardFile });
    },
    async renderCardPreview(cardFile: string) {
      const result = await client.invoke<
        {
          cardFile: string;
          options: {
            target: "card-iframe";
            mode: "preview";
          };
        },
        { view: CardRenderView }
      >("card.render", {
        cardFile,
        options: {
          target: "card-iframe",
          mode: "preview",
        },
      });
      return result.view;
    },
    async inspectBox(boxFile: string) {
      const result = await client.invoke<{ boxFile: string }, { inspection: BoxInspection }>("box.inspect", { boxFile });
      return result.inspection;
    },
  };
}
