//! 文档序列化（解析域权威）：把会话模型确定性地写回包内成员字节。
//!
//! 本模块是《11-文档服务设计》§5.1「会话模型的序列化」与《06-文档解析器设计》
//! §10.2「写入侧约束」的算法权威实现，也是 RFC 点位四 D3 裁定的「序列化载体」：
//! 提交权威在资源域（`chips-resource`），格式与清单权威在本模块，依赖方向维持
//! `chips-resource → chips-parser` 不反转。
//!
//! - 入口：[`serialize_document`]（纯函数、无副作用，时钟由入参给出）；
//! - 回读自检：[`decode_member_value`]（发射字节 → 模型值，走解析域权威读侧）；
//! - 产出：[`SerializedMember`]（`IDocumentSerializedMember` 的 Rust 侧同构形状，
//!   RFC 点位四 §7.4 冻结表），按包内路径 UTF-8 字节序升序；
//! - 规范 YAML：[`canonical`] 子模块（键序单源为 schema 规格表，见
//!   `schema::SchemaRegistry::fields`，与解析期 `SchemaContext::object` 归一同构）；
//! - 归档写侧与闭式尺寸：[`write_archive`] 子模块（OQ-3 裁定 G 手写 Store）；
//! - 摘要口径：[`member_digest`] 与 [`package_content_digest`]
//!   （《11-文档服务设计》§5.5 摘要表，宿主侧镜像实现见
//!   `packages/host/src/capabilities/document/digest.ts`）。
//!
//! 保存时重算（《11.05》§5.5）：
//!
//! - `metadata.file_info`（卡片）：`total_size`（目录态 = 全部成员文件字节之和，
//!   含 metadata 自身；归档态 = 最终归档字节数，闭式和）、`file_count`、
//!   `checksum`（包内容摘要，覆盖除 metadata 自身以外的成员字节）、
//!   `generated_at`（保存时刻 RFC 3339 UTC）；`total_size` 的自引用按
//!   RFC 点位四 §7.3 定点迭代求解，上限 3 轮（OQ-5），不收敛以防御臂拒绝；
//! - `structure.yaml` 的 `manifest`：`card_count` = `structure` 数组长度、
//!   `resource_count` = `resources` 长度、`resources[].size` / `checksum` 按真实
//!   字节重算，成员摘要一致时复用既有值（字节稳定）；
//! - 箱子无 `file_info` 与 `manifest`（《02.04》《02.05》），只做规范形态发射。
//!
//! 变更成员过滤（《11.05》§5.1「只序列化被修订的成员与清单成员」）：再生成员的
//! 序列化产物与源字节逐字节相同即视为未修订，不进入产出集——未修订成员由提交侧
//! 按原字节复制（归档态）或保持不动（目录态），不经过「解析 → 再序列化」。
//!
//! 防写回校验（《11.05》§5.1、《11.09》§9 与《01.03》§3.3）：写出前拒绝
//! `blob:`、`data:`、`file://`、裸绝对路径与 `..` 穿越出现在元数据资源字段、
//! 内容配置与资源清单中；箱子条目的 `url` 属《02.05》统一 URL 引用模型
//! （`file://` 为允许形态，见《06.02》§2.2），不在该集合内，故不受此校验约束。

pub mod write_archive;

mod canonical;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::digest::{sha256, Sha256};
use crate::error::{Diagnostic, DocumentError, Severity, DOCUMENT_METADATA_INVALID};
use crate::model::{DocumentKind, DocumentValue, NodeId, ParseLimits, ParseOptions};
use crate::schema::{SchemaMember, SchemaRegistry};
use crate::source::archive::ArchiveSource;
use crate::source::directory::DirectorySource;
use crate::source::{ByteStream, DocumentSource, PackagePath, SourceKind};

pub use self::write_archive::{archive_total_size, entry_overhead, ZipArchiveWriter};

/// `total_size` 自引用定点的最大轮数（RFC 点位四 §7.3 与 OQ-5 定案：≤3 轮）。
pub(crate) const MAX_FIXED_POINT_ROUNDS: usize = 3;

/// 包形态（《11.05》§5.8）：目录态工作副本与归档态单文件。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SerializeForm {
    /// 目录态（包根为目录）。
    Directory,
    /// 归档态（单个 ZIP Store 文件）。
    Archive,
}

impl SerializeForm {
    /// 由宿主端口的字面量文本构造（`DocumentForm`：`directory` / `archive`）。
    #[must_use]
    pub fn from_text(text: &str) -> Option<Self> {
        match text {
            "directory" => Some(Self::Directory),
            "archive" => Some(Self::Archive),
            _ => None,
        }
    }

    /// 宿主端口字面量文本。
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Directory => "directory",
            Self::Archive => "archive",
        }
    }
}

/// 内容成员（`content/<nodeId>.yaml`）的入参形状，逐字段镜像
/// `IDocumentSerializeRequest.contents` 元素（RFC 点位四 §7.4 冻结表）。
#[derive(Debug, Clone)]
pub struct ContentMemberValue {
    /// 10 位 Base62 节点标识。
    pub node_id: String,
    /// 内容配置值树。
    pub value: DocumentValue,
}

/// 序列化入参：会话模型 + 本次变更集范围（`IDocumentSerializeRequest` 同构）。
///
/// `saved_at` 不在本形状内（宿主端口无时钟字段），由 [`serialize_document`] 的
/// 第二参数给出，保持本函数纯函数性质（同入参必同字节）。
#[derive(Debug, Clone)]
pub struct DocumentSerializeRequest {
    /// 文档类别。
    pub kind: DocumentKind,
    /// 包形态。
    pub form: SerializeForm,
    /// 目录态包根或归档文件路径（用于未修订成员的字节复用）。
    pub local_path: PathBuf,
    /// 元数据切片。
    pub metadata: DocumentValue,
    /// 结构切片（卡片 `structure`/`manifest`，箱子 `entries`）。
    pub structure: DocumentValue,
    /// 卡片内容成员；箱子为空数组。
    pub contents: Vec<ContentMemberValue>,
    /// 箱子 `.box/content.yaml` 布局配置；卡片为 `None`。
    pub layout_config: Option<DocumentValue>,
    /// 被修订的分片集合（建议性：实际过滤以字节比对为准，见交回项）。
    pub changed_parts: Vec<String>,
    /// 被删除的内容成员节点标识。
    pub removed_node_ids: Vec<String>,
}

/// 序列化产出的包内成员（`IDocumentSerializedMember` 同构）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SerializedMember {
    /// 包内路径。
    pub package_path: PackagePath,
    /// 成员字节。
    pub bytes: Vec<u8>,
}

impl SerializedMember {
    /// 成员摘要（《11.05》§5.5：单个成员字节的 SHA-256，十六进制不带前缀）。
    #[must_use]
    pub fn digest(&self) -> String {
        member_digest(&self.bytes)
    }

    /// 字节数。
    #[must_use]
    pub fn size(&self) -> u64 {
        self.bytes.len() as u64
    }
}

/// 成员摘要：单个成员字节的 SHA-256 十六进制（不带前缀）。
#[must_use]
pub fn member_digest(bytes: &[u8]) -> String {
    to_hex(&sha256(bytes))
}

/// 回读成员字节为模型值（往返自检）：走解析域权威读侧 `yaml::parse`，
/// 与生产流水线同源；成员不可用（语法/标签/编码失败）时返回致命错误。
///
/// # Errors
///
/// 读侧判定成员字节不可用时返回对应 [`DocumentError`]。
pub fn decode_member_value(
    bytes: &[u8],
    file: &PackagePath,
) -> Result<DocumentValue, DocumentError> {
    let document = crate::yaml::parse(bytes, file, &ParseOptions::default(), false)?;
    document
        .root
        .ok_or_else(|| DocumentError::StructureInvalid {
            message: format!("成员字节不可回读为模型值：{file}"),
            diagnostics: document.diagnostics,
        })
}

