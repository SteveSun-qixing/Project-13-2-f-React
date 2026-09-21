//! 类型模型（《06-文档解析器设计》§11.1 公开类型、§11.3 模型、§3.7 统计与修订）。
//!
//! 模型一旦构建即冻结（外层以 `Arc` 共享），不再回写文档；所有类型的字段名
//! 与《核心接口规范》§6 及 `packages/sdk/src/types/document.ts` 逐字一致
//! （`snake_case`），保证 Neon 边界与 TS 侧消费形状统一。

use std::fmt;
use std::sync::Arc;

use serde::de::Error as _;
use serde::ser::{SerializeMap, SerializeSeq};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::error::Diagnostic;
use crate::source::PackagePath;
pub use crate::source::SourceFingerprint;
use crate::yaml::value::ValueScan;

#[path = "box.rs"]
mod box_model;
mod card;

pub use box_model::BoxMetadata;
pub use card::{AgeRating, CardMetadata, Visibility};

/// 文档格式类别（《核心接口规范》§6.1）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentKind {
    /// 卡片 `.card`。
    Card,
    /// 箱子 `.box`。
    Box,
}

impl DocumentKind {
    /// 配置目录名（`.card` / `.box`）。
    #[must_use]
    pub fn config_dir(self) -> &'static str {
        match self {
            Self::Card => ".card",
            Self::Box => ".box",
        }
    }

    /// 元数据成员路径（§5.1 的 L0 输入）。
    #[must_use]
    pub fn metadata_file(self) -> &'static str {
        match self {
            Self::Card => ".card/metadata.yaml",
            Self::Box => ".box/metadata.yaml",
        }
    }

    /// 结构成员路径（§5.1 的 L1 输入）。
    #[must_use]
    pub fn structure_file(self) -> &'static str {
        match self {
            Self::Card => ".card/structure.yaml",
            Self::Box => ".box/structure.yaml",
        }
    }

    /// 封面入口成员路径（必需成员，仅记录路径，不读取内容，§11.6）。
    #[must_use]
    pub fn cover_file(self) -> &'static str {
        match self {
            Self::Card => ".card/cover.html",
            Self::Box => ".box/cover.html",
        }
    }

    /// 正式扩展名（大小写不敏感比较由调用方处理）。
    #[must_use]
    pub fn extension(self) -> &'static str {
        match self {
            Self::Card => ".card",
            Self::Box => ".box",
        }
    }
}

/// 卡片内容配置目录（《卡片文件格式》§3.1）。
pub const CARD_CONTENT_DIR: &str = "content";

/// 箱子自有资源目录（《箱子文件格式》§2.2）。
pub const BOX_ASSETS_DIR: &str = "assets";

/// 箱子布局配置成员（《箱子文件格式》§6）。
pub const BOX_LAYOUT_CONFIG_FILE: &str = ".box/content.yaml";

/// 安全限额（《06-文档解析器设计》§9.1）。
///
/// 表中六项为文档口径的可配置默认值。§3.3 索引阶段还要求「成员数」与
/// 「单成员解压尺寸」两类限额，但 §9.1 未给出对应字段名；本实现按语义
/// 由已声明字段推导（见 [`ParseLimits::max_uncompressed_members_guard`] 与
/// [`ParseLimits::max_single_member_bytes`]），不引入第二套硬编码上限。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ParseLimits {
    /// 单 YAML 文件字节上限（默认 8 MiB）。
    pub max_yaml_bytes: u64,
    /// 箱子条目上限（默认 10 000）。
    pub max_entry_count: u64,
    /// 归档解压总字节上限（默认 512 MiB）。
    pub max_uncompressed_bytes: u64,
    /// 压缩比上限（默认 200）。
    pub max_compression_ratio: u64,
    /// 别名展开上限（默认 1 000）。
    pub max_aliases: u64,
    /// 嵌套深度上限（默认 32）。
    pub max_depth: u64,
}

