# 从 `office.document.*` 迁移到 `file.*` 指南

> **适用范围**：所有仍在使用 `office.document.*` / `client.office.*` 的应用插件、模块插件、SDK 调用方。
> **迁移窗口**：当前版本同时保留 `office.document.*` 与 `file.session.*`；新代码一律使用 `file.*`，存量代码按本文档逐步替换。
> **关联文档**：《15-万能文件处理协议.md》、《14-办公文档会话协议.md》、《06-Manifest配置规范.md》。

---

## 1. 为什么必须迁移

`office.document.*` 链路是薯片生态早期为办公文档设计的临时链路，存在以下问题：

1. **范围局限**：只覆盖 `docx` / `pptx` / `xlsx` / `pdf`，无法承载图片、视频、代码、压缩包等格式；
2. **链路分叉**：办公文档与其他文件使用不同的处理路径与错误码，增加 SDK 与 Host 的实现复杂度；
3. **与 `resource.open` 重叠**：跨应用资源转交与会话编辑逻辑互相覆盖，缺少清晰职责划分；
4. **扩展困难**：新增文件类型需要修改多个 Host 服务与 SDK 入口；
5. **与正式架构方向不一致**：万能文件处理链路（`file.*`）是 vNext 冻结后的统一入口，详见《15-万能文件处理协议.md》第 1 节。

迁移完成后，所有文件处理能力都会收敛到 `file.*` 命名空间，统一错误码、统一权限模型、统一能力声明。

---

## 2. 路由与 SDK 入口映射

### 2.1 路由映射

| 旧路由 | 新路由 | 备注 |
|---|---|---|
| `office.document.create` | `file.session.create` | 行为等价 |
| `office.document.open` | `file.session.open` | 行为等价 |
| `office.document.read` | `file.session.read` | 返回结构略有变化，详见 §3.2 |
| `office.document.write` | `file.session.write` | 请求/响应字段更规范 |
| `office.document.get` | `file.session.get` | 行为等价 |
| `office.document.persist` | `file.session.persist` | 支持 `backup` 选项 |
| `office.document.close` | `file.session.close` | 行为等价 |

`file.*` 还额外提供 `file.preview.*`、`file.convert.*`、`file.compare.*` 等办公文档场景之外的能力。

### 2.2 SDK API 映射

| 旧 SDK API | 新 SDK API |
|---|---|
| `client.office.create({ format, fileName?, initialBytes? })` | `client.file.session.create({ format?, fileName?, initialBytes?, options? })` |
| `client.office.open({ filePath, format? })` | `client.file.session.open({ filePath, format?, options? })` |
| `client.office.read(sessionId, options?)` | `client.file.session.read({ sessionId, options? })` |
| `client.office.write(sessionId, bytes, options?)` | `client.file.session.write({ sessionId, bytes, options? })` |
| `client.office.get(sessionId)` | `client.file.session.get(sessionId)` |
| `client.office.persist(sessionId, filePath?)` | `client.file.session.persist({ sessionId, options: { filePath } })` |
| `client.office.close(sessionId, options?)` | `client.file.session.close({ sessionId, options? })` |
| `client.file.detectType(path)` | `client.file.detect.detectType(path, options?)` |

`client.office.*` 在当前 SDK 版本中保留为兼容入口：所有方法都会把请求映射为 `file.session.*` 路由，并把响应归一化为旧的 `OfficeDocumentDescriptor` 形状。新代码不应再使用 `client.office.*`。

### 2.3 Host 服务映射

| 旧 Host 服务 | 新 Host 服务 |
|---|---|
| `office.document.*` | `file.session.*` |
| `OfficeDocumentService` (`Chips-Host/packages/office-document-service`) | `FileSessionService`（后续 Host 版本演进提供），当前过渡期内仍由 `office-document-service` 实现 `office.document.*`，新实现必须使用 `file.session.*` |

Host 服务注册口径详见《15-万能文件处理协议.md》第 5 节。

