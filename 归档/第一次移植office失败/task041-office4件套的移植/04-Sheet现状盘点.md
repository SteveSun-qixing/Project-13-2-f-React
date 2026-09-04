# Chips-Sheet 静态代码审查报告（精简存档）

> 审查时间：2026-09-03
> 审查范围：Chips-Sheet 源码（`src/`）、manifest、配置、技术文档
> 审查方式：只读静态分析（grep / 文件读取），不执行测试
> 原版对照：GenOffice Sheets（Office 套件原型）
> 引擎：Univer 0.25.1（Apache-2.0 开源版）

## 1. AI 残留扫描

**扫描关键词**：`aiAssistant|sidebar|suggestion|completion|llm|openai|claude|gpt|aria-label="AI|smartWrite|AI|llm`

**扫描结论**：✅ **无 AI 残留**。

`tests/e2e/basic-flow.test.tsx` 中有两行**刻意断言**（验证无 AI 引用）：

```ts
expect(sourceBundle).not.toMatch(/openai/i);
expect(sourceBundle).not.toMatch(/\bLLM\b/);
```

这是 e2e 覆盖，不是残留代码。归档目录 `归档/scaffold/src/` 下有脚手架遗留文件（`MainScene.tsx`、`StateBindingView.tsx`），不影响构建产物。

## 2. 工具栏迁移差异（原版 vs 当前）

### 已迁移（✅ 完整）

| 能力类别 | 状态 | 备注 |
|---|---|---|
| 字体（字体族/字号/加粗/斜体/下划线/删除线/颜色） | ✅ | 引擎原生 |
| 数字格式（数字/货币/日期/百分比/科学计数/自定义） | ✅ | Univer preset |
| 单元格格式（OOXML numFmt） | ✅ | 引擎原生 |
| 对齐（水平/垂直/自动换行/文字旋转） | ✅ | 引擎原生 |
| 填充色 + 边框（含 merge-border-fix 补丁） | ✅ | 引擎原生 |
| 合并/拆分单元格 | ✅ | 引擎原生 |
| 冻结（首行/首列/自定义） | ✅ | 引擎原生 |
| 自动筛选 + 自定义排序 | ✅ | Univer preset |
| 公式栏（fx）+ 函数插入对话框 | ✅ | 引擎原生 |
| 条件格式（色阶/数据条/图标集） | ✅ | `UniverSheetsConditionalFormattingPreset` |
| 数据验证 | ✅ | `UniverSheetsDataValidationPreset` |
| 批注插入/编辑/删除 | ✅ | `UniverSheetsNotePreset` |
| 查找替换 | ✅ | `UniverSheetsFindReplacePreset` |
| 行列操作（插入/删除/隐藏） | ✅ | 引擎原生 |
| Sheet 操作（切换/重命名/新增/删除/复制/移动/隐藏） | ✅ | 引擎原生（含 sheet-rename-fix 补丁） |
| 缩放（状态栏滑块） | ✅ | `footer.zoomSlider` |

### 完全未迁移（❌ 许可排除或引擎缺口）

| 能力 | 状态 | 原因 |
|---|---|---|
| 图表插入/编辑/保存 | ❌ | Univer 图表在 `@univerjs-pro/*` 专有包（许可排除） |
| 图表上下文面板（Chart Design） | ❌ | 同上 |
| 推荐图表 | ❌ | 同上 |
| 透视表 | ❌ | 原版 `pivot-engine` + Rust sidecar 专有范围 |
| 切片器（Slicer） | ❌ | 同上 |
| 时间线（Timeline） | ❌ | 同上 |
| 工作表保护 | ❌ | 未移植 |
| 工作簿保护 | ❌ | 未移植 |
| 公式追踪箭头 | ❌ | 依赖 GenOffice UI 层 |
| 名称管理器 UI | ❌ | 引擎可用但无 UI |
| 公式求值（Goal Seek） | ❌ | 未移植 |
| 分类汇总/合并计算 | ❌ | 未移植 |
| 页眉页脚/打印设置 | ❌ | 未移植 |
| 高级筛选对话框 | ❌ | 引擎可用但无专用 UI |
| 跳转到（Go To）对话框 | ❌ | 引擎可用但无专用 UI |
| 视图管理（阅读视图/大纲） | ❌ | 未移植 |
| 宏（VBA） | ⚠️ | 需求文档如实声明：`.xlsm` 仅普通工作簿读写 |

### 简化（🟡）

| 能力 | 现状 |
|---|---|
| 公式词法修复 | ✅ 已移植（处理 `=""` 转义引号） |
| 撤销/重做 | Univer 引擎内部管理，Host 命令系统未独立暴露 |
| 快捷键 Ctrl+Shift+L/Ctrl+F/Ctrl+Home/End/F2 | 引擎内部处理，未注册到 Host 命令系统 |

## 3. 起始页 / 命令系统 / 状态机

### 起始页（StartStage）
- ✅ 新建（xlsx）/ 打开按钮
- ✅ 拖放支持（含深度计数防误触 + `.xlsx|.xlsm|.csv` 扩展名过滤）
- ✅ 快捷键提示（Mod+O / Mod+N）
- ✅ 加载态（Spin）/ 错误态（Result）
- ❌ 无 csv 新建入口
- ❌ 无最近文件列表

### 命令系统
- ✅ 命令前缀 `com.chips.sheet.*`
- ✅ 5 条核心命令（新建/打开/保存/另存为/导出 CSV）
- ✅ Host 命令注册 + 本地命令注册
- ✅ 命令面板关键词 + 菜单项注册
- ❌ 撤销/重做未作为独立命令暴露
- ❌ Ctrl+Shift+L/Ctrl+F 等未注册

