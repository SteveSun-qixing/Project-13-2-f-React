import { useMemo } from "react";
import { Button } from "antd";
import type { Client } from "chips-sdk";
import { chipsClient } from "../../runtime/chips-client";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { resolveCommunityUrl } from "../lib/ui";
import { getCommunityApiBaseUrl } from "../api/client";

export default function AdminRedirectPage() {
  const { t } = useAppPreferences();
  const client: Client = chipsClient;
  const adminHref = useMemo(() => {
    const baseUrl = getCommunityApiBaseUrl();
    return baseUrl ? resolveCommunityUrl(baseUrl, "/admin/") : "";
  }, []);

  const handleOpen = () => {
    if (adminHref) {
      void client.platform.openExternal(adminHref);
    }
  };

  return (
    <div className="page-container">
      <section className="panel error-panel">
        <h1>{t("admin.redirectTitle")}</h1>
        <p>{t("admin.redirectBody")}</p>
        <Button type="primary" onClick={() => void handleOpen()}>
          {t("admin.redirectAction")}
        </Button>
      </section>
    </div>
  );
}
