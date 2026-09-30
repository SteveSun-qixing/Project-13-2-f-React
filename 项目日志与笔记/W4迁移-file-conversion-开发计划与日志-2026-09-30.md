# W4 迁移 — file-conversion 文件转换编排服务：开发计划与日志

> 日期：2026-09-30
> 任务：旧文件转换编排模块（`Chips-ModulePlugin/Chips-FileConversion-Plugin/`）→ 新生态服务插件 `chips-ecosystem/plugins/services/file-conversion/`
> 分支：第五次重构（本任务零 git 写操作）
> 旧仓只读冻结：全程未修改 `Chips-ModulePlugin/Chips-FileConversion-Plugin/` 内任何文件。

---

## 一、输入与裁决对齐

- 覆盖矩阵行（`项目日志与笔记/重构计划/旧功能覆盖矩阵-三插件仓库-2026-09-20.md` :73）：
  「文件转换编排 | Chips-FileConversion-Plugin/src/{planner,executor}.ts（card/html→html/pdf/image 流水线；
  旧 child module invoke + job 轮询 POLL_INTERVAL_MS）| 同上 | **重写** | planner 路径解析/计划生成为纯函数；
  编排协议按 Cordis 服务间调用重建」。
- 母型（同族全绿判例）：`plugins/services/cardtohtml/`（content-converter 契约、conversion-manifest 回执、
  IServicePlugin 编排、错误面在册三码口径）、`plugins/services/htmltopdf/`（service.ts 编排 + engine 诚实抛错臂 +
  fake 端口测试形）、`plugins/services/htmltoimage/`、`plugins/services/content-image/`（node 环境 vitest + coverage）。
- 契约权威：
  - 《04-能力契约规范》§8.2/§8.3/§8.4/§8.5/§8.6（内容处理能力命名、原子操作约束、官方登记表、
    服务互调与依赖声明、错误码族；旧 `converter.file.convert` 明文「不登记：转换编排归 file-processing 服务」）；
  - 《15-文件处理契约》§4（转换编排阶段模型、提供方选择、受控提交——file-processing 侧权威，本包为
    该编排角色的内容处理侧先行交付）；
  - 《10-服务插件接口》§2/§3（IServicePlugin / IServiceContext：provide / inject / bridge / logger）；
  - 《06-服务插件开发指南》§四（§4.1 服务提供与注入＝服务互调正式面）、§六（健康检查）；
  - 《02-插件清单规范》§五（dependencies 声明提供方插件）；
  - 《04-能力契约规范》7.1（`file:*` 内置能力逐项：read/list/write/delete/move/copy/mkdir；无 `file:stat`）；
  - 《09-官方插件与应用目录》§6.2（Chips-FileConversion-Plugin 处置行：内容处理服务「格式转换编排；
    通用会话与受控提交归 file-processing」，待实现按服务插件发布）。
- 能力 ID 在册性核对结论：
  - 旧 `converter.card.to-html` / `converter.html.to-pdf` / `converter.html.to-image` 已按 §8.4 处置表作废，
    替代登记项为 `content-converter.card-to-html` / `content-converter.html-to-pdf` /
    `content-converter.html-to-image`（运行时 Cordis 服务名依次为 `content-converter` /
    `content-html-to-pdf` / `content-html-to-image`，提供方插件依次为 `chips.service.cardtohtml` /
    `chips.service.htmltopdf` / `chips.service.htmltoimage`）——编排对象全部在册；
  - 旧编排能力 `converter.file.convert` 按 §8.4 明文**不登记**（转换编排归 file-processing），
    即本包承载的编排角色在 §8.4 当前**没有在册能力 ID**；本包不自造在册假象：Cordis 服务名
    `content-file-conversion` 按 §8.2 文法自洽推导并在本日志与代码头注如实登记为候 RFC 收口缺口，
    服务对象不携带 `capabilityId` 字段（不冒用在册 ID），contracts/ 不发布 descriptor.json
    （无登记 ID 可描述）。

## 二、交付面（计划）

1. `src/paths.ts`：旧 planner 路径解析纯函数（detectSeparator / splitSegments / dirname / basename /
   joinPath / WINDOWS_ROOT_PATTERN）**语义逐字迁移**，零平台依赖。
2. `src/uuid.ts`：旧 createUuid 逐字迁移（globalThis.crypto.randomUUID + 降级串）。
3. `src/base64.ts`：RFC 4648 纯 TS 编解码（TextEncoder/TextDecoder 标准全局）。来由：新同族
   html-to-pdf / html-to-image 为纯内存原子操作（Uint8Array 进出、不读写路径），而 `file:read`/`file:write`
   的二进制形态是 base64 字符串；路径世界 ↔ 字节世界的桥接归本编排层，需要无 Node 依赖的编解码。
