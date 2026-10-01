// 文本渲染依赖的引擎内最小类型面：只声明引擎高亮/渲染路径消费的入口。
// marked 上游不携带类型声明；prismjs 的运行时取值面（default 导出 + 高亮入口）在此收口，
// 语言组件（prismjs/components/*）为纯副作用加载，统一以通配模块声明放行。

declare module "marked" {
  export interface MarkedOptions {
    [key: string]: unknown;
  }
  export function parse(src: string, options?: MarkedOptions): string;
  export const marked: {
    parse(src: string, options?: MarkedOptions): string;
  };
  const defaultExport: {
    parse(src: string, options?: MarkedOptions): string;
  };
  export default defaultExport;
}

declare module "prismjs" {
  const Prism: {
    /** 对给定代码块元素执行语法高亮（Prism 1.x 公开入口）。 */
    highlightElement(element: HTMLElement): void;
    /** 语言组件注册表：组件副作用脚本向此挂载语法定义。 */
    languages: Record<string, unknown>;
  };
  export default Prism;
}

declare module "prismjs/components/*";
