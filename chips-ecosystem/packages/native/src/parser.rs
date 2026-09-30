//! 文档解析域导出（《核心接口规范》§6.4、§6.6，《06-文档解析器设计》§12）。
//!
//! 导出面与 backing 的一一对应（业务逻辑全部留在 `chips-parser`，本模块
//! 只做类型转换、错误归一与线程回投，§12.2）：
//!
//! | Neon 导出 | backing（`chips-parser` 公开面） |
//! | --- | --- |
//! | `openDocument` | `open_document`（§6.2 自动识别） |
//! | `openCard` | `CardParser::new(options).open`（严格 card） |
//! | `openBox` | `BoxParser::new(options).open`（严格 box） |
//! | `documentMetadata` | `DocumentHandle::metadata` + `diagnostics` 快照 |
//! | `documentStructure` | `DocumentHandle::structure` + `diagnostics` 快照 |
//! | `documentContent` | `DocumentHandle::content(&NodeId)` + `diagnostics` 快照 |
//! | `documentEntries` | `DocumentHandle::entries(Option<Range<usize>>)` |
//! | `documentLayoutConfig` | `DocumentHandle::layout_config()` + `diagnostics` 快照 |
//! | `documentRevision` | `DocumentHandle::revision()`（工单034 正式化，修订/源指纹直投） |
//! | `documentReadResource` | `DocumentHandle::read_resource(&PackagePath, Option<Range<u64>>)` |
//! | `documentValidate` | `DocumentHandle::validate` |
//! | `buildDocumentView` | `build_document_view(&DocumentHandle, SessionId)`（§6.6） |
//! | `documentClose` | 句柄内映射的显式释放（`Arc` 归还，`Finalize` 兜底） |
//! | `documentSerialize` | `serialize::serialize_document(&DocumentSerializeRequest, SystemTime)`
//!   （工单036 波 C3 / RFC 点位四 D3「序列化载体」：格式与清单权威在 `chips-parser`
//!   序列化模块——C1 交付——本导出只做 DTO 换算与线程回投；保存时刻由调用方单源
//!   交付 `savedAtUnixMs`，保持 backing 纯函数性质） |
//! | `createCancelToken` | 已注册于 [`crate::cancel`]（内核 `CancelToken` backing） |
//! | `cancelTokenCancel` | 已注册于 [`crate::cancel`]（取消触发，幂等） |
//!
//! 约定（§12.2、§8.3、§8.4、§8.5）：
//!
//! - 全部 IO / 解析导出为异步：工作提交到绑定层运行时线程执行，完成后经
//!   `Channel` 回投 JS 线程 settle，不阻塞事件循环；
//! - 错误归一：backing 契约码（`DOCUMENT_*`、视图构建器的内核码）经
//!   `ChipsError → throw_chips_error` 原样透传；绑定层只以已登记的
//!   `NATIVE_*` 三码拒绝非法入参，不自造码；
//! - 句柄：`JsBox<NativeDocumentHandle>` 不透明暴露，内部结构不可见；
//!   `documentClose` 提前释放归档映射（幂等），未关闭时由 GC 终结器兜底；
//! - 结果形状：`MetadataResult` / `StructureResult` / `ContentResult` /
//!   `EntriesResult` / `LayoutResult` 统一携带 `{ kind, value, diagnostics }`；
//!   `ValidationReport` 直接投影 backing 序列化形状；`documentRevision` 按
//!   工单034 冻结的 camelCase DTO 形状直投（无诊断快照位，常数时间构建）；
//!   DTO 一律经 `serde_json::Value` 中转（§8.2）。

use std::ops::Range;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, PoisonError};
use std::time::SystemTime;

use chips_core::{ChipsError, SessionId};
use chips_parser::model::NodeId;
use chips_parser::serialize::{
    serialize_document, ContentMemberValue, DocumentSerializeRequest, SerializeForm,
};
use chips_parser::{
    build_document_view, open_document, BoxParser, CardParser, Diagnostic, DocumentHandle,
    DocumentKind, DocumentValue, PackagePath, ParseLimits, ParseOptions, SourceKind,
};
use neon::prelude::*;
use serde::Deserialize;
use serde_json::{json, Value};

use crate::bridge::normalize_u64_field;
use crate::convert::{js_to_json, ConvertIssue};
use crate::error::{internal_error, throw_chips_error, type_unsupported, value_out_of_range};
use crate::runtime::{runtime, settle_json, spawn_result};

/// 打开模式：与 §6.2 三入口一一对应。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OpenMode {
    /// `open_document` 自动识别。
    Auto,
    /// `CardParser` 严格 card。
    Card,
    /// `BoxParser` 严格 box。
    Box,
}

/// `DocumentHandle` 的 JS 句柄载体；对 JS 不透明、无字段、不可序列化。
///
/// `documentClose` 经 [`NativeDocumentHandle::release`] 提前交出内部
/// `Arc`（映射随之释放）；未关闭时 `Finalize` 走 GC 回收兜底（§12.2）。
pub(crate) struct NativeDocumentHandle {
    inner: Mutex<Option<Arc<DocumentHandle>>>,
}

impl Finalize for NativeDocumentHandle {}

impl NativeDocumentHandle {
    /// 由已打开的句柄构造 JS 载体。
    fn new(handle: DocumentHandle) -> Self {
        Self {
            inner: Mutex::new(Some(Arc::new(handle))),
        }
    }

    /// 取共享句柄；已释放时返回 `NATIVE_TYPE_UNSUPPORTED`（绑定层入参拒绝，
    /// 非 backing 契约码）。
    fn acquire(&self) -> Result<Arc<DocumentHandle>, ChipsError> {
        let guard = self.inner.lock().unwrap_or_else(PoisonError::into_inner);
        let handle = guard.as_ref().ok_or_else(released_error).map(Arc::clone)?;
        Ok(handle)
    }

    /// 交出内部句柄以显式释放；重复调用返回 `None`（幂等）。
    fn release(&self) -> Option<Arc<DocumentHandle>> {
        let mut guard = self.inner.lock().unwrap_or_else(PoisonError::into_inner);
        guard.take()
    }
}

/// 句柄已释放的绑定层拒绝错误（`documentClose` 后继续访问）。
fn released_error() -> ChipsError {
    type_unsupported("/handle", "文档句柄已释放（documentClose 已调用）")
}

// ---------------------------------------------------------------------------
// 参数转换（§8.2：DTO 字段 camelCase；`NATIVE_*` 三码拒绝非法入参）
// ---------------------------------------------------------------------------

/// `INativeParseOptions.limits` 的 JS 侧镜像；缺省字段回落 backing 默认值。
#[derive(Debug, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
struct ParseLimitsDto {
    max_yaml_bytes: u64,
    max_entry_count: u64,
    max_uncompressed_bytes: u64,
    max_compression_ratio: u64,
    max_aliases: u64,
    max_depth: u64,
}

impl Default for ParseLimitsDto {
    fn default() -> Self {
        let limits = ParseLimits::default();
        Self {
            max_yaml_bytes: limits.max_yaml_bytes,
            max_entry_count: limits.max_entry_count,
            max_uncompressed_bytes: limits.max_uncompressed_bytes,
            max_compression_ratio: limits.max_compression_ratio,
            max_aliases: limits.max_aliases,
            max_depth: limits.max_depth,
        }
    }
}