4. `src/planner.ts`：转换计划纯函数——`normalizeRequest`（来源/目标/输出校验、路径 trim、overwrite 归一、
   html→html 拒绝）、`normalizePackageMode`（pdf/image 目标强制 directory 中间态、html 目标缺省 zip）、
   `resolveIntermediateHtmlOptions`、`buildCardToHtmlOptions`（locale/themeId 随 task030 废弃裁撤，
   只保留 includeAssets/includeManifest）、`buildHtmlToPdfOptions`（marginMm→margins 按新提供方契约改名）、
   `buildHtmlToImageOptions`、`resolveHtmlSource`（isFile → htmlDir/entryFile）、`planConversion`
   （card→html 单步；card→pdf/image 两步暂存链；html→pdf/image 单步；暂存根/备份/终件路径派生）。
   阶段计划回执 `IConversionPlan` 保留旧字段名（temporaryHtmlRoot / temporaryHtmlDir /
   stagedBackupOutput* / stagedFinalOutput*）与 outputKind / stage / publishArtifact 语义；
   旧 progressStart/End 百分比字段裁撤（见缺位登记 1）。
5. `src/errors.ts`：错误面只用 `@chips/sdk` 生成词表在册码——`CONVERTER_INPUT_UNSUPPORTED` /
   `CONVERTER_RENDER_FAILED` / `CONVERTER_OUTPUT_TOO_LARGE` + 通道码 `BRIDGE_CANCELLED`（§11.3）；
   旧 `CONVERTER_INPUT_INVALID` / `CONVERTER_OUTPUT_EXISTS` 按 cardtohtml 判例归一为
   INPUT_UNSUPPORTED + `details.reason`；旧 `CONVERTER_JOB_CANCELLED` 归一为 BRIDGE_CANCELLED；
   平台 `FILE_*` / `DOCUMENT_*` 等在册 ChipsError 按同族口径原样透传（直连消费方按原码分支）。
6. `src/types.ts`：请求/结果/计划/步骤/端口契约。`IFileConvertRequest` 与旧形状一致（source/target/output/options）；
   `IFileConvertResult` 回执保留 artifacts / pipeline / warnings 面；兄弟服务以**消费方自有端口视图**声明
   （`IContentConverterPort` / `IHtmlToPdfPort` / `IHtmlToImagePort` / `IFilePort`），
   **不 import 兄弟包任何内部模块**——结构化类型对接提供方契约。
7. `src/ports.ts`：`createBridgeFilePort`（ctx.bridge.request('file:*') 正式链路收窄投影）与
   `readHtmlPackage`（file:list 递归 + file:read utf-8/base64 + base64 解码 → {html, assets} 纯内存包）。
   存在性/形态判定按 cardtohtml 判例以 file:list 探测（`file:stat` 不在新 file 域在册表内——见缺位登记 3）。
8. `src/executor.ts`：`createFileConversionService`——取消检查（AbortSignal 安全点，BRIDGE_CANCELLED）→
   输出可写预检（overwrite 口径）→ 暂存区 mkdir → 逐步执行（card-to-html 走 content-converter 端口；
   html 渲染腿读包→纯服务端口→字节非空校验→file:write base64 落暂存）→ 产物存在性复核 →
   提交（overwrite 时先 move 备份、失败回滚还原，旧 commitStagedFinalOutput 语义）→
   finally 尽力清理暂存根。兄弟服务经 `ctx.inject` 注入（manifest dependencies 静态声明），
   服务注册在注入回调内完成（依赖未激活不注册、不假接线）。
9. `src/descriptor.ts` + `src/plugin.ts` + `src/index.ts`：服务名/插件 ID/暂存前缀常量、
   `IServicePlugin` start/stop/health 同族形态、入口默认导出 + 命名导出。
10. `contracts/`：`file-convert.input.schema.json` / `file-convert.output.schema.json`
    （旧 convert.input/output.schema.json 按新错误面与回执面改写；不发 descriptor.json，见核对结论）。
11. `manifest.yaml`：`chips.service.file-conversion` / type service / runtime targets [host] /
    healthCheck 30s / dependencies 声明三个提供方 / 权限最小化
    `filesystem:read + filesystem:write + filesystem:delete`（R19 file:* 映射，无 resources:read——
    文档链路由 content-converter 以其自身会话权限承担）。

## 三、缺位登记（如实缺口，不做假接线）

1. **job 进度/取消契约未定形**：旧 `ctx.job.reportProgress / isCancelled / module.job.get|cancel` 轮询面
   在新 `IServiceContext` 无对应成员（《10》§3 全量成员表无 job 面）；15-文件处理契约的进度/取消语义
   归 file-processing 会话层。本包以提供方族统一的 `IConverterCallContext.signal`（AbortSignal）为取消面
   （安全点检查 + 透传兄弟服务），进度回报无正式通道——百分比映射随计划裁撤，阶段（stage）字段保留于
   计划回执与日志。待 file-processing 会话层收口后承接。
2. **编排能力 ID 不在册**：§8.4 明文不登记 `converter.file.convert` 且未给编排角色分配新 ID/服务名；
   本包服务名 `content-file-conversion` 为 §8.2 文法自洽推导值，候登记维护流程（RFC）收口。