impl Default for ParseLimits {
    fn default() -> Self {
        Self {
            max_yaml_bytes: 8 * 1024 * 1024,
            max_entry_count: 10_000,
            max_uncompressed_bytes: 512 * 1024 * 1024,
            max_compression_ratio: 200,
            max_aliases: 1_000,
            max_depth: 32,
        }
    }
}

impl ParseLimits {
    /// 单成员解压尺寸上限：任何成员都不允许超出解压总量预算。
    #[must_use]
    pub(crate) fn max_single_member_bytes(&self) -> u64 {
        self.max_uncompressed_bytes
    }

    /// 成员数防护上限：以「解压总预算 / 每成员最小可寻址开销」为界，抵御
    /// 畸形 EOCD 声明的天量条目数（§3.3 索引限额检查）。
    #[must_use]
    pub(crate) fn max_uncompressed_members_guard(&self) -> u64 {
        // 每个成员至少占用本地文件头 30 字节与中央目录条目 46 字节。
        self.max_uncompressed_bytes / 76
    }

    /// 单文件展开节点预算：别名展开后的节点总数上限。
    ///
    /// 每个节点至少占用一个源字符，取 `max_yaml_bytes / 8` 为界（8 字节覆盖
    /// `key: v,` 量级的最小开销），使别名炸弹在字节限额内同步受控。
    #[must_use]
    pub(crate) fn node_budget(&self) -> u64 {
        self.max_yaml_bytes / 8
    }
}

/// 解析选项（《核心接口规范》§6.1）；句柄创建后不可变。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParseOptions {
    /// 严格模式：警告升级为错误，并启用完整性哈希校验与未引用文件检查。
    pub strict: bool,
    /// 自动归一化（BOM、Unicode、默认值）并记录诊断。
    pub repair: bool,
    /// 校验 Store 成员 CRC32 与资源哈希。
    pub verify_hashes: bool,
    /// L2 单元并行度，默认 4。
    pub parallelism: usize,
    /// 安全限额。
    pub limits: ParseLimits,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            strict: false,
            repair: true,
            verify_hashes: false,
            parallelism: 4,
            limits: ParseLimits::default(),
        }
    }
}

/// 内容节点标识：10 位 Base62 编号（《卡片文件格式》§5.3、《ID生成规范》）。
///
/// 解析器不发明标识（§5.2），故构造时即完成校验。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize)]
#[serde(transparent)]
pub struct NodeId(String);

impl NodeId {
    /// 由 10 位 Base62 文本构造；不合法返回 `None`，调用方按结构诊断处理。
    #[must_use]
    pub fn new(text: &str) -> Option<Self> {
        let valid = text.len() == 10
            && text
                .bytes()
                .all(|byte| byte.is_ascii_digit() || byte.is_ascii_alphabetic());
        if valid {
            Some(Self(text.to_owned()))
        } else {
            None
        }
    }

    /// 文本形态。
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 对应内容文件路径 `content/<id>.yaml`（《卡片文件格式》§5.3）。
    #[must_use]
    pub fn content_file(&self) -> PackagePath {
        // 标识仅含 ASCII 字母数字，拼接结果必然通过 `PackagePath` 校验，
        // 因此复用已校验构造入口（§11.6 路径校验在构造时完成）。
        PackagePath::from_validated(format!("{CARD_CONTENT_DIR}/{self}.yaml"))
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for NodeId {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let text = String::deserialize(deserializer)?;
        Self::new(&text).ok_or_else(|| D::Error::custom("标识必须为 10 位 Base62"))
    }
}

/// 标签：简单标签为字符串；结构化标签为字符串数组（首项为键，其余为值）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Tag {
    /// 简单标签。
    Simple(String),
    /// 结构化标签。
    Structured(Vec<String>),
}

impl Tag {
    /// 标签键：结构化标签取首项，简单标签取自身。
    #[must_use]
    pub fn key(&self) -> &str {
        match self {
            Self::Simple(text) => text,
            Self::Structured(items) => items.first().map(String::as_str).unwrap_or_default(),
        }
    }

