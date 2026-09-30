# W5 迁移：图标工坊（chips.official.iconmaker）业务迁移开发日志

> 日期：2026-10-01
> 任务：W5 派单行表 #6（三段式第③段——业务迁移；骨架已就绪，骨架包四闸绿）
> 独占目录：`chips-ecosystem/plugins/apps/icon-maker/`；分支「第五次重构」，零 git 写操作
> 依据：《W5开工前置-应用族逐仓勘查-2026-10-01.md》行表 #6、《旧功能覆盖矩阵-SDK与工具类-2026-09-20.md》§三、
> 《13-命令系统契约》《07-CLI完整参考》§5.1/§5.3/§5.6、《02-插件清单规范》§六（权限限定值）
> 母型：`plugins/services/file-conversion`（planner 逐字迁移判例 + 迁移适配头注口径）

---

## 一、交付清单（全部落包，四闸绿）

### 1. 领域层（旧 `src/icon-workbench/` 11 模块逐字迁移 → `src/domain/`，含 2 件旧测试随迁改写）

| 模块 | 迁移口径 |
|---|---|
| `binary.ts` / `crc32.ts` / `file-names.ts` / `zip-store.ts` / `ico.ts` / `icns.ts` | 逐字迁移，零语义差 |
| `types.ts` | 逐字迁移；登记适配 1 处：`IconBackgroundSelection.labelKey`（i18n key）→ `label`（简体中文直写），i18n/messageKey 机制随 task030 作废（矩阵 §三 messages.ts 行「保留设计」口径） |
| `canvas-renderer.ts` / `generator.ts` | 逐字迁移；登记适配 2 处：`fillBackground`/`resolveImageBox`/`resolveBaseName`/`resolveIcnsType` 由模块私有改具名导出——渲染数学以真实输入输出断言直测（渲染数学不 mock），分支与数值边界逐字一致 |
| `image-loader.ts` | 逐字迁移（浏览器窗口内侧装载面） |
| `default-fonts.ts` | 逐字迁移 + 登记适配 2 处：①码位表资产 URL 改自包根解析、非字面量构造（含 `/* @vite-ignore */`），避免构建期把包内资产改名复制，正式资产路径以 `assets/fonts/...` 单一来源收口；②新增 `registerMaterialSymbolsFontFaces` 替代旧 `app-shell.css` 的三套 @font-face（硬编码 CSS 已禁），窗口挂载时经 FontFace API 注册同一组包内 woff2，失败族名如实回报 |

### 2. filesystem 臂（旧 CLI 臂重写面收编，`src/export/`）

- `iconSave.ts`：`file:mkdir`/`file:write` 正式能力链落盘；任一步失败如实返回 `{status:'failed', errorCode, writtenPaths, message}`，禁假成功；`iconBytesToBase64`（分块）/`joinOutputPath`/`resolveErrorCode` 纯函数随测。
- `source-image.ts`：`file:read`（base64）→ `File` → 领域装载链；`inferMimeType`/`inferFileName` 自旧 `cli-runner.ts`（重写面）收编；能力拒绝原样上抛，零旁路兜底。

### 3. 命令系统（骨架样板命令 → 业务命令，按《13-命令系统契约》）

- `appCommands.ts`：注册 `iconmaker:generate`（ui 目标 + `handlerId: 'generate'`，与契约 §八完整示例同 ID 同口径：标题「生成图标」、快捷键 `CommandOrControl+Alt+G`、`paramsSchema` source/outputDir/overwrite、group「导出」）；骨架样板命令 `open-card`/`refresh-view`（脚手架模板生成物）随业务重写移除，manifest `cli.commands` 同步换登 `iconmaker:generate` 单入口（commandPath `[iconmaker, generate]`、`mapsTo: source` path 参数、`output: json`）。
- `useAppCommands.ts`：保持骨架装配顺序（`command:register` → `runtime.attach` 本地处理器 → 卸载 `command:unregister`），处理器经 `AppCommandHandlerContext.generate` 注入窗口生成执行入口；Bridge 不可用收敛 `phase:'error'` + `SDK_BRIDGE_UNAVAILABLE`，不阻塞工作台。
- CLI 任务臂（`cli:task-active/progress/complete/fail` 上报）按派单口径**登记不实现**：CLI 侧以 `command:invoke` 结果收口任务（07-CLI参考 §5.3.2），候 `cli:task-*` 接线波回填。

### 4. UI 壳层（旧 IconMakerScene 业务重写，`src/ui/AppView.tsx`）

