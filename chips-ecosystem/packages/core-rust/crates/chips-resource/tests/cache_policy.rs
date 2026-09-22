//! B4 缓存策略面的管理器侧集成锁测（《04-资源管理设计》§六，段三主体
//! #185）。
//!
//! 以在册计数替身 Provider 驱动，逐则钉住 §6.4 文字面：
//! 完整读取才写 L1、范围读不写、流式只更新元数据、SingleFlight 合流、
//! 失效竞态过期结果丢弃、写提交事件失效、作用域注销随域清空。

use std::collections::BTreeSet;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use chips_core::{ChipsError, NoopDecisionObserver};
use chips_resource::{
    ByteRange, CacheKey, CacheStore, DirectoryEntry, FileMetadata, OpenRequest, Origin,
    ResourceAddress, ResourceLimits, ResourceMetadata, ResourceProvider, ResourceStream, ScopeKind,
    ScopePolicy, ScopeRegistration, SessionKind, VirtualPath, WriteRequest,
    PERMISSION_RESOURCES_READ, PERMISSION_RESOURCES_WRITE,
};

/// 计数替身：全量实现在册契约，读面按字节体返回并计数。
#[derive(Debug, Default)]
struct CountState {
    stat_calls: u64,
    full_reads: u64,
    partial_reads: u64,
    stream_opens: u64,
    writes: u64,
    version: u64,
    payload: Vec<u8>,
}

struct CountingProvider {
    state: Mutex<CountState>,
    gate: tokio::sync::Semaphore,
    passed: std::sync::atomic::AtomicU64,
    gated: bool,
}

impl CountingProvider {
    fn new(payload: Vec<u8>) -> Self {
        Self {
            state: Mutex::new(CountState {
                version: 7,
                payload,
                ..CountState::default()
            }),
            gate: tokio::sync::Semaphore::new(0),
            passed: std::sync::atomic::AtomicU64::new(0),
            gated: false,
        }
    }

    fn gated(payload: Vec<u8>) -> Self {
        Self {
            gated: true,
            ..Self::new(payload)
        }
    }

    fn snapshot(&self) -> (u64, u64, u64, u64, u64, u64) {
        let state = self.state.lock().expect("计数锁不得中毒");
        (
            state.stat_calls,
            state.full_reads,
            state.partial_reads,
            state.stream_opens,
            state.writes,
            state.version,
        )
    }

    /// 已越过停论点的全量读条数（合流测钉住「放闸前确已全部到达」）。
    fn passed_gates(&self) -> u64 {
        self.passed.load(Ordering::SeqCst)
    }

    fn metadata_of(state: &CountState) -> ResourceMetadata {
        ResourceMetadata {
            uri: String::new(),
            size: u64::try_from(state.payload.len()).unwrap_or(u64::MAX),
            mime_type: "application/octet-stream".into(),
            version: format!("cnt-{}", state.version),
            scope: ScopeKind::Document,
        }
    }
}

#[async_trait]
impl ResourceProvider for CountingProvider {
    fn id(&self) -> &'static str {
        "counter"
    }

    fn supports_streaming(&self) -> bool {
        true
    }

    fn supports_write(&self) -> bool {
        true
    }

    async fn stat(&self, address: &ResourceAddress) -> Result<ResourceMetadata, ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.stat_calls += 1;
        let mut metadata = Self::metadata_of(&state);
        metadata.uri = address.uri.clone();
        Ok(metadata)
    }

    async fn read_range(
        &self,
        _address: &ResourceAddress,
        range: ByteRange,
    ) -> Result<Vec<u8>, ChipsError> {
        let full = range.offset == 0 && range.length.is_none();
        if full && self.gated {
            // 停论点：等待测试侧放闸（失效竞态与合流场景的确定性交错）。
            self.passed.fetch_add(1, Ordering::SeqCst);
            let permit = self.gate.acquire().await.expect("放闸许可必须可得");
            drop(permit);
        }
        let mut state = self.state.lock().expect("计数锁不得中毒");
        if full {
            state.full_reads += 1;
            Ok(state.payload.clone())
        } else {
            state.partial_reads += 1;
            let start = usize::try_from(range.offset).unwrap_or(usize::MAX);
            let end = match range.length {
                Some(length) => {
                    (start + usize::try_from(length).unwrap_or(usize::MAX)).min(state.payload.len())
                }
                None => state.payload.len(),
            };
            if start > state.payload.len() {
                return Err(ChipsError::new(
                    chips_resource::error::RESOURCE_NOT_FOUND,
                    "越界",
                ));
            }
            Ok(state.payload[start..end].to_vec())
        }
    }

    async fn open_stream(
        &self,
        _address: &ResourceAddress,
    ) -> Result<Box<dyn ResourceStream>, ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.stream_opens += 1;
        Ok(Box::new(CounterStream {
            bytes: state.payload.clone(),
            cursor: 0,
        }))
    }

    async fn list_directory(
        &self,
        address: &ResourceAddress,
    ) -> Result<Vec<DirectoryEntry>, ChipsError> {
        Err(crate_stub_not_supported(address))
    }

    async fn write(
        &self,
        address: &ResourceAddress,
        data: &[u8],
    ) -> Result<ResourceMetadata, ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.writes += 1;
        state.version += 1;
        state.payload = data.to_vec();
        let mut metadata = Self::metadata_of(&state);
        metadata.uri = address.uri.clone();
        Ok(metadata)
    }

    async fn delete(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.payload = Vec::new();
        state.version += 1;
        let _ = address;
        Ok(())
    }

    async fn rename(
        &self,
        _from: &ResourceAddress,
        to: &ResourceAddress,
    ) -> Result<(), ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.version += 1;
        let _ = to;
        Ok(())
    }

    async fn copy(&self, _from: &ResourceAddress, to: &ResourceAddress) -> Result<(), ChipsError> {
        let mut state = self.state.lock().expect("计数锁不得中毒");
        state.version += 1;
        let _ = to;
        Ok(())
    }

    async fn create_directory(&self, address: &ResourceAddress) -> Result<(), ChipsError> {
        let _ = address;
        Ok(())
    }

    async fn set_metadata(
        &self,
        address: &ResourceAddress,
        _metadata: FileMetadata,
    ) -> Result<(), ChipsError> {
        let _ = address;
        Ok(())
    }
}

