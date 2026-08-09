import React, { useCallback, useState } from 'react';
import { Button, Result } from 'antd';
import { AppChrome, useCommandRegistry } from '@chips/ui';
import { WorkspaceScene } from '../scenes/WorkspaceScene';
import { useEditor } from '../context/EditorContext';
import { workspaceService } from '../services/workspace-service';

interface WorkspaceErrorBoundaryProps {
    children: React.ReactNode;
    onReset?: () => void;
}

interface WorkspaceErrorBoundaryState {
    error: Error | null;
}

export class WorkspaceErrorBoundary extends React.Component<WorkspaceErrorBoundaryProps, WorkspaceErrorBoundaryState> {
    state: WorkspaceErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): WorkspaceErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error('[AppShell] 工作区渲染异常，已由错误边界接管。', error, errorInfo.componentStack);
    }

    handleRetry = (): void => {
        this.setState({ error: null });
    };

    handleResetWorkspace = (): void => {
        this.setState({ error: null });
        this.props.onReset?.();
    };

    render(): React.ReactNode {
        if (this.state.error === null) {
            return this.props.children;
        }

        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                <Result
                    status="error"
                    title="工作区渲染出错"
                    subTitle={this.state.error.message || '编辑引擎遇到异常，可以重试恢复，或重置工作区后重新加载。'}
                    extra={[
                        <Button key="retry" type="primary" onClick={this.handleRetry}>
                            重试
                        </Button>,
                        <Button key="reset" onClick={this.handleResetWorkspace}>
                            重置工作区
                        </Button>,
                    ]}
                />
            </div>
        );
    }
}

export function AppShell(): React.ReactElement {
    useCommandRegistry();
    const { setState } = useEditor();
    const [sceneKey, setSceneKey] = useState(0);

    const handleResetWorkspace = useCallback(() => {
        setState('loading');
        setSceneKey((key) => key + 1);
        void workspaceService.refresh().catch((error) => {
            console.error('[AppShell] 重置工作区后刷新工作区文件失败。', error);
            setState('ready');
        });
    }, [setState]);

    return (
        <AppChrome paletteShortcut="Mod+P" contentStyle={{ overflow: 'hidden', padding: 0 }}>
            <WorkspaceErrorBoundary onReset={handleResetWorkspace}>
                <WorkspaceScene key={sceneKey} />
            </WorkspaceErrorBoundary>
        </AppChrome>
    );
}
