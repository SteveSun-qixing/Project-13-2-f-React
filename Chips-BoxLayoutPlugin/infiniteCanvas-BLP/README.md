# 无限画布布局插件

`chips.layout.infinitecanvas.blp` 为箱子提供可平移、缩放的自由画布布局。条目坐标写入布局配置 `props.items[entryId]`，查看态只消费 Host 注入的摘要页和运行时接口，不直接读写 `.box` 文件或文件系统。

## 功能

- 查看态支持鼠标拖拽平移、滚轮缩放、键盘方向键移动视口。
- 条目支持点模式、封面模式和 mixed 模式；封面通过 `runtime.renderEntryCover(entryId)` 获取。
- 点击点位、封面或标题统一调用 `runtime.openEntry(entryId)`。
- 可显示网格，可在编辑器中开启坐标吸附。
- 背景图片作为箱子自有资源导入，路径固定保存在 `assets/layouts/infinitecanvas/background/`，并同步到 `assetRefs`。
- 编辑器支持未放置条目列表、选择后点击画布放置、拖动节点、坐标输入、条目模式切换、显示名覆盖和背景上传/清空。

## 配置结构

运行时配置使用 camelCase：

```ts
interface InfiniteCanvasLayoutConfig {
  schemaVersion: "1.0.0";
  props: {
    defaultView: { x: number; y: number; zoom: number };
    displayMode: "point" | "cover" | "mixed";
    gridVisible: boolean;
    snapToGrid: boolean;
    background: {
      mode: "none" | "image";
      assetPath?: string;
      width?: number;
      height?: number;
      opacity?: number;
    };
    items: Record<string, {
      x: number;
      y: number;
      width?: number;
      height?: number;
      mode?: "point" | "cover";
      labelOverride?: string;
    }>;
  };
  assetRefs: string[];
}
```

持久化到 `.box/content.yaml` 时由 Host/SDK 负责 snake_case 转换。插件只处理运行时对象。

## 验证

```bash
npm run lint
npm test
npm run build
npm run validate
```

## 目录结构

- `src/view/`：查看态页面挂载与运行时
- `src/editor/`：布局参数编辑与预览
- `src/schema/`：默认配置、归一和校验
- `src/shared/`：共享类型与视图辅助函数
- `src/lib/`：本地中文文案映射（`messages.ts`）
- `contracts/`：布局配置 schema
- `tests/`：单元测试

## 技术栈

- UI 组件：Ant Design（antd v6）+ `@ant-design/icons`
- 共享前端层：`@chips/ui`（苹果风格主题、`EmbeddedDocumentFrame` 等）
- 界面文案：简体中文直写（`src/lib/messages.ts` 统一维护 key → 中文映射）
