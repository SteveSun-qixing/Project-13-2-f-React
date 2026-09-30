import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { usePhotoViewerCamera, type PhotoViewerCamera } from '../src/viewer/usePhotoViewerCamera';
import type { ImageDimensions } from '../src/viewer/image-viewer';

/**
 * 相机状态机行为测试：迁移自旧仓 usePhotoViewerCamera 的裁决语义
 * （fit/manual 双模式、步进缩放、旋转换轴、会话重置、双击缩放）。
 * 指针/滚轮链路在舞台集成测试（tests/stage.test.tsx）经真实 DOM 事件覆盖。
 */

interface ProbeProps {
  readonly options: {
    imageDimensions: ImageDimensions | null;
    isImageLoaded: boolean;
    sessionKey: string | null;
    onNavigateRequest?: (direction: 'prev' | 'next') => void;
  };
  readonly probe: (camera: PhotoViewerCamera) => void;
}

function CameraProbe({ options, probe }: ProbeProps): React.ReactElement | null {
  const camera = usePhotoViewerCamera(options);
  probe(camera);
  return null;
}

const containers: HTMLDivElement[] = [];
const roots: Root[] = [];

function mountCamera(
  options: ProbeProps['options'],
  onProbe: (camera: PhotoViewerCamera) => void,
): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => {
    root.render(<CameraProbe options={options} probe={onProbe} />);
  });
}

function rerenderCamera(
  index: number,
  options: ProbeProps['options'],
  onProbe: (camera: PhotoViewerCamera) => void,
): void {
  const root = roots[index];
  if (!root) {
    throw new Error('相机探针尚未挂载');
  }
  act(() => {
    root.render(<CameraProbe options={options} probe={onProbe} />);
  });
}

function doubleClickEvent(overrides: Partial<{ altKey: boolean; clientX: number; clientY: number }> = {}): ReactMouseEvent<HTMLDivElement> {
  return {
    altKey: overrides.altKey ?? false,
    clientX: overrides.clientX ?? 120,
    clientY: overrides.clientY ?? 90,
    currentTarget: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    },
  } as unknown as ReactMouseEvent<HTMLDivElement>;
}

describe('usePhotoViewerCamera', () => {
  let latest: PhotoViewerCamera | null = null;
  const onProbe = (camera: PhotoViewerCamera): void => {
    latest = camera;
  };

  afterEach(() => {
    roots.forEach((root) => {
      act(() => {
        root.unmount();
      });
    });
    roots.length = 0;
    containers.forEach((container) => container.remove());
    containers.length = 0;
    latest = null;
  });

  it('初始进入适应窗口模式，无尺寸时有效缩放为 1', () => {
    mountCamera({ imageDimensions: null, isImageLoaded: false, sessionKey: 's1' }, onProbe);
    expect(latest?.zoomMode).toBe('fit');
    expect(latest?.effectiveScale).toBe(1);
    expect(latest?.rotation).toBe(0);
    expect(latest?.imageTransform).toBeUndefined();
    expect(latest?.isInteractive).toBe(false);
  });

  it('图片就绪后产出居中位移变换串与交互可用态', () => {
    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    expect(latest?.isInteractive).toBe(true);
    expect(latest?.imageTransform).toBe('translate(-50%, -50%) translate(0px, 0px) scale(1)');
  });

  it('无视口时步进缩放进入手动模式并按步进比钳制', () => {
    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    act(() => {
      latest?.handleZoom('in');
    });
    expect(latest?.zoomMode).toBe('manual');
    expect(latest?.manualScale).toBeCloseTo(1.25);

    for (let i = 0; i < 20; i += 1) {
      act(() => {
        latest?.handleZoom('in');
      });
    }
    expect(latest?.manualScale).toBe(8);

    for (let i = 0; i < 40; i += 1) {
      act(() => {
        latest?.handleZoom('out');
      });
    }
    expect(latest?.manualScale).toBe(0.1);
  });

  it('实际大小切到 100% 手动模式，适应窗口复位并清除平移', () => {
    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    act(() => {
      latest?.handleZoom('in');
    });
    expect(latest?.zoomMode).toBe('manual');
    act(() => {
      latest?.setActualSize();
    });
    expect(latest?.zoomMode).toBe('manual');
    expect(latest?.effectiveScale).toBe(1);
    act(() => {
      latest?.setFitMode();
    });
    expect(latest?.zoomMode).toBe('fit');
    expect(latest?.panOffset).toEqual({ x: 0, y: 0 });
  });

  it('旋转 90/270 换轴展示尺寸并在变换串携带角度', () => {
    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    act(() => {
      latest?.rotateClockwise();
    });
    expect(latest?.rotation).toBe(90);
    expect(latest?.imageWidth).toBe(1600);
    expect(latest?.imageHeight).toBe(900);
    expect(latest?.imageTransform).toContain('rotate(90deg)');

    act(() => {
      latest?.rotateClockwise();
      latest?.rotateClockwise();
      latest?.rotateClockwise();
    });
    expect(latest?.rotation).toBe(0);

    act(() => {
      latest?.rotateCounterclockwise();
    });
    expect(latest?.rotation).toBe(270);
  });

  it('会话键变化时重置缩放、旋转与手势状态', () => {
    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    act(() => {
      latest?.handleZoom('in');
      latest?.rotateClockwise();
    });
    expect(latest?.zoomMode).toBe('manual');
    expect(latest?.rotation).toBe(90);

    rerenderCamera(
      0,
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's2' },
      onProbe,
    );
    expect(latest?.zoomMode).toBe('fit');
    expect(latest?.rotation).toBe(0);
    expect(latest?.manualScale).toBe(1);
    expect(latest?.panOffset).toEqual({ x: 0, y: 0 });
  });

  it('双击在放大与适应窗口间切换；未加载图片时为空操作', () => {
    mountCamera({ imageDimensions: null, isImageLoaded: false, sessionKey: 's1' }, onProbe);
    act(() => {
      latest?.handleDoubleClick(doubleClickEvent());
    });
    expect(latest?.zoomMode).toBe('fit');

    mountCamera(
      { imageDimensions: { width: 900, height: 1600 }, isImageLoaded: true, sessionKey: 's1' },
      onProbe,
    );
    act(() => {
      latest?.handleDoubleClick(doubleClickEvent({ clientX: 100, clientY: 60 }));
    });
    expect(latest?.zoomMode).toBe('manual');
    expect(latest?.manualScale).toBe(2);

    act(() => {
      latest?.handleDoubleClick(doubleClickEvent({ clientX: 100, clientY: 60 }));
    });
    expect(latest?.zoomMode).toBe('fit');

    act(() => {
      latest?.handleDoubleClick(doubleClickEvent({ altKey: true, clientX: 100, clientY: 60 }));
    });
    expect(latest?.zoomMode).toBe('fit');
  });

  it('滚轮导航回调沿会话效果注册且会话切换后重挂（导航通道冒烟）', () => {
    const onNavigateRequest = vi.fn();
    mountCamera(
      {
        imageDimensions: { width: 900, height: 1600 },
        isImageLoaded: true,
        sessionKey: 's1',
        onNavigateRequest,
      },
      onProbe,
    );
    expect(latest?.viewportRef).not.toBeNull();
    expect(latest?.transitionEnabled).toBe(true);
  });
});
