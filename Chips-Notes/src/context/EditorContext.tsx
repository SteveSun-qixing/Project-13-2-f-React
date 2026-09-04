import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LayoutType } from '../types/editor';

interface EditorState {
    state: 'idle' | 'loading' | 'ready' | 'error';
    currentLayout: LayoutType;
    isConnected: boolean;
    hasUnsavedChanges: boolean;
    locale: string;
    error: Error | null;
}

interface EditorContextType extends EditorState {
    setState: (state: EditorState['state']) => void;
    setLayout: (layout: LayoutType) => void;
    setConnected: (connected: boolean) => void;
    setHasUnsavedChanges: (hasChanges: boolean) => void;
    setLocale: (locale: string) => void;
    setError: (error: Error | null) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<EditorState['state']>('idle');
    const [currentLayout, setLayout] = useState<LayoutType>('infinite-canvas');
    const [isConnected, setConnected] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [locale, setLocale] = useState('zh-CN');
    const [error, setError] = useState<Error | null>(null);

    const value = {
        state,
        currentLayout,
        isConnected,
        hasUnsavedChanges,
        locale,
        error,
        setState,
        setLayout,
        setConnected,
        setHasUnsavedChanges,
        setLocale,
        setError,
    };

    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor() {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
}
