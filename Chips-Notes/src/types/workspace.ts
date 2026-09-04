export type WorkspaceFileType = 'card' | 'box' | 'folder' | 'file';

export type WorkspaceFileCategory =
    | 'document'
    | 'image'
    | 'video'
    | 'audio'
    | 'text'
    | 'html'
    | 'archive'
    | 'unknown';

export interface WorkspaceFile {
    id: string;
    name: string;
    path: string;
    type: WorkspaceFileType;
    createdAt: string;
    modifiedAt: string;
    /** 普通文件的资源标识；本地文件通常为空，由 Host resource-open 生成。 */
    resourceId?: string;
    extension?: string;
    mimeType?: string;
    category?: WorkspaceFileCategory;
    size?: number;
    children?: WorkspaceFile[];
    expanded?: boolean;
}

export interface WorkspaceOpenTarget {
    id: string;
    path: string;
    name: string;
    type: WorkspaceFileType;
    resourceId?: string;
    extension?: string;
    mimeType?: string;
    category?: WorkspaceFileCategory;
}

export interface WorkspaceFileEventPayload {
    file: WorkspaceFile;
    target: WorkspaceOpenTarget;
    openOptions?: {
        windowPosition?: { x: number; y: number };
        isEditing?: boolean;
    };
}

export interface BasicCardConfig {
    id: string;
    type: string;
    config: Record<string, unknown>;
}

export interface WorkspaceState {
    initialized: boolean;
    rootPath: string;
    files: WorkspaceFile[];
    openedFiles: string[];
}
