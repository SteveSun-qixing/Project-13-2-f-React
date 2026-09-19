import React from 'react';
import { Button, ChipsProvider, Empty, Spin, theme } from '@chips/ui';
import { chips } from '@chips/sdk';
import type { CapabilityInput, CapabilityOutput, ISubscription } from '@chips/sdk';

const APP_ID = 'chips.example.hello';
const NAMESPACE = `plugins.${APP_ID}`;
const GREETING_KEY = 'greeting';
const GREETING_FULL_KEY = `${NAMESPACE}.${GREETING_KEY}`;
const DEFAULT_GREETING = '你好，世界！';

type ViewState = 'loading' | 'ready' | 'error';

interface IConfigChangedPayload {
  readonly key: string;
  readonly effectiveValue: unknown;
}

const isGreetingChange = (payload: unknown): payload is IConfigChangedPayload => {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as { key?: unknown };
  return candidate.key === GREETING_FULL_KEY;
};

const Workspace: React.FC = () => {
  const { token } = theme.useToken();
  const [greeting, setGreeting] = React.useState<string>(DEFAULT_GREETING);
  const [count, setCount] = React.useState(0);
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [state, setState] = React.useState<ViewState>('loading');

  React.useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      try {
        const input: CapabilityInput<'config:get'> = {
          namespace: NAMESPACE,
          key: GREETING_KEY,
        };
        const view: CapabilityOutput<'config:get'> = await chips.request<
          CapabilityOutput<'config:get'>
        >('config:get', input);
        if (!active) {
          return;
        }
        if (typeof view.value === 'string' && view.value.length > 0) {
          setGreeting(view.value);
        }
        setState('ready');
      } catch {
        if (active) {
          setState('error');
        }
      }
    };

    void load();

    const subscription: ISubscription = chips.subscribe('config:changed', (payload) => {
      if (!isGreetingChange(payload) || typeof payload.effectiveValue !== 'string') {
        return;
      }
      if (payload.effectiveValue.length > 0) {
        setGreeting(payload.effectiveValue);
      }
    });

    return () => {
      active = false;
      subscription.dispose();
    };
  }, []);

  const increment = React.useCallback((): void => {
    setCount((value) => value + 1);
  }, []);

  const copyGreeting = React.useCallback((): void => {
    const input: CapabilityInput<'clipboard:write'> = { text: greeting };
    chips
      .request<void>('clipboard:write', input)
      .then(() => setFeedback('问候语已复制到剪贴板'))
      .catch(() => setFeedback('复制失败，请检查剪贴板权限'));
  }, [greeting]);

  if (state === 'loading') {
    return <Spin />;
  }

  if (state === 'error') {
    return <Empty description="读取应用配置失败" />;
  }

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
        padding: token.padding,
        color: token.colorText,
      }}
    >
      <p style={{ margin: 0, fontSize: token.fontSizeHeading5 }}>{greeting}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: token.marginSM }}>
        <Button type="primary" onClick={increment}>
          点击次数：{count}
        </Button>
        <Button onClick={copyGreeting}>复制问候语</Button>
      </div>
      {feedback !== null ? <div style={{ color: token.colorTextSecondary }}>{feedback}</div> : null}
    </section>
  );
};

/**
 * 应用窗口 UI 根组件：挂载窗口运行环境并提供你好世界界面；构建产物为 render.js。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <Workspace />
  </ChipsProvider>
);

export default AppView;
