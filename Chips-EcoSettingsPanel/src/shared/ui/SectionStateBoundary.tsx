import React from "react";
import { Button, Flex, Result, Spin } from "antd";
import { useI18n } from "../../app/providers/I18nProvider";
import type { SettingsPanelError } from "../runtime/errors";
import { normalizeSettingsError } from "../runtime/errors";

interface SectionStateBoundaryProps {
  loading: boolean;
  error: SettingsPanelError | null;
  loadingLabel: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface RuntimeRenderBoundaryProps {
  error: SettingsPanelError | null;
  retryLabel: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

interface RuntimeRenderBoundaryState {
  capturedError: SettingsPanelError | null;
}

class RuntimeRenderBoundary extends React.Component<RuntimeRenderBoundaryProps, RuntimeRenderBoundaryState> {
  public override state: RuntimeRenderBoundaryState = {
    capturedError: null,
  };

  public static getDerivedStateFromError(error: unknown): RuntimeRenderBoundaryState {
    return {
      capturedError: normalizeSettingsError(error, "渲染设置区块失败。"),
    };
  }

  public override componentDidUpdate(previousProps: RuntimeRenderBoundaryProps): void {
    if (previousProps.error && !this.props.error && this.state.capturedError) {
      this.setState({ capturedError: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ capturedError: null });
    this.props.onRetry?.();
  };

  public override render(): React.ReactNode {
    const effectiveError = this.props.error ?? this.state.capturedError;

    if (effectiveError) {
      return (
        <Flex vertical align="center" className="settings-section-error" style={{ padding: 24 }}>
          <Result
            status="error"
            title={effectiveError.message}
            subTitle={effectiveError.code}
            extra={
              this.props.onRetry ? (
                <Button type="primary" onClick={this.handleRetry}>
                  {this.props.retryLabel}
                </Button>
              ) : undefined
            }
          />
        </Flex>
      );
    }

    return this.props.children;
  }
}

export function SectionStateBoundary({
  loading,
  error,
  loadingLabel,
  onRetry,
  children,
}: SectionStateBoundaryProps): React.ReactElement {
  const { t } = useI18n();

  return (
    <RuntimeRenderBoundary
      error={error}
      retryLabel={t("settingsPanel.app.retry")}
      onRetry={onRetry}
    >
      {loading ? (
        <Flex
          vertical
          align="center"
          gap={12}
          className="settings-section-loading"
          role="status"
          aria-label={loadingLabel}
          style={{ padding: 24, minHeight: 160 }}
        >
          <Spin />
          <span>{loadingLabel}</span>
        </Flex>
      ) : (
        children
      )}
    </RuntimeRenderBoundary>
  );
}
