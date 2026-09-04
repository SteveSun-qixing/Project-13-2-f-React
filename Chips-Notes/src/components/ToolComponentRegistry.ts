import React, { lazy } from 'react';

/**
 * 映射组件名称到具体的 React 组件
 * 使用 lazy 加载以优化性能
 */
export const ToolComponentRegistry: Record<string, React.LazyExoticComponent<any>> = {
    FileManager: lazy(() => import('./FileManager/FileManager')),
    EditPanel: lazy(() => import('./EditPanel/EditPanel')),
    CardBoxLibrary: lazy(() => import('./CardBoxLibrary/CardBoxLibrary')),
    EngineSettings: lazy(() => import('./EngineSettings/EngineSettingsDialog').then(m => ({ default: m.EngineSettingsDialog }))),
    CardSettings: lazy(() => import('./CardSettings/CardSettingsDialog').then(m => ({ default: m.CardSettingsDialog }))),
};
