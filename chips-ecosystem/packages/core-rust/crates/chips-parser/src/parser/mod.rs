//! 句柄与层级编排（《06-文档解析器设计》§5.2、《核心接口规范》§6.3）。
//!
//! [`DocumentHandle`] 持有 L0 冻结模型与惰性层级（L1 结构 / L2 内容与
//! 条目 / L3 资源字节），层级不可逆：访问高层级自动完成其依赖层级，
//! 已解析层级缓存于句柄，重复访问为常数时间（§5.1）。所有非致命诊断
//! 汇入句柄诊断集合，快照读取时排序去重（§3.7）；致命错误原样上抛
//! （§8.1 两级错误模型）。
//!
//! 单元缓存（§5.3）：句柄可经 [`CardParser::with_cache`] /
//! [`BoxParser::with_cache`] 挂接 [`ParseCache`]。只有**自带诊断**的单元
//! （L2 内容节点，`ContentNode::diagnostics`）参与单元缓存——metadata /
//! structure / 布局配置的诊断不随值树自持，缓存命中会丢失不可再生诊断，
//! 因此这三类单元始终按句柄现解析（句柄自身的 OnceLock 记忆化已保证
//! 重复访问常数时间）。
//!
//! 模块布局见 §11.4：本文件承载句柄与编排，[`card`] 承载 [`CardParser`]，
//! [`box_parser`]（文件 `box.rs`，`box` 为保留字故模块名转写）承载
//! [`BoxParser`]，[`pipeline`] 承载六阶段纯函数。

use std::collections::HashMap;
use std::io::Read as _;
use std::ops::Range;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, OnceLock, RwLock};

use crate::cache::{ParseCache, ParsedUnit};
use crate::digest::Sha256;
use crate::error::{sort_diagnostics, Diagnostic, DocumentError, Fatal, Severity};
use crate::model::{
    ContentIndex, ContentNode, DocumentKind, DocumentMetadata, DocumentRevision,
    DocumentStatistics, DocumentValue, Entry, NodeId, ParseOptions, StructureEntry, StructureModel,
    ValidationReport, ValidationStatus,
};
use crate::source::{ByteStream, MemberFingerprint, PackagePath};

mod pipeline;

#[path = "box.rs"]
pub mod box_parser;
pub mod card;

pub use box_parser::{BoxParser, ParsedBox};
pub use card::{CardParser, ParsedCard};

/// 平台当前支持的薯片标准版本（《06-文档解析器设计》§7.1）。
///
/// 文档声明的 `chip_standards_version` 主版本低于本值判过旧、高于判过新，
/// 次版本高于本值记录 `DOCUMENT_VERSION_MISMATCH`（警告）；修订号不参与
/// 判定（§7.2）。
pub const CURRENT_CHIP_STANDARDS_VERSION: &str = "1.0.0";

/// 自动识别 `.card` / `.box` 并打开到 L0（《核心接口规范》§6.2）。
///
/// 扩展名与索引探测矛盾时以探测结果为准，并记录
/// `DOCUMENT_EXTENSION_MISMATCH`（警告）；两侧皆无法判定时返回
/// `DOCUMENT_FORMAT_UNKNOWN`（§3.2 第 4 条）。
///
/// # Errors
///
/// 见 [`DocumentHandle::open`] 的致命错误集合。
pub fn open_document(path: &Path, options: &ParseOptions) -> Result<DocumentHandle, DocumentError> {
    DocumentHandle::open_auto(path, options, None)
}

