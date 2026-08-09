import React from "react";
import {
  DownloadOutlined,
  MutedOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  RedoOutlined,
  RetweetOutlined,
  SoundFilled,
  StepBackwardFilled,
  StepForwardFilled,
  UndoOutlined,
} from "@ant-design/icons";
import type { MusicPlayerController } from "../../hooks/useMusicPlayerController";
import type { TrackPresentation } from "../../utils/music-player";
import { TooltipAnchor } from "../shared/TooltipAnchor";

const ICONS = {
  play: <PlayCircleFilled />,
  pause: <PauseCircleFilled />,
  rewind: <UndoOutlined />,
  forward: <RedoOutlined />,
  previous: <StepBackwardFilled />,
  next: <StepForwardFilled />,
  save: <DownloadOutlined />,
  mute: <MutedOutlined />,
  volume: <SoundFilled />,
  loop: <RetweetOutlined />,
  loopOff: <RetweetOutlined />,
} as const;

function SecondaryControlButton(props: {
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
  pressed?: boolean;
  onClick: () => void | Promise<void>;
}) {
  const { label, icon, disabled, active, pressed, onClick } = props;

  return (
    <span className="music-player-tooltip-anchor" data-tooltip={label}>
      <button
        type="button"
        className={`auxcontrol${active ? " auxcontrol--active" : ""}`}
        aria-label={label}
        aria-pressed={typeof pressed === "boolean" ? pressed : undefined}
        disabled={disabled}
        onClick={() => void onClick()}
      >
        {icon}
      </button>
    </span>
  );
}

export interface TransportControlsProps {
  controller: MusicPlayerController;
  track: TrackPresentation | null;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isSaving: boolean;
  onPreviousTrack: () => void | Promise<void>;
  onNextTrack: () => void | Promise<void>;
  onSaveAudio: () => void | Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function TransportControls(props: TransportControlsProps): React.ReactElement {
  const {
    controller,
    track,
    canGoPrevious,
    canGoNext,
    isSaving,
    onPreviousTrack,
    onNextTrack,
    onSaveAudio,
    t,
  } = props;

  return (
    <>
      <div className="conbox">
        <div className="controls">
          <TooltipAnchor label={t("music-player.actions.play")}>
            <button
              type="button"
              className={`play${controller.isPlaying ? " is-hidden" : ""}`}
              aria-label={t("music-player.actions.play")}
              disabled={!track}
              onClick={() => void controller.togglePlayback()}
            >
              {ICONS.play}
            </button>
          </TooltipAnchor>
          <TooltipAnchor label={t("music-player.actions.pause")}>
            <button
              type="button"
              className={`pause${controller.isPlaying ? "" : " is-hidden"}`}
              aria-label={t("music-player.actions.pause")}
              disabled={!track}
              onClick={() => void controller.togglePlayback()}
            >
              {ICONS.pause}
            </button>
          </TooltipAnchor>
        </div>
      </div>

      <div className="tooldock" aria-label={t("music-player.section.controls")}>
        <div className="auxcontrols">
          <SecondaryControlButton
            label={t("music-player.actions.previousTrack")}
            icon={ICONS.previous}
            disabled={!canGoPrevious}
            onClick={onPreviousTrack}
          />
          <SecondaryControlButton
            label={t("music-player.actions.rewind10")}
            icon={ICONS.rewind}
            disabled={!track}
            onClick={() => controller.seekBy(-10)}
          />
          <SecondaryControlButton
            label={t("music-player.actions.forward10")}
            icon={ICONS.forward}
            disabled={!track}
            onClick={() => controller.seekBy(10)}
          />
          <SecondaryControlButton
            label={t("music-player.actions.nextTrack")}
            icon={ICONS.next}
            disabled={!canGoNext}
            onClick={onNextTrack}
          />
          <SecondaryControlButton
            label={controller.loopMode === "one" ? t("music-player.actions.loopOne") : t("music-player.actions.loopOff")}
            icon={controller.loopMode === "one" ? ICONS.loop : ICONS.loopOff}
            disabled={!track}
            active={controller.loopMode === "one"}
            pressed={controller.loopMode === "one"}
            onClick={controller.toggleLoopMode}
          />
          <SecondaryControlButton
            label={controller.isMuted ? t("music-player.actions.unmute") : t("music-player.actions.mute")}
            icon={controller.isMuted ? ICONS.mute : ICONS.volume}
            disabled={!track}
            active={controller.isMuted}
            pressed={controller.isMuted}
            onClick={controller.toggleMute}
          />
          <SecondaryControlButton
            label={t("music-player.actions.save")}
            icon={ICONS.save}
            disabled={!track || isSaving}
            onClick={onSaveAudio}
          />
        </div>

        <div className="volumecontrol">
          <span className="volumecontrol__label">{t("music-player.labels.volume")}</span>
          <input
            className="volumeinput"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={controller.isMuted ? 0 : controller.volume}
            aria-label={t("music-player.labels.volume")}
            disabled={!track}
            onChange={(event) => {
              controller.setVolumeLevel(Number(event.currentTarget.value));
            }}
          />
        </div>
      </div>
    </>
  );
}
