# 生态工作区 AGENTS

## 适用范围

- 本文件作用于整个生态工作区，除非更深层目录有自己的 `AGENTS.md` 进行补充或覆盖。

## 开工顺序

- 修改任何代码、脚手架或文档前，先阅读 `生态设计原稿/` 中对应领域，再阅读 `生态共用技术文档/` 中对应协议、规范和标准等所有先关的技术细节。
- 更新或者修改文档前，必须重新核对当前代码、`manifest.yaml`、测试和正式运行链路；不要只依赖 README、脚手架模板文本或历史任务说明。
- 分支管理由用户负责；只有在用户明确发出指令时，才能执行创建、切换、合并、归档分支等 Git 分支操作。
- 如果用户要求创建新分支的话，需要按照以下命名格式创建分支：“task-001（编号，要按照仓库里的编号顺延）-任务名称”
    例如：“task-002-优化复合卡片渲染细节”
- 提交代码更改消息的时候，需要用中文编写信息，要全面详细。

## 架构红线

- Host 是唯一运行时承载；插件访问系统能力只能通过 `window.chips.*` / Bridge / `chips-sdk` 正式链路。
- 服务间调用必须走内核路由；禁止跨服务直接 `import` 调用，禁止跨层直连。
- SDK 只负责类型化封装、脚手架和测试辅助，不承载 Host 运行时主实现。
- 官方前端统一采用 React 技术栈；组件库统一使用 antd（唯一组件库）与 `@chips/ui` 共享层；界面文案一律简体中文直写；视觉样式统一走 `@chips/ui` 与 antd 主题定制（token），禁止硬编码样式、禁止引入第二套组件库。主题系统与多语言系统已随 task030 废弃，不得新增相关依赖。
- 不做临时版、简化版、占位实现；不要留下 TODO；不要为当前阶段额外加入兼容性包袱设计。
- 可以在任务范围内适当引入第三方库；引入前必须核对现有技术选型、许可证、维护状态、包体影响、安全风险和跨端兼容性。若会改变基础架构、长期运行时依赖或公共协议，先记录方案并等待用户确认。

## 文档边界

- 对整个生态通用、可复用、对外公开或可能被多个仓库共同消费的信息，写入 `生态共用技术文档/`。
- 只在单个项目内部流转的实现细节、工程约束和内部设计，写入该项目自己的 `技术文档/`、`需求文档/` 或同级内部文档目录。
- `生态设计原稿/` 保存产品设计和架构原稿，不写任务进度、工单过程或临时绕过方案。
- `项目日志与笔记/` 保存工单、排查记录、研究结论和过程性材料，不作为生态公共契约的最终发布位置。
- `AGENTS.md` 只写稳定规则、职责边界、质量要求和文档归属；不要写未来可能变化的业务细节、临时命令参数或短期实现策略。

## 问题发现与工单

- 如果发现架构缺口、组件/接口缺失、SDK 或脚手架不可用、文档与代码不一致、共享层（`@chips/ui`）链路未打通、工具链与文档漂移，先在 `项目日志与笔记/问题工单.md` 登记工单。
- 新工单同时创建独立目录 `项目日志与笔记/工单NNN-描述/任务说明.md`，写清背景、证据、影响范围、复现步骤、期望行为和暂行处理。
- 登记工单后继续推进本轮可继续研究的部分，但后续规则沉淀必须显式绕开未收口的错误口径。

## 归档与验证

- 禁止直接删除文件；需要移除的内容统一移动到就近 `归档/` 目录。
- 改动后优先使用各项目 `package.json` 中的正式脚本做验证；验证范围至少与改动范围相匹配。

## 每次开始任务时：

首先阅读生态设计原稿中的相关内容，对项目有个全面的认识和了解，理解整个项目。然后需要查看生态共用文件夹，里面有各种项目文档和规范文档。

需要查看所有相关文档和内容，认真学习如何使用。要高质量完成项目开发，让薯片生态里的所有软件可以完美配合合作，完美对接。

不要着急开发，要注重项目稳定性和项目质量，要完全按照要求和规范进行，不能开发简化版临时版。
要严格按照各种要求，功能要求，开发规范，开发标准，需求文档，技术文档，如果出现错误，要找到原因并修改。