/// 解析句柄：L0 冻结 + L1/L2 惰性 + L3 按需（§5.1、§5.2）。
///
/// `Send + Sync`，内部可变状态由 `OnceLock` / `RwLock` 保护，同一句柄可
/// 被多个消费者并发共享；`ParseOptions` 创建后不可变。
pub struct DocumentHandle {
    /// 双模式数据源（阶段 1-2 产物）。
    source: Arc<dyn crate::source::DocumentSource>,
    /// 单元缓存（可缺省，§5.3）。
    cache: Option<Arc<ParseCache>>,
    /// 文档格式（阶段 1 判定）。
    kind: DocumentKind,
    /// 解析选项（不可变）。
    options: ParseOptions,
    /// L0 元数据模型（冻结）。
    metadata: Arc<DocumentMetadata>,
    /// 已解析 YAML 字节累计（阶段 6 统计输入）。
    yaml_bytes: AtomicU64,
    /// L1 结构（含致命结果记忆：同一句柄对同一损坏文档返回同一错误）。
    structure: OnceLock<Fatal<Arc<StructureModel>>>,
    /// L2 内容节点记忆化（按标识）。
    content: RwLock<HashMap<NodeId, Arc<ContentNode>>>,
    /// L2 条目集合记忆化（箱子）。
    entries: RwLock<Option<Arc<[Entry]>>>,
    /// L2 布局配置单元记忆化（箱子）。
    layout: OnceLock<Fatal<Arc<DocumentValue>>>,
    /// 诊断集合（未排序；快照读取时排序去重，§3.7）。
    diagnostics: RwLock<Vec<Diagnostic>>,
    /// 视图投影修订序列源：句柄会话内单调计数，每取一号前进 1
    /// （《05-渲染引擎设计》§2.4 第 5 条、工单037 裁定）。
    view_sequence: AtomicU64,
}

impl DocumentHandle {
    /// 严格入口：按声明格式打开到 L0（`CardParser` / `BoxParser`）。
    pub(crate) fn open(
        path: &Path,
        kind: DocumentKind,
        options: &ParseOptions,
        cache: Option<Arc<ParseCache>>,
    ) -> Result<Self, DocumentError> {
        Self::open_impl(path, Some(kind), options, cache)
    }

    /// 自动识别入口（`open_document`）。
    pub(crate) fn open_auto(
        path: &Path,
        options: &ParseOptions,
        cache: Option<Arc<ParseCache>>,
    ) -> Result<Self, DocumentError> {
        Self::open_impl(path, None, options, cache)
    }

    /// 阶段 1-3：打开数据源、判定格式、解析 metadata 到 L0（§3.1-§3.4）。
    fn open_impl(
        path: &Path,
        expected: Option<DocumentKind>,
        options: &ParseOptions,
        cache: Option<Arc<ParseCache>>,
    ) -> Result<Self, DocumentError> {
        let opened = pipeline::open_l0(path, expected, options)?;
        Ok(Self {
            source: opened.source,
            cache,
            kind: opened.kind,
            options: options.clone(),
            metadata: opened.metadata,
            yaml_bytes: AtomicU64::new(opened.yaml_bytes),
            structure: OnceLock::new(),
            content: RwLock::new(HashMap::new()),
            entries: RwLock::new(None),
            layout: OnceLock::new(),
            diagnostics: RwLock::new(opened.diagnostics),
            view_sequence: AtomicU64::new(0),
        })
    }

    /// 文档格式（打开时判定的不可变结果）。
    #[must_use]
    pub fn kind(&self) -> DocumentKind {
        self.kind
    }

    /// 解析选项（句柄创建后不可变，§6.1）。
    #[must_use]
    pub fn options(&self) -> &ParseOptions {
        &self.options
    }

    /// L0：打开时完成，常数时间返回（§6.3）。
    #[must_use]
    pub fn metadata(&self) -> Arc<DocumentMetadata> {
        Arc::clone(&self.metadata)
    }

    /// L1：结构与引用索引，首次访问触发解析（§3.5、§6.3）。
    ///
    /// 语法或 schema 失败返回 `DOCUMENT_STRUCTURE_INVALID`（携带该阶段
    /// 诊断）；同一句柄对同一损坏结构返回同一错误（结果连同失败记忆）。
    pub fn structure(&self) -> Result<Arc<StructureModel>, DocumentError> {
        let outcome = self.structure.get_or_init(|| {
            match pipeline::parse_structure(self.source.as_ref(), self.kind, &self.options) {
                Ok((model, diagnostics, yaml_bytes)) => {
                    self.push_diagnostics(diagnostics);
                    self.yaml_bytes.fetch_add(yaml_bytes, Ordering::Relaxed);
                    Ok(model)
                }
                Err(error) => {
                    self.push_diagnostics(error.diagnostics().to_vec());
                    Err(error)
                }
            }
        });
        outcome.clone()
    }

