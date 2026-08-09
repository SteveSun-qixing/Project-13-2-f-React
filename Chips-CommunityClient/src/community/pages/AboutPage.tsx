import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { useAppPreferences } from "../contexts/PreferencesContext";
import "./AboutPage.css";

export default function AboutPage() {
  const { t } = useAppPreferences();
  const navigate = useNavigate();

  const sections = [
    ["about.sectionProduct", "about.sectionProductBody"],
    ["about.sectionArchitecture", "about.sectionArchitectureBody"],
    ["about.sectionWorkflow", "about.sectionWorkflowBody"],
    ["about.sectionPlugins", "about.sectionPluginsBody"],
  ] as const;

  return (
    <div className="page-container about-page">
      <section className="panel about-hero">
        <span className="eyebrow">{t("about.title")}</span>
        <h1>{t("about.title")}</h1>
        <p className="muted">{t("about.subtitle")}</p>
        <div>
          <Button onClick={() => navigate("/")}>{t("about.backHome")}</Button>
        </div>
      </section>

      <section className="about-grid">
        {sections.map(([titleKey, bodyKey]) => (
          <article key={titleKey} className="panel about-card">
            <span className="eyebrow">{t(titleKey)}</span>
            <h2>{t(titleKey)}</h2>
            <p className="muted">{t(bodyKey)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
