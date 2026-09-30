import type { IAppContext, IAppPlugin } from '@chips/sdk';
import { resolveFileName } from './viewer/image-viewer';

/**
 * 应用插件主逻辑（07-应用插件接口 §3）。
 *
 * - `launch`：保存实例上下文、设置窗口标题并记录启动来源；资源打开投递下的初始上下文随
 *   `ctx.args.resourceOpen` 送达（《14-资源打开与默认处理器契约》§5.1），界面侧经
 *   `resource:opened` 事件面消费运行中投递（§5.5）；
 * - `openFile`：运行中投递的接收面（07 §3.5），同步窗口标题并记录诊断；字节读取与展示
 *   编排一律在窗口界面内经 `chips.resource(uri)` 正式面完成，不在主逻辑重复处理；
 * - 模块顶层只允许声明；副作用全部集中在 `launch` / `openFile`。
 */

const APP_TITLE = '图片查看器';
const APP_TITLE_SEPARATOR = ' · ';

function composeTitle(fileName: string | undefined): string {
  const trimmed = fileName?.trim() ?? '';
  return trimmed.length > 0 ? `${trimmed}${APP_TITLE_SEPARATOR}${APP_TITLE}` : APP_TITLE;
}

class AppPlugin implements IAppPlugin {
  #context: IAppContext | null = null;

  public async launch(ctx: IAppContext): Promise<void> {
    this.#context = ctx;
    const appWindow = ctx.window;
    if (appWindow !== null) {
      const resourceOpen = (ctx.args as { resourceOpen?: { fileName?: string } }).resourceOpen;
      await appWindow.setTitle(composeTitle(resourceOpen?.fileName));
    }
    ctx.logger.info('应用已启动', { appId: ctx.appId, source: ctx.args.source });
  }

  public async openFile(uri: string): Promise<void> {
    // 上下文经 `resource:opened` 事件先于本调用送达界面（《14》§5.5 顺序约束）；
    // 这里只同步窗口标题并记录诊断，不重复投递、不伪造读取结果。
    const ctx = this.#context;
    const fileName = resolveFileName(uri);
    if (ctx !== null) {
      if (ctx.window !== null) {
        await ctx.window.setTitle(composeTitle(fileName.length > 0 ? fileName : undefined));
      }
      ctx.logger.info('已接收运行中打开投递', { uri });
    }
  }
}

export default new AppPlugin();