    /// L2：单个内容节点（§3.6、§6.3）。
    ///
    /// 触达即完成 L1；结构未声明该标识返回 `DOCUMENT_NOT_FOUND`。
    /// 单元失败（引用缺失、语法、schema）按 §8.4 返回占位模型
    /// （空映射 + 结构声明类型回退）并携带错误级诊断，仅真致命
    /// （IO / 限额）返回 `Err`。挂接 [`ParseCache`] 时按成员指纹复用。
    pub fn content(&self, node: &NodeId) -> Result<Arc<ContentNode>, DocumentError> {
        if self.kind != DocumentKind::Card {
            return Err(format_misuse(
                "卡片句柄才有内容节点，箱子句柄请使用 entries / layout_config",
            ));
        }
        let structure = self.structure()?;
        let nodes = Self::card_nodes(&structure)?;
        let index = nodes
            .iter()
            .position(|entry| &entry.node_id == node)
            .ok_or_else(|| DocumentError::NotFound {
                path: node.content_file().to_string(),
            })?;
        if let Some(existing) = self.content_read(node) {
            return Ok(existing);
        }
        let (parsed, unit_bytes) = self.parse_content_at(index, &nodes[index])?;
        let mut map = self.content_write();
        if let Some(existing) = map.get(node) {
            // 并发窗口：他线程已插入则复用其结果，本线程字节不再累计。
            return Ok(Arc::clone(existing));
        }
        self.yaml_bytes.fetch_add(unit_bytes, Ordering::Relaxed);
        self.push_diagnostics(parsed.diagnostics.clone());
        map.insert(node.clone(), Arc::clone(&parsed));
        Ok(parsed)
    }

    /// L2：条目分页读取（箱子，§3.6、§6.3）。
    ///
    /// 触达即完成 L1；`None` 返回全集，`Some(range)` 返回与集合长度
    /// 求交后的窗口（越界端点收敛到边界，起始越界返回空集合——与
    /// 宿主侧数组切片语义一致）。失败条目按 §8.4 保留位置（禁用态）。
    pub fn entries(&self, range: Option<Range<usize>>) -> Result<Arc<[Entry]>, DocumentError> {
        if self.kind != DocumentKind::Box {
            return Err(format_misuse(
                "箱子句柄才有条目集合，卡片句柄请使用 content",
            ));
        }
        let all = self.all_entries()?;
        Ok(match range {
            None => all,
            Some(window) => {
                let start = window.start.min(all.len());
                let end = window.end.clamp(start, all.len());
                Arc::from(&all[start..end])
            }
        })
    }

    /// L2：箱子布局配置单元（`.box/content.yaml` 根值，《箱子文件格式》§6）。
    ///
    /// 《06》§5.2 句柄清单未列本访问器（视图构建器 §6.6 依赖的布局配置
    /// 单元入口，已登记文档漂移工单）；卡片句柄调用返回
    /// `DOCUMENT_FORMAT_UNKNOWN`。文件缺失或校验失败按 §8.4 返回空映射
    /// 占位并携带错误级诊断（生效布局不可用，视图侧按空配置渲染）。
    pub fn layout_config(&self) -> Result<Arc<DocumentValue>, DocumentError> {
        if self.kind != DocumentKind::Box {
            return Err(format_misuse("卡片句柄没有布局配置单元"));
        }
        let outcome = self.layout.get_or_init(|| {
            match pipeline::parse_layout_unit(self.source.as_ref(), &self.options) {
                Ok((value, diagnostics, yaml_bytes)) => {
                    self.push_diagnostics(diagnostics);
                    self.yaml_bytes.fetch_add(yaml_bytes, Ordering::Relaxed);
                    Ok(value)
                }
                Err(error) => {
                    self.push_diagnostics(error.diagnostics().to_vec());
                    Err(error)
                }
            }
        });
        outcome.clone()
    }