    /// 取值列表：简单标签为空。
    #[must_use]
    pub fn values(&self) -> &[String] {
        match self {
            Self::Simple(_) => &[],
            // 首项为键，其余为值（不足两项时退化为无值，不 panic）。
            Self::Structured(items) => {
                let (_, tail) = items.split_first().unwrap_or((&String::new(), &[]));
                tail
            }
        }
    }
}

/// `metadata.file_info`：由写入链路生成（《卡片文件格式》§4.1）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FileInfo {
    /// 总字节数。
    pub total_size: u64,
    /// 文件总数。
    pub file_count: u64,
    /// SHA256 校验值。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub checksum: Option<String>,
    /// 生成时间（RFC 3339 UTC）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub generated_at: Option<String>,
}

/// 元数据解析结果（L0），以 `kind` 为判别字段（《核心接口规范》§6.4）。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum DocumentMetadata {
    /// 卡片元数据。
    Card(CardMetadata),
    /// 箱子元数据。
    Box(BoxMetadata),
}

impl DocumentMetadata {
    /// 格式类别。
    #[must_use]
    pub fn kind(&self) -> DocumentKind {
        match self {
            Self::Card(_) => DocumentKind::Card,
            Self::Box(_) => DocumentKind::Box,
        }
    }

    /// 文档声明的 `chip_standards_version`。
    #[must_use]
    pub fn chip_standards_version(&self) -> &str {
        match self {
            Self::Card(metadata) => &metadata.chip_standards_version,
            Self::Box(metadata) => &metadata.chip_standards_version,
        }
    }

    /// 文档标识（`card_id` / `box_id`）。
    #[must_use]
    pub fn document_id(&self) -> &str {
        match self {
            Self::Card(metadata) => &metadata.card_id,
            Self::Box(metadata) => &metadata.box_id,
        }
    }

    /// 展示名称。
    #[must_use]
    pub fn name(&self) -> &str {
        match self {
            Self::Card(metadata) => &metadata.name,
            Self::Box(metadata) => &metadata.name,
        }
    }

    /// 封面比例（卡片 `cover_ratio`；箱子同名字段）。
    #[must_use]
    pub fn cover_ratio(&self) -> Option<&str> {
        match self {
            Self::Card(metadata) => metadata.cover_ratio.as_deref(),
            Self::Box(metadata) => metadata.cover_ratio.as_deref(),
        }
    }

    /// 标签集合（箱子 `tags` 为可选字段，缺省视为空）。
    #[must_use]
    pub fn tags(&self) -> &[Tag] {
        match self {
            Self::Card(metadata) => &metadata.tags,
            Self::Box(metadata) => metadata.tags.as_deref().unwrap_or(&[]),
        }
    }
}

/// 卡片结构条目（`.card/structure.yaml` 的 `structure[]`）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StructureEntry {
    /// 基础卡片 ID（`structure[].id`）。
    #[serde(rename = "id")]
    pub node_id: NodeId,
    /// 基础卡片类型（`structure[].type`）。
    #[serde(rename = "type")]
    pub card_type: String,
    /// 对应内容文件路径；引用缺失时保留位置（§8.4 部分成功矩阵）。
    pub file: PackagePath,
    /// 引用的内容文件是否存在于索引。
    pub present: bool,
}

/// 资源清单条目（`manifest.resources[]`，《卡片文件格式》§5.1）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ManifestResource {
    /// 相对卡片根目录的资源路径。
    pub path: PackagePath,
    /// 字节数。
    pub size: u64,
    /// MIME 类型（`manifest.resources[].type`）。
    #[serde(rename = "type")]
    pub mime_type: String,
    /// 时长（秒），仅视频 / 音频。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub duration: Option<f64>,
    /// 宽度（像素），仅图片 / 视频。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub width: Option<u64>,
    /// 高度（像素），仅图片 / 视频。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub height: Option<u64>,
    /// 语言代码，仅字幕。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub language: Option<String>,
    /// SHA256 校验值。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub checksum: Option<String>,
}

/// 卡片资源清单（`manifest`）。
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct StructureManifest {
    /// 基础卡片数量。
    pub card_count: u64,
    /// 资源文件数量。
    pub resource_count: u64,
    /// 资源清单条目。
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub resources: Vec<ManifestResource>,
}

