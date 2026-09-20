//! 六阶段流水线实现（《06-文档解析器设计》§3.1-§3.7）。
//!
//! 本模块承载阶段 1-3（打开与识别、建立索引、metadata 解析，[`open_l0`]）
//! 与惰性层级（L1/L2）的纯解析函数：结构（§3.5）、内容单元与布局配置
//! （§3.6）。所有函数不持有句柄状态；诊断由调用方（`DocumentHandle`）
//! 汇入统一集合，致命错误原样上抛（§8.1 两级错误模型）。
//!
//! 阶段 2 的索引建立由 `source` 层（目录态/压缩态）完成，本模块只做
//! 入口分派与格式判定（§3.2）；阶段 6 的模型冻结、修订、统计与诊断
//! 排序去重在句柄侧完成（§3.7）。

use std::collections::HashSet;
use std::path::Path;
use std::sync::Arc;

use crate::error::{
    Diagnostic, DocumentError, Fatal, Severity, DOCUMENT_EXTENSION_MISMATCH,
    DOCUMENT_NOT_FOUND, DOCUMENT_RESOURCE_FILE_MISSING, DOCUMENT_RESOURCE_INTEGRITY_MISMATCH,
    DOCUMENT_UNREFERENCED_FILE, ENTRY_FAILED, ENTRY_SOURCE_INVALID, ENTRY_TARGET_MISSING,
    STRUCTURE_CONTENT_MISSING, STRUCTURE_NODE_FAILED,
};
use crate::model::{
    AgeRating, BoxMetadata, CardMetadata, ContentNode, DocumentKind, DocumentMetadata,
    DocumentStatistics, DocumentValue, Entry, FileInfo, NodeId, ParseOptions, StructureEntry,
    StructureManifest, StructureModel, Tag, Visibility, CARD_CONTENT_DIR,
};
use crate::schema::{validate, SchemaMember};
use crate::source::archive::ArchiveSource;
use crate::source::directory::DirectorySource;
use crate::source::{PackagePath, SourceFingerprint};
use crate::yaml;

use super::CURRENT_CHIP_STANDARDS_VERSION;

/// metadata 成员文件名（配置目录内）。
const METADATA_FILE: &str = "metadata.yaml";
/// 结构成员文件名（配置目录内）。
const STRUCTURE_FILE: &str = "structure.yaml";
/// 封面成员文件名（配置目录内，仅记录路径不读取内容，§11.6）。
const COVER_FILE: &str = "cover.html";

/// 阶段 1-3 的产物：可用句柄所需的全部 L0 状态（§3.1）。
pub(crate) struct OpenedL0 {
    /// 双模式数据源（阶段 1 打开、阶段 2 索引完成）。
    pub source: Arc<dyn crate::source::DocumentSource>,
    /// 判定出的文档格式（§3.2 第 4 条）。
    pub kind: DocumentKind,
    /// L0 元数据模型（冻结）。
    pub metadata: Arc<DocumentMetadata>,
    /// 数据源指纹（修订构建输入，§3.7）。
    pub fingerprint: SourceFingerprint,
    /// 打开期诊断（未排序，由句柄统一排序去重）。
    pub diagnostics: Vec<Diagnostic>,
    /// 已解析 YAML 字节数（阶段 3 部分）。
    pub yaml_bytes: u64,
}

/// 阶段 1-3：打开数据源、判定格式、解析 metadata 到 L0。
///
/// `expected` 为 `Some` 时是严格入口（`CardParser` / `BoxParser`）：
/// 探测结果与声明格式矛盾返回 `DOCUMENT_FORMAT_UNKNOWN`（§3.2 第 4 条）；
/// `None` 为 `open_document` 自动识别：矛盾以探测结果为准并记录
/// `DOCUMENT_EXTENSION_MISMATCH`（警告）。
pub(crate) fn open_l0(
    path: &Path,
    expected: Option<DocumentKind>,
    options: &ParseOptions,
) -> Fatal<OpenedL0> {
    let entry_state = std::fs::metadata(path).map_err(|io_error| {
        if io_error.kind() == std::io::ErrorKind::NotFound {
            DocumentError::NotFound { path: path.display().to_string() }
        } else {
            DocumentError::Io {
                message: format!("无法访问入口路径 {}：{io_error}", path.display()),
            }
        }
    })?;
    let mut diagnostics = Vec::new();
    let source: Arc<dyn crate::source::DocumentSource> = if entry_state.is_dir() {
        Arc::new(DirectorySource::open(path, &mut diagnostics)?)
    } else {
        // 阶段 1 第 3 步：归档签名判定（普通归档 `PK\x03\x04` / 空归档 `PK\x05\x06`）。
        let prefix = read_leading_bytes(path, 4)?;
        if !ArchiveSource::looks_like_zip(&prefix) {
            return Err(DocumentError::FormatUnknown {
                message: format!(
                    "入口 {} 既不是目录也不是 ZIP 归档，无法作为文档打开",
                    path.display()
                ),
            });
        }
        Arc::new(ArchiveSource::open(path, &options.limits)?)
    };

    let kind = detect_kind(source.as_ref(), path, expected, &mut diagnostics)?;
    if options.verify_hashes {
        // §4.3：`verify_hashes` 开启时校验全部归档成员 CRC32（目录态默认
        // 通过）；损坏归档按 `DOCUMENT_ARCHIVE_INVALID` 致命处理。
        let fingerprint = source.fingerprint();
        for (member_path, _) in &fingerprint.members {
            source.verify_member_crc(member_path)?;
        }
    }
    let (metadata, metadata_diagnostics, yaml_bytes) =
        parse_metadata(source.as_ref(), kind, options)?;
    diagnostics.extend(metadata_diagnostics);
    Ok(OpenedL0 {
        source,
        kind,
        metadata,
        fingerprint: source.fingerprint(),
        diagnostics,
        yaml_bytes,
    })
}

