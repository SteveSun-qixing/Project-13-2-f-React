# 台账media-community接管-开发日志

> 任务 #52：W0 台账裁决收尾 —— 音乐/富文本/社区客户端三仓（`Chips-MusicPlayer` / `Chips-RichTextEditor` / `Chips-CommunityClient`）252 行逐行裁决接管。
> owner：`ledger-media-community`（前轮已认领 266 行、裁决 14 行，本轮接管剩余 252 行）。
> 纪律：旧仓库只读零修改；全部落库经 `重构台账.py dispose-batch`（owner 唯一、单事务、自动留痕），无手工 SQL；无 git 写操作。

---

## 批次记录（2026-09-20 20:18~20:32 落库，33 批共 252 行，全部 status=已裁决）

| # | 批次 | 行数 | disposition | target | 抽查证据（节选） |
|---|------|------|-------------|--------|------------------|
| 1 | mp-migrate | 19 | 迁移 | chips-ecosystem/plugins/apps/music-player | 逐文件 grep chips-sdk/window.chips/Bridge 计数 0；audio-metadata.ts 1144 行 186 个顶层声明（ID3/MP4/FLAC/Vorbis 手写解析）；music-player.ts 仅 `import type MusicCardOpenPayload`（302 行，vp video-player.ts 同判）；useMusicPlayerController.ts 129 行纯 `<audio>` hook |
| 2 | mp-ui | 17 | 重写 | 同上 | AppRuntimeProvider.tsx 917 行 `client.*` 触达 11 处 + AppChrome/appleTheme 旧装配（AppRoot/AppShell/commands grep 命中 @chips/ui）；global.css 1009 行硬编码；TransportControls 直装 @ant-design/icons；messages.ts 101 行 key 间接层 |
| 3 | mp-chain | 4 | 重写 | 同上 | chips-client.ts `createClient()`；launch-resource.ts `import type PlatformLaunchContext`；embedded-artwork-cache.ts 注入式旧 client.file/resource 形态含 `convertTiffToPng`（旧能力，归内容处理服务） |
| 4 | mp-manifest | 1 | 重写 | 同上 | 84 行；旧 ID com.chips.music-player 作废（09-目录 §7.3 判重写、ADR-010）；audio:* primary 处理器声明为功能承载，按 02-清单规范字段级重建 |
| 5 | mp-tests | 4 | 重写 | 同上 | launch-resource.test 388 行断言旧投递解析；embedded-artwork-cache.test 205 行断言旧 file/resource 注入面 |
| 6 | mp-atmos | 8 | 废弃 | （空） | 08-总览 §八核心功能表无氛围层条目；artwork-palette/color 与平台能力 `image.color.pick`（09-目录 Chips-ColorPicker）重复，08 §八已知取舍「不复制宿主级解析算法」；消费面仅 AtmosphereCanvas/useAtmosphereTheme/atmosphere-theme（grep 证实无其他消费者） |
| 7 | mp-probe | 2 | 废弃 | （空） | e2e/basic-flow.test 8 行正文实测 `expect(1+1).toBe(2)`；index-html-csp.test 36 行 readFileSync 旧 index.html CSP 断言 |
| 8 | mp-config | 8 | 废弃 | （空） | 基线 5：package.json/tsconfig/.eslintrc/chips.config.mjs/index.html/.gitignore/app-config/logging（123 行复制式 logger，`import type { SdkLogger } from "chips-sdk"` 实测），monorepo+scaffold 重生成 |
| 9 | mp-fonts | 4 | 废弃 | （空） | SOURCE.md（前轮已裁决行 2511）自证 PingFang/SF Pro 专有字体；开源处理素材仓矩阵 §法务排除明文「不可再分发」；global.css @font-face 引用仅作旧用途证据 |
| 10~12 | mp-doc1/2/3 | 3+1+2 | 保留设计 | 08-总览.md / 14-契约.md / 03-查看器设计.md（均现存实体） | README 60 行、技术文档 5 篇（18/135/215/133/81 行）语义落点对齐 08 §八、14 §9.2、03 §八；04 含主题多语言节标 task030 历史参考 |
| 13 | mp-archive | 18 | 归档 | （空） | 开发计划×4 + 归档/**14 行（任务032旧Bridge入口、本地图像转换 png/tiff、i18n×2、AppProviders、旧命令模型 290 行、environment-client、theme-runtime、脚手架残留），基线 1 就地登记不删除 |
| 14 | rte-migrate | 6 | 迁移 | chips-ecosystem/plugins/apps/rich-text-editor | card-document.ts 502 行仅依赖 yaml（固定复合卡片构建/校验，08 §十二数据格式承载）；richtext-card.ts 157 行 base.richtext+markdown_capabilities；id/path 纯函数 grep 零触达；app-icon.svg |
| 15 | rte-ui | 9 | 重写 | 同上 | RichTextEditorScene.tsx 984 行 client.platform.showConfirm/openFile/saveFile/shellOpenPath 实测 434/509/574/749 行；InfoDialog antd Modal/Descriptions 直装；global.css 142；messages.ts 67 行 MESSAGES key 表实测 |
| 16 | rte-chain | 6 | 重写 | 同上 | EditorFrame client.card.editorPanel.render/onReady/onChange/onError 实测 46/61/66/70 行；card-persistence client.card.unpack/pack（185/253 行）；file-client client.file.\* 全文件 9 处；launch-target PlatformLaunchContext |
| 17 | rte-cmd | 2 | 重写 | 同上 | 旧 command.register/@chips/ui CommandProvider 面（191+44 行） |
| 18 | rte-tests | 4 | 重写 | 同上 | card-persistence.test 301 断言旧打包面；e2e 23 行实测断言 resolveLaunchCardPath 旧载荷 |
| 19 | rte-raster | 3 | 废弃 | （空） | png/ico/icns 无登记位置（基线 6） |
| 20 | rte-config | 8 | 废弃 | （空） | 基线 5 同口径（logging 123 行与 mp 同源复制） |
| 21 | rte-proc | 18 | 归档 | （空） | template.json 12 行实测旧模板元信息 + 开发计划×4 + 归档/**12（旧命令 325、AppMenu、i18n×2、theme-runtime、技术手册旧版等）+ SOURCE.md |
| 22 | rte-doc | 10 | 保留设计 | 08-总览.md | README 47 + 技术手册×5 + 需求文档×4 → §十二吸收（09-目录 §7.2 引用列） |
| 23 | cc-svg | 1 | 迁移 | chips-ecosystem/plugins/apps/community-client | app-icon.svg 8 行，16-CC §8.1 仅登记 svg |
| 24 | cc-api | 11 | 重写 | 同上 | api/client.ts 225 行 `fetch(resolveApiUrl(...))` 实测 88/143 行——16-CC §2.2 定 `http:request` 链路；transfer.ts 334 行 client.communityCardTransfer.upload/openRemote/openRemoteBox+module.job 实测 133/174/202/230 行，16-卡片传输协议整面作废；server-config client.config/credential 旧词表；testing×2 chips-sdk/testing 旧 Mock |
| 25 | cc-pages | 22 | 重写 | 同上 | 页面/组件 grep：SettingsPage client.\*×14、WorkspacePage×4；9 个 .css 共 1588 行实测 wc 合计，违 16-CC §2.2「包根禁独立 .css」（03-插件包格式 §2.6）；路由语义由 §3.2 路由表全承接（含 /about、/@username、/admin）；ui.ts 123 行纯 helper 与 getWorkCoverStyle 旧 CSS 变量面混装整文件归 ui/lib 重建 |
| 26 | cc-shell | 12 | 重写 | 同上 | chips-client.ts 4 行实测 `createClient()`；AppShell 220 行 antd Result+AppChrome；messages.ts 246 key 层；scene-registry 34 脚手架面 |
| 27 | cc-tests | 5 | 重写 | 同上 | transfer.test 333 断言旧传输帧；server-config.test 49 旧注入面 |
| 28 | cc-manifest | 1 | 重写 | 同上 | 103 行；权限清单按 16-CC §8.1/§8.2（dialogs:use/credential:manage/network:http/…）重建，旧 ID 作废 |
| 29 | cc-probe | 2 | 废弃 | （空） | preview-smoke.js 58 + e2e 121 行实测断言 chipsdev-r scripts/quality gate 文案（uvf 同口径） |
| 30 | cc-config | 8 | 废弃 | （空） | 基线 5 同口径 |
| 31 | cc-raster | 3 | 废弃 | （空） | 基线 6 同口径 |
| 32 | cc-proc | 24 | 归档 | （空） | 归档/**23 行（i18n×2 各 302、旧 AppRuntimeProvider 239、旧命令 146、卡片/箱子详情页×5、脚手架基线场景×7、theme-runtime 等——本地查看职责移交卡片查看器，16-CC §2.3）+ SOURCE.md |
| 33 | cc-doc | 6 | 保留设计 | 16-社区客户端设计.md | 09-目录 §7.3 明文「新设计已入库（16 号子系统设计）」；技术文档 5 篇+索引语义由 §二~§九吸收；README 已由前轮行 1056 同落点裁决，合并核对一致 |

## 合并核对（前 14 行已裁决 + 本轮 252 行 = 266 行）

- 前轮 14 行分布（与库内实况核对一致，本轮零改动）：保留设计 5（MP 需求文档×4 + CC README）、迁移 3（MP app-icon.svg/default-cover.svg + RTE manifest.yaml）、废弃 3（MP raster×3）、归档 3（SOURCE.md×3）。
- 口径差异如实记录：前轮 2503/2508/3751 三行 target 带中文说明（非纯路径写法），verify 判「写法不校验/提示级」，不手改 DB 覆写；RTE manifest 判「迁移」（三插件矩阵口径）与本面 mp/cc manifest 判「重写」（四媒体矩阵口径）均为「字段级重建、旧 ID 作废」的同一裁决实质（09-目录 §7.3），维持各自存量。
- 本面 252 行全部：迁移/重写 target 为纯计划路径（规划中未落地·提示级）；保留设计 target 为现存文档库实体；废弃/归档 target 为空。

## 收口

- 验收①：`SELECT COUNT(*) FROM files WHERE owner='ledger-media-community' AND status='评估中'` = **0**。
- 验收②：stats/verify 状态计数 **已裁决 12,372 / 12,372**（待评估/评估中 0，无其他 owner 残留）。
- 全库 verify：本面 0 异常；现存 14 行幻想 target 均属他面（BookReader/EcoSettingsPanel/EditingEngine/Notes/Office），非本任务范围。
- 台账操作.log 本 owner 33 条 dispose-batch 留痕（2026-09-20 20:31）+ 前轮 claim/dispose 共 42 条。
- 交付矩阵：`项目日志与笔记/重构计划/旧功能覆盖矩阵-音乐富文本社区客户端-2026-09-20.md`。

**文档结束**
