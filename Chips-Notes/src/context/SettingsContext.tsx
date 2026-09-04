import React, { createContext, useContext, useState, ReactNode } from 'react';
import { settingsService } from '../services/settings-service';

export interface PanelDefinition {
    id: string;
    name: string;
    component: string;
}

interface SettingsState {
    registeredPanels: PanelDefinition[];
    settings: Record<string, unknown>;
}

interface SettingsContextType extends SettingsState {
    registerPanel: (panel: PanelDefinition) => void;
    unregisterPanel: (panelId: string) => void;
    getSetting: <T>(key: string, defaultValue?: T) => T | undefined;
    setSetting: <T>(key: string, value: T) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [registeredPanels, setRegisteredPanels] = useState<PanelDefinition[]>([]);
    const [settings, setSettings] = useState<Record<string, unknown>>({});

    const registerPanel = (panel: PanelDefinition) => {
        setRegisteredPanels(prev => [...prev.filter(p => p.id !== panel.id), panel]);
    };

    const unregisterPanel = (panelId: string) => {
        setRegisteredPanels(prev => prev.filter(p => p.id !== panelId));
    };

    const getSetting = <T,>(key: string, defaultValue?: T): T | undefined => {
        const val = settings[key];
        return val !== undefined ? (val as T) : defaultValue;
    };

    const setSetting = <T,>(key: string, value: T) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        // 异步同步到 Host
        settingsService.set(key, value).catch(e => {
            console.warn('Failed to sync setting to host:', key, e);
        });
    };

    const value = {
        registeredPanels,
        settings,
        registerPanel,
        unregisterPanel,
        getSetting,
        setSetting,
    };

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