    /// L3：资源字节流（§6.3）。解析阶段永不读取资源正文（§3.6），本方法
    /// 是唯一资源出口：压缩态 Store 成员返回映射切片（零拷贝），目录态
    /// 与 Deflate 成员返回解码流。`range` 为绝对字节窗口（越界端点返回
    /// `DOCUMENT_IO`，不改变剩余流的可读语义）。
    pub fn read_resource(
        &self,
        path: &PackagePath,
        range: Option<Range<u64>>,
    ) -> Result<ByteStream, DocumentError> {
        let meta = self
            .source
            .member(path)
            .ok_or_else(|| DocumentError::NotFound {
                path: path.to_string(),
            })?;
        let stream = self.source.open_stream(path)?;
        let Some(range) = range else {
            return Ok(stream);
        };
        if range.start >= range.end || range.end > meta.size {
            return Err(DocumentError::Io {
                message: format!(
                    "资源 {path} 的读取范围 {:?}..{:?} 越出成员长度 {}",
                    range.start, range.end, meta.size
                ),
            });
        }
        let length = range.end - range.start;
        match stream {
            // Store 成员保持零拷贝：窗口仍落在映射内时直接改写区间。
            ByteStream::Mapped { source, offset, .. } => {
                let new_offset = offset + range.start;
                if source.slice(new_offset, length).is_none() {
                    return Err(DocumentError::Io {
                        message: format!("资源 {path} 的映射窗口越界"),
                    });
                }
                Ok(ByteStream::Mapped {
                    source,
                    offset: new_offset,
                    length,
                })
            }
            mut decoded => {
                let bytes = decoded.read_to_vec()?;
                let start = usize::try_from(range.start)
                    .unwrap_or(usize::MAX)
                    .min(bytes.len());
                let end = usize::try_from(range.end)
                    .unwrap_or(usize::MAX)
                    .min(bytes.len());
                Ok(ByteStream::Decoded(Box::new(std::io::Cursor::new(
                    bytes[start..end].to_vec(),
                ))))
            }
        }
    }

    /// 全量诊断快照：已排序去重（§3.7、§6.3）。
    #[must_use]
    pub fn diagnostics(&self) -> Vec<Diagnostic> {
        let snapshot = self
            .diagnostics
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone();
        sort_diagnostics(snapshot)
    }

    /// 修订：数据源指纹 + `chip_standards_version` + 索引摘要（§3.7、§6.3）。
    ///
    /// 构建为常数时间，不读取资源正文。
    #[must_use]
    pub fn revision(&self) -> DocumentRevision {
        DocumentRevision::new(
            self.source.fingerprint(),
            self.metadata.chip_standards_version().to_owned(),
        )
    }

    /// 视图投影修订号（《05-渲染引擎设计》§2.4 第 5 条、《核心接口规范》
    /// §6.6 `revision: number`、工单037 裁定）。
    ///
    /// 句柄会话内单调序列源：每取一号前进 1，首开基线取值为 0——与文档
    /// 服务会话修订基线同序列（《11-文档服务设计》§3.4：首次成功写入产出
    /// 1；回流唯一时序 `document:write → 写后重建 → update(view, revision)`
    /// 下，第 k 次重建恒得 k-1，写臂交付值恒大于渲染会话现值）。
    ///
    /// 语义保证：
    /// - **严格递增**：同一句柄跨连续调用恒增 1，任一写事务提交后的重建
    ///   视图修订必然大于前值（宿主渲染会话锁 `revision <= lastRevision`
    ///   拒绝臂因此恒不误伤合法回流）；
    /// - **有界**：取值 = 句柄会话内已完成的视图构建数，进入 JS 线格式
    ///   `< 2^53` 安全整数契约（《核心接口规范》§8.2、packages/native
    ///   README §五）；达到边界的病态会话由绑定层判闸 fail-closed 拒绝，
    ///   不静默截断。
    ///
    /// 数据源修订身份（缓存失效、外部修改复查）由 [`Self::revision`] 的
    /// 无序指纹承载，与本序列解耦（工单037：禁止以指纹摘要数值充当视图
    /// 修订，无序性与越界性双重不成立）。
    #[must_use]
    pub fn next_view_revision(&self) -> u64 {
        self.view_sequence.fetch_add(1, Ordering::Relaxed)
    }