/// `INativeParseOptions`（§6.1 `ParseOptions` 的 JS 侧 camelCase 形状）。
#[derive(Debug, Deserialize)]
#[serde(default, deny_unknown_fields, rename_all = "camelCase")]
struct ParseOptionsDto {
    strict: bool,
    repair: bool,
    verify_hashes: bool,
    parallelism: usize,
    limits: Option<ParseLimitsDto>,
}

impl Default for ParseOptionsDto {
    fn default() -> Self {
        let options = ParseOptions::default();
        Self {
            strict: options.strict,
            repair: options.repair,
            verify_hashes: options.verify_hashes,
            parallelism: options.parallelism,
            limits: None,
        }
    }
}

impl ParseOptionsDto {
    /// 归一为 backing `ParseOptions`；`limits` 缺省回落默认值。
    fn into_parse_options(self) -> ParseOptions {
        let limits = match self.limits {
            None => ParseLimits::default(),
            Some(dto) => ParseLimits {
                max_yaml_bytes: dto.max_yaml_bytes,
                max_entry_count: dto.max_entry_count,
                max_uncompressed_bytes: dto.max_uncompressed_bytes,
                max_compression_ratio: dto.max_compression_ratio,
                max_aliases: dto.max_aliases,
                max_depth: dto.max_depth,
            },
        };
        ParseOptions {
            strict: self.strict,
            repair: self.repair,
            verify_hashes: self.verify_hashes,
            parallelism: self.parallelism,
            limits,
        }
    }
}

/// `documentEntries` 的分页窗口 `{ offset, limit }`（§12.1）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct EntriesRangeDto {
    offset: u64,
    limit: u64,
}

/// `documentReadResource` 的字节窗口 `{ offset, length }`（§12.1）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ResourceRangeDto {
    offset: u64,
    length: u64,
}

/// `documentSerialize` 的内容成员入参 `{ nodeId, value }`（RFC 点位四 §7.4 冻结表）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct ContentMemberDto {
    node_id: String,
    value: Value,
}

/// `documentSerialize` 请求 DTO（`IDocumentSerializeRequest` 同构 camelCase 形状，
/// RFC 点位四 §7.4 冻结表；值树经 `DocumentValue::from_json` 单点换算）。
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct DocumentSerializeRequestDto {
    kind: String,
    form: String,
    local_path: String,
    metadata: Value,
    structure: Value,
    contents: Vec<ContentMemberDto>,
    layout_config: Option<Value>,
    changed_parts: Vec<String>,
    removed_node_ids: Vec<String>,
}

/// 读取可选对象参数为 JSON 值；缺省（未传 / `undefined` / `null`）返回 `None`。
fn optional_json_argument(
    cx: &mut FunctionContext,
    index: usize,
) -> Result<Option<Value>, ChipsError> {
    let Some(value) = cx.argument_opt(index) else {
        return Ok(None);
    };
    if value.is_a::<JsUndefined, _>(cx) || value.is_a::<JsNull, _>(cx) {
        return Ok(None);
    }
    js_to_json(cx, &value)
        .map(Some)
        .map_err(ConvertIssue::into_error)
}

/// 把 JSON 值反序列化到 DTO；形状不符报告 `NATIVE_TYPE_UNSUPPORTED`。
fn deserialize_dto<T: serde::de::DeserializeOwned>(
    value: Value,
    pointer: &str,
    detail: &str,
) -> Result<T, ChipsError> {
    serde_json::from_value(value)
        .map_err(|error| type_unsupported(pointer, &format!("{detail}：{error}")))
}

/// 解析 `options?: INativeParseOptions` 实参（缺省回落 `ParseOptions::default`）。
fn parse_options_from_json(value: Option<Value>) -> Result<ParseOptions, ChipsError> {
    let Some(value) = value else {
        return Ok(ParseOptions::default());
    };
    let dto: ParseOptionsDto =
        deserialize_dto(value, "/options", "解析选项必须是受支持字段的普通对象")?;
    Ok(dto.into_parse_options())
}

/// 在 JS 线程读取 `options` 实参（固定位于第 2 位）。
fn parse_options_argument(
    cx: &mut FunctionContext,
    index: usize,
) -> Result<ParseOptions, ChipsError> {
    parse_options_from_json(optional_json_argument(cx, index)?)
}

/// 分页窗口 `{ offset, limit }` → `Range<usize>`；越界端点由 backing 收敛。
fn entries_range_from_json(value: Option<Value>) -> Result<Option<Range<usize>>, ChipsError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let dto: EntriesRangeDto =
        deserialize_dto(value, "/range", "分页窗口必须是 { offset, limit } 普通对象")?;
    let start = usize::try_from(dto.offset).unwrap_or(usize::MAX);
    let end = usize::try_from(dto.offset.saturating_add(dto.limit)).unwrap_or(usize::MAX);
    Ok(Some(start..end))
}

/// 字节窗口 `{ offset, length }` → 绝对 `Range<u64>`；求和溢出拒绝。
fn resource_range_from_json(value: Option<Value>) -> Result<Option<Range<u64>>, ChipsError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let dto: ResourceRangeDto = deserialize_dto(
        value,
        "/range",
        "字节窗口必须是 { offset, length } 普通对象",
    )?;
    let end = dto.offset.checked_add(dto.length).ok_or_else(|| {
        value_out_of_range("/range", "offset 与 length 之和超出字节偏移可表示范围")
    })?;
    Ok(Some(dto.offset..end))
}

/// `nodeId` 实参文本 → backing `NodeId`；非法形状以 `NATIVE_*` 拒绝。
fn node_id_from_text(text: &str) -> Result<NodeId, ChipsError> {
    NodeId::new(text)
        .ok_or_else(|| type_unsupported("/nodeId", "内容节点标识必须是 10 位 Base62 字母数字编号"))
}

/// 在 JS 线程读取分页窗口实参（缺省回落 `None`）。
fn entries_range_argument(
    cx: &mut FunctionContext,
    index: usize,
) -> Result<Option<Range<usize>>, ChipsError> {
    entries_range_from_json(optional_json_argument(cx, index)?)
}

/// 在 JS 线程读取字节窗口实参（缺省回落 `None`）。
fn resource_range_argument(
    cx: &mut FunctionContext,
    index: usize,
) -> Result<Option<Range<u64>>, ChipsError> {
    resource_range_from_json(optional_json_argument(cx, index)?)
}

// ---------------------------------------------------------------------------
// backing 调用与结果映射（纯 Rust，可离线单测）
// ---------------------------------------------------------------------------

/// `serde_json` 序列化收口；失败归一 `NATIVE_INTERNAL`（不携带堆栈）。
fn serialize_json<T: serde::Serialize + ?Sized>(
    value: &T,
    pointer: &str,
) -> Result<Value, ChipsError> {
    serde_json::to_value(value)
        .map_err(|error| internal_error(format!("{pointer} 结果序列化失败：{error}")))
}

/// `DocumentKind` 的 JS 判别字面量（与 backing serde `lowercase` 一致）。
const fn kind_label(kind: DocumentKind) -> &'static str {
    match kind {
        DocumentKind::Card => "card",
        DocumentKind::Box => "box",
    }
}

/// 组装 `{ kind, value, diagnostics }` 统一结果（§12.1 / §6.4）。
fn document_result(
    kind: DocumentKind,
    value: Value,
    diagnostics: &[Diagnostic],
) -> Result<Value, ChipsError> {
    Ok(json!({
        "kind": kind_label(kind),
        "value": value,
        "diagnostics": serialize_json(diagnostics, "/diagnostics")?,
    }))
}

