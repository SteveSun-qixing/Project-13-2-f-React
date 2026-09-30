import type { IAppContext, IAppPlugin } from '@chips/sdk';

/**
 * 应用插件主逻辑。
 *
 * 模块顶层只允许声明；窗口标题与日志等副作用全部集中在 launch。
 */
class AppPlugin implements IAppPlugin {
  public async launch(ctx: IAppContext): Promise<void> {
    const appWindow = ctx.window;
    if (appWindow !== null) {
      await appWindow.setTitle('视频播放器');
    }
    ctx.logger.info('应用已启动', { appId: ctx.appId });
  }
}

export default new AppPlugin();
