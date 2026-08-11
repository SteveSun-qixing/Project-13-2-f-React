import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Spin } from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  InfoCircleOutlined,
  UploadOutlined,
  WarningFilled,
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
  filePath: string;
  fileName: string;
  kind: UploadKind;
  ok: boolean;
  message: string;
  communityUrl: string;
  warnings?: UploadWarning[];
}

interface ActiveFileState {
  fileName: string;
  stage: string;
  percent: number | null;
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
  const [activeFile, setActiveFile] = useState<ActiveFileState | null>(null);
  const [results, setResults] = useState<UploadFileResult[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = async (filePaths: string[]) => {
    if (!isAuthenticated) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadRequiresLogin") });
      return;
    }

    const paths = filePaths.filter(Boolean);
    if (paths.length === 0) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadSelectFile") });
      return;
    }

    setUploadStatus({ kind: "idle" });
    setResults([]);
    setBatch({ current: 0, total: paths.length });
    setActiveFile(null);

    const outcomes: UploadFileResult[] = [];

    for (let index = 0; index < paths.length; index += 1) {
      const filePath = paths[index]!;
      const fileName = getFileName(filePath);
      const kind = getUploadKind(filePath);
      setBatch({ current: index + 1, total: paths.length });
      setActiveFile({ fileName, stage: t("workspace.uploading"), percent: null });

      const reportProgress = (progress: TransferJobProgress) => {
        setActiveFile({
          fileName,
          stage:
            formatUploadProgress(progress.message || progress.stage, progress.percent) ??
            t("workspace.uploading"),
          percent: progress.percent > 0 ? progress.percent : null,
        });
      };

      try {
        if (kind === "box") {
          const result = await transferRef.current.uploadBox(filePath, reportProgress);
          outcomes.push({
            filePath,
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
            filePath,
            fileName,
            kind,
            ok: true,
            message: t("workspace.uploadResultPublished"),
            communityUrl: result.communityUrl,
          });
        }
      } catch (nextError) {
        outcomes.push({
          filePath,
          fileName,
          kind,
          ok: false,
          message: getErrorMessage(nextError, t("common.error")),
          communityUrl: "",
        });
      }

      setActiveFile(null);
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
        openLabel =
          firstSuccess?.kind === "box"
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

  const handleUpload = async () => {
    if (!isAuthenticated) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadRequiresLogin") });
      return;
    }

    setUploadStatus({ kind: "idle" });
    setResults([]);
    setBatch(null);
    setActiveFile(null);

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

    await uploadFiles(filePaths);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    const paths = files
      .map((file) => client.platform.getPathForFile(file) || (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path));

    if (paths.length === 0) {
      setUploadStatus({ kind: "error", message: t("workspace.uploadSelectFile") });
      return;
    }

    await uploadFiles(paths);
  };

  const handleRetry = async (filePath: string) => {
    await uploadFiles([filePath]);
  };

  const handleOpenCommunityUrl = () => {
    if (uploadStatus.kind !== "success") {
      return;
    }
    void client.platform.openExternal(uploadStatus.communityUrl);
  };

  const totalCount = batch?.total ?? results.length;
  const doneCount = results.filter((item) => item.ok).length + (batch ? batch.current - 1 : results.length);
  const hasQueue = Boolean(batch || activeFile || results.length > 0);

  if (!user) {
    return null;
  }