现在还没有发布第一版，不需要考虑任何兼容性重构，不需要考虑兼容性，而且后续也不需要考虑大版本兼容性。
要考虑到整个架构的设计优化，模块解耦高度复用性，优化架构设计，注重生态的拓展性，未来的稳定发展等问题

要使用薯片SDK进行开发。
前端使用的React技术栈，要严格按照薯片生态前端基础规范（antd + `@chips/ui` 共享层、统一视觉规范、简体中文文案规范）进行开发。
按照规范和标准使用相应的接口和协议，使用正确的语法。

你的任务是交付完整完美的任务目标，要符合所有标准规范，测试均可以正常通过。

如果遇到架构缺陷或者生态不完善，需要在《项目日志与笔记》中的《问题工单.md》中提交问题。
例如组件库缺少一个组件，或者薯片生态底层，薯片主机，薯片内核，薯片公共基础层没有打通，遇到了一些临时开发代码。
或者SDK里的工具和接口不能正常使用等等各种问题。
遇到这类问题后，首先在问题工单中提交问题，创建一个新的任务文件夹，并创建文档详细描述任务。然后结束当前对话，等待用户进行处理之后再继续往下推进任务。
绝对不能有临时开发。
工单任务文件夹要用中文命名

现在处于整个项目的开发中，有时候架构更新了，但是脚手架或者文档没有更新，在开发中如果遇到没有更新的，也需要提出工单

注意现处于项目开发时，可能有的技术文档没有及时更新，你需要结合具体代码查看。在开发过程中，如果发现有些文档与实际代码不符，那么要提出工单。

## 重要参考文档位置

- 产品设计原稿：`生态设计原稿/` 
- 技术文档，协议和规范：`生态共用技术文档/` 目录

每次完成一部分开发，你都需要及时更新所有相关的文档，

禁止删除任何东西，如果需要移除文件，那么将文件移到归档文件夹中。

分支管理由用户负责；除非用户明确要求，不要自行创建、切换、合并或归档分支。

### 12. 禁止做的事

- 不要未经选型评估就引入第三方库；新增依赖必须核对用途、许可证、维护状态、包体影响、安全风险和跨端兼容性，涉及架构或长期运行时依赖时先询问用户。
- 不要修改不在任务范围内的文件
- 不要创建临时的、简化的、占位的实现（必须完整实现）
- 不要跳过测试编写
- 不要在代码中留下 TODO（当前任务范围内的功能必须完整）
- 不要自行决定改变架构设计（有疑问先询问）


对于整个生态是全局性的信息，比如接口信息等，需要保存在生态共用文档中，创建对应文档。
只有薯片主机内部，只在内部流动的技术细节，不对主机外开发的信息才在薯片主机内部的技术文档中编写。
每次修改文档前，都要重新查看一遍相关代码，重新确认一遍技术细节，然后再编写文档。如果一个信息是整个生态都有可能用到，或者对外公开的信息，那就应该保存在生态共用技术文档文件夹中。只有生态自己内部用到的一些信息才保存在自己的项目文件夹中。生态共用技术文档要有未来所有可能会用到的技术细节，整个生态未来发展的所有正式信息。（开发计划，任务报告什么的不算）

开发过程中，需要考虑到所有角度所有情况，所有相关仓库的处理。不要有任何兼容性设计，要保证整个生态有最好的架构设计，最好的软件工程，最干净整洁优雅的代码。

## 其他要求

- 不要不要自己提交代码，提交代码，合并分支，切换分支都需要经过用户同意才行，一般由用户发出指令进行管理。
- 架构设计和技术制定要满足薯片生态未来长期拓展，长期发展的潜在需要，架构需要有平台性和系统感，未来任何地方都有可能拓展添加。提高代码复用性，提高系统稳健性，提高代码的系统性

<!-- aoci:begin -->
## AOCI Repository Cognition

AOCI maintains a stable, versioned, incrementally updatable repository-level cognition layer so models can reuse their understanding of this system across tasks.

