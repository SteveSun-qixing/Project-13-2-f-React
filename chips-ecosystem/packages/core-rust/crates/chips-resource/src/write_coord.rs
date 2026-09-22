//! `WriteCoordinator`：路径写锁协调器（段二 B3，《04.04》§4.8/§4.9、
//! 《04.13》§13-3「写路径唯一」）。
//!
//! 口径：
//!
//! - 同一规范路径任一时刻至多一个写入者（single writer）；后到者排队等待
//!   （一成一等），不设超时（超时口径未在册，《06》§7.2 `RESOURCE_BUSY`
//!   只裁句柄流占用臂，写锁等待不复用它——findings 登记）；
//! - 覆盖面为 Manager 层公开内部面的**全部**目录写族提交点：
//!   `commit_write` / `delete` / `rename` / `copy`（目标）/
//!   `create_directory` / `open_write_stream → commit_write_stream /
//!   abort_write_stream`（流生命周期全程持锁）；
//! - rename A→B 同时锁 {A, B}：与对 B 的并发写互斥（《04.04》§4.9）；
//! - 多键按升序排队获取，等待边只指向更大键，锁序无环（无死锁构造性论证）；
//! - 读取面（`open`/`stat`/`read_range`/`read_chunk`）不取写锁：句柄流
//!   占用互斥仍由 `HandleTable` 以 `RESOURCE_BUSY` 承载（B2 冻结语义），
//!   写提交对读者呈原子替换（temp+rename，《04.04》§4.8）；
//! - 异步形裁定（#151 残账，段三 #157 收口）：Manager 异步写族入口
//!   （`commit_write`/`delete`/`rename`/`copy`/`create_directory`）一律经
//!   [`WriteCoordinator::lock_async`] 排队——同步臂等待依赖 `Condvar::wait`，
//!   在 async 上下文占用执行器线程等待会饿死同线程上的持锁任务（单线程
//!   runtime 下为永久死锁）；异步臂以 `tokio::sync::Notify` 登记唤醒、等待
//!   期间让出线程，与同步臂共用同一锁表互斥。同步签名入口
//!   （`open_write_stream`，《03.07》§7.1 同步面）维持同步臂形态。

use std::collections::BTreeMap;
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError};

use tokio::sync::Notify;

/// 路径锁键：作用域 ID + 规范虚拟路径文本（`VirtualPath::as_str()`）。
pub type PathLockKey = (crate::scope::ScopeId, String);

/// 锁登记表内部状态：键 → 是否占用。
type LockTable = BTreeMap<PathLockKey, bool>;

#[derive(Debug)]
struct Inner {
    table: Mutex<LockTable>,
    /// 同步臂唤醒面（`Condvar::wait` 队列）。
    ready: Condvar,
    /// 异步臂唤醒面（`Notify` 登记式唤醒，不占线程）。
    async_ready: Notify,
}

/// 路径写锁协调器（`Arc` 语义：许可可随流记录/守卫跨管理器结构存活）。
#[derive(Debug, Clone)]
pub struct WriteCoordinator(Arc<Inner>);

impl Default for WriteCoordinator {
    fn default() -> Self {
        Self::new()
    }
}

impl WriteCoordinator {
    /// 构造空协调器。
    #[must_use]
    pub fn new() -> Self {
        Self(Arc::new(Inner {
            table: Mutex::new(LockTable::new()),
            ready: Condvar::new(),
            async_ready: Notify::new(),
        }))
    }

    /// 获取一组路径写锁（阻塞直到全部按升序取得；重复键去重）。
    ///
    /// 返回的 [`PathWritePermit`] 全部释放前，任何其他线程对同集合中
    /// 任一键的 [`WriteCoordinator::lock`] 都不会通过。
    ///
    /// 同步签名专用；async 上下文使用 [`WriteCoordinator::lock_async`]
    /// （模块头「异步形裁定」）。
    pub fn lock(&self, keys: impl IntoIterator<Item = PathLockKey>) -> Arc<PathWritePermit> {
        let mut ordered: Vec<PathLockKey> = keys.into_iter().collect();
        ordered.sort();
        ordered.dedup();
        for key in &ordered {
            // 逐键排队获取；已取得的更小额外键在本线程持有中，等待边
            // 只向更大键推进，故无环无死锁。
            let mut table = self.park();
            loop {
                let occupied = table.get(key).copied().unwrap_or(false);
                if !occupied {
                    table.insert(key.clone(), true);
                    break;
                }
                table = self
                    .0
                    .ready
                    .wait(table)
                    .unwrap_or_else(PoisonError::into_inner);
            }
        }
        Arc::new(PathWritePermit {
            inner: Arc::clone(&self.0),
            keys: ordered,
        })
    }

