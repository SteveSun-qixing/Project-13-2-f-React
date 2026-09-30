import type {
  IAppContext,
  IAppLaunchArgs,
  IAppPlugin,
  IResourceOpenContext,
  IResourceOpenLaunchArgs,
} from '@chips/sdk';

/**
 * 应用插件主逻辑。
 *
 * 模块顶层只允许声明；窗口标题与日志等副作用全部集中在 launch。
 * 资源打开上下文（《14-资源打开与默认处理器契约》§5.1）仅随 launch 参数送达主进程：
 * 本入口只记录投递事实并把窗口标题收敛为书籍名；被打开臂由窗口 UI 经
 * `resource:opened` 标准事件（§5.5）接收同一上下文后读取资源，主进程不重复读字节。
 */

const APP_DISPLAY_NAME = '书籍阅读器';

/** 从启动参数收窄资源打开上下文（来源固定 file-association；14 §5.1）。 */
function readResourceOpenContext(args: IAppLaunchArgs): IResourceOpenContext | null {
  if (args.source !== 'file-association') {
    return null;
  }
  const candidate = (args as Partial<IResourceOpenLaunchArgs>).resourceOpen;
  return candidate ?? null;
}

class AppPlugin implements IAppPlugin {
  private ctx: IAppContext | null = null;

  public async launch(ctx: IAppContext): Promise<void> {
    this.ctx = ctx;
    const resourceOpen = readResourceOpenContext(ctx.args);

    if (ctx.window !== null) {
      const bookTitle = resourceOpen?.title ?? resourceOpen?.fileName;
      await ctx.window.setTitle(
        bookTitle ? `${bookTitle} - ${APP_DISPLAY_NAME}` : APP_DISPLAY_NAME
      );
    }

    ctx.logger.info('应用已启动', { appId: ctx.appId });
    if (resourceOpen) {
      ctx.logger.info('已接收资源打开上下文', {
        uri: resourceOpen.uri,
        mimeType: resourceOpen.mimeType,
        slot: resourceOpen.slot,
      });
    }
  }

  /** 运行中文件打开投递（07 §3.4）：UI 已先行收到 `resource:opened`，此处聚焦窗口。 */
  public async openFile(uri: string): Promise<void> {
    this.ctx?.logger.info('已接收文件打开投递', { uri });
    await this.ctx?.window?.focus();
  }
}

export default new AppPlugin();