/// 读取文件头部字节（阶段 1 签名探测）。
fn read_leading_bytes(path: &Path, count: usize) -> Fatal<Vec<u8>> {
    use std::io::Read as _;
    let mut file = std::fs::File::open(path).map_err(|io_error| DocumentError::Io {
        message: format!("无法打开 {}：{io_error}", path.display()),
    })?;
    let mut buffer = vec![0u8; count];
    let mut filled = 0usize;
    while filled < count {
        match file.read(&mut buffer[filled..]) {
            Ok(0) => break,
            Ok(read) => filled += read,
            Err(io_error) if io_error.kind() == std::io::ErrorKind::Interrupted => {}
            Err(io_error) => {
                return Err(DocumentError::Io {
                    message: format!("读取 {} 头部失败：{io_error}", path.display()),
                })
            }
        }
    }
    buffer.truncate(filled);
    Ok(buffer)
}

/// §3.2 第 4 条格式判定：扩展名首选、索引探测兜底、矛盾按入口类型处理。
fn detect_kind(
    source: &dyn crate::source::DocumentSource,
    path: &Path,
    expected: Option<DocumentKind>,
    diagnostics: &mut Vec<Diagnostic>,
) -> Fatal<DocumentKind> {
    let extension = path
        .extension()
        .and_then(|name| name.to_str())
        .map(|name| name.to_ascii_lowercase());
    let from_extension = match extension.as_deref() {
        Some("card") => Some(DocumentKind::Card),
        Some("box") => Some(DocumentKind::Box),
        _ => None,
    };
    // 索引探测：配置目录的元数据成员存在即判定（归档根即包根，§3.3）。
    let has_config = |kind: DocumentKind| {
        source.member(&member_in_config_dir(kind, METADATA_FILE)).is_some()
    };
    let probed = match (has_config(DocumentKind::Card), has_config(DocumentKind::Box)) {
        (true, false) => Some(DocumentKind::Card),
        (false, true) => Some(DocumentKind::Box),
        (true, true) => {
            return Err(DocumentError::FormatUnknown {
                message: "包根同时存在 .card 与 .box 配置目录，格式判定歧义".to_owned(),
            });
        }
        (false, false) => None,
    };
    if let Some(declared) = expected {
        // 严格入口：探测结果与声明矛盾即失败；探测为空时要求扩展名
        // 与声明一致（否则无从继续，判格式未知）。
        if let Some(found) = probed {
            if found != declared {
                return Err(DocumentError::FormatUnknown {
                    message: format!(
                        "严格入口要求 {}，实际索引探测为 {}",
                        extension_display(declared),
                        extension_display(found)
                    ),
                });
            }
        } else if from_extension != Some(declared) {
            return Err(DocumentError::FormatUnknown {
                message: format!(
                    "索引与扩展名均无法确认声明的文档格式 {}",
                    extension_display(declared)
                ),
            });
        }
        return Ok(declared);
    }
    match (from_extension, probed) {
        (Some(from_extension), Some(found)) => {
            if from_extension != found {
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Warning,
                        DOCUMENT_EXTENSION_MISMATCH,
                        format!(
                            "扩展名指示 {}，但索引探测为 {}，以探测结果为准",
                            extension_display(from_extension),
                            extension_display(found)
                        ),
                    )
                    .with_hint("重命名文档扩展名以匹配实际格式".to_owned()),
                );
            }
            Ok(found)
        }
        (None, Some(found)) => Ok(found),
        (Some(from_extension), None) => Ok(from_extension),
        (None, None) => Err(DocumentError::FormatUnknown {
            message: "扩展名未知且索引中不存在 .card / .box 配置目录，无法判定格式".to_owned(),
        }),
    }
}

/// 格式的可读名（诊断文案用）。
fn extension_display(kind: DocumentKind) -> &'static str {
    match kind {
        DocumentKind::Card => ".card",
        DocumentKind::Box => ".box",
    }
}

/// 配置目录内成员路径（常量子段拼接，构造必然合法）。
pub(crate) fn member_in_config_dir(kind: DocumentKind, name: &str) -> PackagePath {
    PackagePath::new(&format!("{}/{}", kind.config_dir(), name))
        .expect("配置目录成员路径为常量子段拼接，必然合法")
}

/// 结构成员路径（句柄侧内容单元诊断定位输入，§3.5）。
pub(crate) fn structure_file(kind: DocumentKind) -> PackagePath {
    member_in_config_dir(kind, STRUCTURE_FILE)
}