- 全部组件取自 `@chips/ui`（antd 白名单转发面 + icons 再导出）：Segmented/Card/Collapse/Checkbox/Radio/Input/Button/Flex/Typography/Alert；文案简体中文直写（旧 messages.ts 中文资产逐条直写入界面，messageKey 机制不迁移）。
- 功能面：来源双模式（上传图片拖拽区 / 图标字体三源切换 + 字形网格 + 前景色板 + 背景八预设）、高级设置（输出格式、七档尺寸、适应/填充、自定义字体上传）、实时预览（Canvas）+ 输出目录 + 「生成并写入目录」诚实落盘 + Alert 反馈 + 命令通道状态行。
- 禁面遵守：`ColorPicker` 零触达——取色 GUI 候第十二项，仅提供常用色板（前瞻登记不实现）。

### 5. 资产（从素材仓单一来源复制，非旧仓拷贝）

- 字体 5 件（`assets/fonts/material-symbols/`）：woff2 ×3 + Rounded codepoints（母本 `design-assets/material-symbols/variablefont/`，阶段04任务09冻结提交 `caeba1e6`）+ `SOURCE.md`（上游/锁定提交/授权 Apache-2.0/使用边界，随迁改写）。
- 图标 5 件（`assets/icons/`）：`app-icon.svg/.png/.ico/.icns`（母本 `design-assets/Appicon/IconMaker.*` 同批次产物）+ `SOURCE.md`；`manifest.ui.launcher.icon` 按 SOURCE 边界改指 `app-icon.svg`，脚手架占位图标 `app.svg` 移入 `chips-ecosystem/归档/W5图标工坊-脚手架占位启动图标-20261001/`（禁删除→就近归档）。
- 测试夹具：`tests/fixtures/material-symbols-codepoints-sample.txt`（真实 codepoints 文件切片 40 行 + 空行 + 非法行，解析断言逐条比对真实码位 `10k→U+E951`、`favorite→U+E87E`、`home→U+E9B2` 等）。

### 6. manifest 变更（第③段权限随业务补齐，A组初始化日志 :53 预告口径）

- permissions：`command:write`/`command:execute` 保留（命令注册/派发），新增 `filesystem:read:${userHome}`、`filesystem:write:${userHome}`——按《02-插件清单规范》§6.2/§6.3 filesystem 域**路径限定必需**（`${目录变量}` 文法，变量表见 08-权限系统设计 §7.3）；最小范围权衡：图标工坊输入/输出均为用户指意路径（CLI `~/图片/示例.png`、输出目录自由填写），`${userHome}` 为覆盖用户指意面的最小单一作用域，窄化拆分反而使任意子路径输入失权。
- launcher icon 改 `assets/icons/app-icon.svg`；cli.commands 换登 generate 入口。

## 二、测试（先测后码，56 用例 / 8 文件全绿）

| 文件 | 覆盖 |
|---|---|
| `tests/domain/icon-encoders.test.ts`（旧件随迁扩写） | CRC-32 标准向量（`123456789→0xCBF43926`、fox→`0x414FA339`、空→0）+ 真实 PNG 头夹具逐字节值；ICO 目录逐字段读回（升序、256 宽高字节 0、载荷偏移、超 256 拒绝）；ICNS 大端长度域 + 多条目总长守恒；ZIP Store 本地头/CRC/中央目录/EOCD 逐字段读回 + 总长守恒 + 空归档；文件名归一边界 |
| `tests/domain/canvas-renderer.test.ts`（旧件随迁扩写） | 适配盒真实数值（fit 横/方/竖、fill 横/竖、零尺寸下限）；背景填充决策（渐变双端色标/纯色/同色渐变）；渲染编排（图片模式不画背景、字体模式 62% 字号居中、CANVAS_UNAVAILABLE、PNG_ENCODE_FAILED）——画布桩只记录调用事实，渲染决策全走真实实现 |
| `tests/domain/default-fonts.test.ts` | 真实码位夹具逐条断言 + 非法行跳过；精选 36 字形表；Emoji 区间全域归属校验；私用区字形连续性 |
| `tests/domain/generator.test.ts` | 命名清洗（`Star Rise!→starrise`、纯中文→icon）、ICNS 类型阶梯、MIME 映射、来源支持判定（File 真实构造）、路径 MIME/文件名推断 |
| `tests/export/iconSave.test.ts` | base64 编码（含 >64KiB 分块）、落盘成功清单、**诚实降级三态**（能力拒绝→failed+错误码、次文件失败保留已完成清单、非 ChipsError 收敛 `ICON_SAVE_UNKNOWN_ERROR`）、读取臂三类如实上抛 |
| `tests/commands.test.ts`（骨架件随业务改写） | 元数据 JSON 往返、命名空间/域校验、(commandId, handlerId) 配对派发、生成拒绝上抛、归属守卫 |
| `tests/app.test.ts`（骨架件原样保留） | launch 设窗标题 |
| `tests/ui/AppView.test.tsx` | jsdom 真实渲染链：工作台骨架与生成按钮禁用态、Bridge 缺席→「命令通道：命令通道异常（SDK_BRIDGE_UNAVAILABLE）」不阻塞工作台、无 2D 上下文→「预览生成失败。」诚实呈现 |

