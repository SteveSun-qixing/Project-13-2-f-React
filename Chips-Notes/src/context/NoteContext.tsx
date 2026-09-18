/**
 * 笔记状态管理
 * @description 管理当前打开笔记的状态
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { noteService, type Note, type CardContent } from '../services/note-service';

export interface NoteContextValue {
  currentNote: Note | null;
  loading: boolean;
  saving: boolean;
  openNote: (cardPath: string) => Promise<void>;
  closeNote: () => void;
  saveNote: () => Promise<void>;
  updateContent: (contentId: string, config: unknown) => void;
  insertBasecard: (basecardType: string, insertIndex?: number) => Promise<void>;
  removeBasecard: (basecardId: string) => Promise<void>;
  reorderBasecards: (sourceIndex: number, targetIndex: number) => Promise<void>;
  setEditingBasecard: (basecardId: string | null) => void;
  isDirty: boolean;
}

const NoteContext = createContext<NoteContextValue | null>(null);

export function useNote(): NoteContextValue {
  const context = useContext(NoteContext);
  if (!context) {
    throw new Error('useNote must be used within NoteProvider');
  }
  return context;
}

export function NoteProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [currentNote, setCurrentNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const openNote = useCallback(async (cardPath: string) => {
    setLoading(true);
    try {
      const note = await noteService.openNote(cardPath);
      setCurrentNote(note);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to open note:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const closeNote = useCallback(() => {
    setCurrentNote(null);
    setIsDirty(false);
  }, []);

  const saveNote = useCallback(async () => {
    if (!currentNote) {
      return;
    }

    setSaving(true);
    try {
      await noteService.saveNote(currentNote.path, currentNote.contents);
      setIsDirty(false);

      setCurrentNote(prev => prev ? {
        ...prev,
        dirty: false,
        modifiedAt: new Date().toISOString(),
      } : null);
    } catch (error) {
      console.error('Failed to save note:', error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [currentNote]);

const updateContent = useCallback((contentId: string, config: unknown) => {
    setCurrentNote(prev => {
      if (!prev) return null;

      const updatedContents = prev.contents.map(content =>
        content.id === contentId
          ? { ...content, config }
          : content
      );

      return {
        ...prev,
        contents: updatedContents,
        dirty: true,
      };
    });
    setIsDirty(true);
  }, []);

  const reorderBasecards = useCallback(async (sourceIndex: number, targetIndex: number) => {
    if (!currentNote) return;

    try {
      const { noteService } = await import('../services/note-service');
      const reordered = [...currentNote.contents];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      setCurrentNote(prev => prev ? { ...prev, contents: reordered, dirty: true } : null);
      setIsDirty(true);
    } catch (error) {
      console.error('Failed to reorder basecards:', error);
      throw error;
    }
  }, [currentNote]);

  const insertBasecard = useCallback(async (basecardType: string, insertIndex?: number) => {
    if (!currentNote) {
      return;
    }

    try {
      const newBasecardId = await noteService.insertBasecard(
        currentNote.path,
        basecardType,
        insertIndex
      );

      const updatedNote = await noteService.openNote(currentNote.path);
      setCurrentNote(updatedNote);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to insert basecard:', error);
      throw error;
    }
  }, [currentNote]);

  const removeBasecard = useCallback(async (basecardId: string) => {
    if (!currentNote) {
      return;
    }

    try {
      await noteService.removeBasecard(currentNote.path, basecardId);

      const updatedNote = await noteService.openNote(currentNote.path);
      setCurrentNote(updatedNote);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to remove basecard:', error);
      throw error;
    }
  }, [currentNote]);

  const setEditingBasecard = useCallback((basecardId: string | null) => {
    setCurrentNote(prev => {
      if (!prev) return null;

      const updatedContents = prev.contents.map(content => ({
        ...content,
        editing: content.id === basecardId,
      }));

      return {
        ...prev,
        contents: updatedContents,
      };
    });
  }, []);

  const value: NoteContextValue = {
    currentNote,
    loading,
    saving,
    openNote,
    closeNote,
    saveNote,
    updateContent,
    insertBasecard,
    removeBasecard,
    reorderBasecards,
    setEditingBasecard,
    isDirty,
  };

  return <NoteContext.Provider value={value}>{children}</NoteContext.Provider>;
}
