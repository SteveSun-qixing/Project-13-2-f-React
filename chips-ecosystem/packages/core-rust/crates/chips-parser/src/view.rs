//! 文档视图构建器（《核心接口规范》§6.6、《05-渲染引擎设计》§2.5/§2.6）。
//!
//! 把解析句柄 + 渲染会话投影为可结构化克隆的 [`DocumentView`]，供帧初始化、
//! `host:update`、条目票证与编辑链路就近渲染共同使用。本模块只做字段投影与
//! 不透明值保留（《渲染引擎设计》§2.6 构建规则）：
//!
//! - 不解释插件专有语义：内容节点与布局 `props` 以 [`DocumentValue`] 原样
//!   保留（不透明值顺序稳定，《基础卡片插件接口》§3 约束 4）；
//! - 不读取资源字节、不拼接资源 URI：视图内资源引用保持文件原样
//!   （§6.6 规则 3、规则 4），引用归一由解析器在视图构建之前完成；
//! - 无自有缓存：字段投影对同一层级产物输出确定（§6.6 规则 5）；视图
//!   修订号取自 [`crate::DocumentHandle::next_view_revision`]——句柄会话内
//!   单调序列源（首开 0、每次构建 +1，工单037 裁定，满足《05-渲染引擎
//!   设计》§2.4 第 5 条严格递增与 `<2^53` 线格式契约）；
//! - 惰性层级在视图上的可见性（《06-文档解析器设计》§5.1）：构建视图按需
//!   触达其依赖层级——卡片视图触达 L1 结构并为每个结构节点解析 L2 内容，
//!   箱子视图触达 L2 条目集合与 `.box/content.yaml` 布局配置单元；L3 资源
//!   字节永不被触达。层级不可逆、已解析层级缓存于句柄，视图字段本身与
//!   层级到达顺序无关（同一句柄同一修订下恒等）。
//!
//! 类型命名以《核心接口规范》§6.6 为准：`DocumentView = CardRenderView |
//! BoxRenderView`；`BaseCardView` 由帧运行时按节点在 TS 侧组装（§2.5 约束
//! 2），不在 Rust 侧登记，因此本模块不导出该类型。

use serde::{Deserialize, Serialize};

use std::sync::Arc;

use chips_core::{ChipsError, SessionId};

use crate::error::DocumentError;
use crate::model::{
    BoxMetadata, CardMetadata, ContentNode, DocumentKind, DocumentMetadata, DocumentValue, Entry,
    StructureEntry, StructureModel, Tag,
};
use crate::parser::DocumentHandle;

/// 封面比例缺省值（《渲染引擎设计》§2.5 `CoverView.ratio` 口径：
/// `metadata.yaml → cover_ratio`，缺省 `3:4`）。
///
/// `repair` 开启时 schema 层已按默认值补齐模型（`SCHEMA_DEFAULT_APPLIED`），
/// 此缺省只兜底 `repair = false` 且源文件未声明的场景。
const DEFAULT_COVER_RATIO: &str = "3:4";

/// 标签视图（《核心接口规范》§6.6 `type TagView = string | string[]`）。
///
/// 简单标签投影为字符串；结构化标签投影为字符串数组（首项为键，其余为值），
/// 与 `metadata.yaml` 口径一致。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum TagView {
    /// 简单标签。
    Simple(String),
    /// 结构化标签（首项为键，其余为值）。
    Structured(Vec<String>),
}

impl From<&Tag> for TagView {
    fn from(tag: &Tag) -> Self {
        match tag {
            Tag::Simple(text) => Self::Simple(text.clone()),
            Tag::Structured(items) => Self::Structured(items.clone()),
        }
    }
}

/// 封面视图（《核心接口规范》§6.6 `CoverView`）。
///
/// `entry` 为正式封面入口的包内相对路径（卡片 `.card/cover.html`、
/// 箱子 `.box/cover.html`，《渲染引擎设计》§2.5）；只记录路径，
/// 不读取、不解析、不执行（《06-文档解析器设计》§11.6）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CoverView {
    /// 正式封面入口路径。
    pub entry: String,
    /// 封面比例（`metadata.yaml → cover_ratio`，缺省 `3:4`）。
    pub ratio: String,
}