测试环境说明：vitest 切 `jsdom` + `tests/setup.ts`（matchMedia/ResizeObserver/createObjectURL 平台面补齐 + `IS_REACT_ACT_ENVIRONMENT`），配置形态与 W5 同批 photo-viewer 包一致；antd 运动组件树与异步 `act` 存在定时器等待，挂载用同步 `act`、异步回执以真实宏任务时钟冲刷（测试文件头注登记）。新增 devDependency 仅 `jsdom@28.1.0`（与 `packages/ui`、photo-viewer 同版本在册）。

## 三、验证（亲跑实录，`npx -y pnpm@9`，包内四闸）

| 闸 | 结果 |
|---|---|
| typecheck（`tsc -p tsconfig.json --noEmit`） | 0 错 |
| lint（`eslint src tests`） | 0 错 0 警 |
| test（`vitest run`） | 8 文件 56 用例全绿 |
| build（vite main + render） | `dist/index.js` 0.21 kB；`render.js` 38.85 kB / gzip 12.36 kB；零资产改名复制（码位表/woff2 以运行时包内相对 URL 引用，`grep render.js` 实证） |

补充验证：

- **禁面扫描**（#256 词界双验口径）：A 面 antd/@chips/antd 直接导入 0 命中；B 面 28 禁名词界扫描仅 `message` 一名 15 处，逐条溯源全部为 `IconSaveResult.message` 载荷字段与 antd `Alert` 组件 prop（许可类别），`ColorPicker`/`InputNumber`/`Tree` 等其余 27 名 0 命中；TODO/FIXME/占位 0 命中。
- **清单五阶段**：`chips plugin validate` 对包根目录态报 `CPK_LAYOUT_INVALID`（目录态要求包根形态，按提示改暂存目录验证）；构造无 codepoints 的暂存包实跑五阶段——结构/清单校验**通过**（权限限定值与 CLI 入口过闸），仅 `.codepoints` 资产被 layout 阶段拒绝 → 升工单065。

## 四、工单与文档随动

- **新增工单065**（`项目日志与笔记/工单065-打包器资产扩展白名单缺codepoints/`）：`packages/cli/src/artifacts/cpk-validate.ts:75` 与 `packages/host/src/loader/validate.ts:86` 的 `ASSET_EXTENSIONS` 缺 `.codepoints` 登记，分发态打包被拒（矩阵裁决资产、上游母本正名）。暂行处理零绕过：不改名 `.txt`、不代改两包校验语义；分发态打包挂账。
- **文档更新**：《09-官方插件与应用目录》:228 iconmaker 行翻正「已迁移」，补 manifest 实权限（含 filesystem 限定值）、CLI 任务登记不实现与工单065/工单061 挂账口径、实现路径；包 README 重写为业务实态（功能面/目录结构/已登记缺位）。
- **归档**：脚手架占位启动图标 `app.svg` → `chips-ecosystem/归档/W5图标工坊-脚手架占位启动图标-20261001/`。

## 五、遗留挂账（零绕过，全部在册）

1. **落盘臂/命令域宿主处理器**（工单061 同源）：`file:read/write/mkdir`、`command:*` 处理器未注册——UI 以错误码与「命令通道异常」如实呈现，预览与生成不受影响；处理器落波后零改动回填。
2. **CLI 任务臂**：`cli:task-*` 进度上报按派单口径登记不实现，候接线波。
3. **分发态打包**：工单065 收口后 `chips plugin pack` 即可携带码位表资产。
4. **取色 GUI**：候第十二项裁定（`ColorPicker` 禁面），当前仅常用色板。
5. **骨架样板命令移除说明**：`open-card`/`refresh-view` 为脚手架模板生成物（`tools/scaffold/src/templates/app.ts` 同款样板），业务重写以 `iconmaker:generate` 单命令替换；若裁定模板样板命令形态需调整，归脚手架独占面另行派单。
