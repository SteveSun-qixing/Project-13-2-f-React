// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppView } from '../src/ui/AppView';
import { openVideoInput } from '../src/ui/EmptyState';
import { createVideoSourceFromUri } from '../src/player/videoPlayer';

afterEach(() => {
  cleanup();
});

describe('openVideoInput（空态装配纯逻辑）', () => {
  it('拒绝空输入与非直播地址并给出简体中文提示', () => {
    expect(openVideoInput('   ').error).toBe('请输入视频地址。');
    expect(openVideoInput('/tmp/demo.mp4').error).toContain('暂不支持该地址形式');
  });

  it('拒绝本仓不支持扩展名的本地文件', () => {
    const result = openVideoInput('file:///media/demo.avi');
    expect(result.error).toContain('.avi');
    expect(result.source).toBeUndefined();
  });

  it('接受可直播地址并返回会话来源', () => {
    const result = openVideoInput('file:///media/demo.mp4');
    expect(result.error).toBeUndefined();
    expect(result.source?.fileName).toBe('demo.mp4');
    expect(result.source?.isRemote).toBe(false);
  });
});

describe('AppView（窗口根装配）', () => {
  it('渲染空态：地址输入、支持格式与命令注册诚实降级状态', async () => {
    render(<AppView />);
    expect(screen.getByText('打开视频')).toBeTruthy();
    expect(screen.getByText(/支持格式：/)).toBeTruthy();
    expect(screen.getByLabelText('视频地址')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/命令注册状态：/).textContent).toContain('命令通道异常');
    });
  });

  it('非法地址提交时行内如实报错，不出会话', () => {
    render(<AppView />);
    const input = screen.getByLabelText('视频地址');
    fireEvent.change(input, { target: { value: '/tmp/demo.mp4' } });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    expect(screen.getByRole('alert').textContent).toContain('暂不支持该地址形式');
    expect(screen.queryByText('视频播放区域')).toBeNull();
  });

  it('合法地址提交后进入播放舞台：视频元素与控制面出现', async () => {
    render(<AppView />);
    const input = screen.getByLabelText('视频地址');
    fireEvent.change(input, { target: { value: 'file:///media/演示.webm' } });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));

    const region = screen.getByRole('region', { name: '视频播放区域' });
    expect(region).toBeTruthy();
    expect(region.querySelector('video')).not.toBeNull();
    expect(region.querySelector('video')?.getAttribute('src')).toBe('file:///media/演示.webm');
    expect(screen.getByRole('slider', { name: '播放进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '播放' })).toBeTruthy();
    expect(screen.getByText(/已打开视频会话/)).toBeTruthy();

    await waitFor(
      () => {
        expect(screen.queryByText(/已打开视频会话/)).toBeNull();
      },
      { timeout: 2500 },
    );
  });

  it('键位帮助经按钮打开并以 Modal 呈现', () => {
    const { container } = render(<AppView />);
    const input = screen.getByLabelText('视频地址');
    fireEvent.change(input, { target: { value: createVideoSourceFromUri('file:///media/demo.mp4')?.sourceId ?? '' } });
    fireEvent.click(screen.getByRole('button', { name: '打开' }));
    fireEvent.click(screen.getByRole('button', { name: '快捷键帮助' }));
    expect(screen.getByText('快捷键')).toBeTruthy();
    expect(screen.getByText('播放或暂停')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '关 闭' }));
    });
    expect(container).toBeTruthy();
  });
});
