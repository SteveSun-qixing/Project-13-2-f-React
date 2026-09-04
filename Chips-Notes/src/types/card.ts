export interface CardResource {
    path: string;
    type: string;
    size: number;
}

export interface CardManifest {
    card_count: number;
    resource_count: number;
    resources: CardResource[];
}

export interface CardStructure {
    structure: any[];
    manifest: CardManifest;
}

export interface CardMetadata {
    chip_standards_version: string;
    card_id: string;
    name: string;
    created_at: string;
    modified_at: string;
}

export interface CardInfo {
    id: string;
    metadata: CardMetadata;
    structure: CardStructure;
    resources: Map<string, Blob | ArrayBuffer>;
    filePath?: string;
    isModified?: boolean;
}

export interface BaseCardInfo {
    id: string;
    type: string;
    config: Record<string, unknown>;
}
