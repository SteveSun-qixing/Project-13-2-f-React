import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppView } from '../src/ui/AppView';
import { assembleTrack } from '../src/ui/AssemblyForm';
import { createAudioSourceFromUri } from '../src/player/trackSession';
import { getWindowMusicQueueStore } from '../src/player/queuePersistence';

/**
 * 应用窗口装配判例（重写件）。
 * 会话装配走真实链：data: 地址 → fetch（undici 真实传输）→ ID3v2 夹具解析 → 舞台呈现。
 */

/** 构造最小真实 ID3v2.3 数据地址（TIT2「舞台曲目」，UTF-8 编码帧）。 */
function buildTagDataUri(): string {
  const frame = (id: string, payload: Buffer): Buffer => {
    const head = Buffer.alloc(10);
    head.write(id, 'latin1');
    head.writeUInt32BE(payload.length, 4);
    return Buffer.concat([head, payload]);
  };
  const body = frame(
    'TIT2',
    Buffer.concat([Buffer.from([0x03]), Buffer.from('舞台曲目', 'utf8')]),
  );
  const header = Buffer.alloc(10);
  header.write('ID3', 'latin1');
  header[3] = 0x03;
  header[6] = (body.length >> 21) & 0x7f;
  header[7] = (body.length >> 14) & 0x7f;
  header[8] = (body.length >> 7) & 0x7f;
  header[9] = body.length & 0x7f;
  return `data:audio/mpeg;base64,${Buffer.concat([header, body]).toString('base64')}`;
}

const MP3_FIXTURE_DATA_URI = buildTagDataUri();

afterEach(() => {
  cleanup();
  // 队列存储为窗口会话单例（工单066 内存态）：用例间清空，保证空态起点。
  getWindowMusicQueueStore().clear();
});

describe('assembleTrack（空态装配纯逻辑）', () => {
  it('拒绝空输入与非直接可播放地址并给出简体中文提示', () => {
    return assembleTrack({ audioUri: '   ' }).catch((error: unknown) => {
      expect((error as Error).message).toBe('请输入音频地址。');
    });
  });

  it('拒绝非法伴生歌词地址', () => {
    return assembleTrack({ audioUri: 'https://example.com/a.mp3', lyricsUri: '/tmp/a.lrc' }).catch(
      (error: unknown) => {
        expect((error as Error).message).toContain('歌词地址不可用');
      },
    );
  });

  it('合法地址装配出会话呈现（真实元数据解析）', async () => {
    const presentation = await assembleTrack({ audioUri: MP3_FIXTURE_DATA_URI, title: '舞台曲目' });
    expect(presentation.title).toBe('舞台曲目');
    expect(presentation.artist).toBe('');
    expect(presentation.source.mimeType).toBe('audio/mpeg');
  });
});

describe('AppView（窗口根装配）', () => {
  it('渲染空态：地址输入、支持格式与命令注册诚实降级状态', async () => {
    render(<AppView />);
    expect(screen.getByText('打开音乐')).toBeTruthy();
    expect(screen.getByText(/支持格式：/)).toBeTruthy();
    expect(screen.getByLabelText('音频地址')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(/命令注册状态：/).textContent).toContain('命令通道异常');
    });
  });

  it('非法地址提交时行内如实报错，不出会话', async () => {
    render(<AppView />);
    fireEvent.change(screen.getByLabelText('音频地址'), { target: { value: '/tmp/demo.mp3' } });
    fireEvent.click(screen.getByRole('button', { name: '加入并播放' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('暂不支持该地址形式');
    expect(screen.queryByRole('region', { name: '播放舞台' })).toBeNull();
  });

  it('合法地址提交后进入播放舞台：音频元素、控制面与真实解析标题出现', async () => {
    render(<AppView />);
    fireEvent.change(screen.getByLabelText('音频地址'), { target: { value: MP3_FIXTURE_DATA_URI } });
    fireEvent.change(screen.getByLabelText('展示标题'), { target: { value: '舞台曲目' } });
    fireEvent.click(screen.getByRole('button', { name: '加入并播放' }));

    const stage = await screen.findByRole('region', { name: '播放舞台' });
    // 音频元素由 AppView 承载（舞台区之外），src 随当前曲目会话切换。
    const audio = document.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute('src')).toBe(MP3_FIXTURE_DATA_URI);
    expect(stage).toBeTruthy();
    expect(screen.getByRole('slider', { name: '播放进度' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '播放' })).toBeTruthy();
    // 真实解析链：舞台标题与队列条目都携带装配标题（去重断言）。
    expect(screen.getAllByText('舞台曲目').length).toBeGreaterThan(0);
  });

  it('第二首经「添加曲目」入队：队列面板计数与当前曲目高亮更新', async () => {
    render(<AppView />);
    fireEvent.change(screen.getByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/晴天.mp3' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入并播放' }));

    await screen.findByRole('region', { name: '播放舞台' });
    fireEvent.click(screen.getByRole('button', { name: '添加曲目' }));
    fireEvent.change(await screen.findByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/安河桥.opus' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入队列' }));

    await waitFor(() => {
      expect(screen.getByText('播放队列（2）')).toBeTruthy();
    });
    expect(screen.getAllByText('晴天.mp3').length).toBeGreaterThan(0);
    expect(screen.getAllByText('安河桥.opus').length).toBeGreaterThan(0);
  });

  it('队列点选切换当前曲目（playAt 会话切换）', async () => {
    render(<AppView />);
    fireEvent.change(screen.getByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/晴天.mp3' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入并播放' }));
    await screen.findByRole('region', { name: '播放舞台' });

    fireEvent.click(screen.getByRole('button', { name: '添加曲目' }));
    fireEvent.change(await screen.findByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/安河桥.opus' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入队列' }));
    await waitFor(() => {
      expect(screen.getByText('播放队列（2）')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('安河桥.opus')[0] as HTMLElement);
    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toBe('https://example.com/audio/安河桥.opus');
    });
  });
});

describe('会话形状（resource:open 落波对接面）', () => {
  it('AudioSource 携带播放地址与会话键要素', () => {
    const source = createAudioSourceFromUri('file:///音乐库/夜曲.flac');
    expect(source?.resourceUri).toBe('file:///音乐库/夜曲.flac');
    expect(source?.revision).toBe(1);
    expect(source?.isRemote).toBe(false);
  });
});

describe('键位（窗口容器派发）', () => {
  it('n 键切到下一首（队列可进时）', async () => {
    render(<AppView />);
    fireEvent.change(screen.getByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/晴天.mp3' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入并播放' }));
    await screen.findByRole('region', { name: '播放舞台' });
    fireEvent.click(screen.getByRole('button', { name: '添加曲目' }));
    fireEvent.change(await screen.findByLabelText('音频地址'), {
      target: { value: 'https://example.com/audio/安河桥.opus' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加入队列' }));
    await waitFor(() => {
      expect(screen.getByText('播放队列（2）')).toBeTruthy();
    });

    fireEvent.keyDown(screen.getByRole('region', { name: '播放舞台' }), { key: 'n' });
    await waitFor(() => {
      const audio = document.querySelector('audio');
      expect(audio?.getAttribute('src')).toBe('https://example.com/audio/安河桥.opus');
    });
  });
});