/// 结构模型（L1，§3.5）。
///
/// 卡片承载「结构节点 + 资源清单」，箱子承载「条目索引」；两侧由 `kind`
/// 判别，与《核心接口规范》§6.4 的 `{ kind, value }` 结果形状一致。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", content = "value", rename_all = "lowercase")]
pub enum StructureModel {
    /// 卡片结构。
    Card {
        /// 结构节点（按渲染顺序）。
        structure: Vec<StructureEntry>,
        /// 资源清单。
        manifest: StructureManifest,
    },
    /// 箱子结构。
    Box {
        /// 条目索引（顺序即 `entries` 数组顺序）。
        entries: Vec<Entry>,
        /// 结构层诊断（条目/引用失败位置保留）。
        diagnostics: Vec<Diagnostic>,
    },
}

impl StructureModel {
    /// 结构所属格式。
    #[must_use]
    pub fn kind(&self) -> DocumentKind {
        match self {
            Self::Card { .. } => DocumentKind::Card,
            Self::Box { .. } => DocumentKind::Box,
        }
    }

    /// 卡片结构节点数量。
    #[must_use]
    pub fn node_count(&self) -> usize {
        match self {
            Self::Card { structure, .. } => structure.len(),
            Self::Box { .. } => 0,
        }
    }

    /// 箱子条目数量。
    #[must_use]
    pub fn entry_count(&self) -> usize {
        match self {
            Self::Card { .. } => 0,
            Self::Box { entries, .. } => entries.len(),
        }
    }

    /// 资源清单条目（卡片侧，箱子返回空切片）。
    #[must_use]
    pub fn resources(&self) -> &[ManifestResource] {
        match self {
            Self::Card { manifest, .. } => &manifest.resources,
            Self::Box { .. } => &[],
        }
    }
}

/// 单个内容节点的解析结果（L2，《核心接口规范》§11.3）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ContentNode {
    /// 节点标识。
    pub node_id: NodeId,
    /// 内容文件路径。
    pub file: PackagePath,
    /// 类型标识（`card_type`）。
    pub card_type: String,
    /// 完整值树（插件专有字段原样保留）。
    pub value: DocumentValue,
    /// 该节点诊断；解析失败时为占位模型 + 错误级诊断（§8.4）。
    pub diagnostics: Vec<Diagnostic>,
}

impl ContentNode {
    /// 粗略内存占用（缓存配额核算用）。
    #[must_use]
    pub fn memory_hint(&self) -> usize {
        self.value.estimated_bytes() + self.diagnostics.len() * std::mem::size_of::<Diagnostic>()
    }
}

/// 全量内容索引（`CardParser::parse` 的输出，§11.2）。
#[derive(Debug, Clone, PartialEq)]
pub struct ContentIndex {
    nodes: Vec<(NodeId, Arc<ContentNode>)>,
}

impl ContentIndex {
    /// 由节点列表构建（保持结构顺序）。
    #[must_use]
    pub fn new(nodes: Vec<(NodeId, Arc<ContentNode>)>) -> Self {
        Self { nodes }
    }

    /// 按标识取节点。
    #[must_use]
    pub fn get(&self, node_id: &NodeId) -> Option<&Arc<ContentNode>> {
        self.nodes
            .iter()
            .find(|(id, _)| id == node_id)
            .map(|(_, node)| node)
    }

    /// 迭代（保持结构顺序）。
    pub fn iter(&self) -> std::slice::Iter<'_, (NodeId, Arc<ContentNode>)> {
        self.nodes.iter()
    }

    /// 节点数量。
    #[must_use]
    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    /// 是否无节点。
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// 底层节点列表（保持结构顺序）。
    #[must_use]
    pub fn as_slice(&self) -> &[(NodeId, Arc<ContentNode>)] {
        &self.nodes
    }
}

