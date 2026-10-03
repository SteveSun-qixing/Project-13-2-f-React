import React from 'react';
import { BoxEmptyState, Button, ChipsProvider, CommandProvider, PanelHeader, Tabs, theme } from '@chips/ui';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';
import { WordEditorPanel } from './WordEditorPanel';

const APP_ID = 'chips.official.office';

/** 三域 + word 域迁移状态（与《W5迁移-office-三域臂/word域臂-开发日志-2026-10-01.md》一致）。 */
const DOMAINS: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly status: string;
  readonly description: string;
}> = [
  {
    key: 'sheet',
    label: '表格',
    status: '领域逻辑已迁移',
    description:
      '工作簿模型、自研公式与 xlsx 字节级读写网关已就位（15 个领域模块 + 23 个网关模块，最小合法 xlsx 夹具测试通过）；打开/保存会话链候宿主 document 会话与 file/resource 域处理器。',
  },
  {
    key: 'pdf',
    label: 'PDF',
    status: '阅读域逻辑已迁移',
    description:
      '搜索/标注/文本行/线程/盖章/页面几何等 21 个纯逻辑模块已就位（pdfjs-dist 真实解析夹具测试通过）；渲染装配候渲染帧插件执行通道。',
  },
  {
    key: 'slide',
    label: '演示',
    status: '演示域模型已迁移',
    description:
      '动画时序、调整柄几何、放映序列等演示域模型已就位（最小合法 pptx 夹具校验通过）；画布渲染与 pptx 字节解析候选型收口。',
  },
  {
    key: 'word',
    label: 'Word',
    status: '领域逻辑与编辑面已迁移',
    description:
      '文档模型/段落样式映射/docx 字节级读写网关已就位（最小合法 docx 夹具全链测试通过）；编辑面为统一编辑引擎 Milkdown（Markdown 唯一编辑表示），保存经 file:write 正式能力链落盘。',
  },
];

/** 单个域面板：迁移状态与候前置件的如实降级登记；word 域挂载真编辑面。 */
const DomainPanel: React.FC<{
  readonly domainKey: string;
  readonly status: string;
  readonly description: string;
}> = ({ domainKey, status, description }) => {
  const { token } = theme.useToken();
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: token.marginSM }}>
      <p style={{ margin: 0, color: token.colorTextSecondary }}>
        迁移状态：{status}
      </p>
      <p style={{ margin: 0 }}>{description}</p>
      {domainKey === 'word' ? (
        <WordEditorPanel />
      ) : (
        <BoxEmptyState
          title="域界面待端到端臂装配"
          description="文档打开与编辑界面将随宿主会话链与渲染帧通道收口后接入。"
          compact
        />
      )}
    </section>
  );
};

/** 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。 */
const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.margin,
        padding: token.padding,
      }}
    >
      <PanelHeader
        title="薯片办公"
        description="Word / 表格 / 演示 / PDF 四件套查看与编辑（.docx / .xlsx / .csv / .pptx / .pdf）"
      />
      <Tabs
        defaultActiveKey="sheet"
        items={DOMAINS.map((domain) => ({
          key: domain.key,
          label: domain.label,
          children: (
            <DomainPanel domainKey={domain.key} status={domain.status} description={domain.description} />
          ),
        }))}
      />
    </section>
  );
};

/**
 * 命令消费展示区：挂载命令注册状态与 `command:invoked` 派发执行记录。
 *
 * 两个按钮以 `source: 'api'` 经 `command:invoke` 触发本应用登记的 ui 目标命令，
 * 平台向本窗口派发后由 `attach` 的本地处理器执行并回写状态。
 */
const CommandSection: React.FC = () => {
  const { token } = theme.useToken();
  const { phase, errorCode, lastInvoked, invokeOpenCard, invokeRefreshView } = useAppCommands();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        paddingInline: token.padding,
        paddingBottom: token.padding,
      }}
    >
      <p style={{ margin: 0 }}>命令注册状态：{COMMAND_PHASE_LABELS[phase]}</p>
      {errorCode === null ? null : <p style={{ margin: 0 }}>最近错误码：{errorCode}</p>}
      <div style={{ display: 'flex', gap: token.marginXS }}>
        <Button onClick={() => void invokeOpenCard('~/文档/示例.cpk')}>触发打开卡片命令</Button>
        <Button onClick={() => void invokeRefreshView()}>触发刷新视图命令</Button>
      </div>
      <p style={{ margin: 0 }}>
        {lastInvoked === null
          ? '本窗口尚未执行过命令派发'
          : '最近执行：' + lastInvoked.commandId}
      </p>
    </section>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <AppContent />
      <CommandSection />
    </CommandProvider>
  </ChipsProvider>
);

export default AppView;