/// 阶段 3：metadata 解析（§3.4 全七步）。
///
/// 返回冻结模型、本阶段诊断与消耗的 YAML 字节数；任一错误级判定
/// （语法、schema、版本）归一为 `DOCUMENT_METADATA_INVALID` /
/// `DOCUMENT_VERSION_OUTDATED` / `DOCUMENT_VERSION_UNSUPPORTED`。
pub(crate) fn parse_metadata(
    source: &dyn crate::source::DocumentSource,
    kind: DocumentKind,
    options: &crate::model::ParseOptions,
) -> Fatal<(Arc<DocumentMetadata>, Vec<Diagnostic>, u64)> {
    let file = member_in_config_dir(kind, METADATA_FILE);
    let bytes = source.read(&file).map_err(|error| match error {
        // 成员不在索引：缺元数据文件（§3.4 第 1 步）。
        DocumentError::NotFound { .. } => DocumentError::MetadataMissing { file: file.clone() },
        other => other,
    })?;
    let document = yaml::parse(&bytes, &file, options, true)?;
    let yaml_bytes = document.source_bytes;
    let mut diagnostics = document.diagnostics;
    let Some(root) = document.root else {
        return Err(DocumentError::MetadataInvalid {
            message: "元数据文件不可解析（UTF-8、YAML 语法或根节点形态失败）".to_owned(),
            diagnostics,
        });
    };
    let member = match kind {
        DocumentKind::Card => SchemaMember::CardMetadata,
        DocumentKind::Box => SchemaMember::BoxMetadata,
    };
    let outcome = validate(
        member,
        &root,
        &file,
        options.repair,
        options.strict,
        Some(&document.spans),
    );
    diagnostics.extend(outcome.diagnostics);
    if outcome.has_errors() {
        return Err(DocumentError::MetadataInvalid {
            message: "元数据未通过 schema 校验（必填、类型、枚举或格式不符）".to_owned(),
            diagnostics,
        });
    }
    let build_failure = || DocumentError::MetadataInvalid {
    let metadata = match kind {
        DocumentKind::Card => {
            build_card_metadata(&outcome.value).ok_or_else(build_failure)?
        }
        DocumentKind::Box => build_box_metadata(&outcome.value).ok_or_else(build_failure)?,
    };
    // 版本兼容判定（§7.2）在模型构建后执行。
    let version = metadata.chip_standards_version().to_owned();
    check_version_compatibility(&version, &mut diagnostics)?;
    // §3.4 第 7 步：原文缓冲随局部变量出栈释放，只保留模型与诊断。
    Ok((Arc::new(metadata), diagnostics, yaml_bytes))
}

/// §7.2 兼容判定：主版本边界 + 次版本警告；修订号不参与判定。
pub(crate) fn check_version_compatibility(
    version: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Fatal<()> {
    let (major, minor) = split_version(version);
    let (current_major, current_minor) = split_version(CURRENT_CHIP_STANDARDS_VERSION);
    if major > current_major {
        return Err(DocumentError::VersionUnsupported { version: version.to_owned() });
    }
    if major < current_major {
        return Err(DocumentError::VersionOutdated { version: version.to_owned() });
    }
    if minor > current_minor {
        diagnostics.push(crate::yaml::version_mismatch_warning(
            version,
            CURRENT_CHIP_STANDARDS_VERSION,
        ));
    }
    Ok(())
}

/// 严格三段式版本拆分（schema 层已保证语法；异常段回退 0）。
fn split_version(version: &str) -> (u64, u64) {
    let mut parts = version.split('.');
    let major = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|part| part.parse().ok()).unwrap_or(0);
    (major, minor)
}

/// 读取标签列表值（schema `TagList` 已收窄形态；异常回退 `None`）。
fn build_tags(value: Option<&DocumentValue>) -> Option<Vec<Tag>> {
    match value {
        None | Some(DocumentValue::Null) => Some(Vec::new()),
        Some(DocumentValue::Sequence(items)) => {
            let mut tags = Vec::with_capacity(items.len());
            for item in items {
                match item {
                    DocumentValue::String(label) => tags.push(Tag::Simple(label.clone())),
                    DocumentValue::Sequence(parts) => {
                        let parts = parts
                            .iter()
                            .map(|part| match part {
                                DocumentValue::String(text) => Some(text.clone()),
                                _ => None,
                            })
                            .collect::<Option<Vec<String>>>()?;
                        tags.push(Tag::Structured(parts));
                    }
                    _ => return None,
                }
            }
            Some(tags)
        }
        _ => None,
    }
}

/// 由校验后的值树构建卡片元数据模型（§11.3）。
///
/// schema 层已保证必填、类型、枚举与格式；任一前提不满足（防御性）
/// 返回 `None`，调用方归一为 `DOCUMENT_METADATA_INVALID`。
fn build_card_metadata(value: &DocumentValue) -> Option<DocumentMetadata> {
    let text = |key: &str| value.get(key).and_then(DocumentValue::as_str).map(str::to_owned);
    let tags = build_tags(value.get("tags"))?;
    let content_warning = match value.get("content_warning") {
        None | Some(DocumentValue::Null) => None,
        Some(DocumentValue::Sequence(items)) => Some(
            items
                .iter()
                .map(|item| match item {
                    DocumentValue::String(text) => Some(text.clone()),
                    _ => None,
                })
                .collect::<Option<Vec<String>>>()?,
        ),
        _ => return None,
    };
    let file_info = match value.get("file_info") {
        None | Some(DocumentValue::Null) => None,
        Some(info @ DocumentValue::Mapping(_)) => Some(FileInfo {
            total_size: u64::try_from(info.get("total_size")?.as_i64()?).ok()?,
            file_count: u64::try_from(info.get("file_count")?.as_i64()?).ok()?,
            checksum: info.get("checksum").and_then(DocumentValue::as_str).map(str::to_owned),
            generated_at: info
                .get("generated_at")
                .and_then(DocumentValue::as_str)
                .map(str::to_owned),
        }),
        _ => return None,
    };
    let enum_or_none = |key: &str| -> Option<Option<()>> {
        match text(key) {
            None => Some(None),
            Some(_) => Some(Some(())),
        }
    };
    let _ = enum_or_none;
    Some(DocumentMetadata::Card(CardMetadata {
        chip_standards_version: text("chip_standards_version")?,
        card_id: text("card_id")?,
        name: text("name")?,
        created_at: text("created_at")?,
        modified_at: text("modified_at")?,
        cover_ratio: text("cover_ratio"),
        tags,
        theme: text("theme"),
        visibility: match text("visibility").as_deref() {
            None => None,
            Some("public") => Some(Visibility::Public),
            Some("private") => Some(Visibility::Private),
            Some("unlisted") => Some(Visibility::Unlisted),
            Some(_) => return None,
        },
        downloadable: value.get("downloadable").and_then(DocumentValue::as_bool),
        remixable: value.get("remixable").and_then(DocumentValue::as_bool),
        commentable: value.get("commentable").and_then(DocumentValue::as_bool),
        license: text("license"),
        age_rating: match text("age_rating").as_deref() {
            None => None,
            Some("all") => Some(AgeRating::All),
            Some("pg") => Some(AgeRating::Pg),
            Some("pg13") => Some(AgeRating::Pg13),
            Some("r") => Some(AgeRating::R),
            Some("nc17") => Some(AgeRating::Nc17),
            Some(_) => return None,
        },
        content_warning,
        file_info,
    }))
}

/// 由校验后的值树构建箱子元数据模型（§11.3）。
fn build_box_metadata(value: &DocumentValue) -> Option<DocumentMetadata> {
    let text = |key: &str| value.get(key).and_then(DocumentValue::as_str).map(str::to_owned);
    let tags = match value.get("tags") {
        None | Some(DocumentValue::Null) => None,
        Some(_) => Some(build_tags(value.get("tags"))?),
    };
    Some(DocumentMetadata::Box(BoxMetadata {
        chip_standards_version: text("chip_standards_version")?,
        box_id: text("box_id")?,
        name: text("name")?,
        created_at: text("created_at")?,
        modified_at: text("modified_at")?,
        active_layout_type: text("active_layout_type")?,
        description: text("description"),
        tags,
        cover_ratio: text("cover_ratio"),
        cover_asset: text("cover_asset"),
        owner: text("owner"),
        source: value
            .get("source")
            .filter(|item| matches!(item, DocumentValue::Mapping(_)))
            .cloned(),
    }))
}

/// 阶段 4：结构与引用解析（§3.5，惰性触发）。
///
/// 返回冻结结构模型、本阶段诊断与消耗的 YAML 字节数；语法或 schema
/// 失败归一为 `DOCUMENT_STRUCTURE_INVALID`（结构层级错误，§8.4），
/// 条目数量超限返回 `DOCUMENT_LIMIT_EXCEEDED`（§3.6）。
pub(crate) fn parse_structure(
    source: &dyn crate::source::DocumentSource,
    kind: DocumentKind,
    options: &crate::model::ParseOptions,
) -> Fatal<(Arc<StructureModel>, Vec<Diagnostic>, u64)> {
    let file = member_in_config_dir(kind, STRUCTURE_FILE);
    let bytes = source.read(&file).map_err(|error| match error {
        DocumentError::NotFound { .. } => DocumentError::StructureInvalid {
            message: format!("缺少结构文件 {file}"),
            diagnostics: Vec::new(),
        },
        other => other,
    })?;
    let document = yaml::parse(&bytes, &file, options, true)?;
    let yaml_bytes = document.source_bytes;
    let mut diagnostics = document.diagnostics;
    let Some(root) = document.root else {
        return Err(DocumentError::StructureInvalid {
            message: "结构文件不可解析（UTF-8、YAML 语法或根节点形态失败）".to_owned(),
            diagnostics,
        });
    };
    let member = match kind {
        DocumentKind::Card => SchemaMember::CardStructure,
        DocumentKind::Box => SchemaMember::BoxStructure,
    };
    let outcome = validate(
        member,
        &root,
        &file,
        options.repair,
        options.strict,
        Some(&document.spans),
    );
    diagnostics.extend(outcome.diagnostics);
    if outcome.has_errors() {
        return Err(DocumentError::StructureInvalid {
            message: "结构文件未通过 schema 校验".to_owned(),
            diagnostics,
        });
    }
    let model = match kind {
        DocumentKind::Card => {
            build_card_structure(source, &outcome.value, &file, options, &mut diagnostics)?
        }
        DocumentKind::Box => build_box_structure(
            source,
            &outcome.value,
            &file,
            options.limits.max_entry_count,
            &mut diagnostics,
        )?,
    };
    if options.strict {
        // §3.6：未引用内容/资源检查仅在严格模式执行。
        collect_unreferenced_files(source, kind, &model, &mut diagnostics);
    }
    Ok((Arc::new(model), diagnostics, yaml_bytes))
}

/// 卡片结构：`structure[]` 节点与 `manifest` 清单（§3.5）。
fn build_card_structure(
    source: &dyn crate::source::DocumentSource,
    value: &DocumentValue,
    file: &PackagePath,
    options: &ParseOptions,
    diagnostics: &mut Vec<Diagnostic>,
) -> Fatal<StructureModel> {
    let items = value
        .get("structure")
        .and_then(DocumentValue::as_sequence)
        .ok_or_else(|| DocumentError::StructureInvalid {
            message: "结构缺少合法的 structure 数组".to_owned(),
            diagnostics: Vec::new(),
        })?;
    let mut seen: HashSet<NodeId> = HashSet::new();
    let mut entries = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let pointer = format!("/structure/{index}");
        let id_text = item.get("id").and_then(DocumentValue::as_str).unwrap_or_default();
        let card_type = item
            .get("type")
            .and_then(DocumentValue::as_str)
            .unwrap_or_default()
            .to_owned();
        let Some(node_id) = NodeId::new(id_text) else {
            // schema 层 `Base62Id` 已收窄语法；防御性失败标记该节点。
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    STRUCTURE_NODE_FAILED,
                    format!("结构节点标识 {id_text} 不是合法的 10 位 Base62 编号"),
                )
                .at(file, pointer)
                .with_hint("按《ID生成规范》重新生成节点标识".to_owned()),
            );
            continue;
        };
        if !seen.insert(node_id.clone()) {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    STRUCTURE_NODE_FAILED,
                    format!("结构节点标识 {node_id} 重复，后出现的节点按失败处理"),
                )
                .at(file, pointer)
                .with_hint("删除重复声明或重新分配节点标识".to_owned()),
            );
            continue;
        }
        let target = node_id.content_file();
        let present = source.member(&target).is_some();
        if !present {
            diagnostics.push(missing_content_diagnostic(&node_id, &target, &pointer));
        }
        entries.push(StructureEntry { node_id, card_type, file: target, present });
    }
    let manifest = build_manifest(source, value.get("manifest"), file, options, diagnostics);
    Ok(StructureModel::Card { structure: entries, manifest })
}

