# W5 迁移：万能查看器（chips.official.universal-file-viewer）引擎迁移臂（三段式第③段）开发日志

> 日期：2026-10-01
> 任务：派单行表 #1 引擎迁移臂——viewer-engine 整目录迁移 + MIT 许可随迁 + shims 适配 + G-3 依赖许可逐项登记；壳层不实现（另臂），AppView 保持骨架可用态。
> 包：`chips-ecosystem/plugins/apps/universal-file-viewer/`（分支「第五次重构」，全程零 git 写操作；命令一律 `npx -y pnpm@9 <cmd>`；安装持目录锁 `/tmp/w4-lockguard`）
> 母型：book-reader 引擎迁移判例（`src/engine/` + `src/domain/` + `env.d.ts`）、video-player 包级四闸纪律、W4-B1 夹具纪律。

---

## 一、交付清单（矩阵行 × 落点）

| 矩阵行（四媒体查看器仓 §三） | 判定 | 落点 | 说明 |
|---|---|---|---|
| 预览引擎核心（viewer.ts:1660、detect.ts:557、types.ts、index/support/dom、optional-modules.d.ts） | 迁移 | `src/engine/`（viewer/detect/types/support/dom/index） | 逐行保真迁移；`optional-modules.d.ts` 仅含 `@mlightcad/*` declare（GPL 链），随 DWG 剔除一并废弃；`env.d.ts` 补 `vite/client` 引用 |
| 24 格式插件 + 5 Prism 语法包 | 迁移 | `src/engine/plugins/`（24 文件 + prism-languages/5） | 搬运时移除 DWG 入口（见 §三.2）；Prism 语言包原样随迁 |
| 许可声明（LICENSE.open-file-viewer） | 迁移 | `src/engine/LICENSE.open-file-viewer` | MIT 版权文本随目录保留（《第三方参考资产清单》§4.4 基线样例路径已同步更新） |
| shims 类型声明（archive/heic/text/gis.d.ts） | 迁移+适配 | `src/engine/shims-*.d.ts` | 消点 `any`（GeoJSON 结构类型/MarkedOptions/prismjs 最小面）；`optional-modules.d.ts` 随 DWG 链废弃不迁 |
| 装载与归类（utils/{file-kind 93,engine-plugins 50,open-targets 14}） | 迁移 | `src/domain/{file-kind,engine-plugins,open-targets}.ts` | 零 client 触达纯逻辑保真迁移；`engine-plugins` 的 pdf worker `?url` 接线保留 |
| 资源读取投递（source-loader/launch-resource） | 重写（壳臂） | —（本臂不涉及） | 按《14-契约》resourceOpen.uri + 句柄重建，候 `resource:open` 路由 |
| 引擎 UI 层（style.css:5998、messages.ts:214） | 重写（本臂承担 messages 部分） | `src/engine/messages.ts` | R4 样式不迁移（壳臂 token 化重建）；messages 按 R5/task030 重写为简体中文直写单语表 `engineMessages`，去 locale/en 双语层与 `PreviewLocale`/`PreviewTheme` 类型面，`viewer.ts` 工具栏文案表同步单语化 |
| DWG 解码（cad-dwg.ts:898、cad-webgl.ts:186） | **废弃** | 不迁移 | GPL 链整体剔除；`cad.ts` 移除 `webglDwg`/`libreDwg` 选项与渲染分支，保留 `binaryRenderer` 通用扩展点与 DWG 元数据兜底卡（`renderBinaryCad` 本就内联在 cad.ts） |
| 微前端沙箱兼容层（sandbox-compat.ts:95） | **废弃** | 不迁移 | `viewer.ts` 移除 `ensureSafeAsyncScheduling` import 与调用（薯片生态无微前端运行时，AGENTS 红线） |

引擎 43 文件（根 13 + plugins 25 + prism 5）+ 领域 3 文件全部落位；`renderBinaryCad`、`parseBinaryOasis` 等 DXF/OASIS 矢量渲染路径完整保留。

## 二、G-3 依赖许可账（开工前置，先登记后入 package.json）

26 个运行时依赖逐项核验（npm registry 对钉定版本的 license/dist 元数据，2026-10-01）并登记于《第三方参考资产清单》§2.12「源码移植随行运行时依赖登记（RA-08 引擎依赖集，uvf G-3）」：

- **结论：26 项全部宽松许可**（MIT / Apache-2.0 / BSD-2-Clause / ISC / MIT-0 / Zlib），GPL/LGPL/AGPL 零命中；双许可包取宽松分支（jszip 取 MIT、dompurify 取 Apache-2.0）；逐项批准按移植钉定版本引入；
- 版本钉定与旧仓一致（three 0.184.0、pdfjs-dist 4.10.38、mermaid 11.16.0、xlsx `npm:@stackline/xlsx@1.0.6` 等），全部经动态 `import()` 按格式懒加载，不进插件首屏包体（RA-08 风险③红线保持）；
- **登记外裁决两条**：`@mlightcad/*`（GPL 系）不引入并随代码剔除；`mpegts.js`（FLV/mpegts 可选增强）保持运行时探测、不占依赖位（`import(/* @vite-ignore */ packageName)` 缺位诚实降级，原 `new Function` 动态导入逃逸一并替换为正规写法）；
- 开发依赖补 `jsdom` 与 5 个 `@types/*`（leaflet/pako/prismjs/three/topojson-client，均非运行时面）；
- 安装持目录锁执行 `npx -y pnpm@9 install`，lockfile 新增 1557 行（26 依赖入 importer），`--prefer-offline` 复核收敛 Done in 872ms。