/// 卡片内容节点视图（《核心接口规范》§6.6 `CardNodeView`）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CardNodeView {
    /// 节点 ID（`structure.yaml` 条目 `id`，对应 `content/{node_id}.yaml`）。
    pub node_id: String,
    /// 基础卡片类型（内容配置 `card_type`）。
    pub card_type: String,
    /// 节点内容：`content/{node_id}.yaml` 解析结果根映射，插件专有字段
    /// 以不透明值原样保留；内容单元不可用时投影为空映射。
    pub content: DocumentValue,
}

/// 卡片渲染视图（《核心接口规范》§6.6 `CardRenderView`）。
///
/// `kind` 判别字段由 [`DocumentView`] 的序列化标签投影（与 TS 联合类型
/// `{ kind: 'card', ... }` 形状一致）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct CardRenderView {
    /// 渲染会话修订号（解析句柄会话内单调序列源投影：首开 0、每次构建
    /// +1，与文档服务会话修订同序列；《05-渲染引擎设计》§2.4 第 5 条
    /// 严格递增，工单037 裁定）。
    pub revision: u64,
    /// 卡片 ID（`metadata.yaml → card_id`）。
    pub card_id: String,
    /// 展示名称（`metadata.yaml → name`）。
    pub name: String,
    /// 薯片标准版本号。
    pub chip_standards_version: String,
    /// 封面比例（缺省 `3:4`）。
    pub cover_ratio: String,
    /// 标签集合（`metadata.yaml → tags`，缺省视为空）。
    pub tags: Vec<TagView>,
    /// 封面视图（`.card/cover.html`）。
    pub cover: CoverView,
    /// 内容节点视图，按 `structure.yaml` 声明顺序。
    pub content_nodes: Vec<CardNodeView>,
}

/// 箱子条目视图（《核心接口规范》§6.6 `EntryView`）。
///
/// `url` 为唯一正式定位字段（R13），保持文件原样，不回填运行时映射。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct EntryView {
    /// 条目 ID（`structure.yaml → entry_id`）。
    pub entry_id: String,
    /// 统一 URL 引用（`structure.yaml → url`）。
    pub url: String,
    /// 是否参与布局展示（`structure.yaml → enabled`）。
    pub enabled: bool,
    /// 摘要快照（不透明值原样保留；缺省时不序列化）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub snapshot: Option<DocumentValue>,
    /// 布局索引（不透明值原样保留；缺省时不序列化）。
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub layout_hints: Option<DocumentValue>,
}

/// 箱子渲染视图（《核心接口规范》§6.6 `BoxRenderView`）。
///
/// `kind` 判别字段由 [`DocumentView`] 的序列化标签投影（与 TS 联合类型
/// `{ kind: 'box', ... }` 形状一致）。
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct BoxRenderView {
    /// 渲染会话修订号（与 [`CardRenderView::revision`] 同口径）。
    pub revision: u64,
    /// 箱子 ID（`metadata.yaml → box_id`）。
    pub box_id: String,
    /// 展示名称（`metadata.yaml → name`）。
    pub name: String,
    /// 薯片标准版本号。
    pub chip_standards_version: String,
    /// 生效布局类型（`metadata.yaml` 与 `content.yaml` 一致的声明值）。
    pub active_layout_type: String,
    /// 布局配置（`content.yaml → layout_configs[active_layout_type].props`；
    /// 配置项或 `props` 缺失时投影为空映射，按空配置渲染，
    /// 《箱子文件格式》§6.4 说明）。
    pub layout_config: DocumentValue,
    /// 封面视图（`.box/cover.html`）。
    pub cover: CoverView,
    /// 条目视图，按 `structure.yaml → entries` 声明顺序。
    pub entries: Vec<EntryView>,
}

/// 箱子受控封面视图（《核心接口规范》§6.6 `BoxCoverView`）。
///
/// 供条目目标为箱子时的受控封面渲染使用，不展开布局（§6.6 规则 5）；
/// 全部字段可由 L0 元数据投影，不触达 L1/L2。
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BoxCoverView {
    /// 格式判别（固定 `"box"`，与 TS `kind: 'box'` 一致）。
    pub kind: &'static str,
    /// 箱子 ID。
    pub box_id: String,
    /// 展示名称。
    pub name: String,
    /// 薯片标准版本号。
    pub chip_standards_version: String,
    /// 封面视图（`.box/cover.html`）。
    pub cover: CoverView,
}