/// 结构引用内容文件缺失诊断（§3.5）。
///
/// 结构层与内容占位模型共用本构造函数（同文件、同指针、同消息），
/// 句柄诊断集合排序去重后只保留一条。
pub(crate) fn missing_content_diagnostic(
    node_id: &NodeId,
    target: &PackagePath,
    pointer: &str,
) -> Diagnostic {
    Diagnostic::new(
        Severity::Error,
        STRUCTURE_CONTENT_MISSING,
        format!("结构节点 {node_id} 引用的内容文件 {target} 不存在"),
    )
    .at(&member_in_config_dir(DocumentKind::Card, STRUCTURE_FILE), pointer.to_owned())
    .with_hint(format!("补充 {CARD_CONTENT_DIR}/{node_id}.yaml 或从 structure 中移除该节点声明"))
}

/// `manifest` 清单构建与资源引用校验（§3.5、§6.4）。
fn build_manifest(
    source: &dyn crate::source::DocumentSource,
    manifest: Option<&DocumentValue>,
    file: &PackagePath,
    options: &ParseOptions,
    diagnostics: &mut Vec<Diagnostic>,
) -> StructureManifest {
    let Some(manifest_value @ DocumentValue::Mapping(_)) = manifest else {
        return StructureManifest::default();
    };
    let mut resources = Vec::new();
    if let Some(items) = manifest_value.get("resources").and_then(DocumentValue::as_sequence) {
        for (index, item) in items.iter().enumerate() {
            let pointer = format!("/manifest/resources/{index}");
            let path_text = item.get("path").and_then(DocumentValue::as_str).unwrap_or("");
            let Ok(path) = PackagePath::new(path_text) else {
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Error,
                        ENTRY_SOURCE_INVALID,
                        format!("资源清单路径非法：{path_text}"),
                    )
                    .at(file, pointer)
                    .with_hint("资源路径必须是包内相对路径（/ 分隔、无 .. 与绝对路径）".to_owned()),
                );
                continue;
            };
            let declared_size = item
                .get("size")
                .and_then(DocumentValue::as_i64)
                .and_then(|value| u64::try_from(value).ok())
                .unwrap_or(u64::MAX);
            match source.member(&path) {
                None => diagnostics.push(
                    Diagnostic::new(
                        Severity::Warning,
                        DOCUMENT_RESOURCE_FILE_MISSING,
                        format!("资源清单条目对应文件不存在：{path}"),
                    )
                    .at(file, pointer.clone())
                    .with_hint("补齐资源文件或从清单中移除条目".to_owned()),
                ),
                Some(meta) => {
                    if meta.size != declared_size {
                        // §6.4：尺寸不匹配记警告；严格模式升级为错误。
                        diagnostics.push(
                            Diagnostic::new(
                                Severity::Warning,
                                DOCUMENT_RESOURCE_INTEGRITY_MISMATCH,
                                format!(
                                    "资源声明尺寸 {declared_size} 与索引尺寸 {} 不符：{path}",
                                    meta.size
                                ),
                            )
                            .at(file, pointer.clone())
                            .escalated(options.strict),
                        );
                    }
                    // §6.4：SHA256 checksum 仅在 verify_hashes / validate 执行。
                    if options.verify_hashes {
                        verify_resource_checksum(source, item, &path, file, &pointer, diagnostics);
                    }
                }
            }
            // §8.4：任何部分成功都保留失败对象的位置与标识，条目入模。
            resources.push(crate::model::ManifestResource {
                path,
                size: declared_size,
                mime_type: item
                    .get("type")
                    .and_then(DocumentValue::as_str)
                    .unwrap_or_default()
                    .to_owned(),
                duration: item.get("duration").and_then(DocumentValue::as_f64),
                width: item
                    .get("width")
                    .and_then(DocumentValue::as_i64)
                    .and_then(|value| u64::try_from(value).ok()),
                height: item
                    .get("height")
                    .and_then(DocumentValue::as_i64)
                    .and_then(|value| u64::try_from(value).ok()),
                language: item
                    .get("language")
                    .and_then(DocumentValue::as_str)
                    .map(str::to_owned),
                checksum: item
                    .get("checksum")
                    .and_then(DocumentValue::as_str)
                    .map(str::to_owned),
            });
        }
    }
    StructureManifest {
        card_count: manifest_value
            .get("card_count")
            .and_then(DocumentValue::as_i64)
            .and_then(|value| u64::try_from(value).ok())
            .unwrap_or_default(),
        resource_count: manifest_value
            .get("resource_count")
            .and_then(DocumentValue::as_i64)
            .and_then(|value| u64::try_from(value).ok())
            .unwrap_or_default(),
        resources,
    }
}