## 三、迁移保真修复与类型面适配（判迁移 ≠ 复刻缺陷）

1. **沙箱垫片剔除**：`sandbox-compat.ts`（qiankun/wujie/garfish 探测 + setImmediate 垫片）整体废弃，`viewer.ts` 两处调用点收口。
2. **DWG 入口移除**：`cadPlugin` 选项面收窄为 `binaryRenderer`；DWG 命中后走元数据兜底卡（《03-设计》§8.3「上游许可证不允许的能力不声明」），DXF 矢量/STEP/IGES/GDS/OASIS 路径不动。
3. **单语化**：`messages.ts` 重写（`engineMessages` 简中直写 + `resolveMessages` 合并覆盖项 + `formatPreviewMessage` 占位渲染），`types.ts` 去掉 `PreviewLocale`/`PreviewTheme` 与 `locale`/`theme` 选项；工具栏 `defaultToolbarText` 收敛为单中语文案表；`isBuiltInToolbarAction` 基线同步。
4. **严格基线全量通过**：生态基线的 `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`/typechecked ESLint 对 3.4 万行引擎首次全量生效——修整 569 处 typecheck（索引读面以非空断言保持原运行时语义、可选属性类型面补 `| undefined`、函数式可选属性括号化修复）、827 处 lint（`--fix` 自动消点 550 处断言类、`textOf`/`errorToText` 兜底化 40 处字符串化面、二进制控制字节正则 7 处按行注解豁免、dead code 2 函数删除）。旧仓对 viewer-engine 本就豁免 lint 且 tsconfig 无这两项增量严格旗标，本轮为移植代码首次对齐生态基线，运行时语义保持（断言类修整不改变取值路径）。
5. **错误归一收口**：`String(error || "")` 类未知错误字符串化统一为 `errorToText`/`textOf` 兜底（Error 取 message、字符串直取、标量字符串化、其余走兜底），消除 `[object Object]` 漏出面。

## 四、测试（先测后码，真实夹具）

`tests/` 4 文件 54 用例（骨架 app/commands 用例保留，合计 59 用例全绿）：

- `engine-detect.test.ts`（16）：G-4 MIME 总表 36 格抽查、真实字节装载（PNG 签名/PDF 序列/ZIP 头/URL 取名）、UTF-8/BOM/UTF-16LE/GB18030 真实字节解码、`isTextLike` 归类、`escapeHtml`/`resolveFormat`；
- `engine-plugins.test.ts`（22）：18 格式插件逐一以最小合法真实样本断言 match 路由（PNG/WebP/MP4 ftyp/MP3 ID3/%PDF/EPUB/XPS/OFD/DOCX/XLSX/OLE/RTF/CSV/ZIP/7z/7Z 头/GZIP/EML/MBOX/DRAWIO/EXCALIDRAW/XMIND/DXF/DWG/STEP/GLTF/STL/GEOJSON/TTF 00010000/PSD 8BPS/PARQU1/TXT/MD/LRC/未知 fallback），装配表顺序锁测、DWG 解码链路零残留断言、`isPreviewableTarget` 预判；
- `engine-parse.test.ts`（10）：LRC 逐字/多时间轴真实歌词解析、ZIP 真实字节（jszip 产物签名+条目枚举+中文条目读回）、真实 eml（multipart + base64 附件字节）、最小合法 xlsx（XLSX.write 产物 PK 签名 + 单元格 v/w/!merges/!ref 引擎读取契约）、文案与缩放钳制；
- `file-kind.test.ts`（5）：矩阵迁移判例（file-kind.test.ts:48）随迁。
- 测试素材规范（四媒体 G-5）：全部夹具为测试内构造的真实字节，零外部素材路径依赖，零 `ProductFinishedProductTestingSpace` 触达。

## 五、验证（亲跑，2026-10-01）

- `pnpm --filter @chips/plugin-universal-file-viewer run test`：**6 文件 59 用例全绿**；
- `typecheck`：0 错误（基线严格旗标全量生效）；
- `lint`：0 错误 0 警告；
- `build`：`dist/index.js` 0.22 kB + `render.js` 10.17 kB（引擎为按需懒加载库面，不入骨架 render 入口；vendor 外部化红线通过）；
- FORBIDDEN_ANTD_EXPORTS 词界双验：A 面 antd/`@chips/antd` 导入零命中；B 面 28 名命中 `Layout`（注释「Split Layout UI」1 处）、`message`（MIME 类型串/error.message/文案占位键 91 处）、`modal`（OASIS `modal: Point` 结构字段 3 处）、`version`（二进制版本局部变量/lrcVersion 文案键 49 处）——全部为四类误报源（载荷字段/局部变量/MIME 串/注释），零组件触达；
- TODO/FIXME 零命中；manifest.yaml 零改动；旧仓 `Chips-UniversalFileViewer` 零改动（只读冻结复核）；未跑 `gates:all`（按派单约束）。

## 六、边界与后续（候另臂/候波次，不代裁）

1. 壳重写臂：应用壳/工具栏/兜底信息卡按《03-查看器设计》§8.4 重建，引擎样式 token 化（R4），`resource:open` fallback 注册与 >8MiB readRange/stream 投递按《15-文件处理契约》§五落地；
2. G-1（Office/PDF 自包含预览 vs `content-office.*` 分层口径）与 G-4（detect.ts MIME 表生态单一事实源收编）维持候裁登记，本臂不动兜底边界；
3. `AppView` 保持骨架可用态（ChipsProvider + CommandProvider + 命令演示区），命令注册面与 manifest 逐字对应关系未动。
