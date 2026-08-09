import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Menu, Slider, Spin, Tabs, Tooltip } from "antd";
import {
  AudioMutedOutlined,
  FastBackwardOutlined,
  FastForwardOutlined,
  FolderOpenOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  MoreOutlined,
  PauseCircleFilled,
  PictureOutlined,
  PlayCircleFilled,
  QuestionCircleOutlined,
  RedoOutlined,
  RotateRightOutlined,
  SaveOutlined,
  SoundOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useCommandRegistry } from "@chips/ui";
import { VIDEO_PLAYER_COMMAND_IDS } from "../commands/video-player-commands";
import type { VideoPlayerController } from "../hooks/useVideoPlayerController";
import {
  PLAYBACK_RATES,
  formatDuration,
  formatPlaybackRate,
  formatResolution,
  resolveVideoFormatLabel,
  type VideoSource,
  type VideoTrackOption,
  type ViewerFeedback,
} from "../utils/video-player";
import { Osd, type OsdData } from "./Osd";
import { Timeline } from "./Timeline";
import { EndedOverlay } from "./EndedOverlay";
import { KeyHelpDialog, type KeyHelpGroup } from "./KeyHelpDialog";
import { TrackMenu, type TrackMenuOption } from "./TrackMenu";
import { EmptyState } from "./EmptyState";

interface VideoPlayerStageProps {
  videoSource: VideoSource | null;
  controller: VideoPlayerController;
  isResolving: boolean;
  isSaving: boolean;
  feedback: ViewerFeedback | null;
  isMorePanelOpen: boolean;
  onMorePanelOpenChange: (open: boolean) => void;
  onDropFile: (files: File[]) => void | Promise<void>;
  queueCount: number;
  onPlayNext: () => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

type MorePanelTab = "info" | "subtitles" | "audio" | "diagnostics";
type DockMenuState = "rate" | "subtitle" | "audio" | null;

const OSD_DURATION_MS = 1200;
const CLICK_SUPPRESS_WINDOW_MS = 300;

function PlayerIconButton(props: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onClick: () => void | Promise<void>;
}) {
  const { label, icon, active, disabled, buttonRef, onClick } = props;

  return (
    <Tooltip title={label}>
      <Button
        ref={buttonRef}
        type="text"
        className={`video-player-icon-button${active ? " video-player-icon-button--active" : ""}`}
        aria-label={label}
        disabled={disabled}
        icon={icon}
        onClick={() => void onClick()}
      />
    </Tooltip>
  );
}

function resolveTrackLabel(
  track: VideoTrackOption,
  fallbackKey: string,
  fallbackWithLanguageKey: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (track.label) {
    return track.label;
  }

  if (track.language) {
    return t(fallbackWithLanguageKey, {
      index: track.index + 1,
      language: track.language,
    });
  }

  return t(fallbackKey, {
    index: track.index + 1,
  });
}

function toTrackMenuOptions(tracks: VideoTrackOption[], offKey: string, offLabel: string): TrackMenuOption[] {
  const options: TrackMenuOption[] = [
    {
      key: "off",
      label: offLabel,
      selected: tracks.every((track) => !track.selected),
    },
  ];
  tracks.forEach((track) => {
    options.push({
      key: String(track.index),
      label: track.label || `${offKey} ${track.index + 1}`,
      hint: track.language || undefined,
      selected: track.selected,
    });
  });
  return options;
}

