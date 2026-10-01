import type { IAppContext, IAppPlugin } from '@chips/sdk';

/**
 * 应用插件主逻辑（07-应用插件接口 §3）。
 *
 * - `launch`：设置窗口标题并记录启动来源；以 `.box` 为笔记本、`.card` 为笔记的领域消费
 *   一律在窗口界面内经 `chips.request('document:*')` 正式面完成，主逻辑不重复处理；
 * - 模块顶层只允许声明；窗口标题与日志等副作用全部集中在 `launch`。
 */
class AppPlugin implements IAppPlugin {
  public async launch(ctx: IAppContext): Promise<void> {
    const appWindow = ctx.window;
    if (appWindow !== null) {
      await appWindow.setTitle('笔记');
    }
    ctx.logger.info('应用已启动', { appId: ctx.appId, source: ctx.args.source });
  }
}

export default new AppPlugin();
