import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button } from "antd";
import {
  ArrowLeftOutlined,
  CheckOutlined,
  FileTextOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import type { Client } from "chips-sdk";
import { chipsClient } from "../../runtime/chips-client";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { useAuth } from "../contexts/AuthContext";
import { createCommunityTransferService, type TransferJobProgress } from "../lib/transfer";
import { getErrorMessage } from "../lib/ui";
import "./WorkspacePage.css";

type UploadKind = "card" | "box";

type UploadStatus =
  | { kind: "idle" }
  | { kind: "working"; label: string; percent: number | null }
  | { kind: "success"; message: string; communityUrl: string; openLabel: string }
  | { kind: "error"; message: string };

interface UploadWarning {
  code: string;
  message: string;
}

interface UploadFileResult {
  fileName: string;
  kind: UploadKind;
  ok: boolean;
  message: string;
  communityUrl: string;
  warnings?: UploadWarning[];
}

function formatUploadProgress(stage: string, percent: number): string | null {
  if (!stage) {
    return null;
  }
  return percent > 0 ? `${stage} ${Math.round(percent)}%` : stage;
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) ?? filePath;
}

function getUploadKind(filePath: string): UploadKind {
  return getFileName(filePath).toLowerCase().endsWith(".box") ? "box" : "card";
}