fn crate_stub_not_supported(address: &ResourceAddress) -> ChipsError {
    chips_resource::ResourceError::NotSupported {
        uri: address.uri.clone(),
        scope: ScopeKind::Document,
        operation: chips_resource::ScopeOperation::List,
    }
    .to_chips_error()
}

/// 简单字节流（测试替身流）。
struct CounterStream {
    bytes: Vec<u8>,
    cursor: usize,
}

#[async_trait]
impl ResourceStream for CounterStream {
    async fn next_chunk(&mut self, max_bytes: usize) -> Result<Option<Vec<u8>>, ChipsError> {
        if self.cursor >= self.bytes.len() {
            return Ok(None);
        }
        let cap = max_bytes.clamp(1, 1024 * 1024);
        let end = (self.cursor + cap).min(self.bytes.len());
        let chunk = self.bytes[self.cursor..end].to_vec();
        self.cursor = end;
        Ok(Some(chunk))
    }
}

struct Fixture {
    manager: Arc<chips_resource::ResourceManager>,
    session: u64,
    provider: Arc<CountingProvider>,
    root: std::path::PathBuf,
}

impl Fixture {
    fn build(payload: Vec<u8>) -> Self {
        Self::build_with(payload, false)
    }

    fn build_with(payload: Vec<u8>, gated: bool) -> Self {
        let root = std::env::temp_dir().join(format!(
            "chips-cache-policy-{}-{}",
            std::process::id(),
            nanos_stamp()
        ));
        std::fs::create_dir_all(&root).expect("测试根目录必须可建");
        let provider = Arc::new(if gated {
            CountingProvider::gated(payload)
        } else {
            CountingProvider::new(payload)
        });
        let manager = Arc::new(chips_resource::ResourceManager::new(
            ResourceLimits::default(),
            Arc::new(NoopDecisionObserver),
        ));
        manager
            .register_provider(Arc::clone(&provider) as Arc<dyn ResourceProvider>)
            .expect("注册替身 Provider");
        manager
            .register_scope(ScopeRegistration {
                scope: "card-1".into(),
                kind: ScopeKind::Document,
                owner: "chips.a".into(),
                provider_id: "counter".into(),
                origin: Origin::Directory(root.clone()),
                policy: ScopePolicy {
                    read_only: false,
                    max_resource_bytes: 1 << 30,
                    allowed_hosts: Vec::new(),
                },
            })
            .expect("注册作用域");
        let scopes: BTreeSet<String> = ["card-1".to_owned()].into_iter().collect();
        let permissions: BTreeSet<String> = [
            PERMISSION_RESOURCES_READ.to_owned(),
            PERMISSION_RESOURCES_WRITE.to_owned(),
        ]
        .into_iter()
        .collect();
        let session = manager
            .open_session(
                SessionKind::Document,
                &"chips.a".into(),
                scopes,
                permissions,
            )
            .expect("创建会话");
        Self {
            manager,
            session,
            provider,
            root,
        }
    }

    async fn open_handle(&self) -> chips_resource::OpenHandle {
        self.manager
            .open(OpenRequest {
                uri: "chips-resource://card-1/doc.bin".into(),
                session: self.session,
            })
            .await
            .expect("打开句柄")
    }

    fn release(&self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn nanos_stamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|span| span.as_nanos())
        .unwrap_or(0)
}