/// 为自带 `{ kind, value }` 判别序列化（`DocumentMetadata` / `StructureModel`）
/// 追加 `diagnostics` 快照。
fn with_diagnostics(tagged: Value, diagnostics: &[Diagnostic]) -> Result<Value, ChipsError> {
    let mut tagged = tagged;
    let object = tagged
        .as_object_mut()
        .ok_or_else(|| internal_error("判别结果序列化形状异常（应为 { kind, value } 对象）"))?;
    if !object.contains_key("kind") || !object.contains_key("value") {
        return Err(internal_error("判别结果序列化缺少 kind / value 判别字段"));
    }
    object.insert(
        "diagnostics".to_owned(),
        serialize_json(diagnostics, "/diagnostics")?,
    );
    Ok(tagged)
}

/// 三入口共享的阻塞打开工作（在绑定层运行时线程执行）。
fn open_blocking(
    mode: OpenMode,
    path: String,
    options: ParseOptions,
) -> Result<DocumentHandle, ChipsError> {
    let target = Path::new(&path);
    let opened = match mode {
        OpenMode::Auto => open_document(target, &options),
        OpenMode::Card => CardParser::new(options).open(target),
        OpenMode::Box => BoxParser::new(options).open(target),
    };
    opened.map_err(ChipsError::from)
}

/// `documentMetadata`：L0 冻结元数据 + 句柄诊断快照。
fn metadata_result(handle: &DocumentHandle) -> Result<Value, ChipsError> {
    let tagged = serialize_json(handle.metadata().as_ref(), "/value")?;
    with_diagnostics(tagged, &handle.diagnostics())
}

/// `documentStructure`：L1 结构（首次访问触达）+ 诊断快照。
fn structure_result(handle: &DocumentHandle) -> Result<Value, ChipsError> {
    let structure = handle.structure().map_err(ChipsError::from)?;
    let tagged = serialize_json(structure.as_ref(), "/value")?;
    with_diagnostics(tagged, &handle.diagnostics())
}

/// `documentContent`：L2 单节点 + 诊断快照。
fn content_result(handle: &DocumentHandle, node: &NodeId) -> Result<Value, ChipsError> {
    let content = handle.content(node).map_err(ChipsError::from)?;
    let value = serialize_json(content.as_ref(), "/value")?;
    document_result(handle.kind(), value, &handle.diagnostics())
}

/// `documentEntries`：L2 条目分页 + 诊断快照。
fn entries_result(
    handle: &DocumentHandle,
    range: Option<Range<usize>>,
) -> Result<Value, ChipsError> {
    let entries = handle.entries(range).map_err(ChipsError::from)?;
    let value = serialize_json(entries.as_ref(), "/value")?;
    document_result(handle.kind(), value, &handle.diagnostics())
}

/// `documentLayoutConfig`：L2 箱子布局配置单元（`.box/content.yaml` 根值）
/// 与诊断快照。卡片句柄由 backing 以契约码拒绝；文件缺失或校验失败按
/// §8.4 返回空映射占位并携带错误级诊断（不视为导出失败）。
fn layout_config_result(handle: &DocumentHandle) -> Result<Value, ChipsError> {
    let layout = handle.layout_config().map_err(ChipsError::from)?;
    let value = serialize_json(layout.as_ref(), "/value")?;
    document_result(handle.kind(), value, &handle.diagnostics())
}

/// 修订 DTO 的成员项（工单034 §五.1 冻结形状；`modifiedMillis` / `crc32`
/// 对应 Rust `Option` → `null`）。
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RevisionMemberDto {
    path: String,
    size: u64,
    modified_millis: Option<i64>,
    crc32: Option<u32>,
}

/// 修订 DTO 的数据源指纹项（`kind` 取 `directory` / `archive` 判别字面量，
/// 成员保持 backing 的包内路径升序）。
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RevisionSourceDto {
    kind: &'static str,
    members: Vec<RevisionMemberDto>,
}

/// `documentRevision` 返回值 DTO（工单034 §五.1 逐字冻结的 camelCase 形状）。
#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentRevisionDto {
    source: RevisionSourceDto,
    chip_standards_version: String,
    index_digest: String,
}

/// `documentRevision`：修订与源指纹（工单034 正式化导出）。
///
/// `DocumentHandle::revision()` 的 DTO 直投（§8.2 经 `serde_json::Value` 中转），
/// 形状为 `{ source: { kind, members: [{ path, size, modifiedMillis, crc32 }] },
/// chipStandardsVersion, indexDigest }`。构建为常数时间、不读取资源正文
/// （《06-文档解析器设计》§5.4、《11-文档服务设计》§5.5）；宿主侧
/// `digest.ts` 直接映射为 `ISourceFingerprint`。
fn revision_result(handle: &DocumentHandle) -> Result<Value, ChipsError> {
    let revision = handle.revision();
    let dto = DocumentRevisionDto {
        source: RevisionSourceDto {
            kind: match revision.source.kind {
                SourceKind::Directory => "directory",
                SourceKind::Archive => "archive",
            },
            members: revision
                .source
                .members
                .iter()
                .map(|(path, fingerprint)| RevisionMemberDto {
                    path: path.as_str().to_owned(),
                    size: fingerprint.size,
                    modified_millis: fingerprint.modified_millis,
                    crc32: fingerprint.crc32,
                })
                .collect(),
        },
        chip_standards_version: revision.chip_standards_version,
        index_digest: revision.index_digest,
    };
    serialize_json(&dto, "/revision")
}

/// `documentReadResource`：L3 资源字节（复制一次交付，Rust 侧不保留）。
fn read_resource_bytes(
    handle: &DocumentHandle,
    path: &PackagePath,
    range: Option<Range<u64>>,
) -> Result<Vec<u8>, ChipsError> {
    let mut stream = handle
        .read_resource(path, range)
        .map_err(ChipsError::from)?;
    stream.read_to_vec().map_err(ChipsError::from)
}

/// `documentValidate`：严格校验报告直接投影（§6.5 形状）。
fn validate_result(handle: &DocumentHandle) -> Result<Value, ChipsError> {
    let report = handle.validate().map_err(ChipsError::from)?;
    serialize_json(&report, "/value")
}

/// `buildDocumentView`：视图构建（backing 已返回归一 `ChipsError`，§6.6）。
fn view_result(handle: &DocumentHandle, session: SessionId) -> Result<Value, ChipsError> {
    let view = build_document_view(handle, session)?;
    serialize_json(&view, "/value")
}

// ---------------------------------------------------------------------------
// 序列化导出（工单036 波 C3：落盘序列化载体，算法权威 chips-parser::serialize）
// ---------------------------------------------------------------------------

/// 序列化结果成员（宿主 `IDocumentSerializedMember` 同构；字节不经 JSON 文本通道，
/// settle 阶段逐成员以 `JsBuffer` 交付，零 base64 膨胀）。
#[derive(Debug)]
struct SerializedMemberDto {
    package_path: String,
    bytes: Vec<u8>,
}

/// 判别字面量 → `DocumentKind`（backing serde `lowercase` 同字面量）。
fn parse_document_kind(text: &str) -> Result<DocumentKind, ChipsError> {
    match text {
        "card" => Ok(DocumentKind::Card),
        "box" => Ok(DocumentKind::Box),
        _ => Err(type_unsupported(
            "/kind",
            "文档类别必须是 card / box 判别字面量",
        )),
    }
}