impl From<&BoxRenderView> for BoxCoverView {
    /// 由已构建的箱子渲染视图收缩为受控封面视图（不展开布局字段）。
    fn from(view: &BoxRenderView) -> Self {
        Self {
            kind: "box",
            box_id: view.box_id.clone(),
            name: view.name.clone(),
            chip_standards_version: view.chip_standards_version.clone(),
            cover: view.cover.clone(),
        }
    }
}

/// 文档视图：卡片与箱子两种渲染形态（《核心接口规范》§6.6
/// `type DocumentView = CardRenderView | BoxRenderView`）。
///
/// `DocumentKind` 是唯一分支：判别字段 `kind` 取 `card` / `box`，
/// 与《渲染引擎设计》§2.5 消费形状一致。
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind")]
pub enum DocumentView {
    /// 卡片渲染视图。
    #[serde(rename = "card")]
    Card(CardRenderView),
    /// 箱子渲染视图。
    #[serde(rename = "box")]
    Box(BoxRenderView),
}

/// 构建文档视图（《核心接口规范》§6.6）；只做字段投影与不透明值保留，
/// 不读取资源字节、不拼接资源 URI。
///
/// 层级触达（《06-文档解析器设计》§5.1，层级不可逆、句柄内缓存）：
///
/// - 卡片：L0 元数据 → L1 结构 → 逐节点 L2 内容；
/// - 箱子：L0 元数据 → L2 条目集合与 `.box/content.yaml` 布局配置单元；
/// - 两侧均不触达 L3 资源字节。
///
/// `session` 为渲染会话标识（《11-文档服务设计》§3.2），只作为失败路径
/// `details` 的关联上下文参与错误归一；视图字段内容不依赖 `session`
/// （§6.6 规则 5），修订号按句柄会话单调序列逐次取号（工单037）。
///
/// 致命错误经 `From<DocumentError> for ChipsError` 归一并附加会话上下文；
/// 非致命诊断不阻断构建（§8.4 部分成功矩阵：占位模型进入投影，
/// 诊断保留在句柄快照内）。
///
/// 句柄取回的层级产物统一经 [`project_document_view`] 的类型化边界进入
/// 投影逻辑，该边界即本模块对 `parser` 模块的接口契约。
pub fn build_document_view(
    handle: &DocumentHandle,
    session: SessionId,
) -> Result<DocumentView, ChipsError> {
    project_document_view(
        handle,
        handle.metadata(),
        handle.next_view_revision(),
        session,
    )
}

/// 视图投影主体：句柄取回的层级产物经类型化边界进入本函数后逐字段投影。
///
/// 参数标注即本模块与 `parser` 模块的接口契约（《核心接口规范》§6.3
/// 句柄面 + `layout_config` 布局配置单元 + 修订号取号面
/// [`DocumentHandle::next_view_revision`]），与惰性层级表（§5.1）对应：
/// 卡片 L0 → L1 → 逐节点 L2，箱子 L0 → L2 条目与布局配置单元，
/// 两侧均不触达 L3。
fn project_document_view(
    handle: &DocumentHandle,
    metadata: Arc<DocumentMetadata>,
    revision_number: u64,
    session: SessionId,
) -> Result<DocumentView, ChipsError> {
    match metadata.as_ref() {
        DocumentMetadata::Card(card) => {
            let structure: Arc<StructureModel> = map_fatal(handle.structure(), session)?;
            let nodes = match structure.as_ref() {
                StructureModel::Card { structure, .. } => structure,
                // 同一句柄的元数据与结构必然同形态（DocumentKind 唯一分支）；
                // 矛盾即句柄内部不变量破坏，按结构非法致命归一。
                StructureModel::Box { .. } => {
                    return Err(kinds_conflict(session));
                }
            };
            let mut content_nodes = Vec::with_capacity(nodes.len());
            for entry in nodes {
                let content: Arc<ContentNode> = map_fatal(handle.content(&entry.node_id), session)?;
                content_nodes.push(project_card_node_view(entry, Some(content.as_ref())));
            }
            Ok(DocumentView::Card(project_card_render_view(
                card,
                content_nodes,
                revision_number,
            )))
        }
        DocumentMetadata::Box(box_metadata) => {
            let entries: Arc<[Entry]> = map_fatal(handle.entries(None), session)?;
            let layout_root: Arc<DocumentValue> = map_fatal(handle.layout_config(), session)?;
            Ok(DocumentView::Box(project_box_render_view(
                box_metadata,
                &entries,
                Some(layout_root.as_ref()),
                revision_number,
            )))
        }
    }
}

