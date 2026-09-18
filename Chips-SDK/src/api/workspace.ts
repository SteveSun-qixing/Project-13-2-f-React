import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";
import type { FileCategory, FileDocumentType } from "./file";

export interface WorkspaceFileView {
  id: string;
  name: string;
  path: string;
  type: "card" | "box" | "folder" | "file";
  createdAt: string;
  modifiedAt: string;
  extension?: string | null;
  mimeType?: string;
  category?: FileCategory;
  documentType?: FileDocumentType | null;
  size?: number | null;
  children?: WorkspaceFileView[];
}

export interface WorkspaceContext {
  rootPath: string;
}

export interface WorkspaceApi {
  getContext(): Promise<WorkspaceContext>;
  scan(rootPath?: string): Promise<WorkspaceFileView[]>;
}

export function createWorkspaceApi(client: CoreClient): WorkspaceApi {
  return {
    async getContext() {
      const result = await client.invoke<Record<string, never>, WorkspaceContext>("workspace.getContext", {});
      if (!result || typeof result.rootPath !== "string" || result.rootPath.trim().length === 0) {
        throw createError("INVALID_RESPONSE", "workspace.getContext: rootPath is missing.");
      }
      return result;
    },
    async scan(rootPath) {
      const resolvedRootPath = rootPath?.trim() || (await this.getContext()).rootPath;
      const result = await client.invoke<{ rootPath: string }, { files: WorkspaceFileView[] }>(
        "workspace.scan",
        { rootPath: resolvedRootPath },
      );
      return result.files;
    },
  };
}
