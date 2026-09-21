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
//!   写提交对读者呈原子替换（temp+rename，《04.04》§4.8）。

use std::collections::BTreeMap;
use std::sync::{Arc, Condvar, Mutex, MutexGuard, PoisonError};

/// 路径锁键：作用域 ID + 规范虚拟路径文本（`VirtualPath::as_str()`）。
pub type PathLockKey = (crate::scope::ScopeId, String);

/// 锁登记表内部状态：键 → 是否占用。
type LockTable = BTreeMap<PathLockKey, bool>;

#[derive(Debug)]
struct Inner {
    table: Mutex<LockTable>,
    ready: Condvar,
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
        }))
    }

    /// 获取一组路径写锁（阻塞直到全部按升序取得；重复键去重）。
    ///
    /// 返回的 [`PathWritePermit`] 全部释放前，任何其他线程对同集合中
    /// 任一键的 [`WriteCoordinator::lock`] 都不会通过。
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

    fn park(&self) -> MutexGuard<'_, LockTable> {
        self.0.table.lock().unwrap_or_else(PoisonError::into_inner)
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
        let mut table = self
            .inner
            .table
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        // 无等待者记账：释放即摘除键位防表膨胀，唤醒全部排队者重新竞争。
        for key in &self.keys {
            table.remove(key);
        }
        drop(table);
        self.inner.ready.notify_all();
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
}