/// 投影卡片渲染视图（L0 字段 + 已投影的内容节点 + 修订号）。
fn project_card_render_view(
    metadata: &CardMetadata,
    content_nodes: Vec<CardNodeView>,
    revision: u64,
) -> CardRenderView {
    let cover_ratio = normalized_cover_ratio(metadata.cover_ratio.as_deref());
    CardRenderView {
        revision,
        card_id: metadata.card_id.clone(),
        name: metadata.name.clone(),
        chip_standards_version: metadata.chip_standards_version.clone(),
        cover_ratio: cover_ratio.clone(),
        tags: project_tags(&metadata.tags),
        cover: project_cover(DocumentKind::Card, &cover_ratio),
        content_nodes,
    }
}

/// 投影箱子渲染视图（L0 字段 + L2 条目 + `.box/content.yaml` 根值 + 修订号）。
///
/// `layout_root` 为布局配置单元根映射（`active_layout_type` 与
/// `layout_configs`）；`None` 表示 L2 单元不可用，`layout_config`
/// 按空映射缺省投影。
fn project_box_render_view(
    metadata: &BoxMetadata,
    entries: &[Entry],
    layout_root: Option<&DocumentValue>,
    revision: u64,
) -> BoxRenderView {
    let cover_ratio = normalized_cover_ratio(metadata.cover_ratio.as_deref());
    BoxRenderView {
        revision,
        box_id: metadata.box_id.clone(),
        name: metadata.name.clone(),
        chip_standards_version: metadata.chip_standards_version.clone(),
        active_layout_type: metadata.active_layout_type.clone(),
        layout_config: project_layout_props(layout_root, &metadata.active_layout_type),
        cover: project_cover(DocumentKind::Box, &cover_ratio),
        entries: entries.iter().map(project_entry_view).collect(),
    }
}

/// 投影单个内容节点视图。
///
/// `content` 为 `None` 表示内容单元不可得（L1 可见性场景），此时
/// `content` 投影为空映射、`card_type` 回退结构声明值；§8.4 部分成功
/// 路径下句柄返回的是占位模型（`Some`），同样经本函数投影。
fn project_card_node_view(entry: &StructureEntry, content: Option<&ContentNode>) -> CardNodeView {
    CardNodeView {
        node_id: entry.node_id.to_string(),
        card_type: content.map_or_else(|| entry.card_type.clone(), |node| node.card_type.clone()),
        content: content.map_or_else(
            || DocumentValue::Mapping(Vec::new()),
            |node| object_projection(&node.value),
        ),
    }
}

/// 投影单个箱子条目视图（快照与布局索引不透明保留、缺省不序列化）。
fn project_entry_view(entry: &Entry) -> EntryView {
    EntryView {
        entry_id: entry.entry_id.clone(),
        url: entry.url.clone(),
        enabled: entry.enabled,
        snapshot: entry.snapshot.clone(),
        layout_hints: entry.layout_hints.clone(),
    }
}

/// 投影标签集合（简单标签 / 结构化标签与 `metadata.yaml` 口径一致）。
fn project_tags(tags: &[Tag]) -> Vec<TagView> {
    tags.iter().map(TagView::from).collect()
}

/// 投影封面视图：入口取正式封面成员路径，比例沿用已归一取值。
fn project_cover(kind: DocumentKind, ratio: &str) -> CoverView {
    CoverView {
        entry: kind.cover_file().to_owned(),
        ratio: ratio.to_owned(),
    }
}

/// 归一封面比例：缺失时按缺省 `3:4`（《渲染引擎设计》§2.5）。
fn normalized_cover_ratio(cover_ratio: Option<&str>) -> String {
    cover_ratio.unwrap_or(DEFAULT_COVER_RATIO).to_owned()
}

/// 投影生效布局配置：`layout_configs[active_layout_type].props`。
///
/// 配置项不存在、`props` 缺失或类型非映射时投影为空映射
/// （《箱子文件格式》§6.4 说明：按空配置与插件内部默认值渲染）。
fn project_layout_props(layout_root: Option<&DocumentValue>, active: &str) -> DocumentValue {
    let props = layout_root
        .and_then(|root| root.get("layout_configs"))
        .and_then(|configs| configs.get(active))
        .and_then(|config| config.get("props"));
    match props {
        Some(value @ DocumentValue::Mapping(_)) => value.clone(),
        _ => DocumentValue::Mapping(Vec::new()),
    }
}