export default function WorkspacePage() {
  const { t } = useAppPreferences();
  const client: Client = chipsClient;
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const profileHref = useMemo(() => (user ? `/@${user.username}` : "/login"), [user]);
  const transferRef = useRef(createCommunityTransferService(client));
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ kind: "idle" });
  const [batch, setBatch] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadFileResult[]>([]);

  if (!user) {
    return null;
  }

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadRequiresLogin") });
      return;
    }

    setUploadStatus({ kind: "idle" });
    setResults([]);
    setBatch(null);

    let filePaths: string[] = [];
    try {
      const selected = await client.platform.openFile({
        title: t("workspace.uploadTitle"),
        mode: "file",
        allowMultiple: true,
        mustExist: true,
        filters: [{ name: t("workspace.uploadFilter"), extensions: ["card", "box"] }],
      });
      filePaths = Array.isArray(selected) ? selected.filter(Boolean) : [];
    } catch (nextError) {
      setUploadStatus({ kind: "error", message: getErrorMessage(nextError, t("common.error")) });
      return;
    }

    if (filePaths.length === 0) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadSelectFile") });
      return;
    }

    setBatch({ current: 0, total: filePaths.length });
    const outcomes: UploadFileResult[] = [];

    for (let index = 0; index < filePaths.length; index += 1) {
      const filePath = filePaths[index]!;
      const fileName = getFileName(filePath);
      const kind = getUploadKind(filePath);
      setBatch({ current: index + 1, total: filePaths.length });
      setUploadStatus({
        kind: "working",
        label: t("workspace.uploadBatchProgress", {
          current: index + 1,
          total: filePaths.length,
          phase: t("workspace.uploading"),
        }),
        percent: null,
      });

      const reportProgress = (progress: TransferJobProgress) => {
        setUploadStatus({
          kind: "working",
          label: t("workspace.uploadBatchProgress", {
            current: index + 1,
            total: filePaths.length,
            phase: formatUploadProgress(progress.message || progress.stage, progress.percent) ?? t("workspace.uploading"),
          }),
          percent: progress.percent > 0 ? progress.percent : null,
        });
      };

      try {
        if (kind === "box") {
          const result = await transferRef.current.uploadBox(filePath, reportProgress);
          outcomes.push({
            fileName,
            kind,
            ok: true,
            message: t("workspace.boxUploadResultSummary", {
              uploaded: result.uploadedCards.length,
              skipped: result.skippedCards.length,
            }),
            communityUrl: result.communityUrl,
            warnings: result.warnings,
          });
        } else {
          const result = await transferRef.current.uploadCard(filePath, reportProgress);
          outcomes.push({
            fileName,
            kind,
            ok: true,
            message: t("workspace.uploadResultPublished"),
            communityUrl: result.communityUrl,
          });
        }
      } catch (nextError) {
        outcomes.push({
          fileName,
          kind,
          ok: false,
          message: getErrorMessage(nextError, t("common.error")),
          communityUrl: "",
        });
      }

      setResults([...outcomes]);
    }

    setBatch(null);

    const successItems = outcomes.filter((item) => item.ok);
    const failedCount = outcomes.length - successItems.length;
    const cardSuccessCount = successItems.filter((item) => item.kind === "card").length;
    const boxSuccessCount = successItems.filter((item) => item.kind === "box").length;
    const firstSuccess = successItems[0];

    if (failedCount === 0) {
      let message = t("workspace.uploadComplete", { count: cardSuccessCount });
      let openLabel = t("workspace.uploadCompleteOpen");
      if (cardSuccessCount === 0 && boxSuccessCount > 0) {
        message = t("workspace.boxUploadComplete", { count: boxSuccessCount });
        openLabel = t("workspace.boxUploadCompleteOpen");
      } else if (boxSuccessCount > 0) {
        message = t("workspace.uploadCompleteMixed", { cards: cardSuccessCount, boxes: boxSuccessCount });
        openLabel = firstSuccess?.kind === "box"
          ? t("workspace.boxUploadCompleteOpen")
          : t("workspace.uploadCompleteOpen");
      }
      setUploadStatus({
        kind: "success",
        message,
        communityUrl: firstSuccess?.communityUrl ?? "",
        openLabel,
      });
    } else {
      setUploadStatus({
        kind: "error",
        message: t("workspace.uploadBatchFailed", { success: successItems.length, failed: failedCount }),
      });
    }
  };

  const handleOpenCommunityUrl = () => {
    if (uploadStatus.kind !== "success") {
      return;
    }
    void client.platform.openExternal(uploadStatus.communityUrl);
  };

  return (
    <div className="page-container workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="eyebrow">{t("workspace.title")}</span>
          <h1>{t("workspace.title")}</h1>
          <p className="muted">{t("workspace.subtitle")}</p>
        </div>

        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(profileHref)}>
          {t("workspace.backToProfile")}
        </Button>
      </header>

      <section className="panel workspace-upload">
        <div className="workspace-upload__icon" aria-hidden="true">
          <UploadOutlined style={{ fontSize: 28 }} />
        </div>
        <div className="workspace-upload__copy">
          <h2>{t("workspace.uploadTitle")}</h2>
          <p>{t("workspace.uploadSubtitle")}</p>
        </div>

        <div className="workspace-upload__action">
          <Button
            type="primary"
            onClick={() => void handleUpload()}
            loading={uploadStatus.kind === "working"}
            disabled={!isAuthenticated}
          >
            {uploadStatus.kind === "working" ? t("workspace.uploading") : t("workspace.uploadAction")}
          </Button>
        </div>

        {!isAuthenticated ? (
          <Alert type="error" message={t("workspace.uploadRequiresLogin")} showIcon />
        ) : null}

        {uploadStatus.kind === "working" ? (
          <Alert type="info" message={uploadStatus.label} />
        ) : null}

        {uploadStatus.kind === "success" ? (
          <Alert
            type="success"
            showIcon
            message={uploadStatus.message}
            action={
              uploadStatus.communityUrl ? (
                <Button size="small" type="text" onClick={() => void handleOpenCommunityUrl()}>
                  {uploadStatus.openLabel}
                </Button>
              ) : null
            }
          />
        ) : null}

        {uploadStatus.kind === "error" ? (
          <Alert type="error" message={uploadStatus.message} showIcon />
        ) : null}

        {results.length > 0 ? (
          <ul className="workspace-upload__results" aria-label={t("workspace.uploadResultListLabel")}>
            {results.map((item) => (
              <li
                key={`${item.fileName}-${item.kind}`}
                className={`workspace-upload__result${item.ok ? " workspace-upload__result--ok" : " workspace-upload__result--fail"}`}
              >
                {item.ok ? <CheckOutlined /> : <WarningOutlined />}
                <div className="workspace-upload__result-body">
                  <span className="workspace-upload__result-name">{item.fileName}</span>
                  <span className="workspace-upload__result-message">{item.message}</span>
                </div>
                {item.kind === "box" && item.warnings && item.warnings.length > 0 ? (
                  <ul className="workspace-upload__warnings" aria-label={t("workspace.boxUploadWarningsLabel")}>
                    {item.warnings.map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="panel workspace-client-publish">
        <div className="workspace-client-publish__icon" aria-hidden="true">
          <FileTextOutlined style={{ fontSize: 28 }} />
        </div>
        <div className="workspace-client-publish__copy">
          <h2>{t("workspace.clientOnlyTitle")}</h2>
          <p>{t("workspace.clientOnlyBody")}</p>
        </div>
        <div className="workspace-client-publish__steps" aria-label={t("workspace.clientOnlyStepsLabel")}>
          <article>
            <strong>{t("workspace.clientOnlyStepCreate")}</strong>
            <span>{t("workspace.clientOnlyStepCreateBody")}</span>
          </article>
          <article>
            <strong>{t("workspace.clientOnlyStepPublish")}</strong>
            <span>{t("workspace.clientOnlyStepPublishBody")}</span>
          </article>
          <article>
            <strong>{t("workspace.clientOnlyStepView")}</strong>
            <span>{t("workspace.clientOnlyStepViewBody")}</span>
          </article>
        </div>
      </section>
    </div>
  );
}