export function VideoPlayerStage(props: VideoPlayerStageProps): React.ReactElement {
  const {
    videoSource,
    controller,
    isResolving,
    isSaving,
    feedback,
    isMorePanelOpen,
    onMorePanelOpenChange,
    onDropFile,
    queueCount,
    onPlayNext,
    t,
  } = props;
  const { invoke } = useCommandRegistry();
  const [isDragActive, setIsDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<MorePanelTab>("info");
  const [osd, setOsd] = useState<OsdData | null>(null);
  const [dockMenu, setDockMenu] = useState<DockMenuState>(null);
  const [isKeyHelpOpen, setIsKeyHelpOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const dragDepthRef = useRef(0);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const osdTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const overlayMessage = controller.errorKey
    ? t(`video-player.errors.${controller.errorKey}`)
    : isResolving
      ? t("video-player.viewer.resolving")
      : videoSource && !controller.isReady
        ? t("video-player.viewer.loading")
        : controller.isBuffering
          ? t("video-player.viewer.loading")
          : null;

  const isSubtitleOff =
    controller.subtitleTracks.length > 0 && controller.subtitleTracks.every((track) => !track.selected);
  const sourceType = videoSource
    ? videoSource.isRemote
      ? t("video-player.app.remoteBadge")
      : t("video-player.app.localBadge")
    : t("video-player.labels.unknown");
  const sourceDisplay = videoSource?.filePath ?? videoSource?.sourceId ?? t("video-player.labels.unknown");
  const formatDisplay = videoSource
    ? resolveVideoFormatLabel(videoSource.fileName || videoSource.filePath || videoSource.sourceId, videoSource.mimeType) ||
      t("video-player.labels.unknown")
    : t("video-player.labels.unknown");
  const hasTimeline = Boolean(videoSource) && controller.duration > 0;

  const showOsd = React.useCallback(
    (next: Omit<OsdData, "key">) => {
      const key = `${next.title}:${next.subtitle ?? ""}:${Date.now()}`;
      setOsd({ ...next, key });
      if (osdTimerRef.current !== null) {
        window.clearTimeout(osdTimerRef.current);
      }
      osdTimerRef.current = window.setTimeout(() => {
        osdTimerRef.current = null;
        setOsd(null);
      }, OSD_DURATION_MS);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (osdTimerRef.current !== null) {
        window.clearTimeout(osdTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMorePanelOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (morePanelRef.current?.contains(target) || moreButtonRef.current?.contains(target))) {
        return;
      }

      onMorePanelOpenChange(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMorePanelOpen, onMorePanelOpenChange]);

  useEffect(() => {
    if (!videoSource) {
      setActiveTab("info");
      setDockMenu(null);
      setOsd(null);
    }
  }, [videoSource]);

  const handleVolumeWheel = React.useCallback(
    (deltaY: number): void => {
      const delta = deltaY < 0 ? 0.05 : -0.05;
      const nextVolume = Math.min(1, Math.max(0, controller.volume + delta));
      controller.setVolumeLevel(nextVolume);
      showOsd({
        icon: nextVolume === 0 ? <AudioMutedOutlined /> : <SoundOutlined />,
        title: nextVolume === 0 ? t("video-player.actions.unmute") : `${Math.round(nextVolume * 100)}%`,
        subtitle: nextVolume === 0 ? "0%" : undefined,
        progress: nextVolume,
      });
    },
    [controller, showOsd, t],
  );

  const handleSeekWithOsd = React.useCallback(
    (offsetSeconds: number): void => {
      controller.seekBy(offsetSeconds);
      showOsd({
        icon: offsetSeconds < 0 ? <FastBackwardOutlined /> : <FastForwardOutlined />,
        title: offsetSeconds < 0 ? `-${Math.abs(offsetSeconds)}s` : `+${offsetSeconds}s`,
        subtitle: formatDuration(controller.currentTime),
      });
    },
    [controller, showOsd],
  );

  const handleTogglePlayback = React.useCallback((): void => {
    void controller.togglePlayback();
  }, [controller]);

  const handleToggleMute = React.useCallback((): void => {
    controller.toggleMute();
    showOsd({
      icon: controller.isMuted ? <SoundOutlined /> : <AudioMutedOutlined />,
      title: controller.isMuted ? t("video-player.actions.unmute") : t("video-player.actions.mute"),
    });
  }, [controller, showOsd, t]);

  const handleReplay = React.useCallback((): void => {
    controller.commitSeek(0);
    void controller.togglePlayback();
  }, [controller]);

  const handleToggleLoop = React.useCallback((): void => {
    controller.toggleLoop();
    showOsd({
      icon: <RedoOutlined />,
      title: controller.loop ? "已关闭循环" : "已开启循环",
    });
  }, [controller, showOsd]);

  const contextMenuItems = useMemo(() => {
    const rateItems = PLAYBACK_RATES.map((rate) => ({
      key: `rate-${rate}`,
      label: formatPlaybackRate(rate),
      onClick: () => {
        controller.setPlaybackRate(rate);
        showOsd({ title: formatPlaybackRate(rate) });
      },
    }));
    const subtitleItems = [
      {
        key: "subtitle-off",
        label: t("video-player.more.subtitlesOff"),
        onClick: () => controller.selectSubtitleTrack(null),
      },
      ...controller.subtitleTracks.map((track) => ({
        key: `subtitle-${track.index}`,
        label: track.label || `${t("video-player.more.tabs.subtitles")} ${track.index + 1}`,
        onClick: () => controller.selectSubtitleTrack(track.index),
      })),
    ];
    return [
      {
        key: "play",
        label: controller.isPlaying ? t("video-player.actions.pause") : t("video-player.actions.play"),
        onClick: handleTogglePlayback,
      },
      { key: "loop", label: controller.loop ? "关闭循环" : "循环播放", onClick: handleToggleLoop },
      { type: "divider" as const },
      { key: "rate", label: "播放速度", children: rateItems },
      controller.subtitleTracks.length > 0
        ? { key: "subtitle", label: t("video-player.more.tabs.subtitles"), children: subtitleItems }
        : null,
      { type: "divider" as const },
      {
        key: "pip",
        label: t("video-player.actions.pictureInPicture"),
        disabled: !controller.canUsePictureInPicture,
        onClick: () => void controller.togglePictureInPicture(),
      },
      {
        key: "fullscreen",
        label: controller.isFullscreen ? t("video-player.actions.exitFullscreen") : t("video-player.actions.fullscreen"),
        onClick: () => void controller.toggleFullscreen(),
      },
      { key: "save", label: t("video-player.actions.save"), disabled: !videoSource || isSaving, onClick: () => invoke(VIDEO_PLAYER_COMMAND_IDS.saveCopy) },
      { type: "divider" as const },
      { key: "help", label: "快捷键帮助", icon: <QuestionCircleOutlined />, onClick: () => setIsKeyHelpOpen(true) },
    ].filter((item): item is NonNullable<typeof item> => item !== null);
  }, [
    controller,
    handleToggleLoop,
    handleTogglePlayback,
    invoke,
    isSaving,
    showOsd,
    t,
    videoSource,
  ]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }
    const close = () => setContextMenu(null);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [contextMenu]);

  const keyHelpGroups = useMemo<KeyHelpGroup[]>(
    () => [
      {
        title: "播放",
        items: [
          { keys: "空格 / K", label: t("video-player.actions.play") },
          { keys: "← →", label: "后退 / 前进 5 秒" },
          { keys: "Shift + ← →", label: "后退 / 前进 30 秒" },
          { keys: "J / L", label: "后退 / 前进 10 秒" },
          { keys: "Home / End", label: "回到开头 / 跳到末尾" },
          { keys: "0-9", label: "跳转到 0%-90%" },
          { keys: "[ ]", label: "上一帧 / 下一帧" },
        ],
      },
      {
        title: "声音",
        items: [
          { keys: "↑ ↓", label: "音量增减" },
          { keys: "M", label: "静音" },
          { keys: "滚轮", label: "调节音量" },
        ],
      },
      {
        title: "画面",
        items: [
          { keys: "F", label: "全屏" },
          { keys: "P", label: "画中画" },
          { keys: "双击", label: "全屏" },
        ],
      },
      {
        title: "其他",
        items: [
          { keys: "?", label: "打开快捷键帮助" },
          { keys: "Esc", label: "关闭面板 / 退出全屏" },
        ],
      },
    ],
    [t],
  );

  const rateMenuOptions: TrackMenuOption[] = useMemo(
    () =>
      PLAYBACK_RATES.map((rate) => ({
        key: String(rate),
        label: formatPlaybackRate(rate),
        selected: controller.playbackRate === rate,
      })),
    [controller.playbackRate],
  );

  const subtitleMenuOptions: TrackMenuOption[] = useMemo(
    () => toTrackMenuOptions(controller.subtitleTracks, "video-player.more.subtitlesFallback", t("video-player.more.subtitlesOff")),
    [controller.subtitleTracks, t],
  );

  const audioMenuOptions: TrackMenuOption[] = useMemo(
    () => toTrackMenuOptions(controller.audioTracks, "video-player.more.audioFallback", "默认音轨"),
    [controller.audioTracks],
  );

  const handleDockMenuSelect = React.useCallback(
    (key: string): void => {
      if (dockMenu === "rate") {
        controller.setPlaybackRate(Number(key));
        showOsd({ title: formatPlaybackRate(Number(key)) });
      } else if (dockMenu === "subtitle") {
        controller.selectSubtitleTrack(key === "off" ? null : Number(key));
      } else if (dockMenu === "audio") {
        controller.selectAudioTrack(key === "off" ? null : Number(key));
      }
      setDockMenu(null);
    },
    [controller, dockMenu, showOsd],
  );

  function renderInfoBody(): React.ReactNode {
    return (
      <div className="video-player-side-panel__body">
        <div className="video-player-info-grid">
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.title")}</span>
            <strong>{videoSource?.title ?? t("video-player.more.empty.noVideoInfo")}</strong>
          </div>
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.sourceType")}</span>
            <strong>{sourceType}</strong>
          </div>
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.format")}</span>
            <strong>{formatDisplay}</strong>
          </div>
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.duration")}</span>
            <strong>
              {controller.duration > 0 ? formatDuration(controller.duration) : t("video-player.viewer.durationUnknown")}
            </strong>
          </div>
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.position")}</span>
            <strong>{formatDuration(controller.currentTime)}</strong>
          </div>
          <div className="video-player-info-grid__item">
            <span>{t("video-player.more.info.resolution")}</span>
            <strong>{formatResolution(controller.videoSize) || t("video-player.viewer.resolutionUnknown")}</strong>
          </div>
          <div className="video-player-info-grid__item video-player-info-grid__item--full">
            <span>{t("video-player.more.info.source")}</span>
            <strong title={sourceDisplay}>{sourceDisplay}</strong>
          </div>
        </div>

        <div className="video-player-side-panel__section">
          <div className="video-player-side-panel__section-title">{t("video-player.more.info.playbackSpeed")}</div>
          <div className="video-player-chip-group">
            {PLAYBACK_RATES.map((rate) => (
              <Button
                key={rate}
                type={controller.playbackRate === rate ? "primary" : "default"}
                className="video-player-chip-button"
                onClick={() => {
                  controller.setPlaybackRate(rate);
                  showOsd({ title: formatPlaybackRate(rate) });
                }}
              >
                {formatPlaybackRate(rate)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderSubtitlesBody(): React.ReactNode {
    if (controller.subtitleTracks.length === 0) {
      return <div className="video-player-side-panel__empty">{t("video-player.more.empty.noSubtitles")}</div>;
    }

    return (
      <div className="video-player-side-panel__list">
        <Button
          type={isSubtitleOff ? "primary" : "default"}
          className="video-player-side-option"
          onClick={() => {
            controller.selectSubtitleTrack(null);
          }}
        >
          <span>{t("video-player.more.subtitlesOff")}</span>
        </Button>

        {controller.subtitleTracks.map((track) => (
          <Button
            key={`subtitle-${track.index}`}
            type={track.selected ? "primary" : "default"}
            className="video-player-side-option"
            onClick={() => {
              controller.selectSubtitleTrack(track.index);
            }}
          >
            <span>
              {resolveTrackLabel(
                track,
                "video-player.more.subtitlesFallback",
                "video-player.more.subtitlesFallbackWithLanguage",
                t,
              )}
            </span>
            {track.language ? <small>{track.language}</small> : null}
          </Button>
        ))}
      </div>
    );
  }

  function renderAudioBody(): React.ReactNode {
    if (controller.audioTracks.length === 0) {
      return <div className="video-player-side-panel__empty">{t("video-player.more.empty.noAudioTracks")}</div>;
    }

    return (
      <div className="video-player-side-panel__list">
        {controller.audioTracks.map((track) => (
          <Button
            key={`audio-${track.index}`}
            type={track.selected ? "primary" : "default"}
            className="video-player-side-option"
            onClick={() => {
              controller.selectAudioTrack(track.index);
            }}
          >
            <span>
              {resolveTrackLabel(
                track,
                "video-player.more.audioFallback",
                "video-player.more.audioFallbackWithLanguage",
                t,
              )}
            </span>
            {track.language ? <small>{track.language}</small> : null}
          </Button>
        ))}
      </div>
    );
  }

  function renderDiagnosticsBody(): React.ReactNode {
    const bufferedPercent =
      controller.duration > 0
        ? Math.min(100, Math.round((controller.bufferedUntil / controller.duration) * 100))
        : 0;
    const items: Array<{ label: string; value: string }> = [
      { label: t("video-player.more.info.resolution"), value: formatResolution(controller.videoSize) || t("video-player.viewer.resolutionUnknown") },
      { label: t("video-player.more.info.duration"), value: controller.duration > 0 ? formatDuration(controller.duration) : t("video-player.viewer.durationUnknown") },
      { label: t("video-player.more.info.playbackSpeed"), value: formatPlaybackRate(controller.playbackRate) },
      { label: t("video-player.labels.volume"), value: `${Math.round(controller.volume * 100)}%` },
      { label: t("video-player.labels.buffered"), value: `${bufferedPercent}%` },
      { label: "循环播放", value: controller.loop ? "开" : "关" },
    ];

    return (
      <div className="video-player-side-panel__body">
        <div className="video-player-info-grid">
          {items.map((item) => (
            <div key={item.label} className="video-player-info-grid__item">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderMorePanelBody(): React.ReactNode {
    if (activeTab === "info") {
      return renderInfoBody();
    }

    if (activeTab === "subtitles") {
      return renderSubtitlesBody();
    }

    if (activeTab === "diagnostics") {
      return renderDiagnosticsBody();
    }

    return renderAudioBody();
  }

  const stageClassName = `video-player-stage${isDragActive ? " video-player-stage--drag-active" : ""}${
    controller.isFullscreen ? " video-player-stage--fullscreen" : ""
  }`;

  return (
    <div className="video-player-shell">
      <main
        ref={controller.surfaceRef}
        className={stageClassName}
        tabIndex={0}
        role="region"
        aria-label={t("video-player.labels.stage")}
        aria-describedby={feedback ? "video-player-feedback" : undefined}
        onPointerMove={() => {
          controller.revealChrome();
        }}
        onPointerDown={() => {
          controller.revealChrome();
        }}
        onPointerLeave={() => {
          controller.scheduleChromeHide(280);
        }}
        onFocus={() => {
          controller.revealChrome();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (dockMenu) {
              setDockMenu(null);
              return;
            }
            if (isKeyHelpOpen) {
              setIsKeyHelpOpen(false);
              return;
            }
            if (isMorePanelOpen) {
              event.preventDefault();
              onMorePanelOpenChange(false);
              return;
            }
          }

          if (event.key === "?") {
            event.preventDefault();
            setIsKeyHelpOpen(true);
            return;
          }

          controller.revealChrome();
          controller.handleKeyDown(event);
        }}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) < 8) {
            return;
          }
          handleVolumeWheel(event.deltaY);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragActive(false);
          const files = Array.from(event.dataTransfer.files ?? []);
          void onDropFile(files);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        <div className="video-player-viewport">
          {videoSource ? (
            <video
              key={`${videoSource.resourceUri}-${videoSource.revision}`}
              ref={controller.videoRef}
              className={`video-player-media${controller.isReady ? " video-player-media--ready" : ""}`}
              src={videoSource.resourceUri}
              title={videoSource.title}
              aria-label={videoSource.title}
              preload="metadata"
              playsInline
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                void controller.togglePlayback();
              }}
              onDoubleClick={() => {
                suppressClickRef.current = true;
                window.setTimeout(() => {
                  suppressClickRef.current = false;
                }, CLICK_SUPPRESS_WINDOW_MS);
                void controller.toggleFullscreen();
              }}
              onLoadedMetadata={controller.handleLoadedMetadata}
              onCanPlay={controller.handleCanPlay}
              onPlaying={controller.handlePlaying}
              onPause={controller.handlePause}
              onWaiting={controller.handleWaiting}
              onEnded={controller.handleEnded}
              onTimeUpdate={controller.handleTimeUpdate}
              onDurationChange={controller.handleDurationChange}
              onProgress={controller.handleProgress}
              onVolumeChange={controller.handleVolumeChange}
              onError={controller.handleError}
            />
          ) : (
            <EmptyState
              onOpen={() => invoke(VIDEO_PLAYER_COMMAND_IDS.openFile)}
              dragActive={isDragActive}
              hintText={t("video-player.viewer.supportedHint")}
              openLabel={t("video-player.actions.open")}
              dragPrompt={t("video-player.viewer.dragPromptLine")}
              titleText={t("video-player.viewer.emptyLine")}
            />
          )}

          {overlayMessage ? (
            <div className="video-player-overlay" role={controller.errorKey ? "alert" : "status"} aria-live="polite">
              <div className={`video-player-overlay__card${controller.errorKey ? " video-player-overlay__card--error" : ""}`}>
                <Spin size={isResolving ? "large" : "small"} style={{ display: "block", marginBottom: 8 }} />
                {overlayMessage}
              </div>
            </div>
          ) : null}
        </div>

        {controller.isEnded ? (
          <EndedOverlay
            title={videoSource?.title}
            onReplay={handleReplay}
            onClose={() => controller.commitSeek(0)}
            replayLabel={t("video-player.actions.replay")}
            hasNext={queueCount > 0}
            nextLabel={t("video-player.actions.playNext")}
            onNext={() => void onPlayNext()}
          />
        ) : null}

        {feedback ? (
          <div
            id="video-player-feedback"
            className={`video-player-feedback video-player-feedback--${feedback.tone}`}
            role={feedback.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            aria-label={t("video-player.labels.feedback")}
          >
            {feedback.message}
          </div>
        ) : null}

        {isMorePanelOpen ? (
          <aside
            ref={morePanelRef}
            className="video-player-side-panel"
            aria-label={t("video-player.actions.more")}
            onPointerMove={() => {
              controller.revealChrome();
            }}
            onPointerLeave={() => {
              controller.scheduleChromeHide(420);
            }}
          >
            <Tabs
              className="video-player-side-panel__tabs"
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key as MorePanelTab);
              }}
              items={[
                { key: "info", label: t("video-player.more.tabs.info") },
                { key: "subtitles", label: t("video-player.more.tabs.subtitles") },
                { key: "audio", label: t("video-player.more.tabs.audio") },
                { key: "diagnostics", label: t("video-player.more.tabs.diagnostics") },
              ]}
            />

            {renderMorePanelBody()}
          </aside>
        ) : null}

        {dockMenu ? (
          <TrackMenu
            title={
              dockMenu === "rate"
                ? t("video-player.actions.speed")
                : dockMenu === "subtitle"
                  ? t("video-player.more.tabs.subtitles")
                  : t("video-player.more.tabs.audio")
            }
            options={
              dockMenu === "rate"
                ? rateMenuOptions
                : dockMenu === "subtitle"
                  ? subtitleMenuOptions
                  : audioMenuOptions
            }
            onSelect={handleDockMenuSelect}
            onClose={() => setDockMenu(null)}
          />
        ) : null}

        <section
          className={`video-player-dock${
            controller.chromeVisible || isMorePanelOpen || Boolean(overlayMessage) || isDragActive
              ? ""
              : " video-player-dock--hidden"
          }`}
          aria-label={t("video-player.labels.toolbar")}
          onPointerMove={() => {
            controller.revealChrome();
          }}
          onPointerLeave={() => {
            controller.scheduleChromeHide(420);
          }}
        >
          {hasTimeline ? (
            <>
              <div className="video-player-titlebar">
                <span className="video-player-titlebar__title">{videoSource?.title ?? t("video-player.labels.unknown")}</span>
                <span className="video-player-titlebar__meta">
                  {formatDisplay} · {formatResolution(controller.videoSize) || ""} · {sourceType}
                </span>
              </div>
              <Timeline
                duration={controller.duration}
                currentTime={controller.currentTime}
                bufferedUntil={controller.bufferedUntil}
                ariaLabel={t("video-player.labels.timeline")}
                onPreview={(value) => {
                  controller.seekPreviewTo(value);
                }}
                onCommit={(value) => {
                  controller.commitSeek(value);
                  showOsd({ title: formatDuration(value), subtitle: formatDuration(controller.duration) });
                }}
              />
            </>
          ) : (
            <Slider
              className="video-player-timeline"
              min={0}
              max={1}
              step={0.1}
              value={0}
              disabled
              aria-label={t("video-player.labels.timeline")}
            />
          )}

          <div className="video-player-toolbar">
            <PlayerIconButton
              label={t("video-player.actions.open")}
              icon={<FolderOpenOutlined />}
              onClick={() => invoke(VIDEO_PLAYER_COMMAND_IDS.openFile)}
            />
            <PlayerIconButton
              label={controller.isPlaying ? t("video-player.actions.pause") : t("video-player.actions.play")}
              icon={controller.isPlaying ? <PauseCircleFilled /> : <PlayCircleFilled />}
              disabled={!videoSource}
              onClick={handleTogglePlayback}
            />
            <PlayerIconButton
              label={controller.loop ? "关闭循环" : "循环播放"}
              icon={<RedoOutlined />}
              active={controller.loop}
              disabled={!videoSource}
              onClick={handleToggleLoop}
            />
            <PlayerIconButton
              label={t("video-player.actions.seekBackward")}
              icon={<FastBackwardOutlined />}
              disabled={!videoSource}
              onClick={() => handleSeekWithOsd(-5)}
            />
            <PlayerIconButton
              label={t("video-player.actions.seekForward")}
              icon={<FastForwardOutlined />}
              disabled={!videoSource}
              onClick={() => handleSeekWithOsd(5)}
            />

            <div className="video-player-toolbar__spacer" />

            <div className="video-player-volume">
              <PlayerIconButton
                label={controller.isMuted ? t("video-player.actions.unmute") : t("video-player.actions.mute")}
                icon={controller.isMuted ? <AudioMutedOutlined /> : <SoundOutlined />}
                disabled={!videoSource}
                onClick={handleToggleMute}
              />

              <div className="video-player-volume__popover">
                <Slider
                  className="video-player-volume__slider"
                  vertical
                  min={0}
                  max={1}
                  step={0.01}
                  value={controller.isMuted ? 0 : controller.volume}
                  disabled={!videoSource}
                  aria-label={t("video-player.labels.volume")}
                  tooltip={{ formatter: (value) => `${Math.round(Number(value) * 100)}%` }}
                  onChange={(value) => {
                    controller.setVolumeLevel(Number(value));
                  }}
                  onAfterChange={(value) => {
                    showOsd({
                      icon: Number(value) === 0 ? <AudioMutedOutlined /> : <SoundOutlined />,
                      title: `${Math.round(Number(value) * 100)}%`,
                      progress: Number(value),
                    });
                  }}
                />
              </div>
            </div>

            <PlayerIconButton
              label={t("video-player.actions.speed")}
              icon={<span className="video-player-rate-badge">{formatPlaybackRate(controller.playbackRate)}</span>}
              disabled={!videoSource}
              active={dockMenu === "rate"}
              onClick={() => setDockMenu((current) => (current === "rate" ? null : "rate"))}
            />
            <PlayerIconButton
              label={t("video-player.more.tabs.subtitles")}
              icon={<span className="video-player-cc-badge">CC</span>}
              disabled={!videoSource || controller.subtitleTracks.length === 0}
              active={dockMenu === "subtitle" || !isSubtitleOff}
              onClick={() => setDockMenu((current) => (current === "subtitle" ? null : "subtitle"))}
            />
            <PlayerIconButton
              label={t("video-player.actions.save")}
              icon={<SaveOutlined />}
              disabled={!videoSource || isSaving}
              onClick={() => invoke(VIDEO_PLAYER_COMMAND_IDS.saveCopy)}
            />
            <PlayerIconButton
              label={
                controller.isPictureInPicture
                  ? t("video-player.actions.exitPictureInPicture")
                  : t("video-player.actions.pictureInPicture")
              }
              icon={<PictureOutlined />}
              disabled={!videoSource || !controller.canUsePictureInPicture}
              onClick={() => invoke(VIDEO_PLAYER_COMMAND_IDS.togglePictureInPicture)}
            />
            <PlayerIconButton
              label={controller.isFullscreen ? t("video-player.actions.exitFullscreen") : t("video-player.actions.fullscreen")}
              icon={controller.isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              disabled={!videoSource}
              onClick={() => invoke(VIDEO_PLAYER_COMMAND_IDS.toggleFullscreen)}
            />
            <PlayerIconButton
              label={isMorePanelOpen ? t("video-player.actions.closeMore") : t("video-player.actions.more")}
              icon={<MoreOutlined />}
              active={isMorePanelOpen}
              buttonRef={moreButtonRef}
              onClick={() => invoke(VIDEO_PLAYER_COMMAND_IDS.toggleMorePanel)}
            />
          </div>
        </section>
      </main>

      {osd ? <Osd osd={osd} /> : null}

      {contextMenu ? (
        <div
          className="video-player-context-menu"
          style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y, zIndex: 20 }}
        >
          <Menu items={contextMenuItems} onClick={() => setContextMenu(null)} />
        </div>
      ) : null}

      <KeyHelpDialog
        open={isKeyHelpOpen}
        onClose={() => setIsKeyHelpOpen(false)}
        groups={keyHelpGroups}
      />
    </div>
  );
}
