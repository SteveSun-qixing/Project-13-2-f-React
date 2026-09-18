/**
 * 笔记本服务
 * @description 管理笔记本（箱子）的创建、删除、重命名和扫描
 */

import { getEditingEngineClient } from '../runtime/chips-client';
import type { Client } from 'chips-sdk';

export interface NotebookInfo {
  id: string;
  name: string;
  path: string;
  type: 'notebook';
  createdAt: string;
  modifiedAt: string;
  children?: NoteInfo[];
}

export interface NoteInfo {
  id: string;
  name: string;
  path: string;
  type: 'note';
  createdAt: string;
  modifiedAt: string;
}

export interface TreeNode {
  key: string;
  title: string;
  type: 'root' | 'notebook' | 'note';
  path?: string;
  children?: TreeNode[];
  isLeaf?: boolean;
}

const DEFAULT_LAYOUT_TYPE = 'chips.layout.document-library';

function stripExtension(name: string, ext: string): string {
  return name.toLowerCase().endsWith(ext) ? name.slice(0, -ext.length) : name;
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class NotebookService {
  private client: Client;
  private workspaceRoot: string = '';

  constructor(client?: Client) {
    this.client = client ?? getEditingEngineClient();
  }

  async initialize(workspaceRoot: string): Promise<void> {
    this.workspaceRoot = workspaceRoot;
  }

  async buildTree(workspacePath: string): Promise<TreeNode[]> {
    this.workspaceRoot = workspacePath;
    const files = await this.client.workspace.scan(workspacePath);

    const rootChildren: TreeNode[] = [];

    for (const file of files) {
      if (file.type === 'box') {
        const boxNode: TreeNode = {
          key: file.id,
          title: stripExtension(file.name, '.box'),
          type: 'notebook',
          path: file.path,
          children: [],
        };

        try {
          const notes = await this.listNotes(file.path);
          boxNode.children = notes.map(note => ({
            key: note.id,
            title: stripExtension(note.name, '.card'),
            type: 'note',
            path: note.path,
            isLeaf: true,
          }));
        } catch (error) {
          console.warn(`Failed to load notes for notebook ${file.path}:`, error);
          boxNode.children = [];
        }

        rootChildren.push(boxNode);
      } else if (file.type === 'card') {
        rootChildren.push({
          key: file.id,
          title: stripExtension(file.name, '.card'),
          type: 'note',
          path: file.path,
          isLeaf: true,
        });
      }
    }

    return rootChildren;
  }

  async createNotebook(name: string, parentPath?: string): Promise<string> {
    const parent = parentPath || this.workspaceRoot;
    if (!parent) {
      throw new Error('工作区未初始化，无法创建笔记本');
    }

    const result = await this.client.box.session.create(
      name,
      DEFAULT_LAYOUT_TYPE,
      parent
    );

    return result.boxFile;
  }

  async deleteNotebook(boxPath: string): Promise<void> {
    await this.client.file.delete(boxPath);
  }

  async renameNotebook(boxPath: string, newName: string): Promise<string> {
    const result = await this.client.box.session.rename(boxPath, newName);
    return result.boxFile;
  }

  async listNotes(boxPath: string): Promise<NoteInfo[]> {
    const result = await this.client.box.session.open(boxPath);
    const entries = result.snapshot.entries;

    const notes: NoteInfo[] = [];
    for (const entry of entries) {
      if (entry.entryType === 'card' && entry.cardPath) {
        try {
          const metadata = await this.client.card.readMetadata(entry.cardPath);
          notes.push({
            id: metadata.cardId,
            name: `${metadata.name}.card`,
            path: entry.cardPath,
            type: 'note',
            createdAt: metadata.createdAt,
            modifiedAt: metadata.modifiedAt,
          });
        } catch (error) {
          console.warn(`Failed to read card metadata for ${entry.cardPath}:`, error);
        }
      }
    }

    await this.client.box.session.close(result.sessionId);

    return notes;
  }

  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}

export const notebookService = new NotebookService();
