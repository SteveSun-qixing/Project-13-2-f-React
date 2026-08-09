import React, { useEffect, useState } from "react";
import { Button, Input } from "antd";
import type { BookReaderCommandId } from "../commands/book-reader-commands";
import { BOOK_READER_COMMAND_IDS } from "../commands/book-reader-commands";
import { PanelShell } from "./PanelShell";

export interface SourcePanelProps {
  initialUrl: string;
  onOpenFile: () => void | Promise<void>;
  onOpenUrl: (url: string) => void | Promise<void>;
  onInvokeCommand?: (commandId: BookReaderCommandId, payload?: Record<string, unknown>) => void | Promise<void>;
  restoreFocusElement?: HTMLElement | null;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function SourcePanel(props: SourcePanelProps): React.ReactElement {
  const { initialUrl, onOpenFile, onOpenUrl, onInvokeCommand, restoreFocusElement, onClose, t } = props;
  const [value, setValue] = useState(initialUrl);

  useEffect(() => {
    setValue(initialUrl);
  }, [initialUrl]);

  return (
    <PanelShell
      title={t("book-reader.labels.importBook")}
      eyebrow={t("book-reader.labels.appName")}
      onClose={onClose}
      className="book-reader-panel--source"
      variant="dialog"
      restoreFocusElement={restoreFocusElement}
      t={t}
    >
      <div className="book-reader-source">
        <p className="book-reader-source__copy">{t("book-reader.empty.description")}</p>
        <Button
          type="primary"
          size="large"
          block
          onClick={() => {
            if (onInvokeCommand) {
              void onInvokeCommand(BOOK_READER_COMMAND_IDS.openFile);
              return;
            }
            void onOpenFile();
          }}
        >
          {t("book-reader.actions.openFile")}
        </Button>
        <form
          className="book-reader-sourceForm"
          onSubmit={(event) => {
            event.preventDefault();
            const url = value.trim();
            if (onInvokeCommand) {
              void onInvokeCommand(BOOK_READER_COMMAND_IDS.openUrl, { url });
              return;
            }
            void onOpenUrl(url);
          }}
        >
          <label className="book-reader-sourceForm__label" htmlFor="book-reader-source-url">
            {t("book-reader.actions.openUrl")}
          </label>
          <Input
            id="book-reader-source-url"
            type="url"
            value={value}
            placeholder={t("book-reader.placeholders.remoteUrl")}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="default" size="large" htmlType="submit" block>
            {t("book-reader.actions.openUrl")}
          </Button>
        </form>
        <p className="book-reader-source__supported">{t("book-reader.empty.supportedFormat")}</p>
      </div>
    </PanelShell>
  );
}
