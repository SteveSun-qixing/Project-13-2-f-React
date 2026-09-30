import { describe, expect, it, vi } from 'vitest';
import {
  createMusicPlayerEngine,
  resolveMediaErrorKey,
  type AudioElementLike,
} from '../src/player/audioEngine';

/**
 * 播放状态机判例（随迁自旧仓 tests/unit/audio-engine.test.ts，逐条保真）。
 * 媒体元素以 AudioElementLike 桩注入（迁移件接口面），不 mock 引擎内部行为。
 */

interface FakeAudio extends AudioElementLike {
  playCalls: number;
  pauseCalls: number;
  failNextPlay: (error: { code: number }) => void;
}

function createFakeAudio(initial: Partial<AudioElementLike> = {}): FakeAudio {
  let paused = initial.paused ?? true;
  let currentTime = initial.currentTime ?? 0;
  let volume = initial.volume ?? 1;
  let muted = initial.muted ?? false;
  let loop = initial.loop ?? false;
  let error: { code: number } | null = initial.error ?? null;
  let playFailure: { code: number } | null = null;

  const audio: FakeAudio = {
    get paused() {
      return paused;
    },
    get currentTime() {
      return currentTime;
    },
    set currentTime(value: number) {
      currentTime = value;
    },
    get duration() {
      return initial.duration ?? 0;
    },
    get volume() {
      return volume;
    },
    set volume(value: number) {
      volume = value;
    },
    get muted() {
      return muted;
    },
    set muted(value: boolean) {
      muted = value;
    },
    get loop() {
      return loop;
    },
    set loop(value: boolean) {
      loop = value;
    },
    get buffered() {
      return initial.buffered ?? null;
    },
    get error() {
      return error;
    },
    playCalls: 0,
    pauseCalls: 0,
    play(): Promise<void> {
      audio.playCalls += 1;
      if (playFailure) {
        error = playFailure;
        return Promise.reject(new Error('play rejected'));
      }
      paused = false;
      return Promise.resolve();
    },
    pause() {
      audio.pauseCalls += 1;
      paused = true;
    },
    failNextPlay(nextError: { code: number }) {
      playFailure = nextError;
    },
  };

  return audio;
}

