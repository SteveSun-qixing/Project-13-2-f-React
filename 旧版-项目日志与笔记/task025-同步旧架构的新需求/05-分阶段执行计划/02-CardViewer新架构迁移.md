# 阶段 2：CardViewer 新架构迁移

1. 在 `AppRuntimeProvider` 统一解析 `cardSource`、`targetPath` 和旧 `webDocumentUrl` 过渡输入。
2. 扩展 Scene 解析：
   - 空启动；
   - 本地文档；
   - 托管文档；
   - 封面查看态可作为同一 document scene 内部模式，不新增平行运行时。
3. 将旧 `ViewerSourceProvider` 的来源解析职责迁入当前 `AppRuntimeProvider`，将旧 `ViewerStage` 职责迁入当前 `scene-registry/AppShell`，将旧 `ViewerChrome` 的动作与标题职责迁入当前 `CardViewerShell`、Scene action slot 和 command 体系。
4. 增加封面来源解析：
   - 本地卡片读 Host 卡片封面；
   - 本地箱子读 Host 箱子封面；
   - 社区来源读取 source 内封面字段。
5. 增加封面/内容切换组件和 action slot。
6. 优化 `HostedDocumentWindow` 高度协议，支持正文和封面态切换时的稳定 resize。
7. 补齐 i18n、主题 token、a11y 和测试。

架构融合要求：

- 不复制旧 `App.tsx` 的单体组织方式。
- `cardSource` 是新主入口，`targetPath/webDocumentUrl` 只作为旧输入识别。
- 当前 `document.window.render`、AppRuntime、Scene 和 command registry 链路必须保留并增强。

验收命令：

```bash
npm --prefix Chips-CardViewer run lint
npm --prefix Chips-CardViewer test
npm --prefix Chips-CardViewer run build
npm --prefix Chips-CardViewer run validate
```
