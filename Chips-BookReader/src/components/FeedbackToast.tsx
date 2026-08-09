import React from "react";
import { CheckCircleFilled, CloseCircleFilled, InfoCircleOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import type { ReaderFeedback } from "../utils/book-reader";

export interface FeedbackToastProps {
  feedback: ReaderFeedback | null;
}

const FEEDBACK_ICON_BY_TONE: Record<ReaderFeedback["tone"], ReactNode> = {
  info: <InfoCircleOutlined />,
  success: <CheckCircleFilled />,
  error: <CloseCircleFilled />,
};

export function FeedbackToast(props: FeedbackToastProps): React.ReactElement | null {
  const { feedback } = props;

  if (!feedback) {
    return null;
  }

  return (
    <div className={`book-reader-feedback book-reader-feedback--${feedback.tone}`} role="status" aria-live="polite">
      <span className="book-reader-feedback__icon" aria-hidden="true">
        {FEEDBACK_ICON_BY_TONE[feedback.tone]}
      </span>
      <span className="book-reader-feedback__message">{feedback.message}</span>
    </div>
  );
}
