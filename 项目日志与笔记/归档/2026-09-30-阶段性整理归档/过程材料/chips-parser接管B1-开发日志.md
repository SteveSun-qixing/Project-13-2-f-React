# chips-parser 接管 B1 路（任务 #55）开发日志

接管说明：A 路（存量错面修复 + cache/schema 落地）已验收提交后，本路（B1）只做 `src/view.rs`（视图投影层）；`parser.rs` 归后续 C 路，本路未触碰。

## 阶段 0：文档与上游事实源盘点（2026-09-20 20:04 前）

- 内容：
  1. 读《核心接口规范》分册 03.06 §6.6：`build_document_view(handle, session) -> Result<DocumentView, ChipsError>` 签名与 `DocumentView = CardRenderView | BoxRenderView`、`TagView = string | string[]`、`CoverView{entry,ratio}`、`EntryView`、`BoxCoverView` 视图类型逐字登记（§6.6 为正式定义处）；确认 `BaseCardView` 由帧运行时在 TS 侧按节点组装（《渲染引擎设计》§2.5 约束 2），不在 Rust 视图层导出。
  2. 读《05-渲染引擎设计》§2.5/§2.6：渲染只读投影规则——只字段投影与不透明值保留、不读资源字节、不拼资源 URI、无自有缓存、同一句柄同一 `revision` 输出确定、`revision: number` 语义与封面入口/比例缺省（`3:4`）。
  3. 读《06-文档解析器设计》§5.1/§5.2（惰性层级、DocumentHandle 公开面）、§11（模型）、§12.2（值映射）；《箱子文件格式》§6（`layout_configs[active].props` 投影路径与「配置项不存在按空配置渲染」缺省语义）；《基础卡片插件接口》§3（`content` = 内容 yaml 解析结果根映射、不透明值顺序稳定）。
  4. 读 A 路已验收事实源代码：`model/`（`DocumentMetadata`/`StructureModel`/`ContentNode`/`Entry`/`Tag`/`DocumentValue`、`DocumentRevision::revision_number()`——A 路注释已点名「视图投影用的数值修订（§6.6 revision: number）」，本路据此取修订号）、`cache.rs`（`ParsedUnit::LayoutConfig` 证实布局配置为既有 L2 单元）、`error.rs`（`DocumentError::to_chips_error` 归一面）、`schema/` 风格基准。
- 证据：`df -h /` → 9.0Gi 可用；基线 `cargo check -p chips-parser` → EXIT=101、`error[` 计数=2（parser+view 两个 E0583），/tmp/pcheck_b1_baseline.log。

## 阶段 1：view.rs 落地（2026-09-20 20:04–20:2x）

- 内容：新建 `crates/chips-parser/src/view.rs`（约 560 行，含 8 项单元自测），实现 lib.rs:67 声明的全部 9 个导出符号：`build_document_view`、`DocumentView`、`CardRenderView`、`BoxRenderView`、`CardNodeView`、`EntryView`、`CoverView`、`BoxCoverView`、`TagView`。输入侧只依赖 model/source（经 model 再导出）/error/chips-core（`SessionId`/`ChipsError`）既有公开面与 `parser::DocumentHandle`（§6.3 访问器面）。
- 关键设计决策（均有文档依据）：
  1. `kind` 判别投影：`DocumentView` 以 `#[serde(tag = "kind")]` 内部标签枚举输出 `{kind:'card'|'box', ...}`，与 §6.6 TS 联合类型序列化形状逐字同构；`BoxCoverView` 独立携带 `kind: &'static str = "box"`。
  2. 不透明值保留：`content`/`layout_config`/`snapshot`/`layout_hints` 直接持 `DocumentValue`（映射 TS `Record<string, unknown>`），不走 `serde_json::Value`——工作区 `serde_json` 未开 `preserve_order`，经其中转会破坏「不透明值顺序稳定」承诺（《基础卡片插件接口》§3 约束 4）。
  3. 修订号：`handle.revision().revision_number()`（§6.6 `revision: number` 的确定性投影，A 路预留接口）。
  4. 层级可见性：构建触达 L1/L2 依赖层（卡片 metadata→structure→逐节点 content；箱子 metadata→entries+布局单元），永不触达 L3；`§8.4` 部分成功路径下占位模型进入投影，非致命诊断不阻断。缺省投影语义：`cover_ratio` 缺省 `3:4`；布局 `props` 缺失/单元不可得 → 空映射；内容单元不可得 → `content` 空映射、`card_type` 回退结构声明值；`EntryView` 可选字段缺省不序列化（TS `?` 对齐）。
  5. `session: SessionId` 用途：视图内容不依赖 session（§6.6 规则 5 确定性），仅作为失败路径 `ChipsError.details` 的关联上下文并入（跨边界排障），签名逐字保持文档形态。