/// 资源 `checksum`（SHA256）校验（§6.4：仅在 `verify_hashes` 或 `validate`
/// 时执行，不匹配升级为错误级诊断）。
fn verify_resource_checksum(
    source: &dyn crate::source::DocumentSource,
    item: &DocumentValue,
    path: &PackagePath,
    file: &PackagePath,
    pointer: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let Some(declared) = item.get("checksum").and_then(DocumentValue::as_str) else {
        return;
    };
    let mismatch = |reason: String| {
        diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                DOCUMENT_RESOURCE_INTEGRITY_MISMATCH,
                format!("资源完整性校验失败：{reason}：{path}"),
            )
            .at(file, pointer.to_owned())
            .with_hint("恢复资源原始字节或更新 manifest.resources[].checksum".to_owned()),
        );
    };
    let bytes = match source.read(path) {
        Ok(bytes) => bytes,
        Err(error) => {
            mismatch(format!("成员读取失败（{error}）"));
            return;
        }
    };
    let computed = crate::digest::sha256(&bytes);
    let hex: String = computed.iter().map(|byte| format!("{byte:02x}")).collect();
    if hex != declared.trim_start_matches("sha256:").trim().to_ascii_lowercase() {
        mismatch("SHA256 与声明值不符".to_owned());
    }
}

