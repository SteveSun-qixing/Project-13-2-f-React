import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { CheckOutlined } from "@ant-design/icons";
import type { Client } from "chips-sdk";
import { chipsClient } from "../../runtime/chips-client";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { getCommunityApiBaseUrl } from "../api/client";
import { createCommunityTransferService } from "../lib/transfer";
import { getErrorMessage, getInitial, getWorkCoverStyle, resolveCommunityUrl } from "../lib/ui";
import type { CommunityWorkItem } from "../types/community";

interface WorkTileProps {
  item: CommunityWorkItem;
  manageMode?: boolean;
  selected?: boolean;
  onToggleSelection?: (item: CommunityWorkItem) => void;
}

export function WorkTile({ item, manageMode = false, selected = false, onToggleSelection }: WorkTileProps) {
  const { t } = useAppPreferences();
  const isCard = item.type === "card";
  const coverStyle = getWorkCoverStyle(item.coverRatio) as CSSProperties;
  const rootRef = useRef<HTMLElement | null>(null);
  const [opening, setOpening] = useState(false);
  const clientRef = useRef<Client>(chipsClient);
  const transferRef = useRef(createCommunityTransferService(clientRef.current));

  const coverSrc = item.coverUrl
    ? resolveCommunityUrl(getCommunityApiBaseUrl(), item.coverUrl)
    : null;

  const setRootRef = (node: HTMLElement | null) => {
    rootRef.current = node;
  };

  const handleOpenCard = (event: MouseEvent) => {
    event.preventDefault();
    if (opening || !isCard) {
      return;
    }

    setOpening(true);
    void transferRef.current
      .openInLocalViewer(item.id, (progress) => {
        void progress;
      })
      .catch((nextError) => {
        void clientRef.current.platform.showMessage({
          title: t("card.viewFailedBoxTitle"),
          message: t("card.viewFailedBox", {
            message: getErrorMessage(nextError, t("common.error")),
          }),
        });
      })
      .finally(() => {
        setOpening(false);
      });
  };

  const handleOpenBox = (event: MouseEvent) => {
    event.preventDefault();
    if (opening || isCard) {
      return;
    }

    setOpening(true);
    void transferRef.current
      .openBoxInLocalViewer(item.id, (progress) => {
        void progress;
      })
      .catch((nextError) => {
        void clientRef.current.platform.showMessage({
          title: t("card.viewFailedBoxTitle"),
          message: t("card.viewFailedBox", {
            message: getErrorMessage(nextError, t("common.error")),
          }),
        });
      })
      .finally(() => {
        setOpening(false);
      });
  };

  const content = (
    <article className="work-tile__surface">
      <div className="work-tile__cover-stage">
        <div className="work-tile__cover-shell">
          <div className="work-tile__cover-clip">
            {coverSrc ? (
              <iframe
                className="work-tile__cover-frame"
                src={coverSrc}
                title={item.title}
                loading="lazy"
                sandbox="allow-scripts"
                scrolling="no"
              />
            ) : (
              <div className="work-tile__placeholder">
                <span>{getInitial(item.title)}</span>
              </div>
            )}
          </div>

          {manageMode ? (
            <span
              className={`work-tile__selection-badge${selected ? " is-selected" : ""}`}
              aria-hidden="true"
            >
              {selected ? <CheckOutlined /> : null}
            </span>
          ) : null}
        </div>
      </div>

      <div className="work-tile__label">
        <h2>{item.title}</h2>
      </div>
    </article>
  );

  if (manageMode) {
    return (
      <button
        ref={setRootRef}
        type="button"
        className={`work-tile work-tile--${item.type} work-tile--manage${selected ? " is-selected" : ""}`}
        style={coverStyle}
        onClick={() => onToggleSelection?.(item)}
        aria-pressed={selected}
        aria-label={t("profile.manageTileSelect", {
          title: item.title,
          type: item.type === "card" ? t("common.card") : t("common.box"),
        })}
      >
        {content}
      </button>
    );
  }

  if (isCard) {
    return (
      <button
        ref={setRootRef}
        type="button"
        className="work-tile work-tile--card"
        style={coverStyle}
        onClick={handleOpenCard}
        disabled={opening}
        aria-label={`${item.title} · ${t("common.card")}`}
      >
        {content}
      </button>
    );
  }

  return (
    <button
      ref={setRootRef}
      type="button"
      className="work-tile work-tile--box"
      style={coverStyle}
      onClick={handleOpenBox}
      disabled={opening}
      aria-label={`${item.title} · ${t("common.box")}`}
    >
      {content}
    </button>
  );
}
