import { useEffect, useRef, useState } from "react";
import {
  EditOutlined,
  LinkOutlined,
  LogoutOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { App } from "antd";
import type { PublicUserProfile } from "../api/auth";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { getInitial } from "../lib/ui";

interface ProfileHeroProps {
  user: PublicUserProfile;
  isOwner: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function ProfileHero({ user, isOwner, onOpenSettings, onLogout }: ProfileHeroProps) {
  const { t } = useAppPreferences();
  const { message } = App.useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user.displayName || user.username;

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  const handleShare = async () => {
    setMenuOpen(false);
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      message.success(t("profile.shareCopied"));
    } catch {
      message.error(t("profile.shareFailed"));
    }
  };

  return (
    <header className="profile-hero">
      <div className="profile-hero__card">
        {isOwner ? (
          <div className="profile-hero__menu" ref={menuRef}>
            <button
              type="button"
              className="profile-hero__menu-trigger"
              aria-label={t("profile.moreActions")}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <MoreOutlined />
            </button>
            {menuOpen ? (
              <div className="profile-hero__menu-pop">
                <button type="button" className="profile-hero__menu-item" onClick={onOpenSettings}>
                  <EditOutlined />
                  <span>{t("profile.settingsOpen")}</span>
                </button>
                <button type="button" className="profile-hero__menu-item" onClick={() => void handleShare()}>
                  <LinkOutlined />
                  <span>{t("profile.shareProfile")}</span>
                </button>
                <div className="profile-hero__menu-divider" />
                <button
                  type="button"
                  className="profile-hero__menu-item profile-hero__menu-item--danger"
                  onClick={onLogout}
                >
                  <LogoutOutlined />
                  <span>{t("common.logout")}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="profile-hero__avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} /> : <span>{getInitial(displayName)}</span>}
        </div>
        <div className="profile-hero__content">
          <h1 className="profile-hero__name">{displayName}</h1>
          <p className="profile-hero__username">@{user.username}</p>
          <p className="profile-hero__bio">{user.bio || t("common.noDescription")}</p>
        </div>
      </div>
    </header>
  );
}