    /// 异步获取一组路径写锁（与 [`WriteCoordinator::lock`] 同规范：升序
    /// 排队、去重、单写者；两臂共用同一锁表，互斥语义跨臂成立）。
    ///
    /// 等待经 `tokio::sync::Notify` 登记唤醒，不占用执行器线程；外层任务
    /// 在等待后续键时被取消时，已取得的前缀键随回滚守卫即时归还（取消安全，
    /// 异步面特有；同步臂线程不可取消、无此需求）。
    pub async fn lock_async(
        &self,
        keys: impl IntoIterator<Item = PathLockKey>,
    ) -> Arc<PathWritePermit> {
        let mut ordered: Vec<PathLockKey> = keys.into_iter().collect();
        ordered.sort();
        ordered.dedup();
        let mut rollback = KeyRollback {
            inner: Arc::clone(&self.0),
            keys: Vec::with_capacity(ordered.len()),
        };
        for key in &ordered {
            loop {
                // 先登记唤醒订阅再检查锁表：登记与检查之间若发生释放，
                // 已 enable 的订阅吃掉通知、随后即通过获取尝试，无丢唤醒。
                let notified = self.0.async_ready.notified();
                tokio::pin!(notified);
                notified.as_mut().enable();
                if self.try_acquire(key) {
                    rollback.keys.push(key.clone());
                    break;
                }
                notified.await;
            }
        }
        Arc::new(PathWritePermit {
            inner: Arc::clone(&self.0),
            keys: std::mem::take(&mut rollback.keys),
        })
    }

    /// 单次锁表获取尝试：键空闲则置占用位并返回 `true`。锁表同步取放，
    /// 任何等待形态（同步 `Condvar` / 异步 `Notify`）都不持锁表守卫。
    fn try_acquire(&self, key: &PathLockKey) -> bool {
        let mut table = self.park();
        if table.get(key).copied().unwrap_or(false) {
            return false;
        }
        table.insert(key.clone(), true);
        true
    }