/// 包内容摘要（《11.05》§5.5）：入参为同一包的完整成员枚举
/// `(包内路径, 字节数, 成员摘要 hex)`，按路径 UTF-8 字节序升序拼接
/// `path + "\0" + size + "\0" + 成员摘要 + "\n"` 后再取 SHA-256，
/// 输出 `sha256:<hex>`。
#[must_use]
pub fn package_content_digest(members: &[(&PackagePath, u64, String)]) -> String {
    let mut ordered: Vec<(&PackagePath, u64, String)> = members.to_vec();
    ordered.sort_by(|left, right| left.0.as_str().as_bytes().cmp(right.0.as_str().as_bytes()));
    let mut hasher = Sha256::new();
    for (path, size, digest) in ordered {
        hasher.update(path.as_str().as_bytes());
        hasher.update(b"\0");
        hasher.update(size.to_string().as_bytes());
        hasher.update(b"\0");
        hasher.update(digest.as_bytes());
        hasher.update(b"\n");
    }
    format!("sha256:{}", to_hex(&hasher.finish()))
}

/// 由 [`SerializedMember`] 产出集直接求包内容摘要（提交侧终校验便捷入口）。
#[must_use]
pub fn package_content_digest_of(members: &[SerializedMember]) -> String {
    let entries: Vec<(&PackagePath, u64, String)> = members
        .iter()
        .map(|member| (&member.package_path, member.size(), member.digest()))
        .collect();
    package_content_digest(&entries)
}

/// 保存时刻的 RFC 3339 UTC 文本（毫秒精度，`generated_at` 与时间字段口径）。
///
/// 年份超出四位数字可表达区间（0–9999）以 `DOCUMENT_LIMIT_EXCEEDED` 拒绝。
pub fn rfc3339_millis_utc(saved_at: SystemTime) -> Result<String, DocumentError> {
    let civil = epoch_millis_to_civil(epoch_millis(saved_at)?);
    if civil.year < 0 || civil.year > 9999 {
        return Err(DocumentError::LimitExceeded {
            limit: "rfc3339_year_range",
            actual: format!("年份 {} 超出 0000–9999", civil.year),
            file: None,
        });
    }
    Ok(format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        civil.year, civil.month, civil.day, civil.hour, civil.minute, civil.second, civil.millis
    ))
}

/// UTC 日历时间分解（自 1970-01-01 起的毫秒数，负值向早）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CivilDateTime {
    /// 年（可为负，供上游防御臂判定）。
    pub(crate) year: i64,
    /// 月（1–12）。
    pub(crate) month: u32,
    /// 日（1–31）。
    pub(crate) day: u32,
    /// 时（0–23）。
    pub(crate) hour: u32,
    /// 分（0–59）。
    pub(crate) minute: u32,
    /// 秒（0–59）。
    pub(crate) second: u32,
    /// 毫秒（0–999）。
    pub(crate) millis: u32,
}

/// `SystemTime` → Unix 毫秒（超出 `i64` 可表达范围以 `DOCUMENT_LIMIT_EXCEEDED` 拒绝）。
pub(crate) fn epoch_millis(saved_at: SystemTime) -> Result<i64, DocumentError> {
    let too_far = |sign: &str| DocumentError::LimitExceeded {
        limit: "timestamp_millis_range",
        actual: format!("保存时刻{sign}超出 i64 毫秒可表达范围"),
        file: None,
    };
    match saved_at.duration_since(UNIX_EPOCH) {
        Ok(duration) => i64::try_from(duration.as_millis()).map_err(|_| too_far("晚")),
        Err(error) => i64::try_from(error.duration().as_millis())
            .map(|value| -value)
            .map_err(|_| too_far("早")),
    }
}

/// Unix 毫秒 → UTC 日历时间（Howard Hinnant `civil_from_days`，无外部依赖）。
pub(crate) fn epoch_millis_to_civil(millis: i64) -> CivilDateTime {
    const DAYS_FROM_CIVIL_EPOCH: i64 = 719_468;
    const DAYS_PER_ERA: i64 = 146_097;
    let mut days = millis.div_euclid(86_400_000);
    let mut rest = millis.rem_euclid(86_400_000);
    let hour = (rest / 3_600_000) as u32;
    rest %= 3_600_000;
    let minute = (rest / 60_000) as u32;
    rest %= 60_000;
    let second = (rest / 1000) as u32;
    let millis_part = (rest % 1000) as u32;
    days += DAYS_FROM_CIVIL_EPOCH;
    let era = days.div_euclid(DAYS_PER_ERA);
    let day_of_era = days - era * DAYS_PER_ERA;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_of_year = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_of_year + 2) / 5 + 1;
    let month = if month_of_year < 10 {
        month_of_year + 3
    } else {
        month_of_year - 9
    };
    if month <= 2 {
        year += 1;
    }
    CivilDateTime {
        year,
        month: month as u32,
        day: day as u32,
        hour,
        minute,
        second,
        millis: millis_part,
    }
}

/// 序列化文档：产出本次保存必须写出的成员集合（变更成员 + 依赖清单成员）。
///
/// 限额取 [`ParseLimits::default`]；需要非默认限额用 [`serialize_document_with_limits`]。
pub fn serialize_document(
    request: &DocumentSerializeRequest,
    saved_at: SystemTime,
) -> Result<Vec<SerializedMember>, DocumentError> {
    serialize_document_with_limits(request, saved_at, &ParseLimits::default())
}

/// 序列化文档（显式限额：归档态索引限额沿用读侧口径）。
pub fn serialize_document_with_limits(
    request: &DocumentSerializeRequest,
    saved_at: SystemTime,
    limits: &ParseLimits,
) -> Result<Vec<SerializedMember>, DocumentError> {
    validate_request_shape(request)?;
    let opened = open_source(request, limits)?;
    let source: &dyn DocumentSource = opened.as_source();
    if source.kind() != opened.expected {
        return Err(DocumentError::FormatUnknown {
            message: format!(
                "声明形态 {} 与 {} 的数据源形态不符",
                request.form.as_str(),
                request.local_path.display()
            ),
        });
    }
    let metadata_path = package_path(request.kind.metadata_file())?;
    let structure_path = package_path(request.kind.structure_file())?;
    if source.member(&metadata_path).is_none() {
        return Err(DocumentError::MetadataMissing {
            file: metadata_path,
        });
    }
    serialize_with_source(request, saved_at, source, &metadata_path, &structure_path)
}

/// 已打开的数据源（两种形态统一为 `&dyn DocumentSource`）。
enum OpenedSource {
    Directory(DirectorySource),
    Archive(ArchiveSource),
}

impl OpenedSource {
    fn as_source(&self) -> &dyn DocumentSource {
        match self {
            Self::Directory(source) => source,
            Self::Archive(source) => source,
        }
    }
}

/// 打开源并给出与 `form` 对照的期望形态。
struct Opened {
    source: OpenedSource,
    expected: SourceKind,
}

impl Opened {
    fn as_source(&self) -> &dyn DocumentSource {
        self.source.as_source()
    }
}

/// 按形态打开数据源（目录态读侧诊断不影响写侧，序列化只取索引与字节）。
fn open_source(
    request: &DocumentSerializeRequest,
    limits: &ParseLimits,
) -> Result<Opened, DocumentError> {
    let path: &Path = request.local_path.as_path();
    let (source, expected) = match request.form {
        SerializeForm::Directory => {
            let mut diagnostics = Vec::new();
            (
                OpenedSource::Directory(DirectorySource::open(path, &mut diagnostics)?),
                SourceKind::Directory,
            )
        }
        SerializeForm::Archive => (
            OpenedSource::Archive(ArchiveSource::open(path, limits)?),
            SourceKind::Archive,
        ),
    };
    Ok(Opened { source, expected })
}

