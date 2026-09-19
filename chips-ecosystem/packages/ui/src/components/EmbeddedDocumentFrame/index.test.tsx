import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithApp } from '../../../tests/helpers/harness';
import { EmbeddedDocumentFrame } from './index';

function getFrame(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector('iframe');
  if (frame === null) {
    throw new Error('未找到 iframe');
  }
  return frame;
}

function getSurface(container: HTMLElement): HTMLElement {
  const surface = container.firstElementChild;
  if (!(surface instanceof HTMLElement)) {
    throw new Error('未找到容器');
  }
  return surface;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('EmbeddedDocumentFrame 沙箱与属性', () => {
  it('固定 allow-scripts 沙箱、no-referrer 与默认标题', () => {
    const { container } = renderWithApp(<EmbeddedDocumentFrame src="chips-resource://a.html" />);
    const frame = getFrame(container);
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame.getAttribute('title')).toBe('嵌入式文档');
    expect(frame.getAttribute('data-chips-embedded-frame')).toBe('embedded-document-frame');
  });

  it('自定义沙箱取值一律收口到渲染帧基线', () => {
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame
        src="chips-resource://a.html"
        sandbox="allow-scripts allow-same-origin"
      />
    );
    expect(getFrame(container).getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('写入区域标识、表面 ID、标题与自定义沙箱基线', () => {
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame
        title="封面预览"
        src="chips-resource://a.html"
        scope="cover"
        surfaceId="surface-1"
        sandbox="allow-scripts"
      />
    );
    const frame = getFrame(container);
    expect(frame.getAttribute('title')).toBe('封面预览');
    expect(frame.getAttribute('data-chips-embedded-frame')).toBe('cover');
    expect(frame.getAttribute('data-chips-surface-id')).toBe('surface-1');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts');
  });
});

describe('EmbeddedDocumentFrame 比例与自适应', () => {
  it('合法比例写入 aspect-ratio，非法比例忽略', () => {
    const { container, unmount } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" ratio="16:9" />
    );
    expect(getSurface(container).getAttribute('style')).toContain('aspect-ratio: 16 / 9');
    unmount();

    const second = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" ratio="宽屏" />
    );
    expect(getSurface(second.container).getAttribute('style')).not.toContain('aspect-ratio');
  });

  it('autoHeight 向 srcDoc 注入高度上报脚本，src 模式不注入', () => {
    const injected = renderWithApp(<EmbeddedDocumentFrame srcDoc="<p>文档</p>" autoHeight />);
    const srcdoc = getFrame(injected.container).getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('chips.embedded-frame:height');
    injected.unmount();

    const external = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight />
    );
    expect(getFrame(external.container).getAttribute('srcdoc')).toBeNull();
  });

  it('高度上报生效，并由 maxHeightFactor 设上限', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    try {
      const { container } = renderWithApp(
        <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight maxHeightFactor={0.5} />
      );
      const frame = getFrame(container);
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { type: 'chips.embedded-frame:height', height: 300 },
            source: frame.contentWindow,
          })
        );
      });
      expect(getSurface(container).getAttribute('style')).toContain('height: 200px');
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    }
  });

  it('未上报时按上限兜底，无上限时不设高度', () => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: 400,
    });
    try {
      const capped = renderWithApp(
        <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight maxHeightFactor={0.5} />
      );
      expect(getSurface(capped.container).getAttribute('style')).toContain('height: 200px');
      capped.unmount();

      const uncapped = renderWithApp(
        <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight />
      );
      expect(getSurface(uncapped.container).getAttribute('style')).not.toContain('height:');
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    }
  });

  it('非法上报（来源不符 / 类型不符 / 高度非法）一律忽略', () => {
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight />
    );
    const frame = getFrame(container);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'chips.embedded-frame:height', height: 100 } })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'other', height: 100 },
          source: frame.contentWindow,
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'chips.embedded-frame:height', height: -1 },
          source: frame.contentWindow,
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'chips.embedded-frame:height', height: Number.NaN },
          source: frame.contentWindow,
        })
      );
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'chips.embedded-frame:height', height: '300' },
          source: frame.contentWindow,
        })
      );
    });
    expect(getSurface(container).getAttribute('style')).not.toContain('height:');
  });

  it('autoHeight 等待上报超时后退出等待态', () => {
    vi.useFakeTimers();
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" autoHeight />
    );
    expect(container.querySelector('.ant-spin')).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(container.querySelector('.ant-spin')).toBeNull();
  });
});

describe('EmbeddedDocumentFrame 交互与回调', () => {
  it('加载完成回调与错误回调', () => {
    const onFrameReady = vi.fn();
    const onFrameError = vi.fn();
    const ready = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" onFrameReady={onFrameReady} />
    );
    fireEvent.load(getFrame(ready.container));
    expect(onFrameReady).toHaveBeenCalledTimes(1);
    ready.unmount();

    const failure = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://missing.html" onFrameError={onFrameError} />
    );
    fireEvent.error(getFrame(failure.container));
    expect(onFrameError).toHaveBeenCalledTimes(1);
    expect(failure.getByText('加载失败')).toBeInTheDocument();
  });

  it('点击帧内内容触发激活回调', () => {
    const onActivate = vi.fn();
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" onActivate={onActivate} />
    );
    fireEvent.click(getFrame(container));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('同时提供 src 与 srcDoc 时以 src 为准', () => {
    const { container } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" srcDoc="<p>内联</p>" />
    );
    const frame = getFrame(container);
    expect(frame.getAttribute('src')).toBe('chips-resource://a.html');
    expect(frame.getAttribute('srcdoc')).toBeNull();
  });

  it('源变化后回到加载态', () => {
    const { container, rerender } = renderWithApp(
      <EmbeddedDocumentFrame src="chips-resource://a.html" />
    );
    fireEvent.load(getFrame(container));
    expect(getFrame(container).style.display).toBe('block');

    rerender(<EmbeddedDocumentFrame src="chips-resource://b.html" />);
    expect(getFrame(container).style.display).toBe('none');
  });

  it('可在无 ChipsProvider 的环境直接渲染（默认令牌）', () => {
    const { container } = render(<EmbeddedDocumentFrame src="chips-resource://a.html" />);
    expect(getFrame(container)).toBeInTheDocument();
  });
});
