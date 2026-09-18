/**
 * 笔记服务
 * @description 管理笔记（卡片）的创建、打开、保存、删除
 */

import { getEditingEngineClient } from '../runtime/chips-client';
import type { Client, CardStructure, CardMetadata } from 'chips-sdk';
import { getCardTypeDefinitionData } from '../basecards/types';

export interface Note {
  id: string;
  path: string;
  name: string;
  notebookPath?: string;
  structure: CardStructure;
  contents: CardContent[];
  metadata: CardMetadata;
  modifiedAt: string;
  dirty: boolean;
}

export interface CardContent {
  id: string;
  type: string;
  config: unknown;
  editing?: boolean;
}

function stripExtension(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class NoteService {
  private client: Client;
  private workspaceRoot: string = '';

  constructor(client?: Client) {
    this.client = client ?? getEditingEngineClient();
  }

  async initialize(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;
  }

  async createNote(name: string, notebookPath?: string): Promise<string> {
    const parent = notebookPath || this.workspaceRoot;
    if (!parent) {
      throw new Error('工作区未初始化，无法创建笔记');
    }

    const initialContent = {
      type: 'chips.basecard.rich-text',
      data: {
        content: '<p></p>',
      },
    };

    const result = await this.client.card.session.init(
      parent,
      name,
      initialContent,
      undefined
    );

    if (notebookPath) {
      try {
        const boxResult = await this.client.box.session.open(notebookPath);
        await this.client.box.session.addEntry(boxResult.sessionId, {
          filePath: result.cardDir,
        });
        await this.client.box.session.close(boxResult.sessionId);
      } catch (error) {
        console.warn('Failed to add note to notebook:', error);
      }
    }

    return result.cardDir;
  }

  async openNote(cardPath: string): Promise<Note> {
    const metadata = await this.client.card.readMetadata(cardPath);
    const structure = await this.client.card.readStructure(cardPath);

    const contents: CardContent[] = [];
    for (const basecard of structure.basecards) {
      try {
        const configPath = joinPath(cardPath, '.card', 'content', `${basecard.id}.yaml`);
        const configText = await this.client.file.readText(configPath);
        const yaml = await import('yaml');
        const config = yaml.parse(configText);

        contents.push({
          id: basecard.id,
          type: basecard.type,
          config: config,
          editing: false,
        });
      } catch (error) {
        console.warn(`Failed to read content for basecard ${basecard.id}:`, error);
      }
    }

    return {
      id: metadata.cardId,
      path: cardPath,
      name: metadata.name,
      structure,
      contents,
      metadata,
      modifiedAt: metadata.modifiedAt,
      dirty: false,
    };
  }

  async saveNote(cardPath: string, contents: CardContent[]): Promise<void> {
    const yaml = await import('yaml');

    for (const content of contents) {
      const configPath = joinPath(cardPath, '.card', 'content', `${content.id}.yaml`);
      const configYaml = yaml.stringify({
        type: content.type,
        config: content.config,
      });
      await this.client.file.writeText(configPath, configYaml);
    }

    const metadata = await this.client.card.readMetadata(cardPath);
    metadata.modifiedAt = new Date().toISOString();
    const metadataPath = joinPath(cardPath, '.card', 'metadata.yaml');
    await this.client.file.writeText(metadataPath, yaml.stringify(metadata));
  }

  async deleteNote(cardPath: string): Promise<void> {
    await this.client.file.delete(cardPath);
  }

  async renameNote(cardPath: string, newName: string): Promise<void> {
    const yaml = await import('yaml');
    const metadataPath = joinPath(cardPath, '.card', 'metadata.yaml');
    const metadata = await this.client.card.readMetadata(cardPath);

    metadata.name = stripExtension(newName, '.card');
    metadata.modifiedAt = new Date().toISOString();

    await this.client.file.writeText(metadataPath, yaml.stringify(metadata));
  }

  async moveNote(cardPath: string, targetNotebookPath: string): Promise<void> {
    const boxResult = await this.client.box.session.open(targetNotebookPath);
    await this.client.box.session.addEntry(boxResult.sessionId, {
      filePath: cardPath,
    });
    await this.client.box.session.close(boxResult.sessionId);
  }

  async insertBasecard(cardPath: string, basecardType: string, insertIndex?: number): Promise<string> {
    const structure = await this.client.card.readStructure(cardPath);
    const yaml = await import('yaml');

    const newBasecardId = `basecard-${Date.now()}`;
    const newBasecard = {
      id: newBasecardId,
      type: basecardType,
    };

    if (typeof insertIndex === 'number') {
      structure.basecards.splice(insertIndex, 0, newBasecard);
    } else {
      structure.basecards.push(newBasecard);
    }

    const structurePath = joinPath(cardPath, '.card', 'structure.yaml');
    await this.client.file.writeText(structurePath, yaml.stringify(structure));

    const contentPath = joinPath(cardPath, '.card', 'content', `${newBasecardId}.yaml`);
    const defaultConfig = this.getDefaultConfig(basecardType);
    await this.client.file.writeText(contentPath, yaml.stringify({
      type: basecardType,
      config: defaultConfig,
    }));

    return newBasecardId;
  }

  async removeBasecard(cardPath: string, basecardId: string): Promise<void> {
    const structure = await this.client.card.readStructure(cardPath);
    const yaml = await import('yaml');

    structure.basecards = structure.basecards.filter(bc => bc.id !== basecardId);

    const structurePath = joinPath(cardPath, '.card', 'structure.yaml');
    await this.client.file.writeText(structurePath, yaml.stringify(structure));

    const contentPath = joinPath(cardPath, '.card', 'content', `${basecardId}.yaml`);
    try {
      await this.client.file.delete(contentPath);
    } catch (error) {
      console.warn(`Failed to delete basecard content file: ${contentPath}`, error);
    }
  }

  async reorderBasecards(cardPath: string, newOrder: string[]): Promise<void> {
    const structure = await this.client.card.readStructure(cardPath);
    const yaml = await import('yaml');

    const reorderedBasecards = newOrder
      .map(id => structure.basecards.find(bc => bc.id === id))
      .filter((bc): bc is NonNullable<typeof bc> => bc !== undefined);

    const finalBasecards = reorderedBasecards.length === structure.basecards.length
      ? reorderedBasecards
      : structure.basecards;

    structure.basecards = finalBasecards;

    const structurePath = joinPath(cardPath, '.card', 'structure.yaml');
    await this.client.file.writeText(structurePath, yaml.stringify(structure));
  }

  async updateBasecardConfig(
    cardPath: string,
    basecardId: string,
    config: Record<string, unknown>
  ): Promise<void> {
    const yaml = await import('yaml');
    const contentPath = joinPath(cardPath, '.card', 'content', `${basecardId}.yaml`);
    const structure = await this.client.card.readStructure(cardPath);
    const basecard = structure.basecards.find(bc => bc.id === basecardId);

    if (!basecard) {
      throw new Error(`基础卡片不存在: ${basecardId}`);
    }

    const content = {
      type: basecard.type,
      config,
    };

    await this.client.file.writeText(contentPath, yaml.stringify(content));
  }

  private getDefaultConfig(basecardType: string): unknown {
    const def = getCardTypeDefinitionData(basecardType);
    return def ? { ...def.defaultConfig } : {};
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}

export const noteService = new NoteService();
