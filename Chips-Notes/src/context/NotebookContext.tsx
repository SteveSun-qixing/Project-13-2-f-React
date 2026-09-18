/**
 * 笔记本状态管理
 * @description 管理笔记本目录树状态
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { notebookService, type TreeNode } from '../services/notebook-service';
import { getEditingEngineClient } from '../runtime/chips-client';

export interface NotebookContextValue {
  treeData: TreeNode[];
  loading: boolean;
  workspaceRoot: string;
  selectedKey: string | null;
  expandedKeys: string[];
  refreshTree: () => Promise<void>;
  createNotebook: (name: string, parentPath?: string) => Promise<void>;
  deleteNotebook: (key: string, path: string) => Promise<void>;
  renameNotebook: (key: string, path: string, newName: string) => Promise<void>;
  createNote: (name: string, notebookPath?: string) => Promise<void>;
  deleteNote: (key: string, path: string) => Promise<void>;
  renameNote: (key: string, path: string, newName: string) => Promise<void>;
  selectNode: (key: string) => void;
  setExpandedKeys: (keys: string[]) => void;
}

const NotebookContext = createContext<NotebookContextValue | null>(null);

export function useNotebook(): NotebookContextValue {
  const context = useContext(NotebookContext);
  if (!context) {
    throw new Error('useNotebook must be used within NotebookProvider');
  }
  return context;
}

export function NotebookProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const initializeWorkspace = useCallback(async () => {
    try {
      const client = getEditingEngineClient();
      const context = await client.workspace.getContext();
      const rootPath = context.rootPath;

      setWorkspaceRoot(rootPath);
      await notebookService.initialize(rootPath);
    } catch (error) {
      console.error('Failed to initialize workspace:', error);
    }
  }, []);

  const refreshTree = useCallback(async () => {
    if (!workspaceRoot) {
      return;
    }

    setLoading(true);
    try {
      const tree = await notebookService.buildTree(workspaceRoot);
      setTreeData(tree);
    } catch (error) {
      console.error('Failed to refresh tree:', error);
    } finally {
      setLoading(false);
    }
  }, [workspaceRoot]);

  const createNotebook = useCallback(async (name: string, parentPath?: string) => {
    await notebookService.createNotebook(name, parentPath);
    await refreshTree();
  }, [refreshTree]);

  const deleteNotebook = useCallback(async (key: string, path: string) => {
    await notebookService.deleteNotebook(path);
    if (selectedKey === key) {
      setSelectedKey(null);
    }
    await refreshTree();
  }, [refreshTree, selectedKey]);

  const renameNotebook = useCallback(async (key: string, path: string, newName: string) => {
    await notebookService.renameNotebook(path, newName);
    await refreshTree();
  }, [refreshTree]);

  const createNote = useCallback(async (name: string, notebookPath?: string) => {
    const { noteService } = await import('../services/note-service');
    await noteService.createNote(name, notebookPath);
    await refreshTree();
  }, [refreshTree]);

  const deleteNote = useCallback(async (key: string, path: string) => {
    const { noteService } = await import('../services/note-service');
    await noteService.deleteNote(path);
    if (selectedKey === key) {
      setSelectedKey(null);
    }
    await refreshTree();
  }, [refreshTree, selectedKey]);

  const renameNote = useCallback(async (key: string, path: string, newName: string) => {
    const { noteService } = await import('../services/note-service');
    await noteService.renameNote(path, newName);
    await refreshTree();
  }, [refreshTree]);

  const selectNode = useCallback((key: string) => {
    setSelectedKey(key);
  }, []);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  useEffect(() => {
    if (workspaceRoot) {
      refreshTree();
    }
  }, [workspaceRoot, refreshTree]);

  const value: NotebookContextValue = {
    treeData,
    loading,
    workspaceRoot,
    selectedKey,
    expandedKeys,
    refreshTree,
    createNotebook,
    deleteNotebook,
    renameNotebook,
    createNote,
    deleteNote,
    renameNote,
    selectNode,
    setExpandedKeys,
  };

  return <NotebookContext.Provider value={value}>{children}</NotebookContext.Provider>;
}
