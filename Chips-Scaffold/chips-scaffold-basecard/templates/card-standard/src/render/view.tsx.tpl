import React, { useEffect, useState } from "react";
import { Button, Typography } from "antd";
import type { BasecardOpenResourceInput } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";

export const VIEW_STYLE_TEXT = `
.chips-basecard {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-basecard,
.chips-basecard * {
  box-sizing: border-box;
}

.chips-basecard__content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.chips-basecard__title {
  margin: 0;
}

.chips-basecard__body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: #6e6e73;
}

.chips-basecard__resource {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.chips-basecard__resource-path {
  overflow-wrap: anywhere;
}
`;

export interface BasecardViewProps {
  config: BasecardConfig;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

type ResourcePreviewState = {
  status: "idle" | "resolving" | "ready" | "error";
  url?: string;
};

export function BasecardView({
  config,
  resolveResourceUrl,
  releaseResourceUrl,
  openResource,
}: BasecardViewProps) {
  const resourcePath = config.resource_path;
  const [resourcePreview, setResourcePreview] = useState<ResourcePreviewState>({
    status: resourcePath ? "resolving" : "idle",
  });

  useEffect(() => {
    if (!resourcePath) {
      setResourcePreview({ status: "idle" });
      return undefined;
    }

    const activeResourcePath = resourcePath;
    let disposed = false;
    let resolvedByHost = false;
    setResourcePreview({ status: "resolving" });

    async function resolvePreviewUrl(): Promise<void> {
      try {
        const url = resolveResourceUrl
          ? await resolveResourceUrl(activeResourcePath)
          : activeResourcePath;
        resolvedByHost = Boolean(resolveResourceUrl);
        if (disposed) {
          if (resolvedByHost) {
            await releaseResourceUrl?.(activeResourcePath);
          }
          return;
        }
        setResourcePreview({ status: "ready", url });
      } catch {
        if (!disposed) {
          setResourcePreview({ status: "error" });
        }
      }
    }

    void resolvePreviewUrl();

    return () => {
      disposed = true;
      if (resolvedByHost) {
        void releaseResourceUrl?.(activeResourcePath);
      }
    };
  }, [releaseResourceUrl, resolveResourceUrl, resourcePath]);

  function handleOpenResource(): void {
    if (!resourcePath || !openResource) {
      return;
    }

    const input: BasecardOpenResourceInput = {
      resourceId: resourcePath,
      title: config.title,
      payload: {
        cardType: config.card_type,
        resourcePath,
      },
    };

    openResource(input);
  }

  return (
    <article
      className="chips-basecard"
      data-card-type={config.card_type}
      aria-label={formatMessage("basecard.view.ariaLabel", { title: config.title })}
    >
      <div className="chips-basecard__content">
        <Typography.Title level={2} className="chips-basecard__title">
          {config.title}
        </Typography.Title>
        <Typography.Text className="chips-basecard__body" type="secondary">
          {config.body}
        </Typography.Text>
        {resourcePath ? (
          <div
            className="chips-basecard__resource"
            data-resource-state={resourcePreview.status}
          >
            <Typography.Text type="secondary">
              {formatMessage("basecard.resource.previewLabel")}
            </Typography.Text>
            <Typography.Text code className="chips-basecard__resource-path">
              {resourcePath}
            </Typography.Text>
            {resourcePreview.status === "resolving" ? (
              <Typography.Text type="secondary">
                {formatMessage("basecard.resource.resolving")}
              </Typography.Text>
            ) : null}
            {resourcePreview.status === "error" ? (
              <Typography.Text type="danger">
                {formatMessage("basecard.resource.resolveFailed")}
              </Typography.Text>
            ) : null}
            {openResource ? (
              <Button type="default" onClick={handleOpenResource}>
                {formatMessage("basecard.resource.openAction")}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
