import type { CoreClient } from "../types/client";
import { createError } from "../types/errors";

export interface WorkspaceFileView {
  id: string;
  name: string;
  path: string;
  type: "card" | "box" | "folder";
  createdAt: string;
  modifiedAt: string;
  children?: WorkspaceFileView[];
}

export interface WorkspaceApi {
  scan(rootPath: string): Promise<WorkspaceFileView[]>;
}

export function createWorkspaceApi(client: CoreClient): WorkspaceApi {
  return {
    async scan(rootPath) {
      if (!rootPath) {
        throw createError("INVALID_ARGUMENT", "workspace.scan: rootPath is required.");
      }
      const result = await client.invoke<{ rootPath: string }, { files: WorkspaceFileView[] }>(
        "workspace.scan",
        { rootPath },
      );
      return result.files;
    },
  };
}
