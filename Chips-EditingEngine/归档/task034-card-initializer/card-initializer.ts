import yaml from 'yaml';
import { fileService } from '../services/file-service';
import { createDefaultCoverHtml, DEFAULT_COVER_RATIO } from '../utils/card-cover';

export interface BasicCardConfig {
    id: string;
    type: string;
    config: Record<string, unknown>;
}

export interface CardInitializerConfig {
    workspaceRoot: string;
}

export interface CreateCardResult {
    success: boolean;
    cardPath: string;
    error?: string;
}

function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function createCardInitializer(config: CardInitializerConfig) {
    const { workspaceRoot } = config;

    async function createCard(
        cardId: string,
        name: string,
        initialContent?: BasicCardConfig
    ): Promise<CreateCardResult> {
        try {
            const cardFolderName = `${cardId}.card`;
            const cardPath = joinPath(workspaceRoot, cardFolderName);
            const metaDir = joinPath(cardPath, '.card');
            const contentDir = joinPath(cardPath, 'content');

            const timestamp = new Date().toISOString();
            const metadata = {
                chip_standards_version: '1.0.0',
                card_id: cardId,
                name: name.trim(),
                created_at: timestamp,
                modified_at: timestamp,
                theme: '',
                cover_ratio: DEFAULT_COVER_RATIO,
                tags: [],
                description: '',
            };

            const structure = {
                structure: initialContent ? [{
                    id: initialContent.id,
                    type: initialContent.type,
                    created_at: timestamp,
                    modified_at: timestamp,
                }] : [],
                manifest: {
                    card_count: initialContent ? 1 : 0,
                    resource_count: 0,
                    resources: [],
                },
            };

            await fileService.ensureDir(cardPath);
            await fileService.ensureDir(metaDir);
            await fileService.ensureDir(contentDir);

            await fileService.writeText(joinPath(metaDir, 'metadata.yaml'), yaml.stringify(metadata));
            await fileService.writeText(joinPath(metaDir, 'structure.yaml'), yaml.stringify(structure));
            await fileService.writeText(joinPath(metaDir, 'cover.html'), createDefaultCoverHtml(name.trim()));

            if (initialContent) {
                await fileService.writeText(
                    joinPath(contentDir, `${initialContent.id}.yaml`),
                    yaml.stringify(initialContent.config),
                );
            }

            return {
                success: true,
                cardPath,
            };
        } catch (e) {
            console.error('[CardInitializer] Failed to create card:', e);
            return {
                success: false,
                cardPath: '',
                error: e instanceof Error ? e.message : 'Unknown error',
            };
        }
    }

    return { createCard };
}
