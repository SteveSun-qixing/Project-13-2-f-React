import { FileAddOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, theme } from "antd";
import type { CSSProperties, ReactNode } from "react";

import "./start-home.css";

export interface StartHomeProps {
  title: string;
  description: string;
  formatsText: string;
  openLabel: string;
  shortcutText: string;
  dragActiveText: string;
  dragActive: boolean;
  icon: ReactNode;
  onOpen: () => void;
  /** 可选的新建动作；未提供时保持仅打开入口。 */
  createLabel?: string;
  onCreate?: () => void;
}

type StartHomeStyle = CSSProperties & Record<`--start-home-${string}`, string>;

/** 统一应用起始页：文案和行为由插件提供，视觉 token 由共享层注入。 */
export function StartHome({
  title,
  description,
  formatsText,
  openLabel,
  shortcutText,
  dragActiveText,
  dragActive,
  icon,
  onOpen,
  createLabel,
  onCreate,
}: StartHomeProps): React.ReactElement {
  const { token } = theme.useToken();
  const style: StartHomeStyle = {
    "--start-home-bg": token.colorBgLayout,
    "--start-home-title": token.colorText,
    "--start-home-secondary": token.colorTextSecondary,
    "--start-home-muted": token.colorTextTertiary,
    "--start-home-accent": token.colorPrimary,
    "--start-home-card": token.colorBgContainer,
    "--start-home-shadow": token.boxShadowSecondary,
    "--start-home-drag-veil": token.colorPrimaryBg,
    "--start-home-dash": token.colorPrimaryBorder,
    "--start-home-radius-lg": `${token.borderRadiusLG}px`,
    "--start-home-radius-md": `${token.borderRadius}px`,
    "--start-home-title-size": `${token.fontSizeHeading2}px`,
    "--start-home-description-size": `${token.fontSize}px`,
    "--start-home-meta-size": `${token.fontSizeSM}px`,
    "--start-home-drop-size": `${token.fontSizeLG}px`,
    "--start-home-strong-weight": `${token.fontWeightStrong}`,
  };

  return (
    <div
      className={`start-home${dragActive ? " start-home--drag-active" : ""}`}
      style={style}
      aria-live={dragActive ? "polite" : undefined}
    >
      <div className="start-home__panel">
        <div className="start-home__icon" aria-hidden="true">
          {icon}
        </div>
        <h1 className="start-home__title">{title}</h1>
        <p className="start-home__description">{description}</p>
        <div className="start-home__actions">
          <Button
            type="primary"
            size="large"
            className="start-home__open-button"
            icon={<FolderOpenOutlined />}
            aria-label={openLabel}
            onClick={onOpen}
          >
            {openLabel}
          </Button>
          {createLabel && onCreate ? (
            <Button
              size="large"
              className="start-home__create-button"
              icon={<FileAddOutlined />}
              aria-label={createLabel}
              onClick={onCreate}
            >
              {createLabel}
            </Button>
          ) : null}
        </div>
        <p className="start-home__formats">{formatsText}</p>
        <p className="start-home__shortcut">{shortcutText}</p>
      </div>
      {dragActive ? (
        <div className="start-home__drop-overlay" role="status">
          <span className="start-home__drop-text">{dragActiveText}</span>
        </div>
      ) : null}
    </div>
  );
}
