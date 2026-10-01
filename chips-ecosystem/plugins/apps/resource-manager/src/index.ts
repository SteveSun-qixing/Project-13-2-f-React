import type { IAppContext, IAppPlugin } from '@chips/sdk';

/**
 * 应用插件主逻辑（07-应用插件接口 §3）。
 *
 * - `launch`：按《04-资源管理器产品设计》§2.1 窗口标题规则设名——未绑定工作区时为应用名
 *   （工作区绑定通道候 `config:get(platform, workspace.path)` 域处理器落位后接「位置名 — 资源管理器」
 *   规则，本臂不读平台配置、不伪造位置名）；浏览消费一律在窗口界面内经
 *   `chips.request('document:*')` 正式面完成，主逻辑不重复处理；
 * - 单实例单主窗口（§2.1）：重复启动聚焦既有窗口由平台 surface 复用语义承担（manifest 声明）；
 * - 模块顶层只允许声明；窗口标题与日志等副作用全部集中在 `launch`。
 */
class AppPlugin implements IAppPlugin {
  public async launch(ctx: IAppContext): Promise<void> {
    const appWindow = ctx.window;
    if (appWindow !== null) {
      await appWindow.setTitle('资源管理器');
    }
    ctx.logger.info('应用已启动', { appId: ctx.appId, source: ctx.args.source });
  }
}

export default new AppPlugin();