    /// 全量内容摘要：对「成员路径升序 + 内容字节」序列做 SHA-256，
    /// 按需计算（§6.3）。目录态与压缩态对同一内容必得同一摘要
    /// （§4.4 双模式一致性）。
    pub fn content_digest(&self) -> Result<[u8; 32], DocumentError> {
        let fingerprint = self.source.fingerprint();
        let mut hasher = Sha256::new();
        for (path, member) in &fingerprint.members {
            hasher.update(path.as_str().as_bytes());
            hasher.update(&[0u8]);
            hasher.update(&member.size.to_le_bytes());
            let mut stream = self.source.open_stream(path)?;
            feed_digest(&mut hasher, &mut stream)?;
        }
        Ok(hasher.finish())
    }

    /// 严格校验报告（§6.1、§6.5）：以 `strict: true` + `verify_hashes: true`
    /// 的选项组合对同一数据源全量重扫（metadata / structure / 全部 L2
    /// 单元 / CRC32 / 资源 checksum / 未引用文件），诊断排序去重后聚合
    /// 状态；本方法不改动句柄的惰性层级与诊断集合。
    ///
    /// 信息级诊断不影响状态：`Error` → `Invalid`，`Warning` →
    /// `ValidWithWarnings`，其余 → `Valid`。不可全量解析的文档（元数据、
    /// 结构致命失败、版本越界、归档损坏）直接上抛致命错误。
    pub fn validate(&self) -> Result<ValidationReport, DocumentError> {
        let strict_options = ParseOptions {
            strict: true,
            verify_hashes: true,
            ..self.options.clone()
        };
        let mut diagnostics: Vec<Diagnostic> = Vec::new();
        let (metadata, mut stage, yaml_bytes) =
            pipeline::parse_metadata(self.source.as_ref(), self.kind, &strict_options)?;
        diagnostics.append(&mut stage);
        let mut yaml_bytes = yaml_bytes;
        let (structure, mut stage, structure_bytes) =
            pipeline::parse_structure(self.source.as_ref(), self.kind, &strict_options)?;
        diagnostics.append(&mut stage);
        yaml_bytes += structure_bytes;
        match structure.as_ref() {
            StructureModel::Card {
                structure: nodes, ..
            } => {
                let file = pipeline::structure_file(self.kind);
                for (index, entry) in nodes.iter().enumerate() {
                    let pointer = format!("/structure/{index}");
                    let node = pipeline::parse_content_unit(
                        self.source.as_ref(),
                        &strict_options,
                        entry,
                        &file,
                        &pointer,
                    )?;
                    diagnostics.extend(node.diagnostics.iter().cloned());
                    if let Some(member) = self.source.member(&entry.file) {
                        yaml_bytes = yaml_bytes.saturating_add(member.size);
                    }
                }
            }
            StructureModel::Box { .. } => {
                let (_value, stage, unit_bytes) =
                    pipeline::parse_layout_unit(self.source.as_ref(), &strict_options)?;
                diagnostics.extend(stage);
                yaml_bytes = yaml_bytes.saturating_add(unit_bytes);
            }
        }
        // §4.3：validate 强制完整性扫描（全部成员 CRC32；目录态恒通过）。
        let fingerprint = self.source.fingerprint();
        for (path, _) in &fingerprint.members {
            self.source.verify_member_crc(path)?;
        }
        let diagnostics = sort_diagnostics(diagnostics);
        let status = if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Error)
        {
            ValidationStatus::Invalid
        } else if diagnostics
            .iter()
            .any(|item| item.severity == Severity::Warning)
        {
            ValidationStatus::ValidWithWarnings
        } else {
            ValidationStatus::Valid
        };
        Ok(ValidationReport {
            kind: self.kind,
            chip_standards_version: metadata.chip_standards_version().to_owned(),
            status,
            statistics: pipeline::statistics_from(&fingerprint, yaml_bytes, Some(&structure)),
            diagnostics,
        })
    }

    /// 统计快照（§3.7）：结构未加载时资源/条目计数为 0，已解析 YAML
    /// 字节数随惰性层级推进。
    #[must_use]
    pub fn statistics(&self) -> DocumentStatistics {
        let fingerprint = self.source.fingerprint();
        let structure = self
            .structure
            .get()
            .and_then(|outcome| outcome.as_ref().ok())
            .map(Arc::as_ref);
        pipeline::statistics_from(
            &fingerprint,
            self.yaml_bytes.load(Ordering::Relaxed),
            structure,
        )
    }

    /// 全量内容解析（§11.2 `CardParser::parse` 主体）：结构顺序输出，
    /// 单元级并行受 `parallelism` 限制（§5.3，std 线程域、无第三方池）。
    /// 返回的节点已全部进入句柄记忆化与（可选）单元缓存。
    pub(crate) fn parse_all_content(&self) -> Result<ContentIndex, DocumentError> {
        if self.kind != DocumentKind::Card {
            return Err(format_misuse("卡片句柄才有内容节点集合"));
        }
        let structure = self.structure()?;
        let nodes = Self::card_nodes(&structure)?.clone();
        let mut slots: Vec<Option<Arc<ContentNode>>> = Vec::with_capacity(nodes.len());
        let mut misses: Vec<(usize, StructureEntry)> = Vec::new();
        for (index, entry) in nodes.iter().enumerate() {
            if let Some(existing) = self.content_read(&entry.node_id) {
                slots.push(Some(existing));
            } else {
                slots.push(None);
                misses.push((index, entry.clone()));
            }
        }
        let parsed = self.parse_units_parallel(&misses)?;
        for (index, node, unit_bytes) in parsed {
            let _ = index;
            let mut map = self.content_write();
            if !map.contains_key(&node.node_id) {
                self.yaml_bytes.fetch_add(unit_bytes, Ordering::Relaxed);
                self.push_diagnostics(node.diagnostics.clone());
                map.insert(node.node_id.clone(), Arc::clone(&node));
            }
            slots[index] = Some(node);
        }
        // 结构顺序输出（§3.5：顺序即渲染顺序）。
        let mut pairs = Vec::with_capacity(nodes.len());
        for (entry, slot) in nodes.iter().zip(slots) {
            pairs.push((entry.node_id.clone(), slot.expect("已解析单元全部回填")));
        }
        Ok(ContentIndex::new(pairs))
    }

    /// 缺失单元并行解析：交错分块到 `min(parallelism, 缺失数)` 个工作线程，
    /// 结果按结构下标回归原序（输出确定性，§5.3「写入顺序无关」）；
    /// 任一单元真致命按原序上抛第一个错误。
    fn parse_units_parallel(
        &self,
        misses: &[(usize, StructureEntry)],
    ) -> Result<Vec<(usize, Arc<ContentNode>, u64)>, DocumentError> {
        let workers = self.options.parallelism.max(1).min(misses.len()).max(1);
        if workers == 1 || misses.len() < 2 {
            let mut output = Vec::with_capacity(misses.len());
            for (index, entry) in misses {
                let (node, bytes) = self.parse_content_at(*index, entry)?;
                output.push((*index, node, bytes));
            }
            return Ok(output);
        }
        let source = Arc::clone(&self.source);
        let options = self.options.clone();
        let cache = self.cache.clone();
        let structure_file = pipeline::structure_file(self.kind);
        let mut per_worker: Vec<Vec<(usize, Arc<ContentNode>, u64)>> =
            std::thread::scope(|scope| {
                let mut handles = Vec::with_capacity(workers);
                for worker in 0..workers {
                    let entries: Vec<(usize, StructureEntry)> = misses
                        .iter()
                        .enumerate()
                        .filter(|(offset, _)| offset % workers == worker)
                        .map(|(_, (index, entry))| (*index, entry.clone()))
                        .collect();
                    let source = Arc::clone(&source);
                    let options = options.clone();
                    let cache = cache.clone();
                    let structure_file = structure_file.clone();
                    handles.push(
                        std::thread::Builder::new()
                            .name(format!("chips-parser-l2-{worker}"))
                            .spawn_scoped(scope, move || {
                                let mut produced = Vec::with_capacity(entries.len());
                                for (index, entry) in entries {
                                    let pointer = format!("/structure/{index}");
                                    if let Ok((node, bytes)) = parse_unit_with_cache(
                                        source.as_ref(),
                                        cache.as_ref(),
                                        &options,
                                        &entry,
                                        &structure_file,
                                        &pointer,
                                    ) {
                                        produced.push((index, node, bytes));
                                    }
                                }
                                produced
                            })
                            .expect("受 parallelism 上限的少量作用域线程创建不会失败"),
                    );
                }
                // 作用域内回收全部工作线程（输出确定性：分组后按下标归并）。
                handles
                    .into_iter()
                    .map(|handle| handle.join().unwrap_or_default())
                    .collect()
            });
        let mut merged: Vec<(usize, Arc<ContentNode>, u64)> = Vec::with_capacity(misses.len());
        for group in per_worker.drain(..) {
            merged.extend(group);
        }
        merged.sort_by_key(|(index, _, _)| *index);
        // 真致命（IO/限额）单元缺失于结果集：对全部缺失单元按原序复核，
        // 保证错误确定性上抛（工作线程内不携带句柄状态，重跑仅错误路径）。
        if merged.len() != misses.len() {
            for (index, entry) in misses {
                if merged.iter().any(|(done, _, _)| done == index) {
                    continue;
                }
                let (node, bytes) = self.parse_content_at(*index, entry)?;
                merged.push((*index, node, bytes));
            }
            merged.sort_by_key(|(index, _, _)| *index);
        }
        Ok(merged)
    }

    /// 记忆化查表（读锁）。
    fn content_read(&self, node: &NodeId) -> Option<Arc<ContentNode>> {
        self.content
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .get(node)
            .cloned()
    }

    /// 记忆化写锁。
    fn content_write(&self) -> std::sync::RwLockWriteGuard<'_, HashMap<NodeId, Arc<ContentNode>>> {
        self.content
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }

    /// 结构产物中的卡片节点列表（形态矛盾即句柄内部不变量破坏）。
    fn card_nodes(structure: &StructureModel) -> Result<Vec<StructureEntry>, DocumentError> {
        match structure {
            StructureModel::Card { structure, .. } => Ok(structure.clone()),
            StructureModel::Box { .. } => Err(format_misuse("结构模型与句柄格式不符")),
        }
    }

    /// 解析单个内容单元（查缓存 → 现解析 → 回填缓存），返回节点与该
    /// 单元消耗的源字节数。
    fn parse_content_at(
        &self,
        index: usize,
        entry: &StructureEntry,
    ) -> Result<(Arc<ContentNode>, u64), DocumentError> {
        let pointer = format!("/structure/{index}");
        parse_unit_with_cache(
            self.source.as_ref(),
            self.cache.as_ref(),
            &self.options,
            entry,
            &pipeline::structure_file(self.kind),
            &pointer,
        )
    }

    /// 箱子全量条目（L1 派生 + 记忆化）。
    fn all_entries(&self) -> Result<Arc<[Entry]>, DocumentError> {
        if let Some(existing) = self
            .entries
            .read()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .as_ref()
        {
            return Ok(Arc::clone(existing));
        }
        let structure = self.structure()?;
        let entries: Arc<[Entry]> = match structure.as_ref() {
            StructureModel::Box { entries, .. } => Arc::from(entries.as_slice()),
            StructureModel::Card { .. } => return Err(format_misuse("结构模型与句柄格式不符")),
        };
        *self
            .entries
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(Arc::clone(&entries));
        Ok(entries)
    }

    /// 追加诊断（快照读取时统一排序去重）。
    fn push_diagnostics(&self, diagnostics: Vec<Diagnostic>) {
        if diagnostics.is_empty() {
            return;
        }
        self.diagnostics
            .write()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .extend(diagnostics);
    }
}