`aoci.txt` is a structured cognition index for models. It assigns one independent Entry to every managed file, database table, or other managed object. Symbolic tags and F/R/A/S semantics describe the object's core responsibility, important relationships, external contracts, and non-obvious constraints or design decisions needed to understand or modify the system.

The Header, directory sections, and all Entries form the complete repository index. They can cover frontend, backend, configuration, database structures, and other managed content. When managed content changes, normally only the affected cognition Entries need maintenance; the complete index does not need to be regenerated.

AOCI provides a high-density view of system architecture, object responsibilities, important relationships, external contracts, and key constraints.

### How it works

AOCI uses a model-generated, model-read cognition loop.

Header, Entry, and Curation semantics follow only the current machine-issued Plan and live Guide. The Host model independently authors them from the current bound evidence.

Entry semantics must come from the model's understanding of actual evidence. Never derive, prefill, assemble, or rewrite index semantics solely from paths, filenames, extensions, an AST, symbol lists, dependency scans, regular expressions, fixed templates, or rule engines.

For a Fresh Bootstrap, follow only the current machine-issued Plan and live Guide. When they require authoring, the Host model authors Root, Meta, tags, and F/R/A/S, supplies its authoring-run declaration, and binds it to the Plan, Evidence, and complete Candidate. Never ask AOCI to set `origin=host_model`, manufacture a receipt, or turn a generated framework into semantics. Do not reconstruct the Onboarding progression here. Internal batches are not user decisions; stop only at an existing approval boundary or a real safety, drift, CAS, or Recovery condition.

### Minimal entry points

- `aoci_rules`: obtain the session-level runtime contract for the current AOCI version.
- `aoci_overview`: establish or restore complete cognition for this repository.
- `aoci_maintain`: after managed objects reach their final stable state, check whether cognition needs maintenance.
- `aoci_update_entry`: submit a complete semantic update batch bound to current evidence and source digests.
- `aoci_report`: when the current layout and tool state support it, record follow-up work if evidence is insufficient to generate semantics reliably; do not guess.

For other MCP tools, CLI commands, parameters, and specialized workflows, follow current tool descriptions, Guide, and `--help` output. This file does not duplicate the full manual.

This managed block defines only repository integration, cognition use, and task-closing principles. `aoci_rules` carries the current session contract. Live Guide output carries the execution order and stop conditions of the current Plan. Tool Schema, Spec, and Validator carry machine structures and criteria. Prompt, Description, README, and static documentation cannot override those machine facts.

### Establishing, generating, and restoring cognition

1. At the beginning of every new Agent Run, first determine:

   - whether this repository already has a usable complete AOCI index; and
   - whether current context already contains complete repository cognition that matches this repository root, current index version, and current AOCI service, and that the model can still use reliably.