/// 判别字面量 → `SerializeForm`（backing `SerializeForm::from_text` 同字面量）。
fn parse_serialize_form(text: &str) -> Result<SerializeForm, ChipsError> {
    SerializeForm::from_text(text).ok_or_else(|| {
        type_unsupported(
            "/form",
            "包形态必须是 directory / archive 判别字面量",
        )
    })
}

/// Unix 毫秒（保存时刻）→ `SystemTime`（换算单源 `convert::system_time_from_unix_millis`，
/// 与归档整包换代时间戳同一判闸：非有限值、负值、非整数与超上界一律拒绝）。
fn saved_at_from_unix_millis(raw: f64) -> Result<SystemTime, ChipsError> {
    crate::convert::system_time_from_unix_millis(raw, "/savedAtUnixMs").map_err(ConvertIssue::into_error)
}

/// DTO → backing 序列化请求（值树换算单源 `DocumentValue::from_json`，整数保持整数语义）。
fn serialize_request_from_dto(
    dto: DocumentSerializeRequestDto,
) -> Result<DocumentSerializeRequest, ChipsError> {
    Ok(DocumentSerializeRequest {
        kind: parse_document_kind(&dto.kind)?,
        form: parse_serialize_form(&dto.form)?,
        local_path: PathBuf::from(dto.local_path),
        metadata: DocumentValue::from_json(&dto.metadata),
        structure: DocumentValue::from_json(&dto.structure),
        contents: dto
            .contents
            .into_iter()
            .map(|item| ContentMemberValue {
                node_id: item.node_id,
                value: DocumentValue::from_json(&item.value),
            })
            .collect(),
        layout_config: dto
            .layout_config
            .map(|value| DocumentValue::from_json(&value)),
        changed_parts: dto.changed_parts,
        removed_node_ids: dto.removed_node_ids,
    })
}

/// `documentSerialize` 的 backing 调用（纯 Rust，可离线单测）：序列化变更成员与
/// 依赖成员（`file_info` / `manifest` 重算与未修订成员字节比对过滤全在 backing）。
fn serialize_members(
    request: DocumentSerializeRequest,
    saved_at: SystemTime,
) -> Result<Vec<SerializedMemberDto>, ChipsError> {
    let members = serialize_document(&request, saved_at).map_err(ChipsError::from)?;
    Ok(members
        .into_iter()
        .map(|member| SerializedMemberDto {
            package_path: member.package_path.as_str().to_owned(),
            bytes: member.bytes,
        })
        .collect())
}

// ---------------------------------------------------------------------------
// settle 入口（具名函数满足 `spawn_result` 的高阶 `for<'a>` 约束）
// ---------------------------------------------------------------------------

/// 把打开结果装箱为不透明句柄。
fn settle_handle<'a>(cx: &mut Cx<'a>, handle: DocumentHandle) -> JsResult<'a, JsValue> {
    Ok(cx.boxed(NativeDocumentHandle::new(handle)).upcast())
}

/// 把资源字节复制一次交付 `Buffer`（§8.2：`Vec<u8>` ↔ `Buffer`）。
fn settle_buffer<'a>(cx: &mut Cx<'a>, bytes: Vec<u8>) -> JsResult<'a, JsValue> {
    let buffer = JsBuffer::from_slice(cx, &bytes)?;
    Ok(buffer.upcast::<JsValue>())
}

/// `documentClose` 的空结果。
fn settle_unit<'a>(cx: &mut Cx<'a>, (): ()) -> JsResult<'a, JsValue> {
    Ok(cx.undefined().upcast())
}

/// 统一的异步导出调度：JS 线程只做参数提取与 `JsPromise` 组装，阻塞工作
/// 提交绑定层运行时线程，结果经 `Channel` 回投 settle（§8.3）。
fn spawn_export<'a, T, F, S>(
    cx: &mut FunctionContext<'a>,
    work: F,
    settle: S,
) -> JsResult<'a, JsPromise>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, ChipsError> + Send + 'static,
    S: for<'b> FnOnce(&mut Cx<'b>, T) -> JsResult<'b, JsValue> + Send + 'static,
{
    // 运行时先行确认：`spawn_result` 此后不会再失败，`Deferred` 必然移交 settle。
    if let Err(error) = runtime() {
        return throw_chips_error(cx, error);
    }
    let (deferred, promise) = cx.promise();
    let channel = cx.channel();
    // 运行时已就绪；意外失败时 `Deferred` 由 N-API 6+ 自动拒绝（§8.3 规则 8）。
    let _ = spawn_result(deferred, channel, async move { work() }, settle);
    Ok(promise)
}

/// 解析文档句柄实参（位置 0）。
///
/// 外层 `Err` 是 neon 已抛出的实参类型错误（原样传播）；内层 `Err` 是
/// 句柄已释放的绑定层拒绝（`NATIVE_TYPE_UNSUPPORTED`）。
fn document_handle(
    cx: &mut FunctionContext,
) -> Result<Result<Arc<DocumentHandle>, ChipsError>, neon::result::Throw> {
    let boxed = cx.argument::<JsBox<NativeDocumentHandle>>(0)?;
    Ok(boxed.acquire())
}

/// `document_handle` 结果的导出侧收口：成功取句柄，否则抛出/传播错误。
macro_rules! handle_argument {
    ($cx:ident) => {
        match document_handle(&mut $cx) {
            Ok(Ok(handle)) => handle,
            Ok(Err(error)) => return throw_chips_error(&mut $cx, error),
            Err(throw) => return Err(throw),
        }
    };
}

// ---------------------------------------------------------------------------
// 导出实现（§6.4 表序；全部异步）
// ---------------------------------------------------------------------------

