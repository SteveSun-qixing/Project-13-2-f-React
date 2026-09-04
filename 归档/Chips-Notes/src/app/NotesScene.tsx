/**
 * 笔记应用主场景
 *
 * 职责：
 * - 工作区初始化与配置持久化（client.config）；
 * - 笔记本（箱子）列表与展开会话管理（box.session 链路）；
 * - 笔记（卡片）的选择、加载、自动保存（500ms 防抖）与增删改；
 * - 目录树数据构建与侧边栏 / 编辑区编排；
 * - 注册命令系统（与 @chips/ui 命令面板联动）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Input, Modal } from 'antd';
import { chipsClient } from '../runtime/chips-client';
import { Sidebar } from '../components/Sidebar/Sidebar';
import { EditorView } from '../components/Editor/EditorView';
import { EmptyState } from '../components/EmptyState/EmptyState';
import type {
  Note,
  Notebook,
  NotesConfig,
  NoteEditorState,
  TreeNode,
} from '../types';
import { DEFAULT_NOTEBOOK_NAME, DEFAULT_NOTE_TITLE } from '../types/workspace';
import { messages } from '../lib/messages';
import { buildTreeData } from '../lib/tree';
import {
  AUTO_SAVE_DEBOUNCE_MS,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from '../lib/constants';
import { useNotesCommands } from '../commands/useNotesCommands';
import type { MarkdownEditorHandle } from '../components/Editor/MarkdownEditor';
import {
  listNotebooks,
  createNotebook,
  renameNotebook,
  deleteNotebook,
} from '../services/notebook-service';
import {
  loadNote,
  saveNote,
  createNote,
  renameNote,
  deleteNote,
  listNotes,
} from '../services/note-service';
import { closeNotebookSession } from '../services/session-registry';
import {
  getWorkspaceConfig,
  saveWorkspaceConfig,
  ensureWorkspaceExists,
  selectWorkspace,
  getDefaultWorkspacePath,
  createDefaultConfig,
} from '../services/workspace-service';

interface SceneState {
  initialized: boolean;
  config: NotesConfig | null;
  notebooks: Notebook[];
  /** 每个笔记本展开后的笔记列表（key = boxId） */
  notesByNotebook: Record<string, Note[]>;
  expandedNotebookIds: string[];
  currentNote: Note | null;
  editor: NoteEditorState;
  sidebarWidth: number;
}

const initialEditorState: NoteEditorState = {
  note: null,
  document: null,
  content: '',
  modified: false,
  loading: false,
  saving: false,
};

type PendingDialog =
  | { kind: 'new-notebook' }
  | { kind: 'new-note'; notebook: Notebook }
  | null;

