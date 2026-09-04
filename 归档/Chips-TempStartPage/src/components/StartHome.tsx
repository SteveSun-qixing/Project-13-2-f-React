import React from "react";
import { Button } from "antd";
import "./start-home.css";

export interface StartHomeProps {
  title: string;
  description: string;
  formatsText: string;
  openLabel: string;
  shortcutText: string;
  dragActiveText: string;
  dragActive: boolean;
  icon: React.ReactNode;
  onOpen: () => void;
}

export function StartHome(props: StartHomeProps): React.ReactElement {
  const {
    title,
    description,
    formatsText,
    openLabel,
    shortcutText,
    dragActiveText,
    dragActive,
    icon,
    onOpen,
  } = props;

  return (
    <div className={`start-home${dragActive ? " start-home--drag-active" : ""}`}>
      <div className="start-home__panel">
        <div className="start-home__icon" aria-hidden="true">
          {icon}
        </div>
        <h1 className="start-home__title">{title}</h1>
        <p className="start-home__description">{description}</p>
        <div className="start-home__actions">
          <Button type="primary" size="large" className="start-home__open-button" onClick={onOpen}>
            {openLabel}
          </Button>
        </div>
        <p className="start-home__formats">{formatsText}</p>
        <p className="start-home__shortcut">{shortcutText}</p>
      </div>
      {dragActive ? (
        <div className="start-home__drop-overlay">
          <span className="start-home__drop-text">{dragActiveText}</span>
        </div>
      ) : null}
    </div>
  );
}