### 2.4 能力声明映射

| 旧能力声明（如果存在） | 新能力声明 |
|---|---|
| 无统一格式 | `file-handler:view:application/pdf` 等（详见 §5） |

`office.document.*` 没有对应的 `file-handler` 能力声明；新插件应同时声明 `file-handler:edit:...` 让 Host 在 `file.session.open` 之后能正确选择处理器。

---

## 3. SDK 调用迁移

### 3.1 旧代码示例（`office.document.*`）

```ts
import { createClient } from 'chips-sdk';

const client = createClient();

// 创建空白 Word 文档
const created = await client.office.create({
  format: 'docx',
  fileName: '报告',
});
const sessionId = created.sessionId;

// 读取当前内容
const { document, bytes } = client.office.read(sessionId, {
  offset: 0,
  length: 4096,
});

// 修改后写回
await client.office.write(sessionId, modifiedBytes, { offset: 0 });

// 另存为新文件
await client.office.persist(sessionId, '/workspace/新版报告.docx');

// 关闭会话
await client.office.close(sessionId);
```

### 3.2 新代码示例（`file.session.*`）

```ts
import { createClient } from 'chips-sdk';

const client = createClient();

// 创建空白 Word 文档（不再依赖 office 命名空间）
const created = await client.file.session.create({
  format: 'docx',
  fileName: '报告',
});

// 读取当前内容
const read = await client.file.session.read({
  sessionId: created.sessionId,
  options: { offset: 0, length: 4096 },
});

// 修改后写回
await client.file.session.write({
  sessionId: created.sessionId,
  bytes: modifiedBytes,
  options: { offset: 0 },
});

// 另存为新文件
await client.file.session.persist({
  sessionId: created.sessionId,
  options: { filePath: '/workspace/新版报告.docx' },
});

// 关闭会话
await client.file.session.close({
  sessionId: created.sessionId,
});
```

### 3.3 主要差异

1. **入参形态**：所有方法（除 `get` 外）都接收对象参数，便于在不改方法签名的前提下增加选项；
2. **响应字段**：
   - `client.office.read(sessionId)` 返回 `{ document, bytes }`；
   - `client.file.session.read({ sessionId })` 返回 `{ sessionId, documentId, bytes, offset, length, totalSize, revision }`，便于上层应用同时拿到会话状态；
3. **会话描述符**：`FileSessionDescriptor` 与 `OfficeDocumentDescriptor` 字段对齐，但前者会附 `revision` 与 `status`，方便 UI 显示"已修改"等状态；
4. **能力与权限**：完全沿用 `file.read` / `file.write` 权限；不再使用历史遗留的 `office.read` / `office.write` 权限。

---

## 4. 应用编辑器迁移步骤

### 4.1 Word 编辑器

