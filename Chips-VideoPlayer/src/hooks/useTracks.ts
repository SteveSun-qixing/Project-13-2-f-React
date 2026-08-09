import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import type { VideoTrackOption } from "../utils/video-player";

export interface TextTrackLike {
  kind?: string;
  label?: string;
  language?: string;
  mode?: string;
}

export interface TextTrackListLike {
  length: number;
  [index: number]: TextTrackLike | undefined;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export interface AudioTrackLike {
  id?: string;
  kind?: string;
  label?: string;
  language?: string;
  enabled?: boolean;
}

export interface AudioTrackListLike {
  length: number;
  [index: number]: AudioTrackLike | undefined;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

export type VideoElementWithTracks = HTMLVideoElement & {
  audioTracks?: AudioTrackListLike;
};

export function isSubtitleTextTrack(track: TextTrackLike): boolean {
  return track.kind === "subtitles" || track.kind === "captions";
}

export function readSubtitleTracks(video: { textTracks: TextTrackListLike }): VideoTrackOption[] {
  const { textTracks } = video;
  const subtitleTracks: VideoTrackOption[] = [];

  for (let index = 0; index < textTracks.length; index += 1) {
    const track = textTracks[index];
    if (!track || !isSubtitleTextTrack(track)) {
      continue;
    }

    subtitleTracks.push({
      index,
      label: track.label?.trim() ?? "",
      language: track.language?.trim() ?? "",
      kind: track.kind?.trim() ?? "",
      selected: track.mode === "showing",
    });
  }

  return subtitleTracks;
}

export function readAudioTracks(video: { audioTracks?: AudioTrackListLike }): VideoTrackOption[] {
  const audioTracks = video.audioTracks;
  if (!audioTracks) {
    return [];
  }

  const resolvedTracks: VideoTrackOption[] = [];
  for (let index = 0; index < audioTracks.length; index += 1) {
    const track = audioTracks[index];
    if (!track) {
      continue;
    }

    resolvedTracks.push({
      index,
      label: track.label?.trim() ?? "",
      language: track.language?.trim() ?? "",
      kind: track.kind?.trim() ?? "",
      selected: track.enabled === true,
    });
  }

  return resolvedTracks;
}

export interface UseTracksOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  sessionKey: string | null;
  onTracksChanged?: () => void;
}

export interface TracksController {
  subtitleTracks: VideoTrackOption[];
  audioTracks: VideoTrackOption[];
  selectSubtitleTrack: (nextIndex: number | null) => void;
  selectAudioTrack: (nextIndex: number | null) => void;
  refresh: () => void;
}

export function useTracks(options: UseTracksOptions): TracksController {
  const { videoRef, sessionKey } = options;
  const [subtitleTracks, setSubtitleTracks] = useState<VideoTrackOption[]>([]);
  const [audioTracks, setAudioTracks] = useState<VideoTrackOption[]>([]);

  const syncTrackState = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      setSubtitleTracks([]);
      setAudioTracks([]);
      return;
    }

    setSubtitleTracks(readSubtitleTracks(video));
    setAudioTracks(readAudioTracks(video as VideoElementWithTracks));
  }, [videoRef]);

  const selectSubtitleTrack = useCallback(
    (nextIndex: number | null): void => {
      const video = videoRef.current;
      if (!video) {
        return;
      }

      for (let index = 0; index < video.textTracks.length; index += 1) {
        const track = video.textTracks[index];
        if (!track || !isSubtitleTextTrack(track)) {
          continue;
        }

        track.mode = nextIndex === index ? "showing" : "disabled";
      }

      syncTrackState();
    },
    [syncTrackState, videoRef],
  );

  const selectAudioTrack = useCallback(
    (nextIndex: number | null): void => {
      const video = videoRef.current as VideoElementWithTracks | null;
      const trackList = video?.audioTracks;
      if (!video || !trackList) {
        return;
      }

      for (let index = 0; index < trackList.length; index += 1) {
        const track = trackList[index];
        if (!track) {
          continue;
        }

        track.enabled = nextIndex === null ? index === 0 : index === nextIndex;
      }

      syncTrackState();
    },
    [syncTrackState, videoRef],
  );

  useEffect(() => {
    const video = videoRef.current as VideoElementWithTracks | null;
    if (!video) {
      return undefined;
    }

    const syncTracks = (): void => {
      syncTrackState();
    };

    video.textTracks.addEventListener("addtrack", syncTracks as EventListener);
    video.textTracks.addEventListener("removetrack", syncTracks as EventListener);
    video.textTracks.addEventListener("change", syncTracks as EventListener);

    const audioTrackList = video.audioTracks;
    audioTrackList?.addEventListener?.("addtrack", syncTracks as EventListener);
    audioTrackList?.addEventListener?.("removetrack", syncTracks as EventListener);
    audioTrackList?.addEventListener?.("change", syncTracks as EventListener);

    syncTrackState();

    return () => {
      video.textTracks.removeEventListener("addtrack", syncTracks as EventListener);
      video.textTracks.removeEventListener("removetrack", syncTracks as EventListener);
      video.textTracks.removeEventListener("change", syncTracks as EventListener);
      audioTrackList?.removeEventListener?.("addtrack", syncTracks as EventListener);
      audioTrackList?.removeEventListener?.("removetrack", syncTracks as EventListener);
      audioTrackList?.removeEventListener?.("change", syncTracks as EventListener);
    };
  }, [sessionKey, syncTrackState, videoRef]);

  return {
    subtitleTracks,
    audioTracks,
    selectSubtitleTrack,
    selectAudioTrack,
    refresh: syncTrackState,
  };
}
