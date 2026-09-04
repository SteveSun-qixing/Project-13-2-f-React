import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { Input, Modal } from "antd";
import { formatMessage } from "../lib/messages";

/** 密码对话框：加密 PDF 的解锁入口；密码错误时提示重试 */
export function PasswordDialog({
  open,
  wrong,
  loading,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  wrong: boolean;
  loading: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}): ReactElement {
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  return (
    <Modal
      className="pdf-password-dialog"
      title={formatMessage("pdf.dialog.password.title")}
      open={open}
      onCancel={onCancel}
      maskClosable={false}
      footer={null}
      destroyOnClose
      width={380}
    >
      <div className="pdf-password-pane">
        <p className="pdf-password-description">{formatMessage("pdf.dialog.password.description")}</p>
        {wrong ? <p className="pdf-password-wrong">{formatMessage("pdf.dialog.password.wrong")}</p> : null}
        <Input.Password
          autoFocus
          value={password}
          placeholder={formatMessage("pdf.dialog.password.placeholder")}
          status={wrong ? "error" : undefined}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={() => {
            if (password.length > 0) onSubmit(password);
          }}
        />
        <div className="pdf-password-actions">
          <button type="button" className="pdf-error-retry" onClick={onCancel}>
            {formatMessage("pdf.dialog.password.cancel")}
          </button>
          <button
            type="button"
            className="pdf-error-retry pdf-error-retry-primary"
            disabled={password.length === 0 || loading}
            onClick={() => onSubmit(password)}
          >
            {formatMessage("pdf.dialog.password.confirm")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
