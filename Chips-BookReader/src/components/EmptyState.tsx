import React from "react";
import { Button } from "antd";
import type { BookReaderCommandId } from "../commands/book-reader-commands";
import { BOOK_READER_COMMAND_IDS } from "../commands/book-reader-commands";

export interface EmptyStateProps {
  onOpenSource: () => void;
  onInvokeCommand?: (commandId: BookReaderCommandId) => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EmptyState(props: EmptyStateProps): React.ReactElement {
  const { onOpenSource, onInvokeCommand, t } = props;

  return (
    <div className="book-reader-empty">
      <div className="book-reader-empty__card">
        <span className="book-reader-empty__badge">{t("book-reader.empty.badge")}</span>
        <h1 className="book-reader-empty__title">{t("book-reader.empty.title")}</h1>
        <p className="book-reader-empty__description">{t("book-reader.empty.description")}</p>
        <Button
          type="primary"
          size="large"
          className="book-reader-empty__prompt"
          onClick={() => {
            if (onInvokeCommand) {
              void onInvokeCommand(BOOK_READER_COMMAND_IDS.openSourcePanel);
              return;
            }
            onOpenSource();
          }}
        >
          {t("book-reader.empty.prompt")}
        </Button>
        <p className="book-reader-empty__hint">{t("book-reader.empty.dropHint")}</p>
        <p className="book-reader-empty__supported">{t("book-reader.empty.supportedFormat")}</p>
      </div>
    </div>
  );
}
