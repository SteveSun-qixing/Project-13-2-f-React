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
//! | `documentReadResource` | `DocumentHandle::read_resource(&PackagePath, Option<Range<u64>>)` |
//! | `documentValidate` | `DocumentHandle::validate` |
//! | `buildDocumentView` | `build_document_view(&DocumentHandle, SessionId)`（§6.6） |
//! | `documentClose` | 句柄内映射的显式释放（`Arc` 归还，`Finalize` 兜底） |
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
//!   `EntriesResult` 统一携带 `{ kind, value, diagnostics }`；
//!   `ValidationReport` 直接投影 backing 序列化形状；DTO 一律经
//!   `serde_json::Value` 中转（§8.2）。

use std::ops::Range;
use std::path::Path;
use std::sync::{Arc, Mutex, PoisonError};

use chips_core::{ChipsError, SessionId};
use chips_parser::model::NodeId;
use chips_parser::{
    build_document_view, open_document, BoxParser, CardParser, Diagnostic, DocumentHandle,
    DocumentKind, PackagePath, ParseLimits, ParseOptions,
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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
}