/// 箱子结构：`entries[]` 物化与引用分类校验（§3.5、§3.6）。
fn build_box_structure(
    source: &dyn crate::source::DocumentSource,
    value: &DocumentValue,
    file: &PackagePath,
    max_entry_count: u64,
    diagnostics: &mut Vec<Diagnostic>,
) -> Fatal<StructureModel> {
    let items = value
        .get("entries")
        .and_then(DocumentValue::as_sequence)
        .ok_or_else(|| DocumentError::StructureInvalid {
            message: "结构缺少合法的 entries 数组".to_owned(),
            diagnostics: Vec::new(),
        })?;
    if u64::try_from(items.len()).unwrap_or(u64::MAX) > max_entry_count {
        // §3.6：条目数量超过 `max_entry_count` 返回限额错误。
        return Err(DocumentError::LimitExceeded {
            limit: "max_entry_count",
            actual: format!("{} 条目", items.len()),
            file: Some(file.clone()),
        });
    }
    let mut seen: HashSet<String> = HashSet::new();
    let mut entries = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let pointer = format!("/entries/{index}");
        let entry_id = item.get("entry_id").and_then(DocumentValue::as_str).unwrap_or_default();
        let url = item.get("url").and_then(DocumentValue::as_str).unwrap_or("");
        let Some(enabled) = item.get("enabled").and_then(DocumentValue::as_bool) else {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    ENTRY_FAILED,
                    format!("条目 {entry_id} 缺少合法的 enabled 布尔值，位置保留"),
                )
                .at(file, pointer)
                .with_hint("为条目补充 enabled: true / false".to_owned()),
            );
            // §8.4：失败条目保留位置，以禁用态进入布局，不静默丢弃。
            entries.push(Entry {
                entry_id: entry_id.to_owned(),
                url: url.to_owned(),
                enabled: false,
                snapshot: None,
                layout_hints: None,
            });
            continue;
        };
        if !entry_id.is_empty() && !seen.insert(entry_id.to_owned()) {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    ENTRY_FAILED,
                    format!("条目 ID {entry_id} 重复，后出现的条目按失败处理，位置保留"),
                )
                .at(file, pointer.clone()),
            );
        }
        classify_entry_url(source, url, file, &pointer, diagnostics);
        entries.push(Entry {
            entry_id: entry_id.to_owned(),
            url: url.to_owned(),
            enabled,
            snapshot: optional_mapping(item.get("snapshot")),
            layout_hints: optional_mapping(item.get("layout_hints")),
        });
    }
    Ok(StructureModel::Box { entries, diagnostics: Vec::new() })
}

