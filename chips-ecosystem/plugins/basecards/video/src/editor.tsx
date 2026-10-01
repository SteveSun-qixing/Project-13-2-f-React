import type { ChangeEvent, ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Button, Input, InputNumber, Switch, Tag, theme } from '@chips/ui';
import {
  deriveDisplayTitle,
  readConfig,
  validateConfig,
} from './config';
import type { IVideoConfig, IVideoPlayback, IVideoSubtitleTrack } from './config';
import { generateStableId, normalizeRelativeCardResourcePath } from './shared/utils';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：字段级错误以行内简体中文提示呈现，仅当整份配置合法
 * 且视频资源路径已填写时才向编辑链路发布 replace 变更。
 *
 * 数值与开关项按旧族 video-BCP 语义迁移：默认倍速 InputNumber（0.25~4，步长 0.25）、
 * 起始秒数 InputNumber（非负，步长 1）、自动播放/循环播放/默认静音 Switch、
 * 默认字幕轨全表唯一。
 *
 * 缺位臂（工单071，工单060 族）：视频/封面/字幕文件落卡片的导入（选择/拖放/URL →
 * 资源写入 → 路径回填）与首帧缩略图自动生成（旧族 `extractVideoThumbnail` 注入面）
 * 依赖编辑器资源导入通道与宿主媒体面，通道就绪前编辑器承接资源路径与配置编辑，
 * 面板内行内提示如实说明，不伪造导入流程。
 */

/** 编辑器发布变更前要求的最小完整性：整体合法（schema 同口径）且视频资源路径非空。 */
export function isEditorConfigComplete(config: IVideoConfig): boolean {
  return config.video_file.length > 0 && validateConfig(config);
}

export interface IVideoEditorViewProps {
  config: IVideoConfig;
  onChange: (next: IVideoConfig) => void;
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactElement;
}): ReactElement {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 160px) minmax(0, 1fr)',
        gap: token.marginSM,
        padding: `${token.paddingSM}px 0`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        alignItems: 'start',
      }}
    >
      <div style={{ display: 'grid', gap: 2, paddingTop: 5 }}>
        <span style={{ color: token.colorText, fontSize: token.fontSizeSM, fontWeight: 600 }}>
          {label}
        </span>
        {hint ? (
          <span style={{ color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>{hint}</span>
        ) : null}
      </div>
      <div style={{ display: 'grid', gap: token.marginXXS, minWidth: 0 }}>
        {children}
        {error ? (
          <span role="alert" style={{ color: token.colorError, fontSize: token.fontSizeSM }}>
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}): ReactElement {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: token.marginSM,
        padding: `${token.paddingXS}px 0`,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <span style={{ color: token.colorText, fontSize: token.fontSizeSM }}>{label}</span>
      <Switch data-role={testId} checked={checked} onChange={onChange} />
    </div>
  );
}

/** 旧族数值归一语义：倍速钳制 0.25~4（清空回 1）、起始秒数非负（清空回 0）。 */
function normalizePlaybackRate(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(4, Math.max(0.25, value));
}

function normalizeStartTime(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }
  return value > 0 ? value : 0;
}

function subtitleDisplayName(track: IVideoSubtitleTrack): string {
  return track.label || track.language || track.file_path || '未命名字幕';
}

