import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { useAuth } from "../contexts/AuthContext";

export function SiteHeader() {
  const { t } = useAppPreferences();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const showCreatorNav = isAuthenticated && user?.role !== "admin";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-brand">
          <span className="site-brand__mark" />
          <div>
            <strong>{t("brand.name")}</strong>
            <span>{t("brand.tagline")}</span>
          </div>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>{t("nav.home")}</NavLink>
          <NavLink to="/about">{t("nav.about")}</NavLink>
          {showCreatorNav && user ? <NavLink to={`/@${user.username}`}>{t("nav.profile")}</NavLink> : null}
          {showCreatorNav ? <NavLink to="/workspace">{t("nav.workspace")}</NavLink> : null}
        </nav>

        <div className="site-actions">
          <Link
            to="/settings"
            className="site-header__settings-link"
            aria-label={t("app.scenes.settings.title")}
            title={t("app.scenes.settings.title")}
          >
            <SettingOutlined style={{ fontSize: 18 }} />
          </Link>
          {isAuthenticated && user ? (
            <>
              <Button onClick={() => navigate(`/@${user.username}`)}>{user.username}</Button>
              <Button onClick={() => void logout()}>{t("common.logout")}</Button>
            </>
          ) : (
            <>
              <Button type="text" onClick={() => navigate("/login")}>{t("nav.login")}</Button>
              <Button type="primary" onClick={() => navigate("/register")}>{t("nav.register")}</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