/// `openDocument(path, options?)`：自动识别格式并打开到 L0。
pub(crate) fn js_open_document(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let options = match parse_options_argument(&mut cx, 1) {
        Ok(options) => options,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(
        &mut cx,
        move || open_blocking(OpenMode::Auto, path, options),
        settle_handle,
    )
}

/// `openCard(path, options?)`：严格 card 入口。
pub(crate) fn js_open_card(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let options = match parse_options_argument(&mut cx, 1) {
        Ok(options) => options,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(
        &mut cx,
        move || open_blocking(OpenMode::Card, path, options),
        settle_handle,
    )
}

/// `openBox(path, options?)`：严格 box 入口。
pub(crate) fn js_open_box(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let options = match parse_options_argument(&mut cx, 1) {
        Ok(options) => options,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(
        &mut cx,
        move || open_blocking(OpenMode::Box, path, options),
        settle_handle,
    )
}

/// `documentMetadata(handle)`：L0 元数据（常数时间）+ 诊断快照。
pub(crate) fn js_document_metadata(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    spawn_export(&mut cx, move || metadata_result(&handle), settle_json)
}

/// `documentStructure(handle)`：L1 结构（首次访问触发解析）+ 诊断快照。
pub(crate) fn js_document_structure(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    spawn_export(&mut cx, move || structure_result(&handle), settle_json)
}

/// `documentContent(handle, nodeId)`：L2 单内容节点。
pub(crate) fn js_document_content(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    let node_text = cx.argument::<JsString>(1)?.value(&mut cx);
    let node = match node_id_from_text(&node_text) {
        Ok(node) => node,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(&mut cx, move || content_result(&handle, &node), settle_json)
}

/// `documentEntries(handle, range?)`：L2 条目分页读取。
pub(crate) fn js_document_entries(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    let range = match entries_range_argument(&mut cx, 1) {
        Ok(range) => range,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(&mut cx, move || entries_result(&handle, range), settle_json)
}

/// `documentLayoutConfig(handle)`：L2 箱子布局配置单元（`.box/content.yaml` 根值）。
pub(crate) fn js_document_layout_config(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    spawn_export(&mut cx, move || layout_config_result(&handle), settle_json)
}

/// `documentRevision(handle)`：修订与源指纹（常数时间，不读取资源正文）。
pub(crate) fn js_document_revision(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    spawn_export(&mut cx, move || revision_result(&handle), settle_json)
}

/// `documentReadResource(handle, path, range?)`：L3 资源字节 → `Buffer`。
pub(crate) fn js_document_read_resource(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    let path_text = cx.argument::<JsString>(1)?.value(&mut cx);
    let path = match PackagePath::new(&path_text) {
        Ok(path) => path,
        // 路径校验是 backing 契约（`DOCUMENT_PATH_UNSAFE`），原样透传。
        Err(error) => return throw_chips_error(&mut cx, ChipsError::from(error)),
    };
    let range = match resource_range_argument(&mut cx, 2) {
        Ok(range) => range,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    spawn_export(
        &mut cx,
        move || read_resource_bytes(&handle, &path, range),
        settle_buffer,
    )
}

/// `documentValidate(handle)`：严格校验报告。
pub(crate) fn js_document_validate(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    spawn_export(&mut cx, move || validate_result(&handle), settle_json)
}

/// `buildDocumentView(handle, session)`：文档视图构建器（§6.6）。
pub(crate) fn js_build_document_view(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let handle = handle_argument!(cx);
    let raw = cx.argument::<JsNumber>(1)?.value(&mut cx);
    let Some(session) = normalize_u64_field(raw) else {
        return throw_chips_error(
            &mut cx,
            value_out_of_range("/session", "必须是不超过 2^53 的非负整数值"),
        );
    };
    spawn_export(&mut cx, move || view_result(&handle, session), settle_json)
}

/// `documentClose(handle)`：显式释放归档映射；幂等，未关闭时 `Finalize` 兜底。
pub(crate) fn js_document_close(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let boxed = cx.argument::<JsBox<NativeDocumentHandle>>(0)?;
    let released = boxed.release();
    spawn_export(
        &mut cx,
        move || -> Result<(), ChipsError> {
            // 释放（含归档映射解除）发生在绑定层运行时线程，不占用 JS 线程。
            drop(released);
            Ok(())
        },
        settle_unit,
    )
}

/// 序列化成员数组 settle：`Array<{ packagePath: string, bytes: Buffer }>`（§8.2 字节
/// 经 `Buffer` 复制一次交付；成员序保持 backing 的包内路径升序）。
fn settle_members<'a>(cx: &mut Cx<'a>, members: Vec<SerializedMemberDto>) -> JsResult<'a, JsValue> {
    let array: Handle<JsArray> = cx.empty_array();
    for (index, member) in members.into_iter().enumerate() {
        let object: Handle<JsObject> = cx.empty_object();
        let package_path = cx.string(member.package_path);
        object.set(cx, "packagePath", package_path)?;
        let buffer = JsBuffer::from_slice(cx, &member.bytes)?;
        object.set(cx, "bytes", buffer)?;
        array.set(cx, index as u32, object)?;
    }
    Ok(array.upcast())
}

/// `documentSerialize(request, savedAtUnixMs)`：序列化变更成员与依赖成员
/// （工单036 波 C3，RFC 点位四 D3 序列化载体）。backing = `chips-parser::serialize`
/// 的 C1 纯函数（`file_info` / `manifest` 重算、未修订成员字节比对过滤、防写回校验
/// 全在 backing）；`savedAtUnixMs` 由调用方单源交付（宿主适配器取保存时刻），
/// 保持算法纯函数性质。§11.3 同族异步导出：成员字节以 `Buffer` 复制一次交付。
pub(crate) fn js_document_serialize(mut cx: FunctionContext) -> JsResult<JsPromise> {
    let raw = cx.argument::<JsValue>(0)?;
    let request_value = js_to_json(&mut cx, &raw).map_err(ConvertIssue::into_error);
    let request_value = match request_value {
        Ok(value) => value,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    let dto: DocumentSerializeRequestDto = match deserialize_dto(
        request_value,
        "/request",
        "序列化请求必须是受支持字段的普通对象（kind/form/localPath/metadata/structure/contents/layoutConfig/changedParts/removedNodeIds）",
    ) {
        Ok(dto) => dto,
        Err(error) => return throw_chips_error(&mut cx, error),
    };
    let saved_millis = cx.argument::<JsNumber>(1)?.value(&mut cx);
    spawn_export(
        &mut cx,
        move || {
            let saved_at = saved_at_from_unix_millis(saved_millis)?;
            serialize_members(serialize_request_from_dto(dto)?, saved_at)
        },
        settle_members,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{Duration, UNIX_EPOCH};
    use std::path::PathBuf;

    /// 测试节点标识（与《核心接口规范》§12.3 示例一致）。
    const NODE: &str = "a1B2c3D4e5";

    /// 在临时目录开辟一棵独立小树；返回根路径。
    fn temp_root(tag: &str) -> PathBuf {
        let base = std::env::temp_dir().join(format!(
            "chips-native-parser-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("创建夹具根目录");
        base
    }

    /// 写入成员（自动创建父目录）。
    fn write(root: &Path, relative: &str, content: &str) {
        let target = root.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).expect("创建成员父目录");
        }
        fs::write(target, content).expect("写入成员");
    }

    /// 最小合法卡片夹具（目录态，《核心接口规范》§6.2）。
    fn write_minimal_card(root: &Path) {
        write(
            root,
            ".card/metadata.yaml",
            "chip_standards_version: \"1.0.0\"\n\
             card_id: a1B2c3D4e5\n\
             name: 绑定测试卡片\n\
             created_at: \"2026-01-01T00:00:00Z\"\n\
             modified_at: \"2026-01-02T00:00:00Z\"\n",
        );
        write(
            root,
            ".card/structure.yaml",
            "structure:\n  - id: a1B2c3D4e5\n    type: base.text\nmanifest:\n  card_count: 1\n  resource_count: 0\n",
        );
        write(
            root,
            "content/a1B2c3D4e5.yaml",
            "card_type: base.text\ntext: 你好\n",
        );
        write(root, ".card/cover.html", "<!DOCTYPE html>\n<html></html>\n");
    }

    /// 最小合法箱子夹具（目录态）。
    fn write_minimal_box(root: &Path) {
        write(
            root,
            ".box/metadata.yaml",
            "chip_standards_version: \"1.0.0\"\n\
             box_id: z9Y8x7W6v5\n\
             name: 绑定测试箱子\n\
             created_at: \"2026-01-01T00:00:00Z\"\n\
             modified_at: \"2026-01-02T00:00:00Z\"\n\
             active_layout_type: grid\n",
        );
        write(
            root,
            ".box/structure.yaml",
            "entries:\n  - entry_id: E000000001\n    url: https://example.com/page-a\n    enabled: true\n  - entry_id: E000000002\n    url: https://example.com/page-b\n    enabled: false\n",
        );
        write(
            root,
            ".box/content.yaml",
            "active_layout_type: grid\nlayout_configs:\n  grid:\n    schema_version: \"1.0.0\"\n    props:\n      column_count: 4\n",
        );
        write(root, ".box/cover.html", "<!DOCTYPE html>\n<html></html>\n");
    }

    /// 打开最小卡片夹具的句柄（backing 直连，测试专用）。
    fn open_card_fixture(root: &Path) -> DocumentHandle {
        open_blocking(
            OpenMode::Card,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("最小卡片夹具必须可打开")
    }

    fn json_option(raw: Value) -> Option<Value> {
        Some(raw)
    }

    #[test]
    fn test_parse_options_maps_camel_case_fields_and_limits() {
        let options = parse_options_from_json(json_option(json!({
            "strict": true,
            "repair": false,
            "verifyHashes": true,
            "parallelism": 2,
            "limits": { "maxYamlBytes": 1024, "maxDepth": 8 },
        })))
        .expect("合法选项必须可解析");
        assert!(options.strict);
        assert!(!options.repair);
        assert!(options.verify_hashes);
        assert_eq!(options.parallelism, 2);
        assert_eq!(options.limits.max_yaml_bytes, 1024);
        assert_eq!(options.limits.max_depth, 8);
        // 未提供的限额字段回落 backing 默认值。
        assert_eq!(
            options.limits.max_entry_count,
            ParseLimits::default().max_entry_count
        );
    }

    #[test]
    fn test_parse_options_defaults_and_rejects_invalid_shapes() {
        let defaults = parse_options_from_json(None).expect("缺省必须回落默认选项");
        assert_eq!(defaults, ParseOptions::default());
        // 未知字段（含 snake_case 误写）一律拒绝，防止选项静默失效。
        let error = parse_options_from_json(json_option(json!({ "verify_hashes": true })))
            .expect_err("snake_case 字段必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);
        let error = parse_options_from_json(json_option(json!({ "parallelism": -1 })))
            .expect_err("负并行度必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);
    }

    #[test]
    fn test_entries_range_windows_and_rejections() {
        assert_eq!(entries_range_from_json(None).expect("缺省窗口"), None);
        let window = entries_range_from_json(json_option(json!({ "offset": 2, "limit": 3 })))
            .expect("合法窗口")
            .expect("Some");
        assert_eq!(window, 2..5);
        // 端点收敛到 usize 上限，由 backing 与集合长度求交。
        let huge = entries_range_from_json(json_option(json!({
            "offset": u64::MAX,
            "limit": u64::MAX
        })))
        .expect("天量窗口必须饱和而非溢出")
        .expect("Some");
        assert_eq!(huge, usize::MAX..usize::MAX);
        let error = entries_range_from_json(json_option(json!({ "offset": 0 })))
            .expect_err("缺 limit 的窗口必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);
    }

    #[test]
    fn test_resource_range_maps_absolute_window_and_guards_overflow() {
        assert_eq!(resource_range_from_json(None).expect("缺省窗口"), None);
        let window = resource_range_from_json(json_option(json!({ "offset": 4, "length": 8 })))
            .expect("合法窗口")
            .expect("Some");
        assert_eq!(window, 4..12);
        let error = resource_range_from_json(json_option(json!({
            "offset": u64::MAX,
            "length": 1
        })))
        .expect_err("求和溢出必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
    }

    #[test]
    fn test_open_backing_maps_missing_path_to_not_found() {
        let error = open_blocking(
            OpenMode::Card,
            "/definitely-missing-from-anywhere.card".to_owned(),
            ParseOptions::default(),
        )
        .expect_err("不存在的路径必须失败");
        // backing 契约码原样透传（§8.5），绑定层不加码。
        assert_eq!(error.code(), "DOCUMENT_NOT_FOUND");
    }

    #[test]
    fn test_open_document_auto_recognizes_card() {
        let root = temp_root("auto");
        write_minimal_card(&root);
        let handle = open_blocking(
            OpenMode::Auto,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("自动识别必须命中卡片目录态");
        assert_eq!(handle.kind(), DocumentKind::Card);
        let metadata = metadata_result(&handle).expect("元数据结果必须可构造");
        assert_eq!(metadata["kind"], "card");
        assert_eq!(metadata["value"]["card_id"], NODE);
        assert!(metadata["diagnostics"].is_array());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_card_accessor_results_carry_kind_value_diagnostics() {
        let root = temp_root("card");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);

        let structure = structure_result(&handle).expect("结构结果必须可构造");
        assert_eq!(structure["kind"], "card");
        assert_eq!(structure["value"]["structure"][0]["id"], NODE);
        assert_eq!(structure["value"]["structure"][0]["type"], "base.text");

        let content = content_result(&handle, &NodeId::new(NODE).expect("合法标识"))
            .expect("内容结果必须可构造");
        assert_eq!(content["kind"], "card");
        assert_eq!(content["value"]["node_id"], NODE);
        assert_eq!(content["value"]["card_type"], "base.text");
        assert_eq!(content["value"]["value"]["text"], "你好");

        // `main` 不是 10 位 Base62 标识（规范 §6.5 示例的已知漂移）：
        // 绑定层以 `NATIVE_*` 码拒绝，不下放 backing。
        let error = node_id_from_text("main").expect_err("非法节点标识必须被拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);

        let report = validate_result(&handle).expect("校验报告必须可构造");
        assert_eq!(report["kind"], "card");
        assert!(matches!(
            report["status"].as_str(),
            Some("valid") | Some("validwithwarnings") | Some("invalid")
        ));
        assert!(report["statistics"].is_object());
        assert!(report["diagnostics"].is_array());

        let view = view_result(&handle, 7).expect("卡片视图必须可构建");
        assert_eq!(view["kind"], "card");
        assert_eq!(view["card_id"], NODE);
        assert_eq!(view["content_nodes"][0]["node_id"], NODE);
        assert_eq!(view["content_nodes"][0]["content"]["text"], "你好");
        assert_eq!(view["cover"]["entry"], ".card/cover.html");
        assert_eq!(view["cover"]["ratio"], "3:4");
        let _ = fs::remove_dir_all(&root);
    }

    /// 工单037 回归锁（/tmp/w115-repro native-probe 转正进 native 波测试面）：
    /// 真夹具视图修订恒落 `<2^53` 线格式契约、跨连续构建严格递增、经
    /// `settle_json` 同一条 JSON→JS 数值转换判闸恒可通过。
    #[test]
    fn test_build_document_view_revision_within_wire_boundary_and_monotonic() {
        let root = temp_root("view-revision");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);
        // 探针双臂：同一句柄 session 1 / session 2 连续构建（复现器交错的
        // 正是两个渲染会话的 buildDocumentView）。
        let mut previous: Option<u64> = None;
        for session in [1_u64, 2] {
            let view = view_result(&handle, session)
                .expect("真夹具视图构建必须成功（工单037 修复前恒 NATIVE_VALUE_OUT_OF_RANGE）");
            let raw = view["revision"].as_u64().expect("修订号必须是 u64 数值");
            assert!(
                raw < crate::convert::MAX_SAFE_INTEGER,
                "视图修订越出 JS 安全整数契约：{raw}"
            );
            // 与 settle_json 同一判闸路径：`/revision` 指针臂过界即拒。
            let number = serde_json::Number::from(raw);
            crate::convert::json_number_to_js(&number, "/revision")
                .expect("视图修订跨 JS 边界必须通过 <2^53 判闸");
            if let Some(last) = previous {
                assert!(raw > last, "同一句柄跨连续构建修订必须严格递增");
            }
            previous = Some(raw);
        }
        assert_eq!(previous, Some(1), "首开基线 0、写后再取 1 的会话序列对位");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_card_entries_misuse_maps_contract_code() {
        let root = temp_root("misuse");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);
        let error = entries_result(&handle, None).expect_err("卡片句柄读条目必须失败");
        assert_eq!(error.code(), "DOCUMENT_FORMAT_UNKNOWN");
        let error =
            node_id_from_text("not-an-id!").expect_err("含非字母数字字符的标识必须被绑定层拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);
        let content = content_result(&handle, &NodeId::new(NODE).expect("合法标识"))
            .expect("合法标识在卡片句柄上可读取");
        assert_eq!(content["kind"], "card");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_box_entries_range_view_and_content_misuse() {
        let root = temp_root("box");
        write_minimal_box(&root);
        let handle = open_blocking(
            OpenMode::Box,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("最小箱子夹具必须可打开");

        let all = entries_result(&handle, None).expect("全量条目必须可读取");
        assert_eq!(all["kind"], "box");
        assert_eq!(all["value"].as_array().expect("条目数组").len(), 2);
        assert_eq!(all["value"][0]["entry_id"], "E000000001");
        assert_eq!(all["value"][1]["enabled"], false);

        let window = entries_result(&handle, Some(1..2)).expect("分页窗口必须可读取");
        let items = window["value"].as_array().expect("条目数组");
        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["entry_id"], "E000000002");

        let overflow = entries_result(&handle, Some(9..12)).expect("越界窗口收敛为空前不报错");
        assert!(overflow["value"].as_array().expect("条目数组").is_empty());

        let view = view_result(&handle, 1).expect("箱子视图必须可构建");
        assert_eq!(view["kind"], "box");
        assert_eq!(view["box_id"], "z9Y8x7W6v5");
        assert_eq!(view["active_layout_type"], "grid");
        assert_eq!(view["layout_config"]["column_count"], 4);
        assert_eq!(view["entries"][0]["url"], "https://example.com/page-a");

        let error = content_result(&handle, &NodeId::new(NODE).expect("合法标识"))
            .expect_err("箱子句柄读内容节点必须失败");
        assert_eq!(error.code(), "DOCUMENT_FORMAT_UNKNOWN");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_box_layout_config_dto_shape_and_partial_success() {
        let root = temp_root("layout");
        write_minimal_box(&root);
        let handle = open_blocking(
            OpenMode::Box,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("最小箱子夹具必须可打开");

        // 正向 DTO 形状：`{ kind, value, diagnostics }` 统一信封，
        // `value` 为 `.box/content.yaml` 根值（顺序保持映射）。
        let result = layout_config_result(&handle).expect("布局配置结果必须可构造");
        assert_eq!(result["kind"], "box");
        assert_eq!(result["value"]["active_layout_type"], "grid");
        assert_eq!(
            result["value"]["layout_configs"]["grid"]["props"]["column_count"],
            4
        );
        assert!(result["diagnostics"].is_array());

        // §8.4 部分成功：布局单元缺失不是导出失败——返回空映射占位并
        // 携带错误级诊断（生效布局不可用，视图侧按空配置渲染）。
        let damaged = temp_root("layout-missing");
        write_minimal_box(&damaged);
        fs::remove_file(damaged.join(".box/content.yaml")).expect("移除布局单元");
        let handle = open_blocking(
            OpenMode::Box,
            damaged.display().to_string(),
            ParseOptions::default(),
        )
        .expect("缺布局单元的箱子必须可打开（L2 触达才判定）");
        let result = layout_config_result(&handle).expect("缺布局单元必须按占位成功返回");
        assert_eq!(result["kind"], "box");
        assert_eq!(result["value"], json!({}));
        assert!(
            result["diagnostics"]
                .as_array()
                .expect("诊断必须是数组")
                .iter()
                .any(|item| item["severity"] == "error"),
            "占位结果必须携带错误级诊断"
        );
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&damaged);
    }

    #[test]
    fn test_card_layout_config_misuse_maps_contract_code() {
        let root = temp_root("layout-misuse");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);
        // 卡片句柄无布局配置单元：backing 契约码原样透传（§8.5），绑定层不加码。
        let error = layout_config_result(&handle).expect_err("卡片句柄读布局配置必须失败");
        assert_eq!(error.code(), "DOCUMENT_FORMAT_UNKNOWN");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_document_revision_card_directory_shape_and_determinism() {
        let root = temp_root("revision-card");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);

        let revision = revision_result(&handle).expect("修订结果必须可构造（常数时间）");
        assert_eq!(revision["source"]["kind"], "directory");
        assert_eq!(revision["chipStandardsVersion"], "1.0.0");
        let members = revision["source"]["members"]
            .as_array()
            .expect("成员必须是数组");
        // 目录态：`.card` 三成员 + `content/` 分片，全部在列且按包内路径升序。
        let paths = members
            .iter()
            .map(|item| item["path"].as_str().expect("path 必须是字符串"))
            .collect::<Vec<_>>();
        assert!(paths.contains(&".card/metadata.yaml"));
        assert!(paths.contains(&".card/structure.yaml"));
        assert!(paths.contains(&".card/cover.html"));
        assert!(paths.contains(&"content/a1B2c3D4e5.yaml"));
        let mut sorted = paths.clone();
        sorted.sort();
        assert_eq!(paths, sorted, "成员必须保持包内路径升序");
        for item in members {
            assert!(item["size"].as_u64().is_some(), "size 必须是数值");
            // 目录态无 CRC32：`crc32` 恒为 `null`；修改时间存在且为整数毫秒。
            assert!(item["crc32"].is_null());
            assert!(
                item["modifiedMillis"].is_i64()
                    || item["modifiedMillis"].is_u64()
                    || item["modifiedMillis"].is_null(),
                "modifiedMillis 只允许整数或 null"
            );
        }
        let digest = revision["indexDigest"]
            .as_str()
            .expect("索引摘要必须是字符串");
        assert!(
            digest.len() == 64
                && digest
                    .chars()
                    .all(|c| c.is_ascii_digit() || ('a'..='f').contains(&c)),
            "indexDigest 必须是 64 位小写十六进制：{digest}"
        );

        // 确定性：同一句柄两次取数逐字段一致（常数时间投影，无副作用）。
        let again = revision_result(&handle).expect("重复取数必须成功");
        assert_eq!(revision, again);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_document_revision_tracks_membership_changes() {
        let root = temp_root("revision-box");
        write_minimal_box(&root);
        let handle = open_blocking(
            OpenMode::Box,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("最小箱子夹具必须可打开");
        let before = revision_result(&handle).expect("箱子修订必须可构造");
        assert_eq!(before["source"]["kind"], "directory");
        assert!(before["source"]["members"]
            .as_array()
            .expect("成员数组")
            .iter()
            .any(|item| item["path"] == ".box/content.yaml"));

        // 外部新增成员后重开：成员集合与索引摘要随之变化（§7.1 基线复查的载体语义）。
        write(&root, "assets/note.txt", "外部新增成员");
        let reopened = open_blocking(
            OpenMode::Box,
            root.display().to_string(),
            ParseOptions::default(),
        )
        .expect("新增成员后必须仍可打开");
        let after = revision_result(&reopened).expect("重开后修订必须可构造");
        assert_ne!(
            before["indexDigest"], after["indexDigest"],
            "指纹集合变化必须改变索引摘要"
        );
        assert!(after["source"]["members"]
            .as_array()
            .expect("成员数组")
            .iter()
            .any(|item| item["path"] == "assets/note.txt"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_read_resource_bytes_window_and_error_codes() {
        let root = temp_root("resource");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);
        let metadata_path = PackagePath::new(".card/metadata.yaml").expect("合法包内路径");

        let bytes = read_resource_bytes(&handle, &metadata_path, None).expect("全量读取必须成功");
        assert!(String::from_utf8_lossy(&bytes).contains("绑定测试卡片"));

        let window =
            read_resource_bytes(&handle, &metadata_path, Some(0..4)).expect("窗口读取必须成功");
        assert_eq!(window, vec![b'c', b'h', b'i', b'p']);

        let error = read_resource_bytes(&handle, &metadata_path, Some(0..1 << 40))
            .expect_err("越出成员长度的窗口必须失败");
        assert_eq!(error.code(), "DOCUMENT_IO");

        let error = read_resource_bytes(
            &handle,
            &PackagePath::new("assets/missing.png").expect("合法包内路径"),
            None,
        )
        .expect_err("缺失成员必须失败");
        assert_eq!(error.code(), "DOCUMENT_NOT_FOUND");

        let error = PackagePath::new("../escape").expect_err("越界路径必须被 backing 拒绝");
        assert_eq!(ChipsError::from(error).code(), "DOCUMENT_PATH_UNSAFE");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_native_handle_acquire_release_is_idempotent() {
        let root = temp_root("close");
        write_minimal_card(&root);
        let handle = open_card_fixture(&root);
        let carrier = NativeDocumentHandle::new(handle);

        assert!(carrier.acquire().is_ok(), "释放前句柄必须可用");
        assert!(carrier.release().is_some(), "首次释放必须交出内部句柄");
        assert!(carrier.release().is_none(), "重复释放必须幂等");
        let error = carrier.acquire().expect_err("释放后访问必须被绑定层拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_kind_label_matches_backing_serde_projection() {
        // `DocumentKind` 的 serde 判别（`lowercase`）与绑定层判别字面量逐字一致。
        assert_eq!(
            serialize_json(&DocumentKind::Card, "/kind").expect("序列化"),
            Value::from(kind_label(DocumentKind::Card))
        );
        assert_eq!(
            serialize_json(&DocumentKind::Box, "/kind").expect("序列化"),
            Value::from(kind_label(DocumentKind::Box))
        );
    }

    #[test]
    fn test_with_diagnostics_rejects_malformed_tagged_shape() {
        let error =
            with_diagnostics(json!({ "kind": "card" }), &[]).expect_err("缺 value 必须拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_INTERNAL);
        let error = with_diagnostics(Value::from(1), &[]).expect_err("非对象必须拒绝");
        assert_eq!(error.code(), crate::error::NATIVE_INTERNAL);
    }

    /// 序列化请求夹具（目录态最小卡片；`file_info` 由序列化侧复算，入参不带）。
    fn serialize_request_dto(root: &Path) -> Value {
        json!({
            "kind": "card",
            "form": "directory",
            "localPath": root.display().to_string(),
            "metadata": {
                "chip_standards_version": "1.0.0",
                "card_id": NODE,
                "name": "绑定测试卡片",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": "2026-01-02T00:00:00Z"
            },
            "structure": {
                "structure": [{ "id": NODE, "type": "base.text" }],
                "manifest": { "card_count": 1, "resource_count": 0 }
            },
            "contents": [
                { "nodeId": NODE, "value": { "card_type": "base.text", "text": "保存改写" } }
            ],
            "layoutConfig": null,
            "changedParts": ["content"],
            "removedNodeIds": []
        })
    }

    #[test]
    fn test_saved_at_unix_millis_conversion_and_guards() {
        let epoch = saved_at_from_unix_millis(0.0).expect("零点合法");
        assert_eq!(epoch.duration_since(UNIX_EPOCH).expect("正向"), Duration::ZERO);
        let later = saved_at_from_unix_millis(1_774_166_400_000.0).expect("常规时刻合法");
        assert_eq!(
            later.duration_since(UNIX_EPOCH).expect("正向").as_millis(),
            1_774_166_400_000
        );
        for bad in [f64::NAN, f64::INFINITY, -1.0, 1.5] {
            let error = saved_at_from_unix_millis(bad).expect_err("非法时刻必须拒绝");
            assert_eq!(error.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE, "{bad}");
        }
        let overflow = saved_at_from_unix_millis(1.0e30).expect_err("超上界必须拒绝");
        assert_eq!(overflow.code(), crate::error::NATIVE_VALUE_OUT_OF_RANGE);
    }

    #[test]
    fn test_serialize_request_literal_guards() {
        for (literal, pointer) in [("zip", "/form"), ("document", "/kind")] {
            let mut dto = serialize_request_dto(Path::new("/tmp/unused"));
            if pointer == "/form" {
                dto["form"] = Value::from(literal);
            } else {
                dto["kind"] = Value::from(literal);
            }
            let parsed: DocumentSerializeRequestDto =
                serde_json::from_value(dto).expect("判别字段在 DTO 层合法");
            let error = serialize_request_from_dto(parsed).expect_err("非法字面量必须拒绝");
            assert_eq!(error.code(), crate::error::NATIVE_TYPE_UNSUPPORTED, "{pointer}");
        }
    }

    #[test]
    fn test_serialize_members_writes_revised_members_with_file_info() {
        let root = temp_root("serialize");
        write_minimal_card(&root);
        let dto: DocumentSerializeRequestDto =
            serde_json::from_value(serialize_request_dto(&root)).expect("夹具请求合法");
        let request = serialize_request_from_dto(dto).expect("请求换算成功");
        let saved_at = saved_at_from_unix_millis(1_774_166_400_000.0).expect("时刻合法");
        let members = serialize_members(request, saved_at).expect("序列化成功");

        // 未修订成员字节比对过滤：`.card/cover.html` 与原字节一致不得产出；修订内容成员 +
        // 依赖成员（metadata 带 file_info 复算）交付且按包内路径升序。
        let paths: Vec<&str> = members.iter().map(|m| m.package_path.as_str()).collect();
        assert!(
            !paths.contains(&".card/cover.html"),
            "未修订成员必须被字节比对过滤：{paths:?}"
        );
        assert_eq!(paths, {
            let mut sorted = paths.clone();
            sorted.sort_unstable();
            sorted
        });
        let revised = members
            .iter()
            .find(|m| m.package_path == "content/a1B2c3D4e5.yaml")
            .expect("修订成员必出");
        assert!(String::from_utf8_lossy(&revised.bytes).contains("保存改写"));
        let metadata = members
            .iter()
            .find(|m| m.package_path == ".card/metadata.yaml")
            .expect("metadata 必出");
        let text = String::from_utf8_lossy(&metadata.bytes);
        assert!(text.contains("file_info:"), "卡片 metadata 必须复算 file_info：{text}");
        assert!(text.contains("total_size:"), "total_size 必须由序列化侧求解：{text}");
        assert!(
            text.contains("generated_at: \"2026-03-22T08:00:00.000Z\""),
            "generated_at 必须取调用方交付的保存时刻：{text}"
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_serialize_members_missing_metadata_maps_contract_code() {
        let root = temp_root("serialize-missing");
        write_minimal_card(&root);
        fs::remove_file(root.join(".card/metadata.yaml")).expect("移除 metadata");
        let dto: DocumentSerializeRequestDto =
            serde_json::from_value(serialize_request_dto(&root)).expect("夹具请求合法");
        let request = serialize_request_from_dto(dto).expect("请求换算成功");
        let error = serialize_members(request, UNIX_EPOCH).expect_err("缺 metadata 必须拒绝");
        assert_eq!(error.code(), "DOCUMENT_METADATA_MISSING");
        let _ = fs::remove_dir_all(&root);
    }
}