/// 条目引用的分类与校验（§3.5「引用形式唯一集合」）。
fn classify_entry_url(
    source: &dyn crate::source::DocumentSource,
    url: &str,
    file: &PackagePath,
    pointer: &str,
    diagnostics: &mut Vec<Diagnostic>,
) {
    if let Some(scheme_end) = url.find("://") {
        let scheme = url[..scheme_end].to_ascii_lowercase();
        match scheme.as_str() {
            // 外部引用仅做语法分类，不访问外部资源（§3.5）；URI 细分
            // 合法性由资源管理器协议层复核。
            "file" | "http" | "https" | "webdav" | "chips-resource" => {}
            "data" => diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    ENTRY_SOURCE_INVALID,
                    "data: 引用仅限运行时内存形态，不得持久化在条目中".to_owned(),
                )
                .at(file, pointer.to_owned())
                .with_hint("把数据落盘为包内资源或改用外部引用".to_owned()),
            ),
            other => diagnostics.push(
                Diagnostic::new(
                    Severity::Error,
                    ENTRY_SOURCE_INVALID,
                    format!("条目引用使用了不允许的 scheme：{other}"),
                )
                .at(file, pointer.to_owned())
                .with_hint("仅接受包内相对路径、file、http(s)、webdav 与 chips-resource".to_owned()),
            ),
        }
        return;
    }
    // 包内相对路径：语法合法且存在于索引。
    match PackagePath::new(url) {
        Ok(path) => {
            if source.member(&path).is_none() {
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Warning,
                        ENTRY_TARGET_MISSING,
                        format!("条目包内引用目标不存在：{url}"),
                    )
                    .at(file, pointer.to_owned())
                    .with_hint("补齐目标文件或将条目改为外部引用".to_owned()),
                );
            }
        }
        Err(_) => diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                ENTRY_SOURCE_INVALID,
                format!("条目引用不是合法的包内相对路径：{url}"),
            )
            .at(file, pointer.to_owned())
            .with_hint("使用 / 分隔的相对路径，禁止 ..、绝对路径与裸 scheme 前缀".to_owned()),
        ),
    }
}

/// 可选映射值（`snapshot` / `layout_hints`）：仅保留映射形态。
fn optional_mapping(item: Option<&DocumentValue>) -> Option<DocumentValue> {
    item.filter(|value| matches!(value, DocumentValue::Mapping(_)))
        .cloned()
}

/// 阶段 5：单个内容节点解析（§3.6，卡片 L2 单元）。
///
/// 单元失败（语法、schema、根形态、引用缺失）不抛致命错误：返回占位
/// 模型（空映射 + 结构声明 `card_type` 回退）并携带错误级诊断（§8.4）；
/// 仅真致命（IO / 限额）返回 `Err`。`structure_file` / `pointer` 来自
/// 调用方（句柄持有结构下标），保证与结构层诊断同源可去重。
pub(crate) fn parse_content_unit(
    source: &dyn crate::source::DocumentSource,
    options: &crate::model::ParseOptions,
    entry: &StructureEntry,
    structure_file: &PackagePath,
    pointer: &str,
) -> Fatal<Arc<ContentNode>> {
    let placeholder = |diagnostics: Vec<Diagnostic>| {
        Arc::new(ContentNode {
            node_id: entry.node_id.clone(),
            file: entry.file.clone(),
            card_type: entry.card_type.clone(),
            value: DocumentValue::Mapping(Vec::new()),
            diagnostics,
        })
    };
    if !entry.present {
        return Ok(placeholder(vec![missing_content_diagnostic(
            &entry.node_id,
            &entry.file,
            pointer,
        )]));
    }
    let bytes = match source.read(&entry.file) {
        Ok(bytes) => bytes,
        // 引用文件在读取时消失（目录态竞争窗口）按内容节点失败处理。
        Err(error) if error.code() == DOCUMENT_NOT_FOUND => {
            return Ok(placeholder(vec![missing_content_diagnostic(
                &entry.node_id,
                &entry.file,
                pointer,
            )]));
        }
        Err(error) => return Err(error),
    };
    let document = yaml::parse(&bytes, &entry.file, options, options.strict)?;
    let node_failed = |extra: Vec<Diagnostic>, root_diagnostics: Vec<Diagnostic>| {
        let mut diagnostics = vec![Diagnostic::new(
            Severity::Error,
            STRUCTURE_NODE_FAILED,
            format!("内容节点 {} 解析失败", entry.node_id),
        )
        .at(structure_file, pointer.to_owned())
        .with_hint("修复该 YAML 文件后重新打开".to_owned())];
        diagnostics.extend(root_diagnostics);
        diagnostics.extend(extra);
        placeholder(diagnostics)
    };
    let Some(root) = document.root else {
        return Ok(node_failed(Vec::new(), document.diagnostics));
    };
    let outcome = validate(
        SchemaMember::CardContent,
        &root,
        &entry.file,
        options.repair,
        options.strict,
        if options.strict { Some(&document.spans) } else { None },
    );
    if outcome.has_errors() {
        return Ok(node_failed(outcome.diagnostics, document.diagnostics));
    }
    let card_type = outcome
        .value
        .get("card_type")
        .and_then(DocumentValue::as_str)
        .unwrap_or(entry.card_type.as_str())
        .to_owned();
    Ok(Arc::new(ContentNode {
        node_id: entry.node_id.clone(),
        file: entry.file.clone(),
        card_type,
        value: outcome.value,
        diagnostics: outcome
            .diagnostics
            .into_iter()
            .chain(document.diagnostics)
            .collect(),
    }))
}