- 编译闸口调试（重要工程发现）：`parser` 模块 E0583 时，若 view.rs 直接对句柄返回值做无标注推断，rustc 会以 `{type error}` 泄漏出 E0282/E0308/E0277 连带错误（首轮实测 12 errors）。解法：所有句柄取回值统一经 `project_document_view(handle, metadata, revision, session)` 的**类型化参数边界**进入投影逻辑（参数标注即对 C 路的接口契约），错误连带全部收敛为 0；`map_fatal` 泛型返回标注同理钉死层级类型。
- 证据：见阶段 2。

## 阶段 2：真实工作区验收闸口（2026-09-20 20:3x）

- `cd packages/core-rust && cargo check -p chips-parser > /tmp/pcheck_b1.log 2>&1; echo EXIT=$?` → **EXIT=101**；`error[` 计数=**1**（仅 lib.rs 对 `parser` 的 E0583，C 路范围）；`^warning` 计数=**0**。
- `cargo clippy -p chips-parser > /tmp/pclippy_b1.log 2>&1; echo EXIT=$?` → **EXIT=101**；`error[` 计数=1（同上）；`warning` 计数=**0**（A 路曾出现的 duplicate_mod 提示本轮未出现，属同源事实的连带表现，非 view 侧输出）。
- lib.rs 未做任何修改（导出行与现有符号名天然对齐）。

## 阶段 3：隔离副本真实运行验证（2026-09-20 20:4x，仿 A 路惯例，不触碰真实工作区）

- 内容：将 core-rust 工作区配置 + `chips-core` + `chips-parser` 复制到 `/tmp/pb1_verify`，**仅在副本中**新建契约桩件 `parser.rs`（按 §6.2/§6.3 最小 `DocumentHandle` + 本路新增的 `layout_config()` 布局单元访问器），并附带 3 项端到端装配测试（卡片全链、缺内容单元致命归一携 session、箱子布局单元缺失归一 + props 生效投影 + BoxCoverView 收缩）。`CARGO_TARGET_DIR=/tmp/pb1_target`。
- 证据：
  - `cargo test -p chips-parser --lib --offline` → EXIT=101，86 passed / 13 failed（/tmp/pb1_isolated_test.log）：**`view::tests` 全部 8 项通过**；13 项失败中 12 项与 A 路遗留清单逐条吻合（digest×2、archive×4、inflate×3、directory×1、yaml×1——存量功能缺陷，非本路范围），第 13 项为副本桩件测试自身的取值笔误（clone 后改临时值），修正后 `cargo test --lib view_end_to_end` → **EXIT=0，3 passed**（/tmp/pb1_isolated_test2.log）。
  - 副本 `cargo clippy -p chips-parser --offline` → EXIT=0；**view.rs 零 lint 命中**（/tmp/pb1_clippy_isolated.log）。噪声全部来自桩件 dead-code 豁免面与 source/yaml 存量模块（这些存量 lint 在真实工作区因 E0583 早停而暂不可见，C 路收口全量编译时会显形，届时一并处理）。

## 遗留与移交

1. **给 C 路（parser.rs）的接口契约**（view.rs 的 `project_document_view` 类型化边界逐字钉死）：
   - `handle.metadata() -> Arc<DocumentMetadata>`；`handle.revision() -> DocumentRevision`；
   - `handle.structure() -> Result<Arc<StructureModel>, DocumentError>`（卡片分支必返 `StructureModel::Card`；与元数据形态矛盾时视图按 `DOCUMENT_STRUCTURE_INVALID` 归一）；
   - `handle.content(&NodeId) -> Result<Arc<ContentNode>, DocumentError>`：对 `structure[]` 每个节点调用（含 `present=false` 者，须按 §8.4 返回占位模型携错误级诊断，不得静默跳过）；仅真致命（IO/取消）才返 `Err`；
   - `handle.entries(None) -> Result<Arc<[Entry]>, DocumentError>`（箱子全量条目）；
   - **`handle.layout_config() -> Result<Arc<DocumentValue>, DocumentError>`（新增访问器）**：返回 `.box/content.yaml` L2 根映射（含 `active_layout_type` 与 `layout_configs`），视图侧完成 `props` 投影。注：§6.3/§5.2 文档句柄面未列该访问器，但 §5.1 明确布局配置属 L2、A 路 `ParsedUnit::LayoutConfig` 已按单元缓存建模，视图契约必须经句柄取回——属文档面遗漏，建议主智能体核定时同步补《06-文档解析器设计》§5.2 句柄清单或登记工单；本路按文件面独占约束未改动文档。
2. 存量 12 项功能测试失败与存量 lint 噪声归后续波次收口（A 路遗留清单口径不变）。
3. `/tmp/pb1_verify`、`/tmp/pb1_target` 为一次性验证副本，随环境清理，不入库。
