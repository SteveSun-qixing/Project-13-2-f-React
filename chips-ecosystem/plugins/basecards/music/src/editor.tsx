import type { ChangeEvent, ReactElement } from 'react';
import { useRef, useState } from 'react';
import { Button, Input, Tag, theme } from '@chips/ui';
import { deriveDisplayTitle, readConfig, validateConfig } from './config';
import type { IMusicConfig, IMusicTeamRole } from './config';
import { generateStableId } from './shared/utils';

/**
 * 编辑态面板（08-基础卡片插件接口 §4）。
 *
 * 编辑器只产出配置变更（经 `IBaseCardEditor` 回流），不写文件、不保存；
 * 允许中间非法态（08 §7.4）：字段级错误以行内简体中文提示呈现，仅当整份配置合法
 * 且音频资源路径已填写时才向编辑链路发布 replace 变更。
 *
 * 资源文件落卡片的导入臂（音频/封面/歌词文件选择 → 资源写入 → 路径回填）依赖编辑器
 * 资源导入通道（工单060 登记缺位），通道就绪后在该面板接线；本面板先行承接
 * 资源路径与歌曲信息的编辑与校验。嵌入元数据自动补全的解析器
 * （`src/shared/audio-metadata.ts`）已随包交付，等导入臂就绪后消费。
 */

/** 编辑器发布变更前要求的最小完整性：整体合法（schema 同口径）且音频资源路径非空。 */
export function isEditorConfigComplete(config: IMusicConfig): boolean {
  return config.audio_file.length > 0 && validateConfig(config);
}

export interface IMusicEditorViewProps {
  config: IMusicConfig;
  onChange: (next: IMusicConfig) => void;
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

export function MusicEditorView({ config, onChange }: IMusicEditorViewProps): ReactElement {
  const { token } = theme.useToken();
  const [draft, setDraft] = useState<IMusicConfig>(() => readConfig(config));
  const draftRef = useRef(draft);

  const commit = (patch: Partial<IMusicConfig>): void => {
    const next = readConfig({ ...draftRef.current, ...patch });
    draftRef.current = next;
    setDraft(next);
    onChange(next);
  };

  const onStringField =
    (key: 'audio_file' | 'album_cover' | 'lyrics_file' | 'music_name' | 'album_name' | 'release_date' | 'language' | 'genre') =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
      commit({ [key]: event.currentTarget.value });
    };

  const releaseDateInvalid =
    draft.release_date.trim().length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(draft.release_date.trim());

  const addTeamRole = (): void => {
    const role: IMusicTeamRole = { id: generateStableId('team'), role: '', people: [] };
    commit({ production_team: [...draft.production_team, role] });
  };

  const updateTeamRole = (roleId: string, patch: Partial<IMusicTeamRole>): void => {
    commit({
      production_team: draft.production_team.map((role) =>
        role.id === roleId ? { ...role, ...patch } : role
      ),
    });
  };

  const removeTeamRole = (roleId: string): void => {
    commit({ production_team: draft.production_team.filter((role) => role.id !== roleId) });
  };

  const displayTitle = deriveDisplayTitle(draft) || '未命名歌曲';

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

        <FieldRow label="音频文件" hint="必填；卡片内相对路径，例如 tracks/demo.mp3">
          <Input
            data-role="audio-path-input"
            value={draft.audio_file}
            placeholder="tracks/midnight-echo.mp3"
            onChange={onStringField('audio_file')}
          />
        </FieldRow>

        <FieldRow label="专辑封面" hint="可选；卡片内相对路径，未填写时查看态显示默认占位封面">
          <Input
            data-role="cover-path-input"
            value={draft.album_cover}
            placeholder="covers/midnight-echo.jpg"
            onChange={onStringField('album_cover')}
          />
        </FieldRow>

        <FieldRow label="歌词文件" hint="可选；卡片内相对路径，随打开载荷交给音乐播放器">
          <Input
            data-role="lyrics-path-input"
            value={draft.lyrics_file}
            placeholder="lyrics/midnight-echo.lrc"
            onChange={onStringField('lyrics_file')}
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
          歌曲信息
        </h3>

        <FieldRow label="歌曲名" hint={`留空时查看态从音频文件名派生，当前展示：${displayTitle}`}>
          <Input
            data-role="music-name-input"
            value={draft.music_name}
            placeholder="输入歌曲名"
            onChange={onStringField('music_name')}
          />
        </FieldRow>

        <FieldRow label="专辑名字">
          <Input
            data-role="album-name-input"
            value={draft.album_name}
            placeholder="输入专辑名字"
            onChange={onStringField('album_name')}
          />
        </FieldRow>

        <FieldRow
          label="发行日期"
          hint="格式 YYYY-MM-DD"
          error={releaseDateInvalid ? '发行日期必须使用 YYYY-MM-DD' : undefined}
        >
          <Input
            data-role="release-date-input"
            value={draft.release_date}
            placeholder="2026-04-18"
            {...(releaseDateInvalid ? { status: 'error' as const } : {})}
            onChange={onStringField('release_date')}
          />
        </FieldRow>

        <FieldRow label="语种">
          <Input
            data-role="language-input"
            value={draft.language}
            placeholder="例如：中文、日语、英语"
            onChange={onStringField('language')}
          />
        </FieldRow>

        <FieldRow label="流派">
          <Input
            data-role="genre-input"
            value={draft.genre}
            placeholder="例如：流行、摇滚、电子"
            onChange={onStringField('genre')}
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
            制作团队
          </h3>
          <Button data-role="add-team-role" onClick={addTeamRole}>
            添加身份
          </Button>
        </div>

        {draft.production_team.length > 0 ? (
          <div style={{ display: 'grid', gap: token.marginSM, paddingTop: token.marginSM }}>
            {draft.production_team.map((role) => (
              <div
                key={role.id}
                style={{
                  display: 'grid',
                  gap: token.marginSM,
                  padding: token.paddingSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  borderRadius: token.borderRadiusLG,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: token.marginXS }}>
                  <Tag color="processing">{role.role.trim().length > 0 ? role.role : '未命名身份'}</Tag>
                  <span style={{ flex: '1 1 auto' }} />
                  <Button
                    data-role={`remove-team-role-${role.id}`}
                    size="small"
                    onClick={() => {
                      removeTeamRole(role.id);
                    }}
                  >
                    删除身份
                  </Button>
                </div>
                <FieldRow label="身份名称">
                  <Input
                    data-role={`team-role-input-${role.id}`}
                    value={role.role}
                    placeholder="例如：歌手、作词、作曲"
                    onChange={(event) => {
                      updateTeamRole(role.id, { role: event.currentTarget.value });
                    }}
                  />
                </FieldRow>
                <FieldRow label="成员列表" hint="每行一个人名">
                  <Input.TextArea
                    data-role={`team-people-input-${role.id}`}
                    rows={3}
                    value={role.people.join('\n')}
                    placeholder={'每行输入一个人名'}
                    onChange={(event) => {
                      updateTeamRole(role.id, {
                        people: event.currentTarget.value
                          .split(/\r?\n/u)
                          .map((item) => item.trim())
                          .filter((item) => item.length > 0),
                      });
                    }}
                  />
                </FieldRow>
              </div>
            ))}
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
            还没有录入制作团队，可以先添加一个身份。
          </p>
        )}
      </section>
    </div>
  );
}
