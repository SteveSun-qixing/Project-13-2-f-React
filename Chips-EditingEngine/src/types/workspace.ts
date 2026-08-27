export interface WorkspaceFile {
    id: string;
    name: string;
    path: string;
    type: 'card' | 'box' | 'folder';
    createdAt: string;
    modifiedAt: string;
    children?: WorkspaceFile[];
    expanded?: boolean;
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
