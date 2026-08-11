import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import {
  AppstoreOutlined,
  FileOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import "./HomePage.css";

const features = [
  { icon: <FileOutlined />, titleKey: "home.featureCardTitle", bodyKey: "home.featureCardBody" },
  { icon: <AppstoreOutlined />, titleKey: "home.featureBoxTitle", bodyKey: "home.featureBoxBody" },
  { icon: <TeamOutlined />, titleKey: "home.featureCommunityTitle", bodyKey: "home.featureCommunityBody" },
] as const;

export default function HomePage() {
  const { t } = useAppPreferences();
  const { user } = useAuth();
  const navigate = useNavigate();
  const primaryHref = user ? `/@${user.username}` : "/register";

  return (
    <div className="home">
      <section className="home__hero" aria-labelledby="home-title">
        <p className="home__eyebrow">{t("brand.name")}</p>
        <h1 id="home-title">{t("home.heroTitle")}</h1>
        <p className="home__subtitle">{t("home.heroSubtitle")}</p>
        <div className="home__actions" aria-label={t("home.actionLabel")}>
          <Button type="primary" size="large" onClick={() => navigate(primaryHref)}>
            {user ? t("home.openProfile") : t("home.heroPrimary")}
          </Button>
          <Button size="large" onClick={() => navigate("/about")}>
            {t("home.heroSecondary")}
          </Button>
        </div>
      </section>

      <section className="home__features" aria-label={t("home.ideasLabel")}>
        {features.map((feature) => (
          <article key={feature.titleKey} className="home-feature">
            <span className="home-feature__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h2>{t(feature.titleKey)}</h2>
            <p>{t(feature.bodyKey)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