/// 内容索引序列化：按结构顺序输出节点数组（顺序即渲染顺序，见 §3.5）。
impl Serialize for ContentIndex {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut sequence = serializer.serialize_seq(Some(self.nodes.len()))?;
        for (_, node) in &self.nodes {
            sequence.serialize_element(node.as_ref())?;
        }
        sequence.end()
    }
}

/// 箱子条目（`.box/structure.yaml` 的 `entries` 元素）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Entry {
    /// 条目 ID。
    pub entry_id: String,
    /// 统一 URL 引用（《箱子文件格式》§3）。
    pub url: String,
    /// 是否参与布局展示。
    pub enabled: bool,
    /// 摘要快照。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub snapshot: Option<DocumentValue>,
    /// 布局索引。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub layout_hints: Option<DocumentValue>,
}

/// 解析统计（§3.7 阶段 6）。
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct DocumentStatistics {
    /// 索引成员数。
    pub member_count: u64,
    /// 已解析 YAML 字节数。
    pub yaml_bytes: u64,
    /// 资源数（清单条目数）。
    pub resource_count: u64,
    /// 条目数（箱子）。
    pub entry_count: u64,
    /// 解压总字节数。
    pub uncompressed_bytes: u64,
}

/// 文档修订：数据源指纹 + `chip_standards_version` + 索引摘要（§3.7）。
///
/// 构建为常数时间，不读取资源正文。本类型是修订身份的**无序指纹**载体，
/// 承担缓存失效、增量重解析与外部修改复查（§5.4、《11-文档服务设计》§7.2）；
/// 不作视图数值修订的取值源——视图投影修订号是解析句柄会话内的单调序列源
/// （[`crate::DocumentHandle::next_view_revision`]，《05-渲染引擎设计》§2.4
/// 第 5 条严格递增语义，工单037 裁定：指纹摘要族取值无序，任何由指纹派生的
/// 数值形态都不满足递增，禁止回退为指纹投影）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DocumentRevision {
    /// 数据源指纹。
    pub source: SourceFingerprint,
    /// 文档声明的标准版本。
    pub chip_standards_version: String,
    /// 索引摘要（SHA-256 十六进制小写）。
    pub index_digest: String,
}

impl DocumentRevision {
    /// 由指纹与版本构建修订。
    #[must_use]
    pub fn new(source: SourceFingerprint, chip_standards_version: impl Into<String>) -> Self {
        let index_digest = index_digest_of(&source);
        Self {
            source,
            chip_standards_version: chip_standards_version.into(),
            index_digest,
        }
    }
}

/// 索引摘要：对「路径 + 尺寸 + 修改时间 + CRC」有序序列做 SHA-256。
fn index_digest_of(source: &SourceFingerprint) -> String {
    let mut buffer = String::new();
    for (path, fingerprint) in &source.members {
        use fmt::Write as _;
        // `write!` 对 `String` 永不失败（无 IO）。
        let _ = write!(
            buffer,
            "{path}|{}|{}|{}\u{1}",
            fingerprint.size,
            fingerprint.modified_millis.unwrap_or(0),
            fingerprint.crc32.unwrap_or(0)
        );
    }
    crate::digest::sha256(buffer.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// 校验状态（《06-文档解析器设计》§6.5）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValidationStatus {
    /// 无任何诊断。
    Valid,
    /// 存在警告级诊断（允许发布，必须展示）。
    ValidWithWarnings,
    /// 存在错误级诊断（拒绝发布）。
    Invalid,
}

/// 严格校验报告（§6.5）；同一输入必产生字节级一致的报告。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ValidationReport {
    /// 文档格式。
    pub kind: DocumentKind,
    /// 文档声明的标准版本。
    pub chip_standards_version: String,
    /// 聚合状态。
    pub status: ValidationStatus,
    /// 统计。
    pub statistics: DocumentStatistics,
    /// 排序去重后的全量诊断。
    pub diagnostics: Vec<Diagnostic>,
}