/// 冻结形状的一致性预检（端口注释即权威：卡片无布局配置、箱子无内容成员）。
fn validate_request_shape(request: &DocumentSerializeRequest) -> Result<(), DocumentError> {
    if !matches!(request.metadata, DocumentValue::Mapping(_)) {
        return Err(DocumentError::MetadataInvalid {
            message: "元数据切片必须是映射".to_owned(),
            diagnostics: Vec::new(),
        });
    }
    if !matches!(request.structure, DocumentValue::Mapping(_)) {
        return Err(DocumentError::StructureInvalid {
            message: "结构切片必须是映射".to_owned(),
            diagnostics: Vec::new(),
        });
    }
    match request.kind {
        DocumentKind::Card if request.layout_config.is_some() => {
            return Err(DocumentError::StructureInvalid {
                message: "卡片序列化不得携带布局配置成员（.box/content.yaml 专属）".to_owned(),
                diagnostics: Vec::new(),
            });
        }
        DocumentKind::Box if !request.contents.is_empty() => {
            return Err(DocumentError::StructureInvalid {
                message: "箱子序列化不得携带内容成员（contents 为空数组）".to_owned(),
                diagnostics: Vec::new(),
            });
        }
        _ => {}
    }
    let mut seen: Vec<&str> = Vec::with_capacity(request.contents.len());
    for item in &request.contents {
        node_id(&item.node_id)?;
        if seen.contains(&item.node_id.as_str()) {
            return Err(DocumentError::StructureInvalid {
                message: format!("内容成员节点重复：{}", item.node_id),
                diagnostics: Vec::new(),
            });
        }
        seen.push(item.node_id.as_str());
    }
    for removed in &request.removed_node_ids {
        node_id(removed)?;
        if seen.contains(&removed.as_str()) {
            return Err(DocumentError::StructureInvalid {
                message: format!("节点同时出现在 contents 与 removedNodeIds：{removed}"),
                diagnostics: Vec::new(),
            });
        }
    }
    Ok(())
}

/// 节点标识构造（10 位 Base62，《01.05》§5.3）。
fn node_id(text: &str) -> Result<NodeId, DocumentError> {
    NodeId::new(text).ok_or_else(|| DocumentError::StructureInvalid {
        message: format!("内容节点标识不是 10 位 Base62 编号：{text}"),
        diagnostics: Vec::new(),
    })
}

/// 包内路径构造。
fn package_path(text: &str) -> Result<PackagePath, DocumentError> {
    PackagePath::new(text)
}

/// 以已打开的数据源执行序列化（纯逻辑面，单元测试与生产面共用）。
fn serialize_with_source(
    request: &DocumentSerializeRequest,
    saved_at: SystemTime,
    source: &dyn DocumentSource,
    metadata_path: &PackagePath,
    structure_path: &PackagePath,
) -> Result<Vec<SerializedMember>, DocumentError> {
    let removed: Vec<PackagePath> = request
        .removed_node_ids
        .iter()
        .map(|text| node_id(text).map(|id| id.content_file()))
        .collect::<Result<Vec<_>, _>>()?;
    let mut regenerated: BTreeMap<PackagePath, Vec<u8>> = BTreeMap::new();
    for item in &request.contents {
        let path = node_id(&item.node_id)?.content_file();
        guard_reference_forms(&item.value, &path)?;
        regenerated.insert(
            path.clone(),
            emit_yaml(&item.value, content_member(request.kind), &path)?,
        );
    }
    if let Some(layout) = &request.layout_config {
        let path = package_path(crate::model::BOX_LAYOUT_CONFIG_FILE)?;
        guard_reference_forms(layout, &path)?;
        let bytes = emit_yaml(layout, SchemaMember::BoxContent, &path)?;
        regenerated.insert(path, bytes);
    }
    let outcome = finalize_package(
        request,
        saved_at,
        source,
        metadata_path,
        structure_path,
        &regenerated,
        &removed,
    )?;
    let mut members = Vec::new();
    for (path, bytes) in outcome.regenerated {
        if same_bytes(source, &path, &bytes)? {
            continue;
        }
        members.push(SerializedMember {
            package_path: path,
            bytes,
        });
    }
    members.sort_by(|left, right| {
        left.package_path
            .as_str()
            .as_bytes()
            .cmp(right.package_path.as_str().as_bytes())
    });
    Ok(members)
}

/// 序列化结果中与产出集合并（定点复算的最终成员字节全集）。
struct PackageOutcome {
    /// 再生成员全集（含 `metadata.yaml` / `structure.yaml` 最终字节）。
    regenerated: BTreeMap<PackagePath, Vec<u8>>,
}

/// 复算 `file_info` 与 `manifest`，并对 `total_size` 自引用做定点迭代。
fn finalize_package(
    request: &DocumentSerializeRequest,
    saved_at: SystemTime,
    source: &dyn DocumentSource,
    metadata_path: &PackagePath,
    structure_path: &PackagePath,
    base: &BTreeMap<PackagePath, Vec<u8>>,
    removed: &[PackagePath],
) -> Result<PackageOutcome, DocumentError> {
    let mut view = PackageView::new(source, base, removed);
    view.insert(metadata_path.clone(), Vec::new());
    view.insert(structure_path.clone(), Vec::new());
    let file_count = view.paths().len() as u64;
    let generated_at = rfc3339_millis_utc(saved_at)?;
    let is_card = request.kind == DocumentKind::Card;
    let mut candidate_total = existing_total_size(source, metadata_path)?;
    let mut previous_checksum: Option<String> = None;
    for _ in 0..MAX_FIXED_POINT_ROUNDS {
        let checksum = view.content_digest_excluding(metadata_path)?;
        let metadata_bytes = if is_card {
            let metadata = with_file_info(
                &request.metadata,
                candidate_total,
                file_count,
                &checksum,
                &generated_at,
            );
            emit_yaml(&metadata, SchemaMember::CardMetadata, metadata_path)?
        } else {
            emit_yaml(&request.metadata, SchemaMember::BoxMetadata, metadata_path)?
        };
        view.insert(metadata_path.clone(), metadata_bytes);
        let structure_bytes = if is_card {
            let structure = rebuild_card_structure(&request.structure, &mut view, structure_path)?;
            emit_yaml(&structure, SchemaMember::CardStructure, structure_path)?
        } else {
            emit_yaml(
                &request.structure,
                SchemaMember::BoxStructure,
                structure_path,
            )?
        };
        view.insert(structure_path.clone(), structure_bytes);
        // 定点判据：本轮写出的 `total_size` 嵌入值与视图实际字节和相等，
        // 且包内容摘要逐轮不再漂移（首轮摘要基于占位视图，必须再稳一轮；
        // RFC 点位四 §7.3；箱子无 `file_info`，首轮即终态）。
        let checksum_settled = previous_checksum.as_ref() == Some(&checksum);
        let total = view.total_size(request.form)?;
        if !is_card || (candidate_total == total && checksum_settled) {
            return Ok(PackageOutcome {
                regenerated: view.regenerated.clone(),
            });
        }
        previous_checksum = Some(checksum);
        candidate_total = total;
    }
    Err(DocumentError::LimitExceeded {
        limit: "file_info_fixed_point_rounds",
        actual: format!("{MAX_FIXED_POINT_ROUNDS} 轮内未收敛"),
        file: Some(metadata_path.clone()),
    })
}

/// 既有 `metadata.yaml` 中的 `file_info.total_size`（定点迭代的初值；缺省 0）。
fn existing_total_size(
    source: &dyn DocumentSource,
    metadata_path: &PackagePath,
) -> Result<u64, DocumentError> {
    let bytes = match source.member(metadata_path) {
        Some(_) => source.read(metadata_path)?,
        None => return Ok(0),
    };
    let parsed = decode_member_value(&bytes, metadata_path).unwrap_or(DocumentValue::Null);
    Ok(parsed
        .get("file_info")
        .and_then(|info| info.get("total_size"))
        .and_then(DocumentValue::as_i64)
        .and_then(|value| u64::try_from(value).ok())
        .unwrap_or(0))
}