export function NotesScene(): React.ReactElement {
  const { modal, message } = App.useApp();

  const [state, setState] = useState<SceneState>({
    initialized: false,
    config: null,
    notebooks: [],
    notesByNotebook: {},
    expandedNotebookIds: [],
    currentNote: null,
    editor: initialEditorState,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  });

  const [dialog, setDialog] = useState<PendingDialog>(null);
  const [dialogName, setDialogName] = useState('');

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorApiRef = useRef<MarkdownEditorHandle | null>(null);
  const initLockRef = useRef(false);

  /** 立即保存当前笔记（跳过防抖） */
  const saveCurrentNote = useCallback(
    async (scene: SceneState): Promise<void> => {
      const { editor, config } = scene;
      if (!editor.note || !editor.document || !config) {
        return;
      }
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      setState((prev) => ({ ...prev, editor: { ...prev.editor, saving: true } }));
      try {
        const saved = await saveNote(
          chipsClient,
          config.workspacePath,
          editor.note,
          editor.content,
        );
        setState((prev) => {
          const notes = prev.notesByNotebook[saved.notebookId]?.map((item) =>
            item.entryId === saved.entryId ? saved : item,
          );
          return {
            ...prev,
            notesByNotebook: notes ? { ...prev.notesByNotebook, [saved.notebookId]: notes } : prev.notesByNotebook,
            currentNote: prev.currentNote?.entryId === saved.entryId ? saved : prev.currentNote,
            editor: { ...prev.editor, note: saved, modified: false, saving: false },
          };
        });
      } catch (error) {
        console.error('保存笔记失败:', error);
        message.error(messages.editor.saveFailed);
        setState((prev) => ({ ...prev, editor: { ...prev.editor, saving: false } }));
      }
    },
    [message],
  );

  const saveCurrentNoteRef = useRef(saveCurrentNote);
  saveCurrentNoteRef.current = saveCurrentNote;

  // 初始化工作区
  useEffect(() => {
    if (initLockRef.current) {
      return;
    }
    initLockRef.current = true;

    const init = async () => {
      try {
        let config = await getWorkspaceConfig(chipsClient);

        if (!config) {
          const defaultPath = await getDefaultWorkspacePath(chipsClient);
          await ensureWorkspaceExists(chipsClient, defaultPath);
          config = createDefaultConfig(defaultPath);
          await saveWorkspaceConfig(chipsClient, config);
        }

        await ensureWorkspaceExists(chipsClient, config.workspacePath);
        const notebooks = await listNotebooks(chipsClient, config.workspacePath);

        setState((prev) => ({
          ...prev,
          initialized: true,
          config,
          notebooks,
          sidebarWidth: Math.min(
            MAX_SIDEBAR_WIDTH,
            Math.max(MIN_SIDEBAR_WIDTH, config.sidebarWidth || DEFAULT_SIDEBAR_WIDTH),
          ),
          expandedNotebookIds: config.expandedNotebookIds ?? [],
        }));
      } catch (error) {
        console.error('初始化工作区失败:', error);
        message.error(messages.error.unknown);
        setState((prev) => ({ ...prev, initialized: true }));
      }
    };

    void init();
  }, [message]);

  // 展开笔记本时加载其笔记列表（打开箱子编辑会话）
  const expandNotebook = useCallback(async (notebook: Notebook) => {
    try {
      const notes = await listNotes(chipsClient, notebook);
      setState((prev) => ({
        ...prev,
        notesByNotebook: { ...prev.notesByNotebook, [notebook.id]: notes },
        expandedNotebookIds: prev.expandedNotebookIds.includes(notebook.id)
          ? prev.expandedNotebookIds
          : [...prev.expandedNotebookIds, notebook.id],
      }));
      return notes;
    } catch (error) {
      console.error('加载笔记本内容失败:', error);
      message.error(messages.error.notebookLoadFailed);
      return [];
    }
  }, [message]);

  // 收起笔记本（仅更新 UI 状态，会话保留供后续快速展开）
  const collapseNotebook = useCallback((notebook: Notebook) => {
    setState((prev) => ({
      ...prev,
      expandedNotebookIds: prev.expandedNotebookIds.filter((id) => id !== notebook.id),
    }));
  }, []);

  // 展开状态持久化
  useEffect(() => {
    if (!state.config) {
      return;
    }
    void saveWorkspaceConfig(chipsClient, {
      ...state.config,
      expandedNotebookIds: state.expandedNotebookIds,
    });
  }, [state.config, state.expandedNotebookIds]);

  // 选择笔记
  const selectNote = useCallback(
    async (note: Note) => {
      if (!state.config) {
        return;
      }
      // 切换前先保存未持久化的修改
      if (state.editor.modified && state.editor.note) {
        await saveCurrentNoteRef.current(state);
      }

      setState((prev) => ({
        ...prev,
        currentNote: note,
        editor: { ...initialEditorState, note, loading: true },
      }));

      try {
        const result = await loadNote(chipsClient, state.config.workspacePath, note);
        setState((prev) => ({
          ...prev,
          currentNote: note,
          editor: {
            note,
            document: result.document,
            content: result.document.markdown,
            modified: false,
            loading: false,
            saving: false,
          },
        }));
      } catch (error) {
        console.error('加载笔记失败:', error);
        message.error(messages.editor.loadFailed);
        setState((prev) => ({
          ...prev,
          editor: { ...initialEditorState, error: messages.editor.loadFailed },
        }));
      }
    },
    [state.config, state.editor.modified, state.editor.note, message],
  );

  // 内容变更：标记修改并调度 500ms 防抖自动保存
  const handleContentChange = useCallback((content: string) => {
    setState((prev) => ({
      ...prev,
      editor: { ...prev.editor, content, modified: true },
    }));

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      setState((prev) => {
        if (prev.editor.modified && prev.editor.note && prev.editor.document) {
          void saveCurrentNoteRef.current(prev);
        }
        return prev;
      });
    }, AUTO_SAVE_DEBOUNCE_MS);
  }, []);

  const handleManualSave = useCallback(() => {
    void saveCurrentNoteRef.current(state);
  }, [state]);

  // 目录树数据
  const treeData = useMemo<TreeNode[]>(
    () =>
      buildTreeData({
        notebooks: state.notebooks,
        expandedNotebookIds: state.expandedNotebookIds,
        notesByNotebook: state.notesByNotebook,
      }),
    [state.notebooks, state.expandedNotebookIds, state.notesByNotebook],
  );

  // 新建笔记本
  const handleCreateNotebook = useCallback(async () => {
    if (!state.config) {
      return;
    }
    const name = dialogName.trim() || DEFAULT_NOTEBOOK_NAME;
    setDialog(null);
    setDialogName('');
    try {
      const notebook = await createNotebook(chipsClient, state.config.workspacePath, name);
      setState((prev) => ({ ...prev, notebooks: [notebook, ...prev.notebooks] }));
      await expandNotebook(notebook);
      message.success('笔记本创建成功');
    } catch (error) {
      console.error('创建笔记本失败:', error);
      message.error('创建笔记本失败');
    }
  }, [state.config, dialogName, expandNotebook, message]);

  // 新建笔记
  const handleCreateNote = useCallback(async () => {
    if (!state.config || dialog?.kind !== 'new-note') {
      return;
    }
    const notebook = dialog.notebook;
    const title = dialogName.trim() || DEFAULT_NOTE_TITLE;
    setDialog(null);
    setDialogName('');
    try {
      const note = await createNote(chipsClient, state.config.workspacePath, notebook, title);
      const notes = await listNotes(chipsClient, notebook);
      setState((prev) => ({
        ...prev,
        notesByNotebook: { ...prev.notesByNotebook, [notebook.id]: notes },
        expandedNotebookIds: prev.expandedNotebookIds.includes(notebook.id)
          ? prev.expandedNotebookIds
          : [...prev.expandedNotebookIds, notebook.id],
      }));
      await selectNote(note);
      message.success('笔记创建成功');
    } catch (error) {
      console.error('创建笔记失败:', error);
      message.error('创建笔记失败');
    }
  }, [state.config, dialog, dialogName, selectNote, message]);

  // 重命名笔记本
  const handleRenameNotebook = useCallback(
    async (notebook: Notebook, newName: string) => {
      try {
        await closeNotebookSession(chipsClient, notebook.path);
        const updated = await renameNotebook(chipsClient, notebook, newName);
        setState((prev) => ({
          ...prev,
          notebooks: prev.notebooks.map((item) => (item.id === updated.id ? updated : item)),
        }));
        message.success('笔记本已重命名');
      } catch (error) {
        console.error('重命名笔记本失败:', error);
        message.error('重命名笔记本失败');
      }
    },
    [message],
  );

  // 删除笔记本
  const handleDeleteNotebook = useCallback(
    async (notebook: Notebook) => {
      try {
        const notes = state.notesByNotebook[notebook.id] ?? [];
        const removingCurrent =
          state.currentNote?.notebookId === notebook.id ||
          notes.some((note) => note.entryId === state.currentNote?.entryId);

        await closeNotebookSession(chipsClient, notebook.path);
        await deleteNotebook(chipsClient, notebook);
        setState((prev) => {
          const nextNotes = { ...prev.notesByNotebook };
          delete nextNotes[notebook.id];
          return {
            ...prev,
            notebooks: prev.notebooks.filter((item) => item.id !== notebook.id),
            notesByNotebook: nextNotes,
            expandedNotebookIds: prev.expandedNotebookIds.filter((id) => id !== notebook.id),
            ...(removingCurrent
              ? { currentNote: null, editor: initialEditorState }
              : {}),
          };
        });
        message.success('笔记本已删除');
      } catch (error) {
        console.error('删除笔记本失败:', error);
        message.error('删除笔记本失败');
      }
    },
    [state.notesByNotebook, state.currentNote, message],
  );

  // 重命名笔记（若为当前笔记且有未保存修改，直接携带新标题保存当前内容）
  const handleRenameNote = useCallback(
    async (note: Note, newTitle: string) => {
      if (!state.config) {
        return;
      }
      const isCurrent = state.currentNote?.entryId === note.entryId;
      const hasUnsaved = isCurrent && state.editor.modified && state.editor.document;
      try {
        const updated = hasUnsaved
          ? await saveNote(chipsClient, state.config.workspacePath, note, state.editor.content, {
              title: newTitle,
            })
          : await renameNote(chipsClient, state.config.workspacePath, note, newTitle);
        setState((prev) => {
          const notes = prev.notesByNotebook[updated.notebookId]?.map((item) =>
            item.entryId === updated.entryId ? updated : item,
          );
          return {
            ...prev,
            notesByNotebook: notes ? { ...prev.notesByNotebook, [updated.notebookId]: notes } : prev.notesByNotebook,
            currentNote: prev.currentNote?.entryId === updated.entryId ? updated : prev.currentNote,
            editor: prev.currentNote?.entryId === updated.entryId
              ? { ...prev.editor, note: updated, modified: false }
              : prev.editor,
          };
        });
        message.success('笔记已重命名');
      } catch (error) {
        console.error('重命名笔记失败:', error);
        message.error('重命名笔记失败');
      }
    },
    [state.config, state.currentNote, state.editor, message],
  );

  // 删除笔记
  const handleDeleteNote = useCallback(
    async (note: Note) => {
      if (!state.config) {
        return;
      }
      try {
        await deleteNote(chipsClient, state.config.workspacePath, note);
        setState((prev) => {
          const notes = (prev.notesByNotebook[note.notebookId] ?? []).filter(
            (item) => item.entryId !== note.entryId,
          );
          const removingCurrent = prev.currentNote?.entryId === note.entryId;
          return {
            ...prev,
            notesByNotebook: { ...prev.notesByNotebook, [note.notebookId]: notes },
            ...(removingCurrent ? { currentNote: null, editor: initialEditorState } : {}),
          };
        });
        message.success('笔记已删除');
      } catch (error) {
        console.error('删除笔记失败:', error);
        message.error('删除笔记失败');
      }
    },
    [state.config, message],
  );

  // 更换工作目录
  const handleChangeWorkspace = useCallback(async () => {
    try {
      const selected = await selectWorkspace(chipsClient);
      if (!selected) {
        return;
      }
      await ensureWorkspaceExists(chipsClient, selected);
      const config = createDefaultConfig(selected);
      await saveWorkspaceConfig(chipsClient, config);
      const notebooks = await listNotebooks(chipsClient, selected);
      setState((prev) => ({
        ...prev,
        config,
        notebooks,
        notesByNotebook: {},
        expandedNotebookIds: [],
        currentNote: null,
        editor: initialEditorState,
        sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
      }));
    } catch (error) {
      console.error('切换工作目录失败:', error);
      message.error('切换工作目录失败');
    }
  }, [message]);

  // 侧边栏宽度调整（拖动实时生效，停止后持久化）
  const widthPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWidthChange = useCallback((width: number) => {
    setState((prev) => ({ ...prev, sidebarWidth: width }));
    if (widthPersistTimerRef.current) {
      clearTimeout(widthPersistTimerRef.current);
    }
    widthPersistTimerRef.current = setTimeout(() => {
      widthPersistTimerRef.current = null;
      setState((prev) => {
        if (prev.config) {
          void saveWorkspaceConfig(chipsClient, { ...prev.config, sidebarWidth: width });
        }
        return prev;
      });
    }, 500);
  }, []);

  // 命令系统 handlers
  const commandHandlers = useMemo(
    () => ({
      newNotebook: () => {
        setDialogName('');
        setDialog({ kind: 'new-notebook' });
      },
      newNote: () => {
        const target = state.expandedNotebookIds
          .map((id) => state.notebooks.find((notebook) => notebook.id === id))
          .find((notebook): notebook is Notebook => Boolean(notebook))
          ?? state.notebooks[0];
        if (!target) {
          message.warning(messages.empty.noNotebook);
          return;
        }
        setDialogName('');
        setDialog({ kind: 'new-note', notebook: target });
      },
      save: () => {
        handleManualSave();
      },
      deleteCurrent: () => {
        if (state.currentNote) {
          modal.confirm({
            title: messages.note.delete,
            content: `${messages.note.deleteWarning}「${state.currentNote.title}」`,
            okText: messages.dialog.ok,
            cancelText: messages.dialog.cancel,
            okButtonProps: { danger: true },
            onOk: () => {
              void handleDeleteNote(state.currentNote as Note);
            },
          });
        }
      },
      formatBold: () => {
        editorApiRef.current?.insertSyntax({
          before: '**',
          after: '**',
          placeholder: '加粗文本',
          selectPlaceholder: true,
        });
      },
      formatItalic: () => {
        editorApiRef.current?.insertSyntax({
          before: '*',
          after: '*',
          placeholder: '斜体文本',
          selectPlaceholder: true,
        });
      },
    }),
    [state.expandedNotebookIds, state.notebooks, state.currentNote, message, modal, handleManualSave, handleDeleteNote],
  );

  useNotesCommands({
    ...commandHandlers,
    runtime: {
      hasNotebook: state.notebooks.length > 0,
      hasCurrentNote: Boolean(state.currentNote),
      isReady: state.initialized,
    },
  });

  const selectedNoteId = state.currentNote ? `note-${state.currentNote.entryId}` : null;

  if (!state.initialized) {
    return (
      <div className="notes-scene-loading">
        <div className="notes-scene-loading-text">加载中...</div>
      </div>
    );
  }

  if (!state.config) {
    return (
      <EmptyState
        type="no-workspace"
        title={messages.empty.noWorkspace}
        description={messages.empty.selectWorkspace}
        action={{ label: '选择工作目录', onClick: () => void handleChangeWorkspace() }}
      />
    );
  }

  return (
    <div className="notes-scene">
      <Sidebar
        treeData={treeData}
        expandedKeys={state.expandedNotebookIds.map((id) => `notebook-${id}`)}
        selectedNoteId={selectedNoteId}
        width={state.sidebarWidth}
        onExpandNotebook={(notebook, expanded) =>
          expanded ? void expandNotebook(notebook) : collapseNotebook(notebook)
        }
        onSelectNote={(note) => void selectNote(note)}
        onNewNotebook={() => commandHandlers.newNotebook()}
        onNewNote={(notebook) => {
          setDialogName('');
          setDialog({ kind: 'new-note', notebook });
        }}
        onRenameNotebook={(notebook, name) => void handleRenameNotebook(notebook, name)}
        onDeleteNotebook={(notebook) => void handleDeleteNotebook(notebook)}
        onRenameNote={(note, title) => void handleRenameNote(note, title)}
        onDeleteNote={(note) => void handleDeleteNote(note)}
        onWidthChange={handleWidthChange}
      />

      {state.currentNote ? (
        <EditorView
          note={state.currentNote}
          content={state.editor.content}
          modified={state.editor.modified}
          loading={state.editor.loading}
          saving={state.editor.saving}
          onContentChange={handleContentChange}
          onManualSave={handleManualSave}
          onRename={(title) => {
            if (state.currentNote) {
              void handleRenameNote(state.currentNote, title);
            }
          }}
        />
      ) : (
        <div className="notes-main-empty">
          {state.notebooks.length === 0 ? (
            <EmptyState
              type="no-notebook"
              title={messages.empty.noNotebook}
              description={messages.empty.createFirst}
              action={{ label: messages.notebook.newNotebook, onClick: () => commandHandlers.newNotebook() }}
            />
          ) : (
            <EmptyState type="no-note" title={messages.empty.noNote} description={messages.empty.selectNote} />
          )}
        </div>
      )}

      <Modal
        title={dialog?.kind === 'new-notebook' ? messages.notebook.newNotebook : messages.note.newNote}
        open={dialog !== null}
        okText={messages.dialog.ok}
        cancelText={messages.dialog.cancel}
        onOk={() => {
          if (dialog?.kind === 'new-notebook') {
            void handleCreateNotebook();
          } else if (dialog?.kind === 'new-note') {
            void handleCreateNote();
          }
        }}
        onCancel={() => {
          setDialog(null);
          setDialogName('');
        }}
        destroyOnHidden
      >
        <Input
          value={dialogName}
          placeholder={
            dialog?.kind === 'new-notebook' ? messages.notebook.inputName : messages.note.inputTitle
          }
          onChange={(event) => setDialogName(event.target.value)}
          onPressEnter={() => {
            if (dialog?.kind === 'new-notebook') {
              void handleCreateNotebook();
            } else if (dialog?.kind === 'new-note') {
              void handleCreateNote();
            }
          }}
          autoFocus
        />
      </Modal>
    </div>
  );
}