/// 内容单元解析 + 单元缓存接线（§5.3：仅自带诊断的 `ContentNode` 参与
/// 缓存；成员指纹缺失即不可缓存路径）。
fn parse_unit_with_cache(
    source: &dyn crate::source::DocumentSource,
    cache: Option<&Arc<ParseCache>>,
    options: &ParseOptions,
    entry: &StructureEntry,
    structure_file: &PackagePath,
    pointer: &str,
) -> Result<(Arc<ContentNode>, u64), DocumentError> {
    let (fingerprint, unit_bytes) = match source.member(&entry.file) {
        Some(meta) => (Some(MemberFingerprint::of(&meta)), meta.size),
        None => (None, 0),
    };
    if let (Some(cache), Some(fingerprint)) = (cache, fingerprint) {
        if let Some(unit) = cache.get_unit(&entry.file, fingerprint, options) {
            if let Some(node) = unit.as_content() {
                return Ok((Arc::clone(node), unit_bytes));
            }
        }
    }
    let node = pipeline::parse_content_unit(source, options, entry, structure_file, pointer)?;
    if let (Some(cache), Some(fingerprint)) = (cache, fingerprint) {
        cache.insert_unit(
            &entry.file,
            fingerprint,
            options,
            ParsedUnit::Content(Arc::clone(&node)),
        );
    }
    Ok((node, unit_bytes))
}