/// 不透明值的对象形状投影：根映射原样保留（顺序稳定），
/// 非映射取值收敛为空映射（《基础卡片插件接口》§3 约束 4：
/// 解析器只保证内容根映射可用）。
fn object_projection(value: &DocumentValue) -> DocumentValue {
    match value {
        DocumentValue::Mapping(_) => value.clone(),
        _ => DocumentValue::Mapping(Vec::new()),
    }
}

/// 句柄形态矛盾的内部不变量破坏：归一为结构非法致命错误（复用 §8.2
/// 码表 `DOCUMENT_STRUCTURE_INVALID`，不发明新码）。
fn kinds_conflict(session: SessionId) -> ChipsError {
    with_session(
        DocumentError::StructureInvalid {
            message: "结构模型与元数据形态不一致".to_owned(),
            diagnostics: Vec::new(),
        }
        .to_chips_error(),
        session,
    )
}

/// 致命错误归一：`DocumentError` → `ChipsError` 并附加会话上下文。
fn map_fatal<T>(result: Result<T, DocumentError>, session: SessionId) -> Result<T, ChipsError> {
    result.map_err(|error| with_session(error.to_chips_error(), session))
}

/// 在错误 `details` 中并入渲染会话标识（跨边界排障的关联上下文）。
fn with_session(error: ChipsError, session: SessionId) -> ChipsError {
    let mut details = error
        .details()
        .and_then(serde_json::Value::as_object)
        .cloned()
        .unwrap_or_default();
    details.insert("session".to_owned(), serde_json::Value::from(session));
    error.with_details(serde_json::Value::Object(details))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::NodeId;
    use crate::source::PackagePath;

    fn path(text: &str) -> PackagePath {
        PackagePath::new(text).expect("测试路径必须合法")
    }

    fn node_id(text: &str) -> NodeId {
        NodeId::new(text).expect("测试标识必须为 10 位 Base62")
    }

    fn card_metadata(cover_ratio: Option<&str>, tags: Vec<Tag>) -> CardMetadata {
        CardMetadata {
            chip_standards_version: "1.0.0".to_owned(),
            card_id: "a1B2c3D4e5".to_owned(),
            name: "视图投影卡片".to_owned(),
            created_at: "2026-01-15T08:00:00.000Z".to_owned(),
            modified_at: "2026-01-15T08:00:00.000Z".to_owned(),
            cover_ratio: cover_ratio.map(str::to_owned),
            tags,
            theme: None,
            visibility: None,
            downloadable: None,
            remixable: None,
            commentable: None,
            license: None,
            age_rating: None,
            content_warning: None,
            file_info: None,
        }
    }

    fn box_metadata(cover_ratio: Option<&str>) -> BoxMetadata {
        BoxMetadata {
            chip_standards_version: "1.0.0".to_owned(),
            box_id: "f6G7h8I9j0".to_owned(),
            name: "视图投影箱子".to_owned(),
            created_at: "2026-01-15T08:00:00.000Z".to_owned(),
            modified_at: "2026-01-15T08:00:00.000Z".to_owned(),
            active_layout_type: "chips.layout.grid".to_owned(),
            description: None,
            tags: None,
            cover_ratio: cover_ratio.map(str::to_owned),
            cover_asset: None,
            owner: None,
            source: None,
        }
    }

    fn structure_entry(id: &str, card_type: &str) -> StructureEntry {
        StructureEntry {
            node_id: node_id(id),
            card_type: card_type.to_owned(),
            file: path(&format!("content/{id}.yaml")),
            present: true,
        }
    }

    fn content_node(id: &str, card_type: &str, value: DocumentValue) -> ContentNode {
        ContentNode {
            node_id: node_id(id),
            file: path(&format!("content/{id}.yaml")),
            card_type: card_type.to_owned(),
            value,
            diagnostics: Vec::new(),
        }
    }

    fn entry(entry_id: &str, snapshot: Option<DocumentValue>) -> Entry {
        Entry {
            entry_id: entry_id.to_owned(),
            url: format!("chips://doc/{entry_id}"),
            enabled: true,
            snapshot,
            layout_hints: None,
        }
    }

    fn mapping(items: Vec<(&str, DocumentValue)>) -> DocumentValue {
        DocumentValue::Mapping(
            items
                .into_iter()
                .map(|(key, value)| (key.to_owned(), value))
                .collect(),
        )
    }

    fn text(value: &str) -> DocumentValue {
        DocumentValue::String(value.to_owned())
    }

    #[test]
    fn test_card_projection_full_fields() {
        let metadata = card_metadata(
            Some("16:9"),
            vec![
                Tag::Simple("旅行".to_owned()),
                Tag::Structured(vec!["地点".to_owned(), "日本".to_owned()]),
            ],
        );
        let first = structure_entry("a1B2c3D4e5", "base.richtext");
        let second = structure_entry("f6G7h8I9j0", "base.image");
        let node = content_node(
            "a1B2c3D4e5",
            "base.richtext",
            mapping(vec![
                ("card_type", text("base.richtext")),
                ("config", text("原文")),
            ]),
        );
        let view = project_card_render_view(
            &metadata,
            vec![
                project_card_node_view(&first, Some(&node)),
                project_card_node_view(&second, None),
            ],
            7,
        );
        assert_eq!(view.revision, 7);
        assert_eq!(view.card_id, "a1B2c3D4e5");
        assert_eq!(view.name, "视图投影卡片");
        assert_eq!(view.chip_standards_version, "1.0.0");
        assert_eq!(view.cover_ratio, "16:9");
        assert_eq!(view.cover.entry, ".card/cover.html");
        assert_eq!(view.cover.ratio, "16:9");
        assert_eq!(view.tags[0], TagView::Simple("旅行".to_owned()));
        assert_eq!(
            view.tags[1],
            TagView::Structured(vec!["地点".to_owned(), "日本".to_owned()])
        );
        // L2 可达节点：内容根映射原样保留。
        assert_eq!(view.content_nodes[0].content, node.value);
        assert_eq!(view.content_nodes[0].node_id, "a1B2c3D4e5");
        // L1 可见、L2 未达节点：保留声明顺序与类型，内容空映射缺省。
        assert_eq!(view.content_nodes[1].card_type, "base.image");
        assert_eq!(
            view.content_nodes[1].content,
            DocumentValue::Mapping(Vec::new())
        );
    }

    #[test]
    fn test_box_projection_layout_props() {
        let metadata = box_metadata(None);
        let root = mapping(vec![
            ("active_layout_type", text("chips.layout.grid")),
            (
                "layout_configs",
                mapping(vec![(
                    "chips.layout.grid",
                    mapping(vec![
                        ("schema_version", text("1.0.0")),
                        (
                            "props",
                            mapping(vec![("column_count", DocumentValue::Integer(4))]),
                        ),
                    ]),
                )]),
            ),
        ]);
        let view = project_box_render_view(
            &metadata,
            &[entry("E001", Some(mapping(vec![("title", text("快照"))])))],
            Some(&root),
            3,
        );
        assert_eq!(view.revision, 3);
        assert_eq!(view.box_id, "f6G7h8I9j0");
        assert_eq!(view.active_layout_type, "chips.layout.grid");
        assert_eq!(view.cover.entry, ".box/cover.html");
        // 缺省比例语义：metadata 未声明 → `3:4`。
        assert_eq!(view.cover.ratio, "3:4");
        assert_eq!(
            view.layout_config,
            mapping(vec![("column_count", DocumentValue::Integer(4))])
        );
        assert_eq!(view.entries.len(), 1);
        assert_eq!(view.entries[0].url, "chips://doc/E001");
        assert!(view.entries[0].enabled);
        assert_eq!(view.entries[0].layout_hints, None);
    }

    #[test]
    fn test_layout_config_missing_defaults_to_empty() {
        let metadata = box_metadata(Some("1:1"));
        // L1/L0 可见、布局单元不可得：空映射缺省（按空配置渲染）。
        let without_unit = project_box_render_view(&metadata, &[], None, 1);
        assert_eq!(
            without_unit.layout_config,
            DocumentValue::Mapping(Vec::new())
        );
        assert_eq!(without_unit.cover.ratio, "1:1");
        // 生效布局类型在 `layout_configs` 中不存在：同样空映射。
        let root = mapping(vec![
            ("active_layout_type", text("chips.layout.grid")),
            (
                "layout_configs",
                mapping(vec![(
                    "chips.layout.board",
                    mapping(vec![("props", mapping(vec![("columns", text("x"))]))]),
                )]),
            ),
        ]);
        let other_layout = project_box_render_view(&metadata, &[], Some(&root), 1);
        assert_eq!(
            other_layout.layout_config,
            DocumentValue::Mapping(Vec::new())
        );
    }

    #[test]
    fn test_box_cover_view_is_l0_shrink_of_render_view() {
        let metadata = box_metadata(None);
        let root = mapping(vec![("layout_configs", mapping(vec![]))]);
        let view = project_box_render_view(
            &metadata,
            &[entry("E001", None), entry("E002", None)],
            Some(&root),
            9,
        );
        let cover = BoxCoverView::from(&view);
        assert_eq!(cover.kind, "box");
        assert_eq!(cover.box_id, "f6G7h8I9j0");
        assert_eq!(cover.name, "视图投影箱子");
        assert_eq!(cover.chip_standards_version, "1.0.0");
        assert_eq!(cover.cover, view.cover);
    }

    #[test]
    fn test_document_view_serialization_shape() {
        // 判别字段 `kind` 与 TS 联合类型逐字一致；缺省可选字段不出现在快照中。
        let metadata = box_metadata(None);
        let rendered = project_box_render_view(&metadata, &[entry("E001", None)], None, 2);
        let view = DocumentView::Box(rendered.clone());
        let json = serde_json::to_value(&view).expect("视图必须可序列化");
        assert_eq!(json["kind"], "box");
        assert_eq!(json["revision"], 2);
        assert_eq!(json["layout_config"], serde_json::json!({}));
        assert_eq!(json["cover"]["ratio"], "3:4");
        assert!(json["entries"][0].get("snapshot").is_none());
        assert!(json["entries"][0].get("layout_hints").is_none());
        assert_eq!(json["entries"][0]["entry_id"], "E001");

        let cover_json =
            serde_json::to_value(BoxCoverView::from(&rendered)).expect("封面视图必须可序列化");
        assert_eq!(cover_json["kind"], "box");
        assert_eq!(cover_json["cover"]["ratio"], "3:4");

        let card = DocumentView::Card(project_card_render_view(
            &card_metadata(None, Vec::new()),
            Vec::new(),
            5,
        ));
        let card_json = serde_json::to_value(&card).expect("卡片视图必须可序列化");
        assert_eq!(card_json["kind"], "card");
        assert_eq!(card_json["cover_ratio"], "3:4");
        assert_eq!(card_json["cover"]["entry"], ".card/cover.html");
        assert_eq!(card_json["tags"], serde_json::json!([]));
        assert_eq!(card_json["content_nodes"], serde_json::json!([]));
    }

    #[test]
    fn test_tag_view_untagged_json() {
        let tags = project_tags(&[
            Tag::Simple("美食".to_owned()),
            Tag::Structured(vec![
                "菜系".to_owned(),
                "川菜".to_owned(),
                "湘菜".to_owned(),
            ]),
        ]);
        let json = serde_json::to_value(&tags).expect("标签视图必须可序列化");
        assert_eq!(
            json,
            serde_json::json!(["美食", ["菜系", "川菜", "湘菜"]]),
            "TagView 必须序列化为 string | string[] 联合形态"
        );
    }

    #[test]
    fn test_non_mapping_content_converges_to_empty_object() {
        // 边界形状保障：内容根不是映射（异常/占位取值）时收敛为空对象，
        // 不破坏 `content: Record<string, unknown>` 消费形状。
        let node = content_node("a1B2c3D4e5", "base.text", text("裸标量"));
        let view = project_card_node_view(&structure_entry("a1B2c3D4e5", "base.text"), Some(&node));
        assert_eq!(view.content, DocumentValue::Mapping(Vec::new()));
        assert_eq!(view.card_type, "base.text");
    }

    #[test]
    fn test_error_normalization_carries_session_and_code() {
        let error = with_session(DocumentError::ParseCancelled.to_chips_error(), 42);
        assert_eq!(error.code(), "DOCUMENT_PARSE_CANCELLED");
        assert!(error.retryable());
        assert_eq!(error.details().expect("必须携带会话上下文")["session"], 42);

        let conflict = kinds_conflict(7);
        assert_eq!(conflict.code(), "DOCUMENT_STRUCTURE_INVALID");
        assert_eq!(
            conflict.details().expect("必须携带会话上下文")["session"],
            7
        );
    }
}