/// 注入/覆写 `file_info`（《01.04》§4.3：系统生成，用户与插件不手工维护）。
fn with_file_info(
    metadata: &DocumentValue,
    total_size: u64,
    file_count: u64,
    checksum: &str,
    generated_at: &str,
) -> DocumentValue {
    let mut entries: Vec<(String, DocumentValue)> = metadata
        .as_mapping()
        .map(|items| {
            items
                .iter()
                .filter(|(key, _)| key != "file_info")
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    let info = DocumentValue::Mapping(vec![
        ("total_size".to_owned(), integer(total_size)),
        ("file_count".to_owned(), integer(file_count)),
        (
            "checksum".to_owned(),
            DocumentValue::String(checksum.to_owned()),
        ),
        (
            "generated_at".to_owned(),
            DocumentValue::String(generated_at.to_owned()),
        ),
    ]);
    entries.push(("file_info".to_owned(), info));
    DocumentValue::Mapping(entries)
}

/// 非负整数 → 模型整数值（超出 `i64` 以 `DOCUMENT_LIMIT_EXCEEDED` 拒绝）。
fn integer(value: u64) -> DocumentValue {
    DocumentValue::Integer(i64::try_from(value).unwrap_or(i64::MAX))
}

/// 卡片 `structure.yaml` 的 `manifest` 复算（《01.05》§5.3、《11.05》§5.5）。
fn rebuild_card_structure(
    structure: &DocumentValue,
    view: &mut PackageView<'_>,
    file: &PackagePath,
) -> Result<DocumentValue, DocumentError> {
    let entries = structure
        .as_mapping()
        .ok_or_else(|| DocumentError::StructureInvalid {
            message: "结构切片必须是映射".to_owned(),
            diagnostics: Vec::new(),
        })?;
    let nodes = structure
        .get("structure")
        .and_then(DocumentValue::as_sequence)
        .ok_or_else(|| DocumentError::StructureInvalid {
            message: "结构切片缺少 structure 数组".to_owned(),
            diagnostics: vec![invalid_diagnostic(
                "缺少必填字段 structure",
                file,
                "/structure",
            )],
        })?;
    let card_count = nodes.len() as u64;
    let existing = structure.get("manifest");
    let manifest_entries: Vec<(String, DocumentValue)> = existing
        .and_then(DocumentValue::as_mapping)
        .map(|items| items.to_vec())
        .unwrap_or_default();
    let resources = existing
        .and_then(|manifest| manifest.get("resources"))
        .and_then(DocumentValue::as_sequence)
        .map(|items| items.to_vec())
        .unwrap_or_default();
    let mut updated = Vec::with_capacity(resources.len());
    for item in &resources {
        updated.push(rebuild_resource_item(item, view, file)?);
    }
    let resource_count = updated.len() as u64;
    let mut manifest: BTreeMap<String, DocumentValue> = BTreeMap::new();
    for (key, value) in manifest_entries {
        manifest.insert(key, value);
    }
    manifest.insert("card_count".to_owned(), integer(card_count));
    manifest.insert("resource_count".to_owned(), integer(resource_count));
    if !resources.is_empty() || manifest.contains_key("resources") {
        manifest.insert("resources".to_owned(), DocumentValue::Sequence(updated));
    }
    let manifest_value = DocumentValue::Mapping(manifest.into_iter().collect());
    let mut rebuilt: Vec<(String, DocumentValue)> = Vec::with_capacity(entries.len() + 1);
    let mut replaced = false;
    for (key, value) in entries {
        if key == "manifest" {
            rebuilt.push((key.clone(), manifest_value.clone()));
            replaced = true;
        } else {
            rebuilt.push((key.clone(), value.clone()));
        }
    }
    if !replaced {
        rebuilt.push(("manifest".to_owned(), manifest_value));
    }
    Ok(DocumentValue::Mapping(rebuilt))
}

/// 单条 `manifest.resources[]`：真实字节重算，成员摘要一致时复用既有值。
fn rebuild_resource_item(
    item: &DocumentValue,
    view: &mut PackageView<'_>,
    file: &PackagePath,
) -> Result<DocumentValue, DocumentError> {
    let path_text = item
        .get("path")
        .and_then(DocumentValue::as_str)
        .unwrap_or("");
    guard_reference_text(path_text, file, "/manifest/resources/path")?;
    let located = PackagePath::new(path_text).ok();
    let Some(path) = located.as_ref().filter(|path| view.contains(path)) else {
        // 缺席成员（网络资源卡片，《01.02》§2.5）与远端 URL 条目：原样保留。
        return Ok(item.clone());
    };
    let (size, digest) = view.digest(path)?;
    let declared_checksum_matches = item
        .get("checksum")
        .and_then(DocumentValue::as_str)
        .is_some_and(|declared| {
            declared
                .trim_start_matches("sha256:")
                .trim()
                .eq_ignore_ascii_case(&digest)
        });
    let declared_size_matches = item
        .get("size")
        .and_then(DocumentValue::as_i64)
        .is_some_and(|declared| u64::try_from(declared).is_ok_and(|value| value == size));
    if declared_checksum_matches && (declared_size_matches || item.get("checksum").is_none()) {
        // 《11.05》§5.5：成员摘要一致 → 复用既有值，保字节稳定。
        return Ok(item.clone());
    }
    let mut entries: Vec<(String, DocumentValue)> = item
        .as_mapping()
        .map(|items| items.to_vec())
        .unwrap_or_default();
    let mut touched_size = false;
    let mut touched_checksum = false;
    for (key, value) in &mut entries {
        match key.as_str() {
            "size" => {
                *value = integer(size);
                touched_size = true;
            }
            "checksum" => {
                *value = DocumentValue::String(digest.clone());
                touched_checksum = true;
            }
            _ => {}
        }
    }
    if !touched_size {
        entries.push(("size".to_owned(), integer(size)));
    }
    if !touched_checksum {
        entries.push(("checksum".to_owned(), DocumentValue::String(digest)));
    }
    Ok(DocumentValue::Mapping(entries))
}

/// 最终包视图：复用成员（既有字节）+ 再生成员（候选字节）。
struct PackageView<'a> {
    source: &'a dyn DocumentSource,
    regenerated: BTreeMap<PackagePath, Vec<u8>>,
    reused: BTreeMap<PackagePath, u64>,
    digests: BTreeMap<PackagePath, (u64, String)>,
}

impl<'a> PackageView<'a> {
    /// 以源索引与再生集合建视图；`removed` 成员整条剔除。
    fn new(
        source: &'a dyn DocumentSource,
        regenerated: &BTreeMap<PackagePath, Vec<u8>>,
        removed: &[PackagePath],
    ) -> Self {
        let reused: BTreeMap<PackagePath, u64> = source
            .fingerprint()
            .members
            .iter()
            .filter(|(path, _)| !removed.contains(path) && !regenerated.contains_key(path))
            .map(|(path, fingerprint)| (path.clone(), fingerprint.size))
            .collect();
        Self {
            source,
            regenerated: regenerated.clone(),
            reused,
            digests: BTreeMap::new(),
        }
    }

    fn contains(&self, path: &PackagePath) -> bool {
        self.regenerated.contains_key(path) || self.reused.contains_key(path)
    }

    fn insert(&mut self, path: PackagePath, bytes: Vec<u8>) {
        self.reused.remove(&path);
        self.digests.remove(&path);
        self.regenerated.insert(path, bytes);
    }

    /// 最终成员全集（升序）。
    fn paths(&self) -> Vec<PackagePath> {
        let mut paths: Vec<PackagePath> = self
            .regenerated
            .keys()
            .chain(self.reused.keys())
            .cloned()
            .collect();
        paths.sort_by(|left, right| left.as_str().as_bytes().cmp(right.as_str().as_bytes()));
        paths
    }

    fn size(&self, path: &PackagePath) -> Option<u64> {
        if let Some(bytes) = self.regenerated.get(path) {
            return Some(bytes.len() as u64);
        }
        self.reused.get(path).copied()
    }

    /// 成员摘要（再生成员按候选字节、复用成员按源字节流式摘要）。
    fn digest(&mut self, path: &PackagePath) -> Result<(u64, String), DocumentError> {
        if let Some(cached) = self.digests.get(path) {
            if Some(cached.0) == self.size(path) {
                return Ok(cached.clone());
            }
        }
        let computed = if let Some(bytes) = self.regenerated.get(path) {
            let bytes = bytes.clone();
            (bytes.len() as u64, member_digest(&bytes))
        } else {
            hash_stream_member(self.source, path)?
        };
        self.digests.insert(path.clone(), computed.clone());
        Ok(computed)
    }

    /// 包内容摘要（覆盖除 `skip` 以外的成员字节，《11.05》§5.5）。
    fn content_digest_excluding(&mut self, skip: &PackagePath) -> Result<String, DocumentError> {
        let mut owned: Vec<(PackagePath, u64, String)> = Vec::new();
        for path in self.paths() {
            if &path == skip {
                continue;
            }
            let (size, digest) = self.digest(&path)?;
            owned.push((path, size, digest));
        }
        let entries: Vec<(&PackagePath, u64, String)> = owned
            .iter()
            .map(|(path, size, digest)| (path, *size, digest.clone()))
            .collect();
        Ok(package_content_digest(&entries))
    }

    /// `total_size`：目录态为全部成员文件字节之和；归档态为闭式和（《11.05》§5.5）。
    fn total_size(&self, form: SerializeForm) -> Result<u64, DocumentError> {
        let entries: Vec<(PackagePath, u64)> = self
            .paths()
            .into_iter()
            .map(|path| {
                let size = self.size(&path).unwrap_or(0);
                (path, size)
            })
            .collect();
        match form {
            SerializeForm::Directory => entries.iter().try_fold(0u64, |acc, (_, size)| {
                acc.checked_add(*size).ok_or(DocumentError::LimitExceeded {
                    limit: "total_size",
                    actual: "目录态总字节求和溢出".to_owned(),
                    file: None,
                })
            }),
            SerializeForm::Archive => archive_total_size(&entries),
        }
    }
}

/// 流式计算成员字节数与摘要（常数内存，不整成员载入由源侧分块读取承担）。
fn hash_stream_member(
    source: &dyn DocumentSource,
    path: &PackagePath,
) -> Result<(u64, String), DocumentError> {
    let mut stream = source.open_stream(path)?;
    let mut hasher = Sha256::new();
    let mut total = 0u64;
    let mut buffer = vec![0u8; 64 * 1024];
    match &mut stream {
        ByteStream::Mapped {
            source: mapping,
            offset,
            length,
        } => {
            let mut read = 0u64;
            while read < *length {
                let chunk = (*length - read).min(buffer.len() as u64);
                let slice =
                    mapping
                        .slice(*offset + read, chunk)
                        .ok_or_else(|| DocumentError::Io {
                            message: format!("成员切片越界：{path}"),
                        })?;
                let len = slice.len() as u64;
                hasher.update(slice);
                read += len;
                total += len;
                if len == 0 {
                    break;
                }
            }
        }
        ByteStream::Decoded(reader) => loop {
            let read = reader
                .read(&mut buffer)
                .map_err(|io_error| DocumentError::Io {
                    message: format!("成员读取失败（{path}）：{io_error}"),
                })?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
            total += read as u64;
        },
    }
    Ok((total, to_hex(&hasher.finish())))
}

/// 与源字节逐字节比对：相同即未修订，不进入产出集（《11.05》§5.1）。
fn same_bytes(
    source: &dyn DocumentSource,
    path: &PackagePath,
    bytes: &[u8],
) -> Result<bool, DocumentError> {
    if source.member(path).is_none() {
        return Ok(false);
    }
    let existing = source.read(path)?;
    Ok(existing == bytes)
}

/// 规范形态发射：键序提纯 + YAML 写出（《06.10》§10.2）。
fn emit_yaml(
    value: &DocumentValue,
    member: SchemaMember,
    file: &PackagePath,
) -> Result<Vec<u8>, DocumentError> {
    let canonical = canonical::canonicalize(value, SchemaRegistry::fields(member));
    let text = canonical::to_yaml_document(&canonical)
        .map_err(|error| emission_error(error, member, file))?;
    Ok(text.into_bytes())
}

/// 发射失败 → 在册错误码映射（零新码）。
fn emission_error(
    error: canonical::EmitError,
    member: SchemaMember,
    file: &PackagePath,
) -> DocumentError {
    match error {
        canonical::EmitError::Depth(reason) => DocumentError::LimitExceeded {
            limit: "max_depth",
            actual: reason,
            file: Some(file.clone()),
        },
        canonical::EmitError::Invalid(reason) => {
            let diagnostic = invalid_diagnostic(&reason, file, "");
            if is_metadata_member(member) {
                DocumentError::MetadataInvalid {
                    message: reason.clone(),
                    diagnostics: vec![diagnostic],
                }
            } else {
                DocumentError::StructureInvalid {
                    message: reason.clone(),
                    diagnostics: vec![diagnostic],
                }
            }
        }
    }
}

/// 成员 → schema 表（内容成员按类别取卡片/箱子内容信封）。
fn content_member(kind: DocumentKind) -> SchemaMember {
    match kind {
        DocumentKind::Card => SchemaMember::CardContent,
        DocumentKind::Box => SchemaMember::BoxContent,
    }
}

/// 是否元数据成员（决定 `DOCUMENT_METADATA_INVALID` / `DOCUMENT_STRUCTURE_INVALID`）。
fn is_metadata_member(member: SchemaMember) -> bool {
    matches!(
        member,
        SchemaMember::CardMetadata | SchemaMember::BoxMetadata
    )
}

/// 错误级诊断（携带定位文件）。
fn invalid_diagnostic(message: &str, file: &PackagePath, pointer: &str) -> Diagnostic {
    let base = Diagnostic::new(
        Severity::Error,
        DOCUMENT_METADATA_INVALID,
        message.to_owned(),
    );
    if pointer.is_empty() {
        base.in_file(file)
    } else {
        base.at(file, pointer.to_owned())
    }
}

/// 防写回校验：递归检查值树中全部字符串标量（《11.05》§5.1、《11.09》§9）。
fn guard_reference_forms(value: &DocumentValue, file: &PackagePath) -> Result<(), DocumentError> {
    match value {
        DocumentValue::String(text) => guard_reference_text(text, file, ""),
        DocumentValue::Sequence(items) => {
            for (index, item) in items.iter().enumerate() {
                guard_reference_forms(item, file)
                    .map_err(|error| with_pointer(error, &format!("/{index}")))?;
            }
            Ok(())
        }
        DocumentValue::Mapping(entries) => {
            for (key, item) in entries {
                guard_reference_forms(item, file)
                    .map_err(|error| with_pointer(error, &format!("/{key}")))?;
            }
            Ok(())
        }
        _ => Ok(()),
    }
}

/// 为错误补挂 RFC 6901 指针诊断。
fn with_pointer(error: DocumentError, pointer: &str) -> DocumentError {
    match error {
        DocumentError::PathUnsafe { path } => DocumentError::PathUnsafe {
            path: format!("{path}（指针 {pointer}）"),
        },
        other => other,
    }
}

/// 单值防写回判定。
fn guard_reference_text(
    text: &str,
    file: &PackagePath,
    pointer: &str,
) -> Result<(), DocumentError> {
    let _ = (file, pointer);
    match forbidden_reference(text) {
        Some(reason) => Err(DocumentError::PathUnsafe {
            path: format!("{text}（{reason}）"),
        }),
        None => Ok(()),
    }
}

/// 命中的禁止形态说明；未命中返回 `None`。
///
/// 判定面严格限于形态，不做键名启发：
///
/// - 值以 `blob:` / `data:` / `file://` 起始（运行期与本地地址，R12/R13）；
/// - 路径形（单行、无空白）且为裸绝对路径（`/…`、`C:\…`、`\\server\…`）；
/// - 路径形且含 `..` 段（穿越）。
fn forbidden_reference(text: &str) -> Option<&'static str> {
    if text.starts_with("blob:") {
        return Some("blob: 运行期地址");
    }
    if text.starts_with("data:") {
        return Some("data: 内联数据（仅运行时内存形态）");
    }
    if text.starts_with("file://") {
        return Some("file:// 本地地址");
    }
    if !is_path_shaped(text) {
        return None;
    }
    if is_bare_absolute_path(text) {
        return Some("裸绝对路径");
    }
    if text.split('/').any(|segment| segment == "..") {
        return Some(".. 路径穿越");
    }
    None
}