fn write_request(session: u64, bytes: &[u8]) -> WriteRequest {
    WriteRequest {
        session,
        scope: "card-1".into(),
        path: VirtualPath::validate(
            "doc.bin",
            "chips-resource://card-1/doc.bin",
            &ResourceLimits::default(),
        )
        .expect("合法虚拟路径"),
        bytes: bytes.to_vec(),
    }
}

/// 观察侧确定性等待：钉住 N 条全量读已越过停论点停放后再放闸，
/// 不依赖 tokio `time` 特性（本 crate 未启用）的交错收敛手段。
async fn wait_past_gate(fixture: &Fixture, expected: u64) {
    for _ in 0..10_000u32 {
        if fixture.provider.passed_gates() >= expected {
            return;
        }
        tokio::task::yield_now().await;
    }
    panic!("等待停论点超时：期望 ≥{expected} 条越闸");
}

#[tokio::test]
async fn full_read_lands_in_l1_and_second_read_skips_provider_bytes() {
    let fixture = Fixture::build(b"hello-cache".to_vec());
    let handle = fixture.open_handle().await;
    let first = fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("首次完整读");
    let second = fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("二次完整读");
    assert_eq!(first, b"hello-cache".to_vec());
    assert_eq!(second, first, "L1 命中必须逐字节一致");
    let (stat_calls, full_reads, _, _, _, _) = fixture.provider.snapshot();
    assert_eq!(
        full_reads, 1,
        "第二次完整读不得触达 Provider 字节面（§6.4）"
    );
    assert_eq!(
        stat_calls, 3,
        "open 一次 + 每次读取前版本戳校验各一次（§6.3 Directory 行）"
    );
    fixture.release();
}

#[tokio::test]
async fn range_read_never_writes_l1() {
    let fixture = Fixture::build(b"0123456789".to_vec());
    let handle = fixture.open_handle().await;
    let partial = ByteRange {
        offset: 2,
        length: Some(3),
    };
    let a = fixture
        .manager
        .read_range(handle.id, fixture.session, partial)
        .await
        .expect("范围读");
    let b = fixture
        .manager
        .read_range(handle.id, fixture.session, partial)
        .await
        .expect("范围读");
    assert_eq!(a, b"234".to_vec());
    assert_eq!(b, a);
    let (_, full_reads, partial_reads, _, _, _) = fixture.provider.snapshot();
    assert_eq!(
        partial_reads, 2,
        "范围读必须每次直通（§6.4 范围读不写入 L1）"
    );
    assert_eq!(full_reads, 0);
    // 范围读不产 L1 驻留：随后的完整读照常落取一次。
    let full = fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("完整读");
    assert_eq!(full, b"0123456789".to_vec());
    let (_, full_reads, _, _, _, _) = fixture.provider.snapshot();
    assert_eq!(full_reads, 1);
    fixture.release();
}

#[tokio::test]
async fn streaming_does_not_write_bytes_cache() {
    let payload: Vec<u8> = (0..100u8).collect();
    let fixture = Fixture::build(payload.clone());
    let handle = fixture.open_handle().await;
    let mut consumed = Vec::new();
    while let Some(chunk) = fixture
        .manager
        .read_chunk(handle.id, fixture.session, 16)
        .await
        .expect("流读")
    {
        consumed.extend_from_slice(&chunk);
    }
    assert_eq!(consumed, payload, "流式全量收敛");
    let (_, full_reads, _, stream_opens, _, _) = fixture.provider.snapshot();
    assert_eq!(stream_opens, 1);
    assert_eq!(full_reads, 0, "流式读取不写入字节缓存（§6.4）");
    // 流后完整读照常落取（L1 无流式驻留）。
    fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("流后完整读");
    let (_, full_reads, _, _, _, _) = fixture.provider.snapshot();
    assert_eq!(full_reads, 1, "流式只更新元数据、不种子 L1");
    fixture.release();
}

#[tokio::test]
async fn write_commit_event_invalidates_stale_l1_and_refreshes_metadata() {
    let fixture = Fixture::build(b"old-bytes".to_vec());
    let handle = fixture.open_handle().await;
    let before = fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("初始完整读");
    assert_eq!(before, b"old-bytes".to_vec());
    let metadata = fixture
        .manager
        .commit_write(write_request(fixture.session, b"new-bytes!"))
        .await
        .expect("写提交");
    assert_eq!(
        metadata.version, "cnt-8",
        "写提交后新版本（§6.3 Temporary 行）"
    );
    let after = fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("提交后完整读");
    assert_eq!(after, b"new-bytes!".to_vec(), "事件失效后不得回吐旧字节");
    let (_, full_reads, _, _, writes, _) = fixture.provider.snapshot();
    assert_eq!(writes, 1);
    assert_eq!(full_reads, 2, "旧版本条目已清，新版本重新落取一次");
    fixture.release();
}