/// 把字节流分块喂入摘要累加器（64 KiB 窗口，不整读大资源）。
fn feed_digest(hasher: &mut Sha256, stream: &mut ByteStream) -> Result<(), DocumentError> {
    const CHUNK: u64 = 64 * 1024;
    match stream {
        ByteStream::Mapped {
            source,
            offset,
            length,
        } => {
            let mut done = 0u64;
            while done < *length {
                let take = (*length - done).min(CHUNK);
                let bytes =
                    source
                        .slice(*offset + done, take)
                        .ok_or_else(|| DocumentError::Io {
                            message: "映射切片越界，归档可能已损坏".to_owned(),
                        })?;
                hasher.update(bytes);
                done += take;
            }
            Ok(())
        }
        ByteStream::Decoded(reader) => {
            let mut buffer = vec![0u8; usize::try_from(CHUNK).unwrap_or(usize::MAX)];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => return Ok(()),
                    Ok(read) => hasher.update(&buffer[..read]),
                    Err(io_error) if io_error.kind() == std::io::ErrorKind::Interrupted => {}
                    Err(io_error) => {
                        return Err(DocumentError::Io {
                            message: format!("摘要计算读取失败：{io_error}"),
                        })
                    }
                }
            }
        }
    }
}

/// 句柄调试输出：只暴露不可变判定结果（格式、文档标识与版本），不触发
/// 任何惰性层级解析（§5.2 访问器语义不变）。
impl std::fmt::Debug for DocumentHandle {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("DocumentHandle")
            .field("kind", &self.kind)
            .field("document_id", &self.metadata.document_id())
            .field(
                "chip_standards_version",
                &self.metadata.chip_standards_version(),
            )
            .finish_non_exhaustive()
    }
}

/// 访问器与文档格式不符的致命错误（复用 §8.2 码表，不发明新码）。
fn format_misuse(message: impl Into<String>) -> DocumentError {
    DocumentError::FormatUnknown {
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 句柄必须可跨线程共享（《核心接口规范》§6.3）。
    #[test]
    fn test_handle_is_send_sync() {
        fn assert_send_sync<T: Send + Sync>() {}
        assert_send_sync::<DocumentHandle>();
        assert_send_sync::<ParsedCard>();
        assert_send_sync::<ParsedBox>();
    }

    #[test]
    fn test_current_version_shape() {
        assert!(
            crate::schema::is_strict_version(CURRENT_CHIP_STANDARDS_VERSION),
            "平台标准版本必须是严格三段式"
        );
    }

    #[test]
    fn test_open_missing_path_is_not_found() {
        let error = match open_document(
            Path::new("/nonexistent/chips-c54.card"),
            &ParseOptions::default(),
        ) {
            Ok(_) => panic!("不存在的路径必须失败"),
            Err(error) => error,
        };
        assert_eq!(error.code(), crate::error::DOCUMENT_NOT_FOUND);
    }
}
