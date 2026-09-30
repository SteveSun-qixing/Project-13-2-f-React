import React from 'react';
import { Button, Form, Input, Spin, Typography, theme } from '@chips/ui';
import {
  assembleTrackFromInput,
  fetchCompanionLyrics,
  probeAudioMetadata,
  buildTrackPresentation,
  type TrackAssemblyInput,
  type TrackPresentation,
} from '../player/trackSession';
import { SUPPORTED_AUDIO_EXTENSION_LABEL } from '../player/musicPlayer';

/**
 * 曲目装配表单（重写件）：空态与「添加曲目」共用的会话装配入口。
 *
 * 本臂的会话装配面：直接可播放地址（`file:` / `http(s):` / `blob:` / `data:`）。
 * `resource:open` audio 槽位端到端随宿主资源打开路由落波（工单060 关联面），届时启动
 * 投递复用同一 `TrackPresentation` 会话形状；文件选择等系统能力经 `dialog:*` 域，宿主
 * 处理器同样未就绪，本界面不自建旁路。地址可取字节时同步探测嵌入元数据与伴生歌词
 * （真实解析链，不 mock）；`file:` 地址与拉取失败如实降级为文件名展示。
 */

export interface AssemblyFormProps {
  /** 装配完成回调（已完成元数据探测与伴生歌词拉取）。 */
  onAppend: (presentation: TrackPresentation) => void;
  /** 提交按钮文案（空态＝「加入并播放」，添加曲目＝「加入队列」）。 */
  submitLabel: string;
}

interface AssemblyFormValues {
  audioUri: string;
  title?: string;
  lyricsUri?: string;
  coverUri?: string;
}

/** 执行装配：守卫 → 来源归一 → 嵌入元数据与伴生歌词补全 → 呈现合成。 */
export async function assembleTrack(values: AssemblyFormValues): Promise<TrackPresentation> {
  const input: TrackAssemblyInput = {
    audioUri: values.audioUri,
    ...(values.title ? { title: values.title } : {}),
    ...(values.lyricsUri ? { lyricsUri: values.lyricsUri } : {}),
    ...(values.coverUri ? { coverUri: values.coverUri } : {}),
  };
  const assembled = assembleTrackFromInput(input);
  if (!assembled.ok) {
    throw new Error(assembled.error);
  }
  const source = assembled.presentation.source;
  const [metadata, companionLyrics] = await Promise.all([
    probeAudioMetadata(source),
    input.lyricsUri ? fetchCompanionLyrics(input.lyricsUri.trim()) : Promise.resolve(null),
  ]);
  return buildTrackPresentation({
    source,
    metadata,
    companionLyrics,
    ...(input.coverUri ? { companionCoverUri: input.coverUri.trim() } : {}),
    ...(input.title ? { cardDisplay: { title: input.title.trim() } } : {}),
  });
}

export const AssemblyForm: React.FC<AssemblyFormProps> = ({ onAppend, submitLabel }) => {
  const { token } = theme.useToken();
  const [form] = Form.useForm<AssemblyFormValues>();
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = (values: AssemblyFormValues): void => {
    setError(null);
    setSubmitting(true);
    void (async (): Promise<void> => {
      try {
        const presentation = await assembleTrack(values);
        onAppend(presentation);
        form.resetFields();
      } catch (cause: unknown) {
        setError(cause instanceof Error ? cause.message : '无法识别的音频地址。');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  return (
    <Spin spinning={submitting} description="正在装配曲目">
      <Form
        form={form}
        layout="vertical"
        style={{ width: 'min(520px, 100%)' }}
        onFinish={handleSubmit}
      >
        <Form.Item
          name="audioUri"
          label="音频地址"
          required
          rules={[{ required: true, message: '请输入音频地址。' }]}
        >
          <Input placeholder="音频地址（file://、https://、blob:、data:）" aria-label="音频地址" allowClear />
        </Form.Item>
        <Form.Item name="title" label="标题（可选，缺省按文件名）">
          <Input placeholder="展示标题" aria-label="展示标题" allowClear />
        </Form.Item>
        <Form.Item name="lyricsUri" label="歌词地址（可选，.lrc / .txt）">
          <Input placeholder="伴生歌词地址" aria-label="伴生歌词地址" allowClear />
        </Form.Item>
        <Form.Item name="coverUri" label="封面地址（可选）">
          <Input placeholder="伴生封面地址" aria-label="伴生封面地址" allowClear />
        </Form.Item>
        <Button type="primary" htmlType="submit" block aria-label={submitLabel}>
          {submitLabel}
        </Button>
      </Form>
      {error === null ? null : (
        <Typography.Text type="danger" role="alert">
          {error}
        </Typography.Text>
      )}
      <Typography.Text
        type="secondary"
        style={{ display: 'block', marginTop: token.marginSM, fontSize: token.fontSizeSM }}
      >
        支持格式：{SUPPORTED_AUDIO_EXTENSION_LABEL}
      </Typography.Text>
    </Spin>
  );
};

export default AssemblyForm;