#[tokio::test]
async fn unregister_scope_clears_cache_entries() {
    let fixture = Fixture::build(b"scope-bound".to_vec());
    let handle = fixture.open_handle().await;
    fixture
        .manager
        .read_range(
            handle.id,
            fixture.session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("初始完整读");
    fixture
        .manager
        .unregister_scope(&"card-1".to_owned())
        .expect("注销作用域");
    // 重注册（新版本戳不变）：若 L1/L0 未随域清空，读取将免触 Provider。
    fixture
        .manager
        .register_scope(ScopeRegistration {
            scope: "card-1".into(),
            kind: ScopeKind::Document,
            owner: "chips.a".into(),
            provider_id: "counter".into(),
            origin: Origin::Directory(fixture.root.clone()),
            policy: ScopePolicy {
                read_only: false,
                max_resource_bytes: 1 << 30,
                allowed_hosts: Vec::new(),
            },
        })
        .expect("重注册作用域");
    let scopes: BTreeSet<String> = ["card-1".to_owned()].into_iter().collect();
    let permissions: BTreeSet<String> =
        [PERMISSION_RESOURCES_READ.to_owned()].into_iter().collect();
    let session = fixture
        .manager
        .open_session(
            SessionKind::Document,
            &"chips.a".into(),
            scopes,
            permissions,
        )
        .expect("新会话");
    let fresh = fixture
        .manager
        .open(OpenRequest {
            uri: "chips-resource://card-1/doc.bin".into(),
            session,
        })
        .await
        .expect("重开句柄");
    let bytes = fixture
        .manager
        .read_range(
            fresh.id,
            session,
            ByteRange {
                offset: 0,
                length: None,
            },
        )
        .await
        .expect("重读");
    assert_eq!(bytes, b"scope-bound".to_vec());
    let (_, full_reads, _, _, _, _) = fixture.provider.snapshot();
    assert_eq!(full_reads, 2, "随域失效后再落取（《04》§6.1 生命周期列）");
    fixture.release();
}

#[tokio::test]
async fn concurrent_full_reads_merge_via_single_flight() {
    let fixture = Arc::new(Fixture::build_with(vec![9u8; 64], true));
    let handle = fixture.open_handle().await;
    let mut tasks = Vec::new();
    for _ in 0..3 {
        let fixture = Arc::clone(&fixture);
        let handle_id = handle.id;
        tasks.push(tokio::spawn(async move {
            fixture
                .manager
                .read_range(
                    handle_id,
                    fixture.session,
                    ByteRange {
                        offset: 0,
                        length: None,
                    },
                )
                .await
                .expect("合流读取")
        }));
        tokio::task::yield_now().await;
    }
    // 首个入闸者即 SingleFlight 领队；其余两名在途者同键合流等待。
    wait_past_gate(&fixture, 1).await;
    fixture.provider.gate.add_permits(8);
    let mut results = Vec::new();
    for task in tasks {
        results.push(task.await.expect("任务收敛"));
    }
    assert!(results.iter().all(|bytes| bytes == &results[0]));
    let (_, full_reads, _, _, _, _) = fixture.provider.snapshot();
    assert_eq!(
        full_reads, 1,
        "同键并发只落一次后端读取（§6.4 SingleFlight）"
    );
    fixture.release();
}

#[tokio::test]
async fn invalidation_during_inflight_read_discards_stale_commit() {
    let fixture = Arc::new(Fixture::build_with(b"stale-risk".to_vec(), true));
    let handle = fixture.open_handle().await;
    let reader = {
        let fixture = Arc::clone(&fixture);
        let handle_id = handle.id;
        tokio::spawn(async move {
            fixture
                .manager
                .read_range(
                    handle_id,
                    fixture.session,
                    ByteRange {
                        offset: 0,
                        length: None,
                    },
                )
                .await
                .expect("在途读取允许完成（§6.3）")
        })
    };
    wait_past_gate(&fixture, 1).await;
    // 在途读取停顿时发生失效：标记先于清理。
    fixture
        .manager
        .cache()
        .invalidate_resource("card-1", "doc.bin");
    fixture.provider.gate.add_permits(4);
    let bytes = reader.await.expect("在途收敛");
    assert_eq!(bytes, b"stale-risk".to_vec(), "当前结果可完成返回");
    // 但过期结果不得驻留 L1（提交时 epoch 再校验丢弃，§6.4）。
    let store: &Arc<CacheStore> = fixture.manager.cache();
    let stale_key = CacheKey::managed("card-1", "doc.bin", "cnt-7");
    assert!(
        store.memory_get_pinned(&stale_key).is_none(),
        "过期在途结果丢弃：L1 不得驻留失效前版本条目"
    );
    fixture.release();
}
