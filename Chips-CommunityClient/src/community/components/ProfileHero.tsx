import { Button } from "antd";
import { LogoutOutlined, SettingOutlined } from "@ant-design/icons";
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
  const displayName = user.displayName || user.username;

  return (
    <header className="profile-hero">
      <div className="profile-hero__main">
        <div className="profile-hero__avatar-shell">
          <div className="profile-hero__avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} />
            ) : (
              <span>{getInitial(displayName)}</span>
            )}
          </div>
        </div>

        <div className={`profile-hero__content${isOwner ? " profile-hero__content--owner" : ""}`}>
          {isOwner ? (
            <div className="profile-hero__toolbar">
              <Button onClick={onOpenSettings} aria-label={t("profile.settingsOpen")}>
                <SettingOutlined />
                <span>{t("profile.settingsOpen")}</span>
              </Button>
              <Button type="text" onClick={onLogout} aria-label={t("common.logout")}>
                <LogoutOutlined />
                <span>{t("common.logout")}</span>
              </Button>
            </div>
          ) : null}
          <h1>{displayName}</h1>
          <p className="profile-hero__username">@{user.username}</p>
          <p className="profile-hero__bio">{user.bio || t("common.noDescription")}</p>
        </div>
      </div>
    </header>
  );
}