export function VideoEditorView({ config, onChange }: IVideoEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IVideoConfig>(() => readConfig(config));
  const draftRef = useRef(draft);

  const commit = (patch: Partial<IVideoConfig>): void => {
    const next = readConfig({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const onStringField =
    (key: 'video_file' | 'cover_image' | 'video_title' | 'publish_time' | 'creator') =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      commit({ [key]: event.currentTarget.value });
    };

  /** 播放参数补丁：以 draftRef 当前值为基（渲染闭包可能滞后于连续变更）。 */
  const patchPlayback = (partial: Partial<IVideoPlayback>): void => {
    commit({ playback: { ...draftRef.current.playback, ...partial } });
  };

  const updateSubtitle = (trackId: string, patch: Partial<IVideoSubtitleTrack>): void => {
    commit({
      subtitles: draftRef.current.subtitles.map((track) =>
        track.id === trackId ? { ...track, ...patch } : track,
      ),
    });
  };

  /** 默认字幕轨全表唯一：开启即关闭其余轨（归一层再按首个 default 兜底）。 */
  const setDefaultSubtitle = (trackId: string, checked: boolean): void => {
    commit({
      subtitles: draftRef.current.subtitles.map((track) =>
        track.id === trackId ? { ...track, default: checked } : { ...track, default: false },
      ),
    });
  };

  const addSubtitle = (): void => {
    const track: IVideoSubtitleTrack = {
      id: generateStableId('subtitle'),
      label: '',
      language: '',
      kind: 'subtitles',
      file_path: '',
      default: false,
    };
    commit({ subtitles: [...draftRef.current.subtitles, track] });
  };

  const removeSubtitle = (trackId: string): void => {
    commit({ subtitles: draftRef.current.subtitles.filter((track) => track.id !== trackId) });
  };

  const displayTitle = deriveDisplayTitle(draft) || '未命名视频';
  const videoPathInvalid =
    draft.video_file.length > 0 && normalizeRelativeCardResourcePath(draft.video_file) === undefined;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
        padding: token.padding,
        boxSizing: 'border-box',
      }}
    >
      <section style={{ display: 'grid', gap: 0, maxWidth: 720, margin: '0 auto' }}>
        <h3
          style={{
            margin: 0,
            padding: `${token.paddingXS}px 0`,
            color: token.colorText,
            fontSize: token.fontSize,
            fontWeight: 700,
          }}
        >
          资源文件
        </h3>
        <p
          style={{
            margin: 0,
            paddingBottom: token.paddingXS,
            color: token.colorTextSecondary,
            fontSize: token.fontSizeSM,
          }}
        >
          本地视频、封面与字幕文件导入依赖编辑器资源导入通道（工单071），通道交付前请直接填写卡片内相对资源路径。
        </p>

        <FieldRow
          label="视频文件"
          hint="必填；卡片内相对路径，例如 videos/tokyo-travel.mp4"
          error={videoPathInvalid ? '视频文件必须是合法的卡片内相对路径' : undefined}
        >
          <Input
            data-role="video-path-input"
            value={draft.video_file}
            placeholder="videos/tokyo-travel.mp4"
            {...(videoPathInvalid ? { status: 'error' as const } : {})}
            onChange={onStringField('video_file')}
          />
        </FieldRow>

        <FieldRow label="视频封面" hint="可选；卡片内相对路径，未填写时查看态以视频首帧回退呈现">
          <Input
            data-role="cover-path-input"
            value={draft.cover_image}
            placeholder="covers/tokyo-travel.jpg"
            onChange={onStringField('cover_image')}
          />
        </FieldRow>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: token.marginXS,
            paddingTop: token.paddingLG,
          }}
        >
          <h3 style={{ margin: 0, color: token.colorText, fontSize: token.fontSize, fontWeight: 700 }}>
            字幕
          </h3>
          <Button data-role="add-subtitle" onClick={addSubtitle}>
            添加字幕
          </Button>
        </div>

        {draft.subtitles.length > 0 ? (
          <div style={{ display: 'grid', gap: token.marginSM, paddingTop: token.marginSM }}>
            {draft.subtitles.map((track) => {
              const pathInvalid =
                track.file_path.length > 0 &&
                normalizeRelativeCardResourcePath(track.file_path) === undefined;
              return (
                <div
                  key={track.id}
                  style={{
                    display: 'grid',
                    gap: token.marginSM,
                    padding: token.paddingSM,
                    border: `1px solid ${token.colorBorderSecondary}`,
                    borderRadius: token.borderRadiusLG,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                    <Tag color="processing">{subtitleDisplayName(track)}</Tag>
                    {track.default ? <Tag color="success">默认字幕</Tag> : null}
                    <span style={{ flex: '1 1 auto' }} />
                    <Button
                      data-role={`remove-subtitle-${track.id}`}
                      size="small"
                      onClick={() => {
                        removeSubtitle(track.id);
                      }}
                    >
                      删除字幕
                    </Button>
                  </div>
                  <FieldRow label="字幕名称">
                    <Input
                      data-role={`subtitle-label-input-${track.id}`}
                      value={track.label}
                      placeholder="例如：简体中文"
                      onChange={(event) => {
                        updateSubtitle(track.id, { label: event.currentTarget.value });
                      }}
                    />
                  </FieldRow>
                  <FieldRow label="语言" hint="BCP 47 标识">
                    <Input
                      data-role={`subtitle-language-input-${track.id}`}
                      value={track.language}
                      placeholder="例如：zh-CN"
                      onChange={(event) => {
                        updateSubtitle(track.id, { language: event.currentTarget.value });
                      }}
                    />
                  </FieldRow>
                  <FieldRow
                    label="字幕文件"
                    error={pathInvalid ? '字幕文件必须是合法的卡片内相对路径' : undefined}
                  >
                    <Input
                      data-role={`subtitle-path-input-${track.id}`}
                      value={track.file_path}
                      placeholder="subtitles/tokyo-travel.zh.vtt"
                      {...(pathInvalid ? { status: 'error' as const } : {})}
                      onChange={(event) => {
                        updateSubtitle(track.id, { file_path: event.currentTarget.value });
                      }}
                    />
                  </FieldRow>
                  <SwitchRow
                    label="默认字幕"
                    testId={`subtitle-default-switch-${track.id}`}
                    checked={track.default}
                    onChange={(checked) => {
                      setDefaultSubtitle(track.id, checked);
                    }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <p
            style={{
              margin: 0,
              paddingTop: token.marginSM,
              color: token.colorTextSecondary,
              fontSize: token.fontSizeSM,
            }}
          >
            还没有添加字幕轨，可以为视频添加外挂字幕。
          </p>
        )}

        <h3
          style={{
            margin: 0,
            paddingTop: token.paddingLG,
            color: token.colorText,
            fontSize: token.fontSize,
            fontWeight: 700,
          }}
        >
          视频信息
        </h3>

        <FieldRow label="视频标题" hint={`留空时查看态从视频文件名派生，当前展示：${displayTitle}`}>
          <Input
            data-role="video-title-input"
            value={draft.video_title}
            placeholder="例如：旅行 Vlog 第 12 集"
            onChange={onStringField('video_title')}
          />
        </FieldRow>

        <FieldRow label="创作者">
          <Input
            data-role="creator-input"
            value={draft.creator}
            placeholder="例如：薯片工作室"
            onChange={onStringField('creator')}
          />
        </FieldRow>

        <FieldRow label="发布时间">
          <Input
            data-role="publish-time-input"
            value={draft.publish_time}
            placeholder="例如：2026-04-18"
            onChange={onStringField('publish_time')}
          />
        </FieldRow>

        <h3
          style={{
            margin: 0,
            paddingTop: token.paddingLG,
            color: token.colorText,
            fontSize: token.fontSize,
            fontWeight: 700,
          }}
        >
          播放参数
        </h3>

        <div style={{ display: 'grid', gap: 0, paddingTop: token.paddingXS }}>
          <SwitchRow
            label="自动播放"
            testId="autoplay-switch"
            checked={draft.playback.autoplay}
            onChange={(checked) => {
              patchPlayback({ autoplay: checked });
            }}
          />
          <SwitchRow
            label="循环播放"
            testId="loop-switch"
            checked={draft.playback.loop}
            onChange={(checked) => {
              patchPlayback({ loop: checked });
            }}
          />
          <SwitchRow
            label="默认静音"
            testId="muted-switch"
            checked={draft.playback.muted}
            onChange={(checked) => {
              patchPlayback({ muted: checked });
            }}
          />

          <FieldRow label="默认倍速" hint="0.25 ~ 4，步长 0.25">
            <InputNumber
              data-role="playback-rate-input"
              value={draft.playback.playback_rate}
              min={0.25}
              max={4}
              step={0.25}
              onChange={(value) => {
                patchPlayback({ playback_rate: normalizePlaybackRate(value) });
              }}
            />
          </FieldRow>

          <FieldRow label="起始秒数" hint="从第几秒开始播放，最小 0">
            <InputNumber
              data-role="start-time-input"
              value={draft.playback.start_time}
              min={0}
              step={1}
              onChange={(value) => {
                patchPlayback({ start_time: normalizeStartTime(value) });
              }}
            />
          </FieldRow>
        </div>
      </section>
    </div>
  );
}
