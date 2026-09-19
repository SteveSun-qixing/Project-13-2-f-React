//! 集成测试公共支撑：可编程插件执行器、内核构造、负载构造与轮询工具。
#![allow(dead_code)]

use std::collections::VecDeque;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use chips_cordis::{
    Context, DependencySpec, Event, EventSink, Kernel, KernelError, KernelOptions, LoadRequest,
    PluginConfig, PluginRole, PluginRunner,
};
use chips_core::{PluginId, Version, VersionRange};

/// 构造依赖声明；范围用语义化版本表达式。
pub fn spec(id: &str, range: &str) -> DependencySpec {
    DependencySpec {
        id: id.to_owned(),
        range: VersionRange::parse(range).expect("测试版本范围应合法"),
    }
}

/// 解析测试版本号。
pub fn version(value: &str) -> Version {
    Version::parse(value).expect("测试版本号应合法")
}

/// 自定义 `apply` 步骤逻辑。
pub type ApplyFn = Arc<dyn Fn(&Context, &PluginConfig) -> Result<(), KernelError> + Send + Sync>;

/// 自定义 `stop` 步骤逻辑。
pub type StopFn = Arc<dyn Fn(&Context) -> Result<(), KernelError> + Send + Sync>;

/// 单次 `apply` 的行为。
pub enum ApplyStep {
    /// 立即成功。
    Ok,
    /// 立即失败（`KERNEL_APPLY_FAILED`）。
    Fail,
    /// 睡眠指定时长后成功（用于超时路径）。
    Sleep(Duration),
    /// 执行自定义逻辑。
    Run(ApplyFn),
}

/// 单次 `stop` 的行为。
pub enum StopStep {
    /// 立即成功。
    Ok,
    /// 立即失败。
    Fail,
    /// 睡眠指定时长后成功（用于超时路径）。
    Sleep(Duration),
    /// 执行自定义逻辑。
    Run(StopFn),
}

/// 可编程插件执行器；每次生命周期调用按队列顺序取出一步，队列耗尽后默认成功。
pub struct TestRunner {
    id: PluginId,
    apply_steps: Mutex<VecDeque<ApplyStep>>,
    stop_steps: Mutex<VecDeque<StopStep>>,
}

impl TestRunner {
    /// 以给定行为队列构造执行器。
    pub fn new(id: &str, apply_steps: Vec<ApplyStep>, stop_steps: Vec<StopStep>) -> Arc<Self> {
        Arc::new(Self {
            id: id.to_owned(),
            apply_steps: Mutex::new(apply_steps.into()),
            stop_steps: Mutex::new(stop_steps.into()),
        })
    }

    /// 全部生命周期调用成功的执行器。
    pub fn ok(id: &str) -> Arc<Self> {
        Self::new(id, Vec::new(), Vec::new())
    }

    /// 只定制 `apply` 每一步的执行器。
    pub fn with_apply(id: &str, steps: Vec<ApplyStep>) -> Arc<Self> {
        Self::new(id, steps, Vec::new())
    }

    /// 只定制 `stop` 每一步的执行器。
    pub fn with_stop(id: &str, steps: Vec<StopStep>) -> Arc<Self> {
        Self::new(id, Vec::new(), steps)
    }
}

#[async_trait]
impl PluginRunner for TestRunner {
    async fn apply(&self, ctx: &Context, config: &PluginConfig) -> Result<(), KernelError> {
        let step = self
            .apply_steps
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?
            .pop_front()
            .unwrap_or(ApplyStep::Ok);
        match step {
            ApplyStep::Ok => Ok(()),
            ApplyStep::Fail => Err(KernelError::ApplyFailed {
                id: self.id.clone(),
            }),
            ApplyStep::Sleep(duration) => {
                tokio::time::sleep(duration).await;
                Ok(())
            }
            ApplyStep::Run(run) => run(ctx, config),
        }
    }

    async fn stop(&self, ctx: &Context) -> Result<(), KernelError> {
        let step = self
            .stop_steps
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?
            .pop_front()
            .unwrap_or(StopStep::Ok);
        match step {
            StopStep::Ok => Ok(()),
            StopStep::Fail => Err(KernelError::ApplyFailed {
                id: self.id.clone(),
            }),
            StopStep::Sleep(duration) => {
                tokio::time::sleep(duration).await;
                Ok(())
            }
            StopStep::Run(run) => run(ctx),
        }
    }
}

/// 构造加载请求；可用版本只有当前版本。
pub fn request(
    id: &str,
    ver: &str,
    dependencies: Vec<DependencySpec>,
    runner: Arc<dyn PluginRunner>,
) -> LoadRequest {
    LoadRequest {
        id: id.to_owned(),
        version: version(ver),
        available_versions: vec![version(ver)],
        dependencies,
        role: PluginRole::Service,
        parent: None,
        runner,
    }
}

/// 以默认选项创建内核。
pub fn default_kernel() -> Kernel {
    Kernel::with_options(
        tokio::runtime::Handle::current(),
        KernelOptions::default(),
        Arc::new(chips_cordis::EmptyConfigProvider),
    )
    .expect("内核应可创建")
}

/// 以自定义选项创建内核（用于超时等策略覆盖）。
pub fn kernel_with(options: KernelOptions) -> Kernel {
    Kernel::with_options(
        tokio::runtime::Handle::current(),
        options,
        Arc::new(chips_cordis::EmptyConfigProvider),
    )
    .expect("内核应可创建")
}

/// 轮询等待条件成立；最长 2 秒。
pub async fn wait_for(mut predicate: impl FnMut() -> bool) -> bool {
    for _ in 0..200 {
        if predicate() {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    predicate()
}

/// 新建计数器。
pub fn counter() -> Arc<AtomicUsize> {
    Arc::new(AtomicUsize::new(0))
}

/// 递增计数器。
pub fn bump(counter: &AtomicUsize) {
    counter.fetch_add(1, Ordering::SeqCst);
}

/// 记录型事件入队器；验证 `emit` 的入队语义与事件信封。
#[derive(Default)]
pub struct RecordingSink {
    events: Mutex<Vec<Event>>,
}

impl RecordingSink {
    /// 已入队的事件副本。
    pub fn events(&self) -> Vec<Event> {
        self.events
            .lock()
            .map(|events| events.clone())
            .unwrap_or_default()
    }

    /// 已入队事件数量。
    pub fn len(&self) -> usize {
        self.events.lock().map(|events| events.len()).unwrap_or(0)
    }
}

impl EventSink for RecordingSink {
    fn enqueue(&self, event: Event) -> Result<(), KernelError> {
        self.events
            .lock()
            .map_err(|_| KernelError::LockPoisoned)?
            .push(event);
        Ok(())
    }
}
