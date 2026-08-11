import { Button } from 'antd';
import { LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import type { PublicUserProfile } from '../api/auth';
import { getInitial } from '../lib/ui';

interface ProfileHeroProps {
  user: PublicUserProfile;
  isOwner: boolean;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function ProfileHero({ user, isOwner, onOpenSettings, onLogout }: ProfileHeroProps) {
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

        <div className={`profile-hero__content${isOwner ? ' profile-hero__content--owner' : ''}`}>
          {isOwner ? (
            <div className="profile-hero__toolbar">
              <Button onClick={onOpenSettings} aria-label="编辑资料">
                <SettingOutlined />
                <span>编辑资料</span>
              </Button>
              <Button type="text" onClick={onLogout} aria-label="退出登录">
                <LogoutOutlined />
                <span>退出登录</span>
              </Button>
            </div>
          ) : null}
          <h1>{displayName}</h1>
          <p className="profile-hero__username">@{user.username}</p>
          <p className="profile-hero__bio">{user.bio || '暂无简介'}</p>
        </div>
      </div>
    </header>
  );
}