| 步骤 | 旧实现 | 新实现 |
|---|---|---|
| 打开文档 | `client.office.open({ filePath })` | `client.file.session.open({ filePath, format, options })` |
| 读取字节 | `client.office.read(sessionId)` | `client.file.session.read({ sessionId })` |
| 写入字节 | `client.office.write(sessionId, bytes)` | `client.file.session.write({ sessionId, bytes })` |
| 保存 | `client.office.persist(sessionId)` | `client.file.session.persist({ sessionId })` |
| 关闭 | `client.office.close(sessionId)` | `client.file.session.close({ sessionId })` |
| Manifest | （无统一能力声明） | 增加 `file-handler:edit:application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

### 4.2 Sheet 编辑器

与 §4.1 完全一致，仅需把 `format` 改为 `xlsx`，并新增 `file-handler:edit:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`。

### 4.3 Slide 编辑器

旧实现使用 `client.resource.write` 直接写回路径，存在以下问题：跨服务路径必须经由 Host 内核路由；缺少会话/版本状态；与"通用文件处理"语义脱节。

迁移步骤：

1. 把 `client.resource.write(state.filePath, blob)` 替换为：
   ```ts
   const session = await client.file.session.open({
     filePath: state.filePath,
     format: 'pptx',
   });
   await client.file.session.write({
     sessionId: session.sessionId,
     bytes: await blobToBytes(blob),
   });
   await client.file.session.persist({ sessionId: session.sessionId });
   await client.file.session.close({ sessionId: session.sessionId });
   ```
2. Manifest 增加 `file-handler:edit:application/vnd.openxmlformats-officedocument.presentationml.presentation`。

### 4.4 PDF 查看器

旧实现使用 `client.office.read(sessionId)`，迁移为：

```ts
const session = await client.file.session.open({
  filePath: filePath,
  format: 'pdf',
  options: { readOnly: true },
});
const { bytes } = await client.file.session.read({ sessionId: session.sessionId });
await client.file.session.close({ sessionId: session.sessionId });
```

Manifest 增加 `file-handler:view:application/pdf` 以及（若支持编辑）`file-handler:edit:application/pdf`。

---

## 5. Manifest 能力声明迁移

新版插件必须在 `manifest.yaml` 中声明 `file-handler`，示例：

```yaml
capabilities:
  - file-handler:view:application/pdf
  - file-handler:edit:application/pdf
  - file-handler:preview:application/pdf
  - file-handler:convert:application/pdf->image/png
  - file-handler:view:application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - file-handler:edit:application/vnd.openxmlformats-officedocument.wordprocessingml.document
  - file-handler:view:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - file-handler:edit:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  - file-handler:view:application/vnd.openxmlformats-officedocument.presentationml.presentation
  - file-handler:edit:application/vnd.openxmlformats-officedocument.presentationml.presentation
```

完整规则、层级后缀、转换声明格式见《15-万能文件处理协议.md》第 4 节和《06-Manifest配置规范.md》第 6.2 节。

---

## 6. Host 服务演进

`office.document.*` 当前仍由 `Chips-Host/packages/office-document-service` 实现，Host 在 `register-host-services.ts` 中保留注册以提供历史兼容路径。Host 团队后续版本将：

1. 把 `office.document.*` 路由完全委托到 `file.session.*`（薄壳实现）；
2. 移除 `office.document.*` 的独立注册，保留 `file.session.*` 作为唯一文件会话入口；
3. 在所有应用插件切换完成后彻底移除 `office-document-service` 包。

详细时间线与里程碑在用户/工程团队约定的迁移计划中跟踪，不在本协议文档中固化。

---

## 7. 迁移验证清单

完成迁移后请按以下清单自检：

- [ ] 全部 `client.office.*` 调用替换为 `client.file.session.*` 或其他 `file.*` 入口；
- [ ] `manifest.yaml` 中补充完整的 `file-handler` 能力声明；
- [ ] `permission` 仍为 `file.read` / `file.write`，不再使用 `office.*` 权限；
- [ ] `Chips-SDK` 包主入口中只 import 来自 `contracts/file.ts` 的类型，不依赖 `office-document.ts`；
- [ ] 运行 `npm test` 通过（包括 `office-document.test.ts`、`client.test.ts`、`route-manifest.test.ts`、`tooling/contract-drift.test.ts`）；
- [ ] 编辑器、查看器手动回归：新建/打开/编辑/保存/关闭正常，会话状态正确刷新，错误提示归一为 `FILE_*` 错误码。

---

## 8. 兼容性说明

1. 当前 SDK 仍然导出 `OfficeDocumentApi` 等兼容类型，供未迁移的存量代码继续使用；
2. 当前 SDK 仍把 `office.document.*` 注册到 route manifest，兼容旧插件；
3. 当前 Host 仍实现 `office.document.*` 服务，兼容旧插件；
4. 上述兼容能力仅供过渡期使用，不再演进功能；新功能（如预览、转换、对比）只在 `file.*` 中提供；
5. 当前生态尚未发布第一版，不会为 `office.*` 提供长期兼容承诺；上述兼容路径在迁移完成后将按 §6 时间表移除。