/// 顺序保持、无标签、JSON 兼容的不透明值（§11.3）。
///
/// 解析器对插件专有字段的唯一表示：顺序稳定、无标签，重复键在 YAML 层即
/// 判为 `YAML_SYNTAX_ERROR`，可直接映射为 TS 对象与 `serde_json::Value`。
#[derive(Debug, Clone, PartialEq)]
pub enum DocumentValue {
    /// 空值。
    Null,
    /// 布尔。
    Bool(bool),
    /// 整数。
    Integer(i64),
    /// 浮点。
    Float(f64),
    /// 字符串。
    String(String),
    /// 序列。
    Sequence(Vec<DocumentValue>),
    /// 映射（保持文档顺序）。
    Mapping(Vec<(String, DocumentValue)>),
}

impl DocumentValue {
    /// 空值构造。
    #[must_use]
    pub fn null() -> Self {
        Self::Null
    }

    /// 按字符串读取。
    #[must_use]
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(text) => Some(text),
            _ => None,
        }
    }

    /// 按布尔读取。
    #[must_use]
    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Bool(value) => Some(*value),
            _ => None,
        }
    }

    /// 按整数读取。
    #[must_use]
    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Self::Integer(value) => Some(*value),
            _ => None,
        }
    }

    /// 按数值读取（整数与浮点统一为 `f64`）。
    #[must_use]
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Self::Integer(value) => Some(*value as f64),
            Self::Float(value) => Some(*value),
            _ => None,
        }
    }

    /// 按键名读取。
    #[must_use]
    pub fn get(&self, key: &str) -> Option<&DocumentValue> {
        match self {
            Self::Mapping(entries) => entries
                .iter()
                .find(|(name, _)| name == key)
                .map(|(_, value)| value),
            _ => None,
        }
    }

    /// 序列视图。
    #[must_use]
    pub fn as_sequence(&self) -> Option<&[DocumentValue]> {
        match self {
            Self::Sequence(items) => Some(items),
            _ => None,
        }
    }

    /// 映射视图（保持顺序）。
    #[must_use]
    pub fn as_mapping(&self) -> Option<&[(String, DocumentValue)]> {
        match self {
            Self::Mapping(entries) => Some(entries),
            _ => None,
        }
    }

    /// 是否为空值。
    #[must_use]
    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }

    /// RFC 6901 指针取值（如 `/structure/0/id`）。
    #[must_use]
    pub fn pointer(&self, pointer: &str) -> Option<&DocumentValue> {
        let mut current = self;
        for token in pointer
            .split('/')
            .skip(if pointer.starts_with('/') { 1 } else { 0 })
        {
            let key = token.replace("~1", "/").replace("~0", "~");
            current = match current {
                Self::Mapping(_) => current.get(&key)?,
                Self::Sequence(items) => {
                    let index = key.parse::<usize>().ok()?;
                    items.get(index)?
                }
                _ => return None,
            };
        }
        Some(current)
    }

    /// 最大嵌套深度（空容器记为 1，标量记为 1）。
    #[must_use]
    pub fn depth(&self) -> u64 {
        match self {
            Self::Sequence(items) => 1 + items.iter().map(Self::depth).max().unwrap_or(0),
            Self::Mapping(entries) => 1 + entries.iter().map(|(_, v)| v.depth()).max().unwrap_or(0),
            _ => 1,
        }
    }

    /// 节点总数。
    #[must_use]
    pub fn node_count(&self) -> u64 {
        match self {
            Self::Sequence(items) => 1 + items.iter().map(Self::node_count).sum::<u64>(),
            Self::Mapping(entries) => {
                1 + entries
                    .iter()
                    .map(|(_, value)| value.node_count())
                    .sum::<u64>()
            }
            _ => 1,
        }
    }

    /// 粗略内存占用（缓存配额核算）。
    #[must_use]
    pub fn estimated_bytes(&self) -> usize {
        match self {
            Self::String(text) => text.len() + 32,
            Self::Sequence(items) => items.iter().map(Self::estimated_bytes).sum::<usize>() + 32,
            Self::Mapping(entries) => {
                entries
                    .iter()
                    .map(|(key, value)| key.len() + value.estimated_bytes() + 48)
                    .sum::<usize>()
                    + 32
            }
            _ => 24,
        }
    }

    /// 转为 `serde_json::Value`（用于 schema 校验与 JSON 互操作）。
    #[must_use]
    pub fn to_json(&self) -> serde_json::Value {
        match self {
            Self::Null => serde_json::Value::Null,
            Self::Bool(value) => serde_json::Value::Bool(*value),
            Self::Integer(value) => serde_json::Value::from(*value),
            Self::Float(value) => serde_json::Number::from_f64(*value)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null),
            Self::String(text) => serde_json::Value::String(text.clone()),
            Self::Sequence(items) => {
                serde_json::Value::Array(items.iter().map(Self::to_json).collect())
            }
            Self::Mapping(entries) => {
                let mut object = serde_json::Map::new();
                for (key, value) in entries {
                    object.insert(key.clone(), value.to_json());
                }
                serde_json::Value::Object(object)
            }
        }
    }

    /// 由 `serde_json::Value` 构建（整数保持整数语义）。
    #[must_use]
    pub fn from_json(value: &serde_json::Value) -> Self {
        match value {
            serde_json::Value::Null => Self::Null,
            serde_json::Value::Bool(flag) => Self::Bool(*flag),
            serde_json::Value::Number(number) => {
                if let Some(integer) = number.as_i64() {
                    return Self::Integer(integer);
                }
                number.as_f64().map_or(Self::Null, Self::Float)
            }
            serde_json::Value::String(text) => Self::String(text.clone()),
            serde_json::Value::Array(items) => {
                Self::Sequence(items.iter().map(Self::from_json).collect())
            }
            serde_json::Value::Object(object) => Self::Mapping(
                object
                    .iter()
                    .map(|(key, value)| (key.clone(), Self::from_json(value)))
                    .collect(),
            ),
        }
    }

    /// JSON Schema 校验用的类型名（`type` 关键字口径）。
    #[must_use]
    pub fn type_name(&self) -> &'static str {
        match self {
            Self::Null => "null",
            Self::Bool(_) => "boolean",
            Self::Integer(_) => "integer",
            Self::Float(_) => "number",
            Self::String(_) => "string",
            Self::Sequence(_) => "array",
            Self::Mapping(_) => "object",
        }
    }

    /// 映射键列表（保持顺序）。
    #[must_use]
    pub fn keys(&self) -> Option<impl Iterator<Item = &str>> {
        match self {
            Self::Mapping(entries) => Some(entries.iter().map(|(key, _)| key.as_str())),
            _ => None,
        }
    }
}