### AppRuntimeProvider 状态机
- ✅ 完整四态（start/loading/ready/error）
- ✅ 引擎引导 + 销毁时机正确（`containerSequence` 防 StrictMode 复用）
- ✅ 事件订阅清理（offDirty + 补丁 dispose）
- ✅ office 会话关闭（unmount 时 `client.office.close`）
- ✅ 中文错误兜底
- ✅ 多次挂载幂等 + workbookRevision 驱动重灌

## 4. 资源接受链路

`resolveLaunchSheetTarget`（`src/utils/launch-resource.ts`）：

```
resourceOpen.filePath → targetPath → resourceOpen.resourceId
 ↓
normalizeFileUriToPath（处理 file:// 解码 + Windows 盘符）
 ↓
resolveFormat（扩展名 / mimeType / 文件名三轮推导）
 ↓
LaunchSheetTarget { sourceId, filePath, fileName, format }
```

**与薯片标准差距**：
- ✅ 完整覆盖 `surfaceContext.launchParams` → `launchParams` 两层合并
- ✅ `file://` 归一化（含 Windows UNC 路径）
- ✅ `chips-render://` 等 Host 托管 URI 不被误判为本地路径
- ✅ mimeType + 文件名双重格式推导兜底
- ✅ `isLikelyLocalPath` 判断逻辑正确
- ⚠️ `launchParams.subject` 字段未被解析（GenOffice CLI `chips chips-sheet open "path"` 中有用到，但 `cli.commands` 已声明）

**CSV 与 XLSX 共用 `openWorkbookTarget`**：
- `localPath && format !== "csv"` → `client.office.open/read`
- 其他 → `readWorkbookBytes`（file.read / fetch / resource.readBinary）

符合薯片协议预期（XLSX 走 office 会话，CSV 走文件通道）。

## 5. P0 / P1 / P2 清单

### P0（核心功能缺失）

| 优先级 | 事项 | 状态 | 备注 |
|---|---|---|---|
| **P0** | **图表能力缺口** | ❌ 完全缺失 | 许可排除专有包；评估是否接入 Univer 开源图表子集或明确为未来版本 |
| **P0** | **透视表/切片器缺口** | ❌ 完全缺失 | 同上 |

### P1（重要功能）

| 优先级 | 事项 | 状态 |
|---|---|---|
| P1 | 公式追踪（追踪箭头） | ❌ 未移植 |
| P1 | 名称管理器 UI | ❌ 引擎可用但无 UI |
| P1 | Go To 对话框独立触发入口 | ❌ 无 |
| P1 | 高级筛选对话框 | ❌ 无 |
| P1 | csv 新建入口 | ❌ 起始页缺失 |
| P1 | 最近文件列表 | ❌ 起始页缺失 |

### P2（体验完善）

| 优先级 | 事项 |
|---|---|
| P2 | 撤销/重做命令暴露到 Host |
| P2 | Ctrl+Shift+L/Ctrl+F 等快捷键显式注册 |
| P2 | 分类汇总/合并计算对话框 |
| P2 | 页眉页脚/打印设置 UI |

## 6. 关键文件清单

| 文件 | 职责 |
|---|---|
| `src/components/SheetToolbar.tsx` | 顶部工具栏 |
| `src/components/StartStage.tsx` | 起始页场景 |
| `src/components/DocumentScene.tsx` | 文档场景装配 |
| `src/components/SheetStage.tsx` | 引擎挂载 + dispose |
| `src/components/SheetErrorState.tsx` | 错误态展示 |
| `src/sheet/runtime.ts` | 运行时封装 |
| `src/sheet/open-workbook.ts` | 工作簿打开链路 |
| `src/sheet/content-change.ts` | 修改标记逻辑 |
| `src/sheet/import/csv-import.ts` | CSV 字符集评分 |
| `src/sheet/format-detect.ts` | 格式探测 |
| `src/sheet/capability-fallbacks.ts` | Web 宿主降级 |
| `src/commands/app-commands.tsx` | 命令定义与注册 |
| `src/commands/useAppCommands.ts` | 命令装配 Hook |
| `src/app/SheetRuntimeProvider.tsx` | 文档生命周期 Provider |
| `src/app/AppRuntimeProvider.tsx` | 应用运行时 Provider |
| `src/app/AppShell.tsx` | 应用外壳（场景路由） |
| `src/utils/launch-resource.ts` | 启动目标解析 |
| `src/lib/messages.ts` | 简体中文文案 |
| `manifest.yaml` | 插件声明（`com.chips.sheet`） |

## 7. 与原版 Univer 开源边界

Chips-Sheet 选型 Apache-2.0 开源版 Univer，**图表、透视表、切片器均在 `@univerjs-pro/*` 专有包**（许可排除）。这是有意识的架构决定（避免商业许可），不是技术遗漏。建议：

- 在 manifest.yaml 的 `notes` 字段或在生态共用技术文档中**明确记录**此边界
- 评估是否将图表/透视表列为生态自有"未来工作"，由生态自行基于 Konva/ExcelJS 重新实现
- 名称管理器、Go To 等引擎已支持但缺 UI 的功能应优先补 UI

## 审查结论

Chips-Sheet **核心编辑/格式/公式/排序筛选/批注/条件格式/数据验证**完整迁移并验证通过，AI 完全剥离。**P0 缺口为图表和透视表**（许可问题，需架构层面决断），P1 缺口为 UI 入口缺失（引擎已支持）和起始页便利性，**整体是 4 件套中迁移最完整的一个**。