    fn park(&self) -> MutexGuard<'_, LockTable> {
        self.0.table.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// 释放一组键并唤醒两臂排队者（无等待者记账：释放即摘除键位防表膨胀）。
fn release_keys(inner: &Arc<Inner>, keys: &[PathLockKey]) {
    {
        let mut table = inner.table.lock().unwrap_or_else(PoisonError::into_inner);
        for key in keys {
            table.remove(key);
        }
    }
    inner.ready.notify_all();
    inner.async_ready.notify_waiters();
}

/// 异步臂半获取回滚守卫：`lock_async` 在等待后续键期间被取消时，已取得的
/// 前缀键随本守卫 `Drop` 归还（正常完成路径键已移交给 [`PathWritePermit`]，
/// 本守卫持空集直接放行）。
#[derive(Debug)]
struct KeyRollback {
    inner: Arc<Inner>,
    keys: Vec<PathLockKey>,
}

impl Drop for KeyRollback {
    fn drop(&mut self) {
        if self.keys.is_empty() {
            return;
        }
        let keys = std::mem::take(&mut self.keys);
        release_keys(&self.inner, &keys);
    }
}

/// 写锁许可：Drop 时释放全部键并唤醒排队者。
#[derive(Debug)]
pub struct PathWritePermit {
    inner: Arc<Inner>,
    keys: Vec<PathLockKey>,
}

impl Drop for PathWritePermit {
    fn drop(&mut self) {
        release_keys(&self.inner, &self.keys);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(path: &str) -> PathLockKey {
        ("workspace-1".to_owned(), path.to_owned())
    }

    #[test]
    fn test_same_key_serializes_and_different_keys_do_not_block() {
        let coordinator = Arc::new(WriteCoordinator::new());
        let permit = coordinator.lock([key("a.txt")]);
        {
            let coordinator = Arc::clone(&coordinator);
            let acquired = Arc::new(std::sync::atomic::AtomicBool::new(false));
            let flag = Arc::clone(&acquired);
            let handle = std::thread::spawn(move || {
                let _guard = coordinator.lock([key("a.txt")]);
                flag.store(true, std::sync::atomic::Ordering::SeqCst);
            });
            std::thread::sleep(std::time::Duration::from_millis(50));
            assert!(
                !acquired.load(std::sync::atomic::Ordering::SeqCst),
                "同键在许可存活期间不得放行第二写者"
            );
            drop(permit);
            handle.join().expect("等待线程必须最终取得锁");
        }
        // 不同键互不排斥：持有 a 时对 b 的锁即刻通过。
        let permit_a = coordinator.lock([key("a.txt")]);
        let permit_b = coordinator.lock([key("b.txt")]);
        assert!(!permit_a.keys.is_empty() && !permit_b.keys.is_empty());
    }

    #[test]
    fn test_multi_key_acquisition_and_release() {
        let coordinator = WriteCoordinator::new();
        // rename {A, B} 双键：释放前对 B 单键不得通过。
        let rename_guard = coordinator.lock([key("b.txt"), key("a.txt")]);
        let coordinator2 = {
            let inner = Arc::clone(&coordinator.0);
            std::thread::spawn(move || {
                let coord = WriteCoordinator(inner);
                let _write_guard = coord.lock([key("b.txt")]);
                true
            })
        };
        std::thread::sleep(std::time::Duration::from_millis(50));
        drop(rename_guard);
        assert!(coordinator2.join().expect("被排斥写者释放后放行"));
    }

    #[tokio::test]
    async fn test_lock_async_serializes_same_key_without_starving_executor() {
        // 异步形收口锁测①（#151 残账判定基准，单线程 runtime）：async 臂
        // 等待不得占用执行器线程——持锁方与排队方靠任务切换推进；若回归为
        // 同步 Condvar 等待，排队任务饿死线程、释放点永不可达（本测试挂死）。
        let coordinator = Arc::new(WriteCoordinator::new());
        let permit = coordinator.lock_async([key("a.txt")]).await;
        let (tx, mut rx) = tokio::sync::oneshot::channel();
        let waiter = {
            let coordinator = Arc::clone(&coordinator);
            tokio::spawn(async move {
                let _guard = coordinator.lock_async([key("a.txt")]).await;
                let _ = tx.send(());
            })
        };
        for _ in 0..8 {
            tokio::task::yield_now().await;
        }
        assert!(rx.try_recv().is_err(), "同键在许可存活期间不得放行第二写者");
        drop(permit);
        rx.await.expect("释放后异步排队者必须放行");
        waiter.await.expect("排队任务不得 panic");
    }

    #[tokio::test]
    async fn test_lock_async_sorts_dedups_and_occupies_all_keys() {
        // 异步形收口锁测②：升序 + 去重规范与同步臂同形；任一键占用即排队。
        let coordinator = Arc::new(WriteCoordinator::new());
        let permit = coordinator
            .lock_async([key("b.txt"), key("a.txt"), key("b.txt")])
            .await;
        assert_eq!(permit.keys, vec![key("a.txt"), key("b.txt")], "升序 + 去重");
        let (tx, mut rx) = tokio::sync::oneshot::channel();
        let waiter = {
            let coordinator = Arc::clone(&coordinator);
            tokio::spawn(async move {
                let _guard = coordinator.lock_async([key("b.txt")]).await;
                let _ = tx.send(());
            })
        };
        for _ in 0..8 {
            tokio::task::yield_now().await;
        }
        assert!(rx.try_recv().is_err(), "b 被占用时同键排队不得放行");
        drop(permit);
        rx.await.expect("全键释放后放行");
        waiter.await.expect("排队任务不得 panic");
    }

    #[tokio::test]
    async fn test_lock_async_waits_for_sync_holder_and_rolls_back_on_cancel() {
        // 异步形收口锁测③：跨臂互斥 + 取消安全。OS 线程以同步臂持 b；
        // 异步任务按升序取 {a, b}：先取得 a、停在 b 的异步等待上（不占线程）；
        // 取消该任务必须把已取得的 a 随回滚守卫归还，不得留下半获取锁位。
        let coordinator = Arc::new(WriteCoordinator::new());
        let (busy_tx, busy_rx) = std::sync::mpsc::channel();
        let (release_tx, release_rx) = std::sync::mpsc::channel();
        let holder = {
            let coordinator = Arc::clone(&coordinator);
            std::thread::spawn(move || {
                let permit = coordinator.lock([key("b.txt")]);
                busy_tx.send(()).expect("同步持锁方信号必达");
                release_rx.recv().expect("同步持锁方接收释放信号");
                drop(permit);
            })
        };
        busy_rx.recv().expect("b 必须已被同步臂占用");
        let partial = {
            let coordinator = Arc::clone(&coordinator);
            tokio::spawn(async move { coordinator.lock_async([key("a.txt"), key("b.txt")]).await })
        };
        // 唯一让出点：任务首轮 poll 内 a 已同步取得、停在 b 的异步等待上。
        tokio::task::yield_now().await;
        partial.abort();
        let cancelled = partial.await.expect_err("已取消任务必返回 JoinError");
        assert!(cancelled.is_cancelled(), "取消形态锁定：{cancelled}");
        tokio::task::yield_now().await;
        release_tx.send(()).expect("释放信号必达");
        holder.join().expect("同步持锁线程不得 panic");
        // 回滚生效则 a、b 均可立即再取（半获取泄漏时本行永挂）。
        let both = coordinator.lock_async([key("a.txt"), key("b.txt")]).await;
        assert_eq!(both.keys.len(), 2, "两键均须已归还");
    }

    #[tokio::test]
    async fn test_lock_async_holder_blocks_sync_waiter_until_release() {
        // 异步形收口锁测④：异步臂持锁对同步臂排队者同样互斥。
        let coordinator = Arc::new(WriteCoordinator::new());
        let permit = coordinator.lock_async([key("a.txt")]).await;
        let (busy_tx, busy_rx) = std::sync::mpsc::channel();
        let waiter = {
            let coordinator = Arc::clone(&coordinator);
            std::thread::spawn(move || {
                let _guard = coordinator.lock([key("a.txt")]);
                let _ = busy_tx.send(());
            })
        };
        assert!(
            busy_rx
                .recv_timeout(std::time::Duration::from_millis(50))
                .is_err(),
            "异步臂许可存活期间同步排队者不得放行"
        );
        drop(permit);
        busy_rx.recv().expect("释放后同步排队者放行");
        waiter.join().expect("同步等待线程不得 panic");
    }
}