/// 阶段 5：箱子布局配置单元（`.box/content.yaml`，§3.6）。
///
/// 文件缺失或校验失败返回空映射占位并携带错误级诊断（§8.4「布局配置
/// 非法 → 该布局不可用」，视图侧按空配置渲染）；仅 IO 类真致命返回 `Err`。
pub(crate) fn parse_layout_unit(
    source: &dyn crate::source::DocumentSource,
    options: &crate::model::ParseOptions,
) -> Fatal<(Arc<DocumentValue>, Vec<Diagnostic>, u64)> {
    let file = PackagePath::from_validated(crate::model::BOX_LAYOUT_CONFIG_FILE.to_owned());
    let empty = Arc::new(DocumentValue::Mapping(Vec::new()));
    if source.member(&file).is_none() {
        return Ok((
            empty,
            vec![Diagnostic::new(
                Severity::Error,
                STRUCTURE_CONTENT_MISSING,
                format!("布局配置文件不存在：{file}"),
            )
            .in_file(&file)
            .with_hint("按《箱子文件格式》§6 补充 .box/content.yaml".to_owned())],
            0,
        ));
    }
    let bytes = source.read(&file)?;
    let document = yaml::parse(&bytes, &file, options, true)?;
    let yaml_bytes = document.source_bytes;
    let failed = |diagnostics: Vec<Diagnostic>| (empty, diagnostics, yaml_bytes);
    let Some(root) = document.root else {
        let mut diagnostics = document.diagnostics;
        diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                STRUCTURE_NODE_FAILED,
                "布局配置单元解析失败，生效布局不可用".to_owned(),
            )
            .in_file(&file),
        );
        return Ok(failed(diagnostics));
    };
    let outcome = validate(
        SchemaMember::BoxContent,
        &root,
        &file,
        options.repair,
        options.strict,
        Some(&document.spans),
    );
    let mut diagnostics: Vec<Diagnostic> =
        outcome.diagnostics.into_iter().chain(document.diagnostics).collect();
    if outcome.has_errors() {
        diagnostics.push(
            Diagnostic::new(
                Severity::Error,
                STRUCTURE_NODE_FAILED,
                "布局配置未通过 schema 校验，生效布局不可用".to_owned(),
            )
            .in_file(&file),
        );
        return Ok(failed(diagnostics));
    }
    Ok((Arc::new(outcome.value), diagnostics, yaml_bytes))
}

/// 严格模式未引用文件检查（§3.6、§6.4「清单外资源文件」）。
fn collect_unreferenced_files(
    source: &dyn crate::source::DocumentSource,
    kind: DocumentKind,
    model: &StructureModel,
    diagnostics: &mut Vec<Diagnostic>,
) {
    let mut referenced: HashSet<PackagePath> = HashSet::new();
    for name in [METADATA_FILE, STRUCTURE_FILE, COVER_FILE] {
        referenced.insert(member_in_config_dir(kind, name));
    }
    match model {
        StructureModel::Card { structure, manifest } => {
            for entry in structure {
                referenced.insert(entry.file.clone());
            }
            for resource in &manifest.resources {
                referenced.insert(resource.path.clone());
            }
        }
        StructureModel::Box { entries, .. } => {
            for entry in entries {
                // 包内相对路径引用视为已引用；其余形态不参与文件集合。
                if let Ok(path) = PackagePath::new(&entry.url) {
                    referenced.insert(path);
                }
            }
        }
    }
    let fingerprint = source.fingerprint();
    for (path, _) in &fingerprint.members {
        if !referenced.contains(path) {
            diagnostics.push(
                Diagnostic::new(
                    Severity::Warning,
                    DOCUMENT_UNREFERENCED_FILE,
                    format!("存在未被结构与清单引用的文件：{path}"),
                )
                .in_file(path)
                .escalated(true)
                .with_hint("删除冗余文件，或将其登记进 structure / manifest".to_owned()),
            );
        }
    }
}

/// 统计构建（§3.7；结构未加载时资源/条目计数为 0）。
#[must_use]
pub(crate) fn statistics_from(
    fingerprint: &SourceFingerprint,
    yaml_bytes: u64,
    model: Option<&StructureModel>,
) -> DocumentStatistics {
    let member_count = u64::try_from(fingerprint.members.len()).unwrap_or(u64::MAX);
    let uncompressed_bytes = fingerprint.members.iter().map(|(_, member)| member.size).sum();
    let (resource_count, entry_count) = match model {
        Some(StructureModel::Card { manifest, .. }) => (manifest.resources.len() as u64, 0),
        Some(StructureModel::Box { entries, .. }) => (0, entries.len() as u64),
        None => (0, 0),
    };
    DocumentStatistics { member_count, yaml_bytes, resource_count, entry_count, uncompressed_bytes }
}