  return (
    <div className="page-container workspace-page">
      <div className="workspace-page__head">
        <button
          type="button"
          className="workspace-page__back"
          aria-label={t("workspace.backToProfile")}
          onClick={() => navigate(profileHref)}
        >
          <ArrowLeftOutlined />
        </button>
        <div>
          <h1>{t("workspace.title")}</h1>
          <p>{t("workspace.subtitle")}</p>
        </div>
      </div>

      {/* 上传区 */}
      <section
        className={`workspace-dropzone${isDragging ? " workspace-dropzone--dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => void handleDrop(event)}
      >
        <div className="workspace-dropzone__icon" aria-hidden="true">
          <UploadOutlined />
        </div>
        <h2>{t("workspace.dropzoneTitle")}</h2>
        <p className="workspace-dropzone__desc">{t("workspace.dropzoneSubtitle")}</p>
        <div className="workspace-dropzone__formats">
          <span className="format-chip">{t("workspace.formatCard")}</span>
          <span className="format-chip">{t("workspace.formatBox")}</span>
        </div>
        <Button
          type="primary"
          size="large"
          className="workspace-dropzone__button"
          onClick={() => void handleUpload()}
          loading={uploadStatus.kind === "working"}
          disabled={!isAuthenticated}
        >
          {t("workspace.uploadAction")}
        </Button>

        {!isAuthenticated ? (
          <Alert type="error" message={t("workspace.uploadRequiresLogin")} showIcon style={{ marginTop: 18 }} />
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
            style={{ marginTop: 18, textAlign: "left" }}
          />
        ) : null}

        {uploadStatus.kind === "error" ? (
          <Alert type="error" showIcon message={uploadStatus.message} style={{ marginTop: 18, textAlign: "left" }} />
        ) : null}
      </section>

      {/* 任务队列 */}
      {hasQueue ? (
        <section className="workspace-queue" aria-label={t("workspace.uploadResultListLabel")}>
          <div className="workspace-queue__head">
            <h2>{t("workspace.queueTitle")}</h2>
            <span className="workspace-queue__summary">
              {t("workspace.queueSummary", { done: doneCount, total: totalCount })}
            </span>
          </div>

          {activeFile ? (
            <div className="queue-task" role="status">
              <div className="queue-task__icon queue-task__icon--working">
                <Spin size="small" />
              </div>
              <div className="queue-task__body">
                <div className="queue-task__name">{activeFile.fileName}</div>
                <div className="queue-task__status">{activeFile.stage}</div>
                <div className="queue-task__progress">
                  <div
                    className="queue-task__progress-bar"
                    style={{ width: activeFile.percent ? `${Math.min(100, Math.round(activeFile.percent))}%` : "100%" }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {results.map((item, index) => {
            const isSuccess = item.ok && (!item.warnings || item.warnings.length === 0);
            const hasWarnings = item.ok && item.warnings && item.warnings.length > 0;
            const isFailed = !item.ok;

            return (
              <div
                key={`${item.filePath}-${index}`}
                className={`queue-task queue-task--${isSuccess ? "success" : hasWarnings ? "warning" : "error"}`}
              >
                <div
                  className={`queue-task__icon ${isSuccess ? "queue-task__icon--success" : hasWarnings ? "queue-task__icon--warning" : "queue-task__icon--error"}`}
                >
                  {isSuccess ? (
                    <CheckCircleFilled />
                  ) : hasWarnings ? (
                    <WarningFilled />
                  ) : (
                    <ExclamationCircleFilled />
                  )}
                </div>
                <div className="queue-task__body">
                  <div className="queue-task__name">{item.fileName}</div>
                  <div className="queue-task__status">
                    {isSuccess ? (
                      <span className="queue-task__status--success">{t("workspace.taskPublished")}</span>
                    ) : hasWarnings ? (
                      <span className="queue-task__status--warning">
                        {t("workspace.taskPublishedWithWarnings", { count: item.warnings?.length ?? 0 })}
                      </span>
                    ) : (
                      <span className="queue-task__status--error">{item.message}</span>
                    )}
                  </div>
                  {hasWarnings ? (
                    <ul className="queue-task__warnings">
                      {item.warnings?.map((warning) => (
                        <li key={`${warning.code}-${warning.message}`}>
                          <InfoCircleOutlined /> {warning.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="queue-task__action">
                  {isSuccess || hasWarnings ? (
                    item.communityUrl ? (
                      <button
                        type="button"
                        className="queue-task__link"
                        onClick={() => void client.platform.openExternal(item.communityUrl)}
                      >
                        {t("workspace.taskOpenInCommunity")} →
                      </button>
                    ) : null
                  ) : (
                    <Button
                      size="small"
                      onClick={() => void handleRetry(item.filePath)}
                      disabled={uploadStatus.kind === "working"}
                    >
                      {t("workspace.taskRetry")}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {/* 上传说明 */}
      <section className="workspace-hint">
        <h3>{t("workspace.hintTitle")}</h3>
        <ul>
          <li>{t("workspace.hintFormat")}</li>
          <li>{t("workspace.hintPack")}</li>
          <li>{t("workspace.hintVisibility")}</li>
          <li>{t("workspace.hintProcess")}</li>
        </ul>
      </section>
    </div>
  );
}