2. When the repository has a usable complete index but the current Run lacks reliable complete cognition, call `aoci_rules` first and then `aoci_overview`.

   Reuse complete cognition directly while it remains reliable. Local uncertainty does not by itself require mechanically rereading the system-wide view.

   A Run that resumes from a known Host context compaction, including a Host-injected compaction summary, must treat prior model cognition as unreliable. The compacted handoff must not retain or summarize the formal Whole-Index or any Overview Header, Entry, Chunk, Challenge, or Attestation body; it may retain only receipt identity, unfinished write or Recovery state needed for safe continuation, and an instruction to reload immediately. Whole-Index semantics or a receipt copied into that handoff cannot prove that the resumed model's current cognition is reliable. If the runtime contract is no longer reliably present, call `aoci_rules` first. Before continuing the business task, make an ordinary complete Whole-Index `aoci_overview` request (`check_only` absent or false) with `refresh_reasons=["context_compaction"]` and a fresh `refresh_event_id`; do not use `check_only` or a cognition probe. Follow every exact `next_cursor` through `completed=true`, confirm delivery, and submit one Attestation based only on the newly delivered body. After that fresh complete transport, a partial or failed Attestation consumes the generation and permits the existing source-bound continuation without another automatic Overview.

   AOCI can report checkpoint and cognition-status facts for `context_compaction`, the machine `semantic_threshold` under the project `cognition_refresh_threshold`, or a major `phase_transition`. Use `check_only=true` when only those compact facts are needed. They advise the Agent but do not decide whether the model needs the system-wide view.

   When the Agent explicitly calls ordinary `aoci_overview` (`check_only` absent or false), AOCI must deliver the complete requested scope whenever a coherent CognitionSet can be formed. It must not suppress that body because a receipt already exists, a threshold was not reached, or no refresh reason is pending. Dirty or stale formal cognition is still delivered but is marked unreliable. Pending recovery or an incoherent snapshot fails closed without a mixed body.

   When an ordinary Overview reports `continuation_required=true`, submit its exact `next_cursor` automatically until `completed=true`. Do not ask the user to continue, begin the business task, or state a partial system conclusion. Stop the cognition chain on Host truncation, a missing, duplicate, or reordered Chunk, cursor failure, Index change, or `chunk_tokens` change. Until Attestation completes, never use Memory, source, Spec, `aoci.txt`, historical sessions, scope, search, or Entry reads to repair or supplement Whole-Index cognition. A challenge ordinal is the 1-based position in the formal Entry sequence; Header content, comments, blank lines, Section/Overview/Chunk markers, receipts, and Metadata are excluded, and Chunk Receipt ordinals use that same sequence. The Attestation must echo the Challenge's exact current `index_sha256`, `entry_sequence_sha256`, and `entry_count`; a prior Index, Entry sequence, count, or Attestation is invalid. After the complete chain, submit the existing model cognition Attestation once. One same-response JSON Schema or field-format error may be corrected once without changing semantic answers; an object, Tag, or F mismatch means failure and uncertain assimilation, with no semantic retry or information bypass. During initial cognition it also blocks Root/Meta, Migration, layout-wide, or other unbound system decisions. During a context-compaction refresh with complete transport, unchanged cognition identity, aligned governance, and no Recovery or third-party conflict, the attempt consumes that refresh generation even when Attestation is partial or failed; continue the existing task without another automatic Overview. `system_mastery_percent` self-assesses only the system framework—architecture, responsibilities, strong relationships, stable external contracts, and high-entropy safety and maintenance constraints—not complete implementation or runtime knowledge. Keep machine Index coverage separate, and normally give the user only the prescribed single success or failure sentence derived from actual coverage, Challenge, Chunk, token, and mastery results. If the Host truncates a Chunk, ask the user to set `overview_delivery.chunk_tokens` to a smaller valid value and restart; do not change it automatically.

   Interpret the additive cognition level independently from strict proof fields. `delivery_verified` means the Index was loaded and Host delivery was confirmed while complete cognition verification is still unfinished; describe that state as loaded and delivery-verified, never as no cognition or failure to understand the system. `cognition_verified` requires a passing Attestation (at least 80 percent of Challenge ordinals fully correct with at most one object identity miss), and `cognition_governed` additionally requires governance alignment. A generic complete-read failure sentence is reserved for an actual delivery fault.

   When an Overview response contains the optional `cognition-state/v2` projection, use its dimensions independently. Its Level ends at `model_cognition_usable`; `strict_attestation_verified`, `governance_aligned`, and `current_system_cognition_reliable` are independent states and never participate in that Level. An ordinal, object identity, Tag, or core F mismatch can make strict Attestation fail while model cognition remains usable; do not report that mismatch alone as proof that the model did not understand the system. Only `current_system_cognition_reliable=true` permits an unqualified current complete-system cognition claim. When the projection is absent, keep using the legacy interpretation above.

   An ordinary read-only audit, analysis, or check, a request not to modify code, or a request not to commit or push does not automatically mean strictly zero writes and does not alter the cognition-validity decision above. Codex Memory and historical Skills may only help recover experience, user preferences, and investigation directions. They cannot replace a current cognition receipt matching the repository root, index digest, AOCI service identity, and cognition scope. Project AGENTS and current AOCI identity take precedence over historical Memory for AOCI state.

   Treat a task as strictly zero-write only when the user explicitly prohibits Ledger, metadata, `.aoci` runtime assets, and every filesystem write. If necessary cognition establishment conflicts with that boundary, report the conflict and ask the user to decide or recommend an isolated copy. Never silently substitute Memory for current repository cognition.

