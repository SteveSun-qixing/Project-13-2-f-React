import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Input } from "antd";
import { ArrowLeftOutlined, LogoutOutlined } from "@ant-design/icons";
import type { Client } from "chips-sdk";
import { chipsClient } from "../../runtime/chips-client";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import {
  configureCommunityApiBaseUrl,
  getCommunityApiBaseUrl,
} from "../api/client";
import {
  normalizeCommunityServerUrl,
  saveCommunityServerUrl,
} from "../lib/server-config";
import { getErrorMessage } from "../lib/ui";
import "./SettingsPage.css";

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

export default function SettingsPage() {
  const { t } = useAppPreferences();
  const client: Client = chipsClient;
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [serverUrl, setServerUrl] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });

  useEffect(() => {
    const current = getCommunityApiBaseUrl();
    if (current) {
      setServerUrl(current);
    }
  }, []);

  const handleSave = async () => {
    const normalized = normalizeCommunityServerUrl(serverUrl);
    if (!normalized) {
      setSaveStatus({ kind: "error", message: t("client.settings.invalidUrl") });
      return;
    }

    const previousUrl = getCommunityApiBaseUrl();
    setSaveStatus({ kind: "saving" });
    try {
      await saveCommunityServerUrl(client, normalized);
      if (previousUrl && previousUrl !== normalized) {
        await logout();
        configureCommunityApiBaseUrl(normalized);
        setServerUrl(normalized);
        setSaveStatus({ kind: "success", message: t("client.settings.savedRequireLogin") });
      } else {
        configureCommunityApiBaseUrl(normalized);
        setServerUrl(normalized);
        setSaveStatus({ kind: "success", message: t("client.settings.saved") });
      }
    } catch (nextError) {
      setSaveStatus({
        kind: "error",
        message: t("client.settings.saveFailed", { message: getErrorMessage(nextError, t("common.error")) }),
      });
    }
  };

  const handleLogout = async () => {
    const confirmed = await client.platform.showConfirm({
      title: t("common.logout"),
      message: t("common.logout"),
    });
    if (confirmed) {
      await logout();
    }
  };

  return (
    <div className="page-container settings-page">
      <header className="settings-page__header">
        <div>
          <span className="eyebrow">{t("client.settings.title")}</span>
          <h1>{t("client.settings.title")}</h1>
          <p className="muted">{t("client.settings.subtitle")}</p>
        </div>

        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(user ? `/@${user.username}` : "/")}
        >
          {t("common.back")}
        </Button>
      </header>

      <section className="panel settings-card">
        <div className="field">
          <label htmlFor="server-url">{t("client.settings.serverUrl")}</label>
          <Input
            id="server-url"
            type="url"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder={t("client.settings.serverUrlPlaceholder")}
            disabled={saveStatus.kind === "saving"}
          />
          <p className="muted settings-card__hint">{t("client.settings.serverUrlHint")}</p>
        </div>

        <div className="settings-card__actions">
          <Button
            type="primary"
            onClick={() => void handleSave()}
            loading={saveStatus.kind === "saving"}
          >
            {saveStatus.kind === "saving" ? t("common.loading") : t("client.settings.save")}
          </Button>
        </div>

        {saveStatus.kind === "success" ? (
          <Alert type="success" message={saveStatus.message} showIcon />
        ) : null}
        {saveStatus.kind === "error" ? (
          <Alert type="error" message={saveStatus.message} showIcon />
        ) : null}
      </section>

      <section className="panel settings-card">
        <div className="settings-card__row">
          <div>
            <strong>{user ? t("client.settings.loggedInAs", { username: user.username }) : t("auth.loginTitle")}</strong>
            <p className="muted">{user ? user.username : t("auth.loginSubtitle")}</p>
          </div>
          {user ? (
            <Button type="text" danger onClick={() => void handleLogout()}>
              <LogoutOutlined />
              {t("client.settings.logout")}
            </Button>
          ) : (
            <Button type="primary" onClick={() => navigate("/login")}>
              {t("nav.login")}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