3. **`file:stat` 缺位**：新 file 域在册能力（7.1）无 stat；旧「stat → isFile 形态判定 / 产物存在性复核」
   改以 file:list 探测（目录探测成功=目录；FILE_NOT_FOUND=来源不存在；其余错误=按文件形态处理并在
   读入口处如实失败）。产物复核为父目录列举成员判定，isFile/isDirectory 精细校验暂不可得。
4. **暂存位置口径**：旧算法把暂存根建在输出同级目录（`.chips-file-conversion-*`）；15-文件处理契约 §4.4
   对 file-processing 会话要求插件作用域/平台临时作用域。本包按矩阵行「旧算法语义逐字迁移」保留旧位置
   语义，待 file-processing 收口后由会话层接管暂存区治理（该契约不约束内容处理编排服务本身）。

## 四、执行日志

- 2026-09-30：研读旧仓 planner/executor/types/errors/index 与旧单测、矩阵行 :73；
  研读 cardtohtml（plugin/converter/types/errors/contract 测试）、htmltopdf（service/main/engine port/
  errors/全部测试）、htmltoimage（descriptor/types/options）、content-image（vitest 配置）母型；
  核对 §8.2–8.6、15 §四、10 §2/§3、06 §四、02 §五、7.1 file:*、R19 权限映射、09 §6.2；
  确认 SDK Context.inject/IServiceContext 注入面与 generated error-codes 在册词表（CONVERTER_* 三码）。
- 2026-09-30：能力 ID 在册性核对（结论见第一节）；缺位登记 1–3 立项（无新工单编号占用：
  缺口均为在册规范明文状态而非链路缺陷，随本日志与代码头注登记，编排 ID 候 RFC）。
- 2026-09-30：包骨架落位（package.json / manifest.yaml / tsconfig / vite.main.config / vitest.config）
  与 contracts/ 双 schema（不发 descriptor.json）。
- 2026-09-30：测试先测后码——tests/{paths,base64,planner,executor,plugin,contract}.test.ts；
  交付中按测试驱动补 tests/ports.test.ts（createBridgeFilePort 投影与 base64 往返），
  并按旧 commitStagedFinalOutput 语义补回滚/备份失败三臂用例。
- 2026-09-30：实现落位与两处语义校正（对照旧面发现的回执瑕疵，非简化）：
  1. 结果回执 artifacts 只收录 `publishArtifact` 腿——旧面把已被 cleanup 删除的中间 HTML 目录
     也计入产物清单（指向已删路径的死引用），新回执仅含发布产物，pipeline 面仍逐腿全量登记；
  2. 产物存在性复核对每腿执行（旧 ensureArtifactExists 逐腿口径），card-to-html 腿复核点为
     `input.output.path`（暂存物理位）；`file:stat` 缺位下的复核口径见缺位登记 3。
- 2026-09-30：四闸全绿（74 用例）+ 覆盖率抽查（语句 94.4%、函数 100%）。

## 五、四闸验证（亲跑记录）

| 闸 | 命令 | 结果 |
|---|---|---|
| test | `npx -y pnpm@9 --filter @chips/service-file-conversion test` | 7 文件 74 用例全绿（paths 10 / base64 5 / planner 18 / executor 20 / ports 4 / plugin 8 / contract 9） |
| typecheck | `npx -y pnpm@9 --filter @chips/service-file-conversion typecheck` | 通过（strict + exactOptionalPropertyTypes） |
| lint | `npx -y pnpm@9 --filter @chips/service-file-conversion lint` | 通过（0 error / 0 warning） |
| build | `npx -y pnpm@9 --filter @chips/service-file-conversion build` | `dist/index.js` 24.60 KiB（gzip 7.01 KiB，自包含单文件，禁导入守卫在构建期生效） |
| coverage | `test:coverage`（附加抽查） | 语句 94.42%、函数 100%、分支 83.72% |

安装记录：`npx -y pnpm@9 install` 在 /tmp/w4-lockguard 目录锁下执行（Done, pnpm v9.15.9）；
新包经 pnpm-workspace.yaml 既有 `plugins/*/*` glob 自动纳入，lockfile 随新工作区包注册更新。

## 六、登记与文档联动

- 本日志（过程材料）；缺位登记见第三节（job 进度/取消契约未定形、编排能力 ID 不在册、
  file:stat 缺位探测口径、暂存位置口径）。
- 《09-官方插件与应用目录》§6.2 处置行回写**候 RFC**：因编排能力 ID 不在册（§8.4 明文不登记
  `converter.file.convert` 且未分配新 ID），本包不以「已迁移/已实现」口径回写目录行，
  待登记维护流程为 `chips.service.file-conversion` / `content-file-conversion` 分配在册身份后一并回写。
- 旧仓 `Chips-ModulePlugin/Chips-FileConversion-Plugin/` 全程零改动；本任务零 git 写操作
  （chips-ecosystem 工作区内其他并行 W4 流的既有改动与本任务无关，未触碰）。