3. If the repository has no usable complete index, or has only a minimal skeleton, an incomplete Header, unfinished Entries, or undecided required Curation, obtain `aoci_rules` and enter the current AOCI Guide when a formal complete AOCI index is required. Let Guide choose the next phase from actual repository state and complete the required safety steps.

   `aoci_maintain` does not replace the index-establishment workflow.

   Do not reconstruct or hard-code the full-index generation state machine in this file.

4. During a long-running task, the model is responsible for preserving the current cognition receipt and using the refresh gate correctly:

   - when the Host reports context compaction or the model knows the system-wide view was lost, follow the mandatory `context_compaction` reload rule above; AOCI cannot infer the Host event;
   - when entering a genuinely major phase, declare `phase_transition`, not a function, test run, or small step;
   - at a plausible stable checkpoint, use `check_only=true` to obtain the machine semantic count when that fact is useful;
   - except for the mandatory known-compaction reload, decide whether the current task needs another explicit scoped or complete Overview; and
   - keep the Dirty or Stale reliability state reported by AOCI until maintenance and alignment complete.

### Task closing and cognition maintenance

5. A purely read-only question, analysis, version check, or task that changes no AOCI-managed object does not require a maintenance-tool call. The AOCI version in use is `cognition_receipt.mcp_service_version` in any `aoci_overview` check_only or `aoci_maintain` response; the binary path is the `command` in the project's `.mcp.json`, and the CLI need not be on PATH.

6. When AOCI-managed objects change, call `aoci_maintain` once after they reach the task's final stable state. Do not maintain files individually after each intermediate edit.

7. If maintenance returns actual semantic candidates, the Host model must independently author the complete tag and F/R/A/S updates from each candidate's bound object and necessary evidence. Submit the complete candidate set for that current machine-issued batch in one `aoci_update_entry` call while preserving each `source_sha256`, `candidate_id`, and domain batch identity. `max_entries` limits one request and atomic transaction, not the logical plan, Whole-Index, or Managed Scope. When `remaining` is nonzero, call Maintain again after the successful Apply and continue from the new preimage; never shrink Index coverage or slice a returned batch to satisfy transport limits.

   When evidence is insufficient and the current layout supports `aoci_report`, use it instead of guessing, applying a template, or generating unsupported cognition merely to eliminate follow-up work.

8. Obey structured tool states and safety boundaries:

   - `repair_required`: repair only the explicitly identified candidates, then resubmit the complete current machine-issued batch;
   - `stopped`: end that write attempt and inspect `failed_step`, error, formal-write evidence, and Recovery. In auto mode, a proven zero-write closure is followed by a fresh Plan; a complete Intent with provable postimage is resumed; a policy-selected Rollback with exact preimage is completed and replanned. Stop the user task only when proof is unavailable, third-party bytes conflict, approval or external action is required, or another real safety boundary applies;
   - never ignore conflicts, approvals, human decisions, permissions, or safety signals; and
   - after alignment, do not repeat maintenance or writes; `refresh_ready_for_overview` is a checkpoint fact, and the Agent decides whether to request an ordinary complete Overview for its next phase.

   If any managed object changes after maintenance completes, the previous result is invalid. Complete closing again from the new final stable state.

9. When the user limits only business-file scope and does not explicitly forbid repository-managed assets, AOCI-managed assets may be updated during closing to preserve cognition consistency. Distinguish them from business files in audits and commits.

   When the user explicitly forbids changes to `aoci.txt`, `.aoci`, metadata, or any additional file, obey that restriction, do not write, and report any remaining inconsistency accurately.

### Specialized workflows

Initialization, complete-index generation, Header generation, Entries generation, database-structure indexing, Curation, human review, and failure recovery must follow only the instructions, commands, and safety stops returned by the current AOCI Guide or tool at the corresponding stage.

Do not preload, guess, or reconstruct these specialized workflows. The relevant Guide, tool descriptions, model Prompt, and CLI help provide platform invocation, request format, batch limits, approval rules, index-format details, and recovery steps as needed.
<!-- aoci:end -->
