# 分析报告：Chips-ModulePlugin 与 Chips-CardViewer（2026-06-30 ~ 08-05）

## 任务簇 A：CardtoHTML 主题资源外置（06-30）
- exporter.ts：新增 THEME_ASSET_DIR=assets/theme；isHostThemeAssetPath 识别 theme.theme.*/dist/ 路径；createStablePathHash（FNV-1a）防同名覆盖；rewriteStandaloneAssetUrls 复制根外字体资源并改写相对 URL；extractAssetRoot 排除 Host 主题路径参与根推导；ABSOLUTE_URL_PATTERN 支持 JS 字符串内转义引号 URL。
- 测试 +3 用例（资源基址相对化、@font-face file:// 外置、srcdoc script 字符串改写）。
- README/技术文档 01/需求文档 01 同步（FR-18）。

## 任务簇 B：CommunityUploader → community.card.transfer（08-05，task027 阶段1/2/4/6 模块侧）
- manifest.yaml：provides 改 community.card.transfer（upload/download/openRemote，mode: job）；permissions 新增 platform.external/plugin.manage/window.control/zip.manage；mobile supported: true。
- contracts：新增 6 个 upload/download/openRemote schema；删除 publish 两个 schema（归档到 contracts/归档/20260805-publish能力归档/）。
- types.ts：新增 TransferServer/ClientInfo/Upload/Download/OpenRemote 类型；index.ts 三方法转发。
- publisher.ts：
  - 网络层 fetchWithRetry/fetchControlPlane（指数退避、408/429/5xx 重试、401/403 抛 AUTH_EXPIRED、AbortSignal 取消）；
  - 上传 uploadCommunityCard：inspect（readInfo+zip.list 并行+assertZipStoreEntries）→ unpack → scan（元数据收集，内存边界）→ session → presignObjects → 逐资源直传 → 富文本内联 → card.pack 网络卡片 → 直传 → complete；
  - 下载 downloadCommunityCard：download-sessions → plan → 下载 → unpack → restoreDownloadedCard → entryPlan → card.pack → verifyRestoredCard（readInfo/render/open，失败清理）；
  - openRemoteCommunityCard：临时工作区 + surface.open 启动 card-viewer（cardSource local-file + communityServer）。
- card-rewrite.ts：YAML/封面 URL 双向改写、富文本 file↔inline 还原、resolveOriginalPath 保 ?/# 后缀。
- 错误码全部改 COMMUNITY_TRANSFER_*。
- 测试：card-rewrite.test.ts（新 6 用例）、module-definition.test.ts 重写（上传/下载/openRemote/重试/401/富文本内联）；tsconfig 排除归档。
- 技术文档/01（新）+ README 更新。依赖评审：仅 yaml@^2.8.2。

## 任务簇 C：CardViewer 统一来源与封面切换（07-06）
- CardViewerShell：children → content。
- ViewerChrome：useChipsBridge → client.events（emit/on + unsubscribe）。
- ViewerCoverSurface：client prop、publishResize 协议（height/contentHeight/safeBlockEnd/viewportHeight/reason/stable），挂载+160ms 稳定成对事件、window resize 监听。
- DocumentFileScene/HostedDocumentScene：封面分支传 client。
- ViewerSourceProvider.tsx 删除（来源解析收敛到 types/viewer-source.ts + AppRuntimeProvider）。

## 任务簇 D：CardViewer 下载链路与 document-flow（08-05，task027 阶段6/7）
- manifest.yaml：新增 module.invoke/network.request/platform.external 权限；mobile supported: true；description 更新。
- AppRuntimeProvider：downloadActiveCard/canDownloadActiveCard（saveFile → communityCardTransfer.download → showMessage）；surfaceMode = openedTarget ? document : immersive（data-chips-surface-mode）；openFile 守卫。
- AppShell：下载浮动按钮 + 外部 chrome 动作（download-card/toggle-cover）；usesExternalChrome 走 ViewerChrome.Provider。
- CardWindow/CardWindow.css：frame-host 容器、overlay 条件渲染、iframe 背景 token 化。
- ViewerStage：client prop 透传。
- i18n：5 条下载相关双语文案。
- tsconfig 排除归档；归档 ViewerSourceProvider。
- tests：app.test.tsx（surface-mode、chrome 协议）、e2e、hosted-document-window（1568）、viewer-cover-surface（client.events mock）。
- 技术文档/卡片查看器应用架构与验收矩阵.md 同步。

## 发现的问题
- **canDownloadActiveCard 恒为 false**：要求 openedTarget.kind === "document" 且 surfaceMode !== "document"，而 surfaceMode 在有 openedTarget 时必为 "document"（AppRuntimeProvider.tsx:541-545 vs 335）。下载按钮永远不会显示，测试未覆盖。建议修复后提交。