/// 路径形：单行、非空、不含空白字符（含空白的散文不参与路径判定）。
fn is_path_shaped(text: &str) -> bool {
    !text.is_empty() && !text.contains(char::is_whitespace)
}

/// 裸绝对路径形态（POSIX 根、Windows 盘符、UNC）。
fn is_bare_absolute_path(text: &str) -> bool {
    if text.starts_with('/') || text.starts_with("\\\\") {
        return true;
    }
    let bytes = text.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

/// 字节 → 小写十六进制。
fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{DOCUMENT_LIMIT_EXCEEDED, DOCUMENT_PATH_UNSAFE, DOCUMENT_STRUCTURE_INVALID};
    use crate::source::{MemberMeta, MemberMethod, SourceFingerprint};
    use std::io::Cursor;

    /// 内存数据源替例：序列化纯逻辑面的单元测试不触盘。
    struct MemorySource {
        fingerprint: SourceFingerprint,
        members: BTreeMap<PackagePath, Vec<u8>>,
    }

    impl MemorySource {
        fn new(kind: SourceKind, members: &[(&str, &str)]) -> Self {
            let mut entries: Vec<(PackagePath, Vec<u8>)> = members
                .iter()
                .map(|(path, text)| {
                    (
                        PackagePath::new(path).expect("合法路径"),
                        (*text).to_owned().into_bytes(),
                    )
                })
                .collect();
            entries
                .sort_by(|left, right| left.0.as_str().as_bytes().cmp(right.0.as_str().as_bytes()));
            let fingerprint_members = entries
                .iter()
                .map(|(path, bytes)| {
                    (
                        path.clone(),
                        crate::source::MemberFingerprint {
                            size: bytes.len() as u64,
                            modified_millis: None,
                            crc32: None,
                        },
                    )
                })
                .collect();
            Self {
                fingerprint: SourceFingerprint {
                    kind,
                    members: fingerprint_members,
                },
                members: entries.into_iter().collect(),
            }
        }
    }

    impl DocumentSource for MemorySource {
        fn kind(&self) -> SourceKind {
            self.fingerprint.kind
        }

        fn fingerprint(&self) -> SourceFingerprint {
            self.fingerprint.clone()
        }

        fn member(&self, path: &PackagePath) -> Option<MemberMeta> {
            self.members
                .get_key_value(path)
                .map(|(path, bytes)| MemberMeta {
                    path: path.clone(),
                    size: bytes.len() as u64,
                    modified: None,
                    crc32: None,
                    method: MemberMethod::Store,
                })
        }

        fn list(&self, prefix: &PackagePath) -> Result<Vec<PackagePath>, DocumentError> {
            Ok(self
                .members
                .keys()
                .filter(|path| path.starts_with(&format!("{prefix}/")))
                .cloned()
                .collect())
        }

        fn read(&self, path: &PackagePath) -> Result<Vec<u8>, DocumentError> {
            self.members
                .get(path)
                .cloned()
                .ok_or_else(|| DocumentError::NotFound {
                    path: path.to_string(),
                })
        }

        fn open_stream(&self, path: &PackagePath) -> Result<ByteStream, DocumentError> {
            Ok(ByteStream::Decoded(Box::new(Cursor::new(self.read(path)?))))
        }
    }

    fn mapping(pairs: &[(&str, DocumentValue)]) -> DocumentValue {
        DocumentValue::Mapping(
            pairs
                .iter()
                .map(|(key, value)| ((*key).to_owned(), value.clone()))
                .collect(),
        )
    }

    fn text(value: &str) -> DocumentValue {
        DocumentValue::String(value.to_owned())
    }

    /// 卡片最小模型（`file_info` 由序列化侧复算，故入参不带）。
    fn card_request(contents: Vec<(&str, DocumentValue)>) -> DocumentSerializeRequest {
        DocumentSerializeRequest {
            kind: DocumentKind::Card,
            form: SerializeForm::Directory,
            local_path: PathBuf::from("sample.card"),
            metadata: mapping(&[
                ("chip_standards_version", text("1.0.0")),
                ("card_id", text("a1B2c3D4e5")),
                ("name", text("序列化夹具")),
                ("created_at", text("2026-01-15T08:00:00.000Z")),
                ("modified_at", text("2026-03-22T08:00:00.000Z")),
            ]),
            structure: mapping(&[
                (
                    "structure",
                    DocumentValue::Sequence(vec![mapping(&[
                        ("id", text("a1B2c3D4e5")),
                        ("type", text("base.video")),
                    ])]),
                ),
                (
                    "manifest",
                    mapping(&[
                        ("card_count", DocumentValue::Integer(999)),
                        ("resource_count", DocumentValue::Integer(999)),
                        (
                            "resources",
                            DocumentValue::Sequence(vec![mapping(&[
                                ("path", text("photo.jpg")),
                                ("size", DocumentValue::Integer(1)),
                                ("type", text("image/jpeg")),
                            ])]),
                        ),
                    ]),
                ),
            ]),
            contents: contents
                .into_iter()
                .map(|(node_id, value)| ContentMemberValue {
                    node_id: node_id.to_owned(),
                    value,
                })
                .collect(),
            layout_config: None,
            changed_parts: Vec::new(),
            removed_node_ids: Vec::new(),
        }
    }

    fn source_with(members: &[(&str, &str)]) -> MemorySource {
        MemorySource::new(SourceKind::Directory, members)
    }

    fn saved_at() -> SystemTime {
        UNIX_EPOCH + std::time::Duration::from_millis(1_774_166_400_000)
    }

    /// 日历向量用例：`(Unix 毫秒, (年, 月, 日, 时, 分, 秒, 毫秒))`。
    type CivilCase = (i64, (i64, u32, u32, u32, u32, u32, u32));

    #[test]
    fn test_civil_date_vectors() {
        let cases: [CivilCase; 6] = [
            (0, (1970, 1, 1, 0, 0, 0, 0)),
            (-1, (1969, 12, 31, 23, 59, 59, 999)),
            (1_774_166_400_000, (2026, 3, 22, 8, 0, 0, 0)),
            (1_709_172_000_000, (2024, 2, 29, 2, 0, 0, 0)),
            (31_536_000_000, (1971, 1, 1, 0, 0, 0, 0)),
            (4_354_819_200_000, (2108, 1, 1, 0, 0, 0, 0)),
        ];
        for (millis, expected) in cases {
            let civil = epoch_millis_to_civil(millis);
            assert_eq!(
                (
                    civil.year,
                    civil.month,
                    civil.day,
                    civil.hour,
                    civil.minute,
                    civil.second,
                    civil.millis
                ),
                expected,
                "毫秒 {millis} 的 UTC 分解"
            );
        }
    }

    #[test]
    fn test_rfc3339_millis_utc_form_and_guard() {
        assert_eq!(
            rfc3339_millis_utc(UNIX_EPOCH).expect("epoch 可表达"),
            "1970-01-01T00:00:00.000Z"
        );
        assert_eq!(
            rfc3339_millis_utc(saved_at()).expect("保存时刻可表达"),
            "2026-03-22T08:00:00.000Z"
        );
        // 年份超出四位数字：防御臂拒绝。
        let error =
            rfc3339_millis_utc(UNIX_EPOCH + std::time::Duration::from_secs(86_400 * 4_000_000))
                .expect_err("超出 9999 年必须拒绝");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_epoch_millis_out_of_range_is_limit() {
        let far = UNIX_EPOCH + std::time::Duration::from_secs(u64::MAX / 2);
        let error = epoch_millis(far).expect_err("超出 i64 毫秒必须拒绝");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
    }

    #[test]
    fn test_member_digest_known_vectors() {
        // FIPS 180-4 标准向量：空与 "abc"。
        assert_eq!(
            member_digest(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            member_digest(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn test_package_content_digest_formula_and_order() {
        let a = PackagePath::new("a.txt").expect("合法");
        let b = PackagePath::new("b/c.txt").expect("合法");
        let joined = |members: &[(&PackagePath, u64, String)]| {
            let mut ordered: Vec<_> = members.to_vec();
            ordered
                .sort_by(|left, right| left.0.as_str().as_bytes().cmp(right.0.as_str().as_bytes()));
            let mut text = String::new();
            for (path, size, digest) in ordered {
                text.push_str(&format!("{}\u{0}{size}\u{0}{digest}\n", path.as_str()));
            }
            text
        };
        let hex_a = member_digest(b"aaa");
        let entries = vec![(&b, 2u64, member_digest(b"bb")), (&a, 3u64, hex_a.clone())];
        let digest = package_content_digest(&entries);
        assert_eq!(
            digest,
            format!("sha256:{}", to_hex(&sha256(joined(&entries).as_bytes()))),
            "摘要必须按 §5.5 拼接式与路径升序计算"
        );
        // 顺序无关：交换入参顺序结果一致。
        let shuffled = vec![(&a, 3u64, hex_a), (&b, 2u64, member_digest(b"bb"))];
        assert_eq!(package_content_digest(&shuffled), digest);
        // 尺寸字段参与摘要：仅尺寸不同必须改变结果。
        let sized = vec![
            (&a, 4u64, member_digest(b"aaa")),
            (&b, 2u64, member_digest(b"bb")),
        ];
        assert_ne!(package_content_digest(&sized), digest);
        // 空集：即空串 SHA-256（已知向量）。
        assert_eq!(
            package_content_digest(&[]),
            "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }

    #[test]
    fn test_guard_rejects_runtime_addresses() {
        for forbidden in [
            "blob:https://example/1",
            "data:image/png;base64,AAAA",
            "file:///Users/me/x.png",
            "/Users/me/x.png",
            "C:\\Users\\me\\x.png",
            "\\\\server\\share\\x.png",
            "../escape.png",
            "a/../../escape.png",
            "..",
        ] {
            let value = mapping(&[("src", text(forbidden))]);
            let file = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法");
            let error =
                guard_reference_forms(&value, &file).expect_err(&format!("{forbidden} 必须被拒绝"));
            assert_eq!(error.code(), DOCUMENT_PATH_UNSAFE, "{forbidden}");
        }
        // 允许形态：包内相对路径与正式远端引用（《06.02》§2.2）。
        for allowed in [
            "photo.jpg",
            "docs/季度报告.pdf",
            "https://cdn.example/a.png",
            "webdav://host/a.png",
            "chips-resource://workspace/a.png",
            "a/..b.png",
            "正文里提到 data: 但不在值首",
            "/ 与 \\ 的分隔说明（含空白，非路径形）",
            "行\n数据",
        ] {
            let file = PackagePath::new("content/a1B2c3D4e5.yaml").expect("合法");
            guard_reference_text(allowed, &file, "")
                .unwrap_or_else(|_| panic!("{allowed} 必须放行"));
        }
    }

    #[test]
    fn test_shape_validation_rejects_inconsistencies() {
        // 卡片不得带布局配置。
        let mut request = card_request(vec![]);
        request.layout_config = Some(mapping(&[("layout_type", text("grid"))]));
        assert_eq!(
            validate_request_shape(&request)
                .expect_err("卡片带布局配置必须拒绝")
                .code(),
            DOCUMENT_STRUCTURE_INVALID
        );
        // 箱子不得带内容成员。
        let mut box_request = request;
        box_request.kind = DocumentKind::Box;
        box_request.layout_config = None;
        box_request.contents = vec![ContentMemberValue {
            node_id: "a1B2c3D4e5".to_owned(),
            value: mapping(&[("card_type", text("base.video"))]),
        }];
        assert_eq!(
            validate_request_shape(&box_request)
                .expect_err("箱子带内容成员必须拒绝")
                .code(),
            DOCUMENT_STRUCTURE_INVALID
        );
        // 非法节点标识 / 重复节点 / contents 与 removed 交集。
        let mut bad = card_request(vec![]);
        bad.contents = vec![ContentMemberValue {
            node_id: "short".to_owned(),
            value: mapping(&[("card_type", text("base.video"))]),
        }];
        assert_eq!(
            validate_request_shape(&bad)
                .expect_err("非法节点标识必须拒绝")
                .code(),
            DOCUMENT_STRUCTURE_INVALID
        );
        let mut dup = card_request(vec![("a1B2c3D4e5", mapping(&[("card_type", text("x"))]))]);
        dup.contents.push(ContentMemberValue {
            node_id: "a1B2c3D4e5".to_owned(),
            value: DocumentValue::Mapping(Vec::new()),
        });
        assert_eq!(
            validate_request_shape(&dup)
                .expect_err("重复节点必须拒绝")
                .code(),
            DOCUMENT_STRUCTURE_INVALID
        );
        let mut overlap = card_request(vec![("a1B2c3D4e5", mapping(&[("card_type", text("x"))]))]);
        overlap.removed_node_ids = vec!["a1B2c3D4e5".to_owned()];
        assert_eq!(
            validate_request_shape(&overlap)
                .expect_err("增删交集必须拒绝")
                .code(),
            DOCUMENT_STRUCTURE_INVALID
        );
    }

    #[test]
    fn test_card_serialize_emits_all_lists_with_injected_file_info() {
        let source = source_with(&[
            (".card/metadata.yaml", "stale: true\n"),
            (".card/structure.yaml", "stale: true\n"),
            (".card/cover.html", "<html>cover</html>"),
            ("content/a1B2c3D4e5.yaml", "card_type: base.image\n"),
            ("photo.jpg", "12345"),
        ]);
        let request = card_request(vec![(
            "f6G7h8I9j0",
            mapping(&[("card_type", text("base.video"))]),
        )]);
        let members = serialize_with_source(
            &request,
            saved_at(),
            &source,
            &PackagePath::new(".card/metadata.yaml").expect("合法"),
            &PackagePath::new(".card/structure.yaml").expect("合法"),
        )
        .expect("序列化成功");
        let paths: Vec<&str> = members
            .iter()
            .map(|member| member.package_path.as_str())
            .collect();
        assert_eq!(
            paths,
            vec![
                ".card/metadata.yaml",
                ".card/structure.yaml",
                "content/f6G7h8I9j0.yaml"
            ],
            "未修订的 content/a1B2c3D4e5.yaml 必须被字节比对过滤（产出升序）"
        );
        let metadata = String::from_utf8(
            members
                .iter()
                .find(|member| member.package_path.as_str() == ".card/metadata.yaml")
                .expect("metadata 必出")
                .bytes
                .clone(),
        )
        .expect("UTF-8");
        println!("{metadata}");
        assert!(metadata.contains("generated_at: \"2026-03-22T08:00:00.000Z\""));
        let structure = String::from_utf8(
            members
                .iter()
                .find(|member| member.package_path.as_str() == ".card/structure.yaml")
                .expect("structure 必出")
                .bytes
                .clone(),
        )
        .expect("UTF-8");
        assert!(
            structure.contains("card_count: 1"),
            "card_count 必须按 structure 长度复算：{structure}"
        );
        assert!(
            structure.contains("resource_count: 1"),
            "resource_count 必须按 resources 长度复算：{structure}"
        );
        assert!(
            structure.contains(&format!("checksum: {}", member_digest(b"12345"))),
            "资源成员摘要必须重算：{structure}"
        );
    }

    #[test]
    fn test_file_info_total_size_is_self_consistent_directory_form() {
        // 目录态定点：total_size 含 metadata 自身 → 写出后必须与实际字节一致。
        let source = source_with(&[
            (".card/metadata.yaml", "name: old\n"),
            (".card/structure.yaml", "name: old\n"),
            ("photo.jpg", "1234567890"),
        ]);
        let request = card_request(vec![]);
        let metadata_path = PackagePath::new(".card/metadata.yaml").expect("合法");
        let structure_path = PackagePath::new(".card/structure.yaml").expect("合法");
        let members = serialize_with_source(
            &request,
            saved_at(),
            &source,
            &metadata_path,
            &structure_path,
        )
        .expect("序列化成功");
        let metadata_bytes = members
            .iter()
            .find(|member| member.package_path == metadata_path)
            .expect("metadata 必出")
            .bytes
            .clone();
        let declared = declared_total_size(&metadata_bytes);
        let structure_bytes = members
            .iter()
            .find(|member| member.package_path == structure_path)
            .expect("structure 必出")
            .bytes
            .len() as u64;
        let actual = metadata_bytes.len() as u64
            + structure_bytes
            + b"1234567890".len() as u64
            + members
                .iter()
                .filter(|member| {
                    member.package_path != metadata_path && member.package_path != structure_path
                })
                .map(|member| member.bytes.len() as u64)
                .sum::<u64>();
        assert_eq!(declared, actual, "声明总字节必须等于最终全部成员字节之和");
    }

    /// 从发射出的 metadata 字节里取 `file_info.total_size`（测试断言用）。
    fn declared_total_size(bytes: &[u8]) -> u64 {
        let parsed = decode_member_value(
            bytes,
            &PackagePath::new(".card/metadata.yaml").expect("合法"),
        )
        .expect("发射文本必须可回读");
        parsed
            .get("file_info")
            .and_then(|info| info.get("total_size"))
            .and_then(DocumentValue::as_i64)
            .expect("total_size 必为整数") as u64
    }

    #[test]
    fn test_removed_nodes_are_excluded_and_reused_members_not_emitted() {
        let source = source_with(&[
            (".card/metadata.yaml", "name: old\n"),
            (".card/structure.yaml", "name: old\n"),
            ("content/a1B2c3D4e5.yaml", "card_type: base.video\n"),
            ("photo.jpg", "12345"),
        ]);
        let mut request = card_request(vec![]);
        request.removed_node_ids = vec!["a1B2c3D4e5".to_owned()];
        let members = serialize_with_source(
            &request,
            saved_at(),
            &source,
            &PackagePath::new(".card/metadata.yaml").expect("合法"),
            &PackagePath::new(".card/structure.yaml").expect("合法"),
        )
        .expect("序列化成功");
        assert!(
            !members
                .iter()
                .any(|member| member.package_path.as_str() == "content/a1B2c3D4e5.yaml"),
            "被删除成员不得写出"
        );
        let metadata = members
            .iter()
            .find(|member| member.package_path.as_str() == ".card/metadata.yaml")
            .expect("metadata 必出");
        let text = String::from_utf8(metadata.bytes.clone()).expect("UTF-8");
        // 删除后 total_size 与被删成员无关：9（photo）+ 结构 + 元数据。
        assert!(
            text.contains("file_count: 3"),
            "成员数须剔除被删成员：{text}"
        );
    }

    #[test]
    fn test_absent_manifest_member_keeps_entry_unchanged() {
        // 网络资源卡片：清单指向包内不存在的字节 → 条目原样保留（《01.02》§2.5）。
        let source = source_with(&[
            (".card/metadata.yaml", "name: old\n"),
            (".card/structure.yaml", "name: old\n"),
        ]);
        let request = card_request(vec![]);
        let members = serialize_with_source(
            &request,
            saved_at(),
            &source,
            &PackagePath::new(".card/metadata.yaml").expect("合法"),
            &PackagePath::new(".card/structure.yaml").expect("合法"),
        )
        .expect("序列化成功");
        let structure = members
            .iter()
            .find(|member| member.package_path.as_str() == ".card/structure.yaml")
            .expect("structure 必出");
        let text = String::from_utf8(structure.bytes.clone()).expect("UTF-8");
        assert!(
            text.contains("size: 1"),
            "缺席成员的尺寸必须保持既有值：{text}"
        );
        assert!(
            !text.contains("checksum: "),
            "缺席成员不得凭空补摘要：{text}"
        );
    }

    #[test]
    fn test_fixed_point_oscillation_is_rejected() {
        // 定点不收敛的防御臂：候选值与字节和逐轮互相错开时以限额错误拒绝（OQ-5 上限 3）。
        // 生产链路上数字位长单调稳定使该摆动不可达，直测同式迭代器。
        // 摆动源：偶候选发射 9 字节、奇候选发射 10 字节，字节和永远不等于候选值。
        let oscillating = |candidate: u64| -> Result<(Vec<u8>, Vec<u8>), DocumentError> {
            let body = if candidate % 2 == 0 {
                "aaaaaaaa\n".to_owned()
            } else {
                "bbbbbbbbb\n".to_owned()
            };
            Ok((body.into_bytes(), b"stable: 1\n".to_vec()))
        };
        let error = iterate_list_fixed_point(
            0,
            Box::new(oscillating),
            Box::new(|metadata, _structure| Ok(metadata.len() as u64)),
        )
        .expect_err("摆动必须不收敛");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
        // 同式收敛臂：候选与字节和恒等时，首轮记稳、第二轮判定收敛。
        let (metadata, _structure, total) = iterate_list_fixed_point(
            9,
            Box::new(|candidate| Ok((format!("{candidate}\n").into_bytes(), b"s: 1\n".to_vec()))),
            Box::new(|metadata, _structure| {
                let text = String::from_utf8(metadata.to_vec()).expect("UTF-8");
                Ok(text.trim().parse::<u64>().expect("整数"))
            }),
        )
        .expect("候选即字节和时必须在限额轮内收敛");
        assert_eq!(&metadata, b"9\n");
        assert_eq!(total, 9);
    }

    /// 定点迭代器（与 `finalize_package` 同式的测试镜像：≤3 轮、
    /// 判据为「候选值 == 本轮字节和 且 字节不再逐轮漂移」、不收敛以限额错误拒绝）。
    /// 定点发射臂：由候选值产出 `(metadata 候选字节, structure 候选字节)`。
    type EmitBox = Box<dyn FnMut(u64) -> Result<(Vec<u8>, Vec<u8>), DocumentError>>;
    /// 定点求和臂：由候选字节求本轮字节和。
    type SumBox = Box<dyn FnMut(&[u8], &[u8]) -> Result<u64, DocumentError>>;

    fn iterate_list_fixed_point(
        initial: u64,
        mut emit: EmitBox,
        mut sum: SumBox,
    ) -> Result<(Vec<u8>, Vec<u8>, u64), DocumentError> {
        let mut candidate = initial;
        let mut previous: Option<(Vec<u8>, Vec<u8>)> = None;
        for _ in 0..MAX_FIXED_POINT_ROUNDS {
            let (metadata, structure) = emit(candidate)?;
            let settled = previous.as_ref() == Some(&(metadata.clone(), structure.clone()));
            let total = sum(&metadata, &structure)?;
            if candidate == total && settled {
                return Ok((metadata, structure, total));
            }
            previous = Some((metadata, structure));
            candidate = total;
        }
        Err(DocumentError::LimitExceeded {
            limit: "file_info_fixed_point_rounds",
            actual: format!("{MAX_FIXED_POINT_ROUNDS} 轮内未收敛"),
            file: None,
        })
    }

    #[test]
    fn test_form_mismatch_and_missing_metadata() {
        // 公开入口形态面：目录态缺 `metadata.yaml` 以 `DOCUMENT_METADATA_MISSING` 拒绝。
        let root = std::env::temp_dir().join(format!(
            "chips-parser-t240-missing-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).expect("创建夹具根目录");
        std::fs::write(root.join("readme.txt"), b"x").expect("写入成员");
        let mut request = card_request(vec![]);
        request.local_path = root.clone();
        let error = serialize_document(&request, saved_at()).expect_err("缺少 metadata 必须拒绝");
        assert_eq!(error.code(), crate::error::DOCUMENT_METADATA_MISSING);
        std::fs::remove_dir_all(&root).expect("清理夹具");
    }

    #[test]
    fn test_serialize_form_text_mapping() {
        assert_eq!(
            SerializeForm::from_text("directory"),
            Some(SerializeForm::Directory)
        );
        assert_eq!(
            SerializeForm::from_text("archive"),
            Some(SerializeForm::Archive)
        );
        assert_eq!(SerializeForm::from_text("zip"), None);
        assert_eq!(SerializeForm::Archive.as_str(), "archive");
    }
}