describe('music player audio engine', () => {
  it('starts with a clean snapshot and documented defaults', () => {
    const engine = createMusicPlayerEngine();

    const snapshot = engine.getSnapshot();

    expect(snapshot.isReady).toBe(false);
    expect(snapshot.isPlaying).toBe(false);
    expect(snapshot.isBuffering).toBe(false);
    expect(snapshot.isMuted).toBe(false);
    expect(snapshot.duration).toBe(0);
    expect(snapshot.currentTime).toBe(0);
    expect(snapshot.bufferedUntil).toBe(0);
    expect(snapshot.loopMode).toBe('one');
    expect(snapshot.errorKey).toBeNull();
    expect(snapshot.volume).toBe(0.82);
  });

  it('honors custom defaults and exposes immutable snapshots', () => {
    const engine = createMusicPlayerEngine({ defaultVolume: 0.5, defaultLoopMode: 'off' });

    const first = engine.getSnapshot();
    engine.toggleLoopMode();
    const second = engine.getSnapshot();

    expect(first.loopMode).toBe('off');
    expect(first.volume).toBe(0.5);
    expect(second.loopMode).toBe('one');
    expect(second).not.toBe(first);
  });

  it('togglePlayback plays exactly once when paused', async () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    await engine.togglePlayback();
    engine.handlePlaying();

    expect(audio.playCalls).toBe(1);
    expect(engine.getSnapshot().isPlaying).toBe(true);
  });

  it('togglePlayback pauses exactly once when already playing', async () => {
    const audio = createFakeAudio({ paused: false });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);
    engine.handlePlaying();

    await engine.togglePlayback();
    engine.handlePause();

    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('a double fired toggle ends with playback stopped', async () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    await engine.togglePlayback();
    engine.handlePlaying();
    await engine.togglePlayback();
    engine.handlePause();

    expect(audio.playCalls).toBe(1);
    expect(audio.pauseCalls).toBe(1);
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('togglePlayback without an attached element is a safe no-op', async () => {
    const engine = createMusicPlayerEngine();

    await expect(engine.togglePlayback()).resolves.toBeUndefined();
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('a rejected play surfaces a media error key', async () => {
    const audio = createFakeAudio();
    audio.failNextPlay({ code: 2 });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    await engine.togglePlayback();

    expect(engine.getSnapshot().errorKey).toBe('mediaNetwork');
    expect(engine.getSnapshot().isPlaying).toBe(false);
  });

  it('seekTo clamps to the loaded duration', () => {
    const audio = createFakeAudio({ duration: 120 });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.seekTo(90);
    expect(audio.currentTime).toBe(90);
    expect(engine.getSnapshot().currentTime).toBe(90);

    engine.seekTo(120);
    expect(audio.currentTime).toBe(120);

    engine.seekTo(500);
    expect(audio.currentTime).toBe(120);

    engine.seekTo(-5);
    expect(audio.currentTime).toBe(0);
  });

  it('seekBy offsets and clamps within the loaded duration', () => {
    const audio = createFakeAudio({ duration: 120 });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.seekTo(100);
    engine.seekBy(10);
    expect(audio.currentTime).toBe(110);

    engine.seekBy(300);
    expect(audio.currentTime).toBe(120);

    engine.seekBy(-10);
    expect(audio.currentTime).toBe(110);

    engine.seekBy(-1000);
    expect(audio.currentTime).toBe(0);
  });

  it('seek without an attached element is a safe no-op', () => {
    const engine = createMusicPlayerEngine();

    expect(() => {
      engine.seekTo(50);
      engine.seekBy(10);
    }).not.toThrow();
    expect(engine.getSnapshot().currentTime).toBe(0);
  });

  it('setVolumeLevel clamps and mirrors the element', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.setVolumeLevel(2);
    expect(audio.volume).toBe(1);
    expect(engine.getSnapshot().volume).toBe(1);

    engine.setVolumeLevel(-1);
    expect(audio.volume).toBe(0);
    expect(engine.getSnapshot().volume).toBe(0);

    engine.setVolumeLevel(0.5);
    expect(audio.volume).toBe(0.5);
    expect(engine.getSnapshot().volume).toBe(0.5);
  });

  it('zero volume counts as muted and raising it unmutes', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.setVolumeLevel(0);
    expect(audio.muted).toBe(true);
    expect(engine.getSnapshot().isMuted).toBe(true);

    engine.setVolumeLevel(0.5);
    expect(audio.muted).toBe(false);
    expect(engine.getSnapshot().isMuted).toBe(false);
  });

  it('setVolumeLevel without an attached element is a safe no-op', () => {
    const engine = createMusicPlayerEngine();

    engine.setVolumeLevel(0.5);

    expect(engine.getSnapshot().volume).toBe(0.82);
  });

  it('toggleMute preserves and restores the volume level', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);
    engine.setVolumeLevel(0.8);

    engine.toggleMute();
    expect(engine.getSnapshot().isMuted).toBe(true);
    expect(audio.muted).toBe(true);
    expect(engine.getSnapshot().volume).toBe(0.8);

    engine.toggleMute();
    expect(engine.getSnapshot().isMuted).toBe(false);
    expect(engine.getSnapshot().volume).toBe(0.8);
  });

  it('toggleMute restores the previous volume after muting via zero volume', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);
    engine.setVolumeLevel(0.8);
    engine.setVolumeLevel(0);
    expect(engine.getSnapshot().isMuted).toBe(true);

    engine.toggleMute();
    expect(engine.getSnapshot().isMuted).toBe(false);
    expect(engine.getSnapshot().volume).toBe(0.8);
  });

  it('toggleLoopMode flips and applies to the element', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine({ defaultLoopMode: 'off' });
    engine.attach(audio);

    engine.toggleLoopMode();
    expect(engine.getSnapshot().loopMode).toBe('one');
    expect(audio.loop).toBe(true);

    engine.toggleLoopMode();
    expect(engine.getSnapshot().loopMode).toBe('off');
    expect(audio.loop).toBe(false);
  });

  it('attach applies the current engine state to the element', () => {
    const firstAudio = createFakeAudio();
    const nextAudio = createFakeAudio();
    const engine = createMusicPlayerEngine({ defaultVolume: 0.4, defaultLoopMode: 'off' });
    engine.attach(firstAudio);
    engine.setVolumeLevel(0.6);
    engine.toggleMute();
    engine.toggleLoopMode();

    engine.attach(nextAudio);

    expect(nextAudio.volume).toBe(0.6);
    expect(nextAudio.muted).toBe(true);
    expect(nextAudio.loop).toBe(true);
  });

  it('handleLoadedMetadata applies settings and syncs progress', () => {
    const audio = createFakeAudio({
      duration: 200,
      currentTime: 30,
      buffered: { length: 1, end: () => 45 },
      volume: 0.7,
      muted: true,
    });
    const engine = createMusicPlayerEngine({ defaultLoopMode: 'off' });
    engine.attach(audio);
    engine.setVolumeLevel(0.9);

    engine.handleLoadedMetadata();

    expect(engine.getSnapshot().duration).toBe(200);
    expect(engine.getSnapshot().currentTime).toBe(30);
    expect(engine.getSnapshot().bufferedUntil).toBe(45);
    expect(audio.volume).toBe(0.9);
    expect(audio.loop).toBe(false);
  });

  it('normalizes play state events into the snapshot', () => {
    const audio = createFakeAudio();
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.handleWaiting();
    expect(engine.getSnapshot().isBuffering).toBe(true);

    engine.handleCanPlay();
    expect(engine.getSnapshot().isReady).toBe(true);
    expect(engine.getSnapshot().isBuffering).toBe(false);

    engine.handlePlaying();
    expect(engine.getSnapshot().isPlaying).toBe(true);
    expect(engine.getSnapshot().isReady).toBe(true);

    engine.handlePause();
    expect(engine.getSnapshot().isPlaying).toBe(false);
    expect(engine.getSnapshot().isBuffering).toBe(false);
  });

  it('time updates and progress events sync the snapshot', () => {
    const audio = createFakeAudio({
      duration: 120,
      currentTime: 42,
      buffered: { length: 1, end: () => 60 },
    });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);

    engine.handleTimeUpdate();
    expect(engine.getSnapshot().currentTime).toBe(42);
    expect(engine.getSnapshot().duration).toBe(120);

    engine.handleProgress();
    expect(engine.getSnapshot().bufferedUntil).toBe(60);
  });

  it('ended keeps playing in single loop mode and stops outside it', () => {
    const loopingAudio = createFakeAudio({ paused: false });
    const loopingEngine = createMusicPlayerEngine({ defaultLoopMode: 'one' });
    loopingEngine.attach(loopingAudio);
    loopingEngine.handlePlaying();

    loopingEngine.handleEnded();
    expect(loopingEngine.getSnapshot().isPlaying).toBe(true);

    const onEnded = vi.fn();
    const stoppingAudio = createFakeAudio({ paused: false });
    const stoppingEngine = createMusicPlayerEngine({ defaultLoopMode: 'off', onEnded });
    stoppingEngine.attach(stoppingAudio);
    stoppingEngine.handlePlaying();

    stoppingEngine.handleEnded();
    expect(stoppingEngine.getSnapshot().isPlaying).toBe(false);
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('handleError clears readiness and sets a media error key', () => {
    const audio = createFakeAudio({ error: { code: 4 } });
    const engine = createMusicPlayerEngine();
    engine.attach(audio);
    engine.handlePlaying();

    engine.handleError();

    expect(engine.getSnapshot().isReady).toBe(false);
    expect(engine.getSnapshot().isPlaying).toBe(false);
    expect(engine.getSnapshot().isBuffering).toBe(false);
    expect(engine.getSnapshot().errorKey).toBe('mediaSource');
  });

  it('handleError without an element reports a missing source', () => {
    const engine = createMusicPlayerEngine();

    engine.handleError();

    expect(engine.getSnapshot().errorKey).toBe('mediaSource');
  });

  it('resetSession pauses the element and resets progress but keeps user settings', () => {
    const audio = createFakeAudio({ paused: false });
    const engine = createMusicPlayerEngine({ defaultVolume: 0.7 });
    engine.attach(audio);
    engine.setVolumeLevel(0.5);
    engine.handleLoadedMetadata();

    engine.resetSession();

    expect(audio.pauseCalls).toBe(1);
    expect(audio.currentTime).toBe(0);
    expect(engine.getSnapshot().isPlaying).toBe(false);
    expect(engine.getSnapshot().duration).toBe(0);
    expect(engine.getSnapshot().currentTime).toBe(0);
    expect(engine.getSnapshot().bufferedUntil).toBe(0);
    expect(engine.getSnapshot().errorKey).toBeNull();
    expect(engine.getSnapshot().volume).toBe(0.5);
  });

  it('resolveMediaErrorKey maps media element error codes', () => {
    expect(resolveMediaErrorKey(null)).toBe('mediaSource');
    expect(resolveMediaErrorKey({ code: 1 })).toBe('mediaAborted');
    expect(resolveMediaErrorKey({ code: 2 })).toBe('mediaNetwork');
    expect(resolveMediaErrorKey({ code: 3 })).toBe('mediaDecode');
    expect(resolveMediaErrorKey({ code: 4 })).toBe('mediaSource');
    expect(resolveMediaErrorKey({ code: 9 })).toBe('loadFailed');
  });
});
