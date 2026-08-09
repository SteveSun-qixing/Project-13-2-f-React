import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { PublicUserProfile } from '../api/auth';
import { getErrorMessage, getInitial } from '../lib/ui';

const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
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
  const [form] = Form.useForm<ProfileSettingsFormValues>();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.setFieldsValue({
      displayName: user.displayName || user.username,
      bio: user.bio ?? '',
    });
    setAvatarFile(null);
    setError('');
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

  const handleAvatarSelect: UploadProps['beforeUpload'] = (file) => {
    if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
      setAvatarFile(null);
      setError('头像仅支持 JPG、PNG、WebP 或 GIF 格式。');
      return Upload.LIST_IGNORE;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarFile(null);
      setError('头像文件不能超过 5MB。');
      return Upload.LIST_IGNORE;
    }

    setAvatarFile(file as File);
    setError('');
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
    setError('');

    try {
      await onSubmit({
        displayName: normalizedDisplayName,
        bio: normalizedBio,
        avatarFile,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError, '个人资料更新失败，请稍后重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      title="编辑个人资料"
      onOk={() => void handleOk()}
      onCancel={handleCancel}
      confirmLoading={isSubmitting}
      maskClosable={!isSubmitting}
      keyboard={!isSubmitting}
      okText={isSubmitting ? '正在保存…' : '保存'}
      cancelText="取消"
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
          <span className="eyebrow">资料设置</span>
          <p className="muted">更新名字、头像和简介，页面会立即同步到你的个人主页。</p>
        </div>
      </div>

      <div className="profile-settings-dialog__avatar-row">
        <div className="profile-settings-dialog__avatar-copy">
          <span className="profile-settings-dialog__avatar-hint">
            {avatarFile
              ? `已选择：${avatarFile.name}`
              : '支持 JPG、PNG、WebP、GIF，大小不超过 5MB。'}
          </span>
        </div>

        <Upload
          accept={ACCEPTED_AVATAR_TYPES.join(',')}
          showUploadList={false}
          beforeUpload={handleAvatarSelect}
        >
          <Button icon={<UploadOutlined />}>上传新头像</Button>
        </Upload>
      </div>

      <Form form={form} layout="vertical" disabled={isSubmitting}>
        <Form.Item
          name="displayName"
          label="个人名字"
          rules={[{ required: true, message: '个人名字不能为空。' }]}
        >
          <Input maxLength={100} />
        </Form.Item>

        <Form.Item name="bio" label="个人简介">
          <Input.TextArea rows={4} maxLength={200} />
        </Form.Item>
      </Form>

      {error ? <Alert type="error" message={error} showIcon /> : null}
    </Modal>
  );
}
