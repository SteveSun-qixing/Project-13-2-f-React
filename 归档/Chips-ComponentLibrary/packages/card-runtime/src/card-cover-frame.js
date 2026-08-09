import React from "react";
import { EmbeddedDocumentFrame } from "./embedded-document-frame.js";

export function CardCoverFrame(props) {
  const {
    cardId,
    title,
    coverUrl,
    ratio = "4:3",
    loading = false,
    disabled = false,
    sandbox = "allow-scripts",
    onOpenCard,
    onFrameReady,
    onFrameError
  } = props;
  return React.createElement(
    EmbeddedDocumentFrame,
    {
      surfaceId: cardId,
      title: title || "Card Cover",
      src: coverUrl,
      ratio,
      loading,
      disabled,
      sandbox,
      scope: "card-cover-frame",
      onActivate: typeof onOpenCard === "function" ? () => onOpenCard(cardId) : undefined,
      onFrameReady: typeof onFrameReady === "function" ? () => onFrameReady(cardId) : undefined,
      onFrameError
    }
  );
}