impl Serialize for DocumentValue {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Null => serializer.serialize_unit(),
            Self::Bool(value) => serializer.serialize_bool(*value),
            Self::Integer(value) => serializer.serialize_i64(*value),
            Self::Float(value) => serializer.serialize_f64(*value),
            Self::String(text) => serializer.serialize_str(text),
            Self::Sequence(items) => {
                let mut sequence = serializer.serialize_seq(Some(items.len()))?;
                for item in items {
                    sequence.serialize_element(item)?;
                }
                sequence.end()
            }
            Self::Mapping(entries) => {
                let mut mapping = serializer.serialize_map(Some(entries.len()))?;
                for (key, value) in entries {
                    mapping.serialize_entry(key, value)?;
                }
                mapping.end()
            }
        }
    }
}

impl<'de> Deserialize<'de> for DocumentValue {
    /// 以文档默认限额反序列化（解析流水线使用配置限额，见 `yaml` 模块）。
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let mut scan = ValueScan::new(ScanLimits::default());
        crate::yaml::value::from_deserializer(deserializer, &mut scan)
    }
}

/// 反序列化防护参数（深度与展开节点预算）。
#[derive(Debug, Clone, Copy)]
pub struct ScanLimits {
    /// 最大嵌套深度。
    pub max_depth: u64,
    /// 展开节点总数预算。
    pub node_budget: u64,
}

impl Default for ScanLimits {
    fn default() -> Self {
        let limits = ParseLimits::default();
        Self {
            max_depth: limits.max_depth,
            node_budget: limits.node_budget(),
        }
    }
}
