import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Modal, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import type { PublicUserProfile } from "../api/auth";
import { useAppPreferences } from "../contexts/PreferencesContext";
import { getErrorMessage, getInitial } from "../lib/ui";

const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024;

export interface ProfileSettingsPayload {
  displayName: string;
  bio: string;
  avatarFile: File | null;
}

interface ProfileSettingsFormValues {
  displayName: string;
  bio: string;
}

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  user: PublicUserProfile;
  onClose: () => void;
  onSubmit: (payload: ProfileSettingsPayload) => Promise<void>;
}

export function ProfileSettingsDialog({
  isOpen,
  user,
  onClose,
  onSubmit,
}: ProfileSettingsDialogProps) {
  const { t } = useAppPreferences();
  const [form] = Form.useForm<ProfileSettingsFormValues>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.setFieldsValue({
      displayName: user.displayName || user.username,
      bio: user.bio ?? "",
    });
    setAvatarFile(null);
    setError("");
  }, [form, isOpen, user.bio, user.displayName, user.username]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(nextPreviewUrl);
    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [avatarFile]);

  const avatarAlt = user.displayName || user.username;
  const avatarSrc = avatarPreviewUrl || user.avatarUrl;

  const handleAvatarSelect: UploadProps["beforeUpload"] = (file) => {
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarFile(null);
      setError(t("profile.settingsImageTypeInvalid"));
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarFile(null);
      setError(t("profile.settingsImageTooLarge"));
      return Upload.LIST_IGNORE;
    }

    setAvatarFile(file as File);
    setError("");
    return Upload.LIST_IGNORE;
  };

  const handleCancel = () => {
    if (isSubmitting) {
      return;
    }
    onClose();
  };

  const handleOk = async () => {
    let values: ProfileSettingsFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const normalizedDisplayName = values.displayName.trim();
    const normalizedBio = values.bio.trim();

    setIsSubmitting(true);
    setError("");

    try {
      await onSubmit({
        displayName: normalizedDisplayName,
        bio: normalizedBio,
        avatarFile,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, t("profile.settingsSubmitError")));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      title={t("profile.settingsTitle")}
      onOk={() => void handleOk()}
      onCancel={handleCancel}
      confirmLoading={isSubmitting}
      maskClosable={!isSubmitting}
      keyboard={!isSubmitting}
      okText={isSubmitting ? t("profile.settingsSaving") : t("common.save")}
      cancelText={t("common.cancel")}
      width={560}
    >
      <div className="profile-settings-dialog__header">
        <div className="profile-settings-dialog__avatar-preview">
          {avatarSrc ? (
            <img src={avatarSrc} alt={avatarAlt} />
          ) : (
            <span>{getInitial(avatarAlt)}</span>
          )}
        </div>

        <div className="profile-settings-dialog__header-copy">
          <span className="eyebrow">{t("profile.settingsEyebrow")}</span>
          <p className="muted">{t("profile.settingsSubtitle")}</p>
        </div>
      </div>

      <div className="profile-settings-dialog__avatar-row">
        <div className="profile-settings-dialog__avatar-copy">
          <span className="profile-settings-dialog__avatar-hint">
            {avatarFile
              ? t("profile.settingsAvatarSelected", { name: avatarFile.name })
              : t("profile.settingsAvatarHint")}
          </span>
        </div>

        <Upload
          accept={ACCEPTED_AVATAR_TYPES.join(",")}
          showUploadList={false}
          beforeUpload={handleAvatarSelect}
        >
          <Button icon={<UploadOutlined />}>{t("profile.settingsAvatarAction")}</Button>
        </Upload>
      </div>

      <Form form={form} layout="vertical" disabled={isSubmitting}>
        <Form.Item
          name="displayName"
          label={t("profile.settingsName")}
          rules={[{ required: true, message: t("profile.settingsNameRequired") }]}
        >
          <Input maxLength={100} />
        </Form.Item>

        <Form.Item name="bio" label={t("profile.settingsBio")}>
          <Input.TextArea rows={4} maxLength={200} />
        </Form.Item>
      </Form>

      {error ? <Alert type="error" message={error} showIcon /> : null}
    </Modal>
  );
}
