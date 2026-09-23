//! 提交日志（写意图落盘）与启动恢复扫描（工单036 波 C2a-1，《04.04》§4.8
//! 「受控提交路径」五要素中的**提交日志**与**恢复扫描**两要素落地）。
//!
//! # 动机（勘查报告 §2.2 条 13 / §2.3 条 14、15 在册缺口）
//!
//! 既有写族（`directory.rs`）已实现「临时物 + fsync + 原子替换 + 失败清理」，
//! 但写流登记表纯进程内存：进程崩溃后「曾有哪些在途提交」无从得知，残留
//! `.chips-tmp-*` 临时物无人回收。本模块把每次目录域临时物写的**意图**先落盘
//! （prepare 相），提交终结时随原子替换后撤销（commit 相），并把中间态的判读
//! 与收敛（恢复扫描、孤儿临时物回收）收口到同一份意图账上。
//!
//! # 形态：同目录 sidecar 意图记录（prepare–commit 两相）
//!
//! - 每条在途提交对应一个意图记录文件（journal）：与临时物**同目录**、名字为
//!   临时物名追加 `.j` 后缀（`.chips-tmp-<pid>-<seq>` ↔
//!   `.chips-tmp-<pid>-<seq>.j`）——配对关系由文件名单源承载，恢复扫描不依赖
//!   记录内容可解析性；记录内容为 JSON [`CommitRecord`]（`temp` / `target` /
//!   `createdUnixMs`，相对挂载根路径，仅供事后判读与一致性锁测消费）。
//! - 写序（prepare 相先于一切临时物动作）：登记进程内在途账 → 建档 journal
//!   （write + `sync_all` + 父目录 `sync_all`，保证「临时物已建而未 rename」
//!   这一中间态在断电/崩溃后可被判读）→ 建临时物 → 写数据 → `sync_all` →
//!   `rename` 原子替换 → 删 journal（commit 相，单次 unlink，不再 fsync：
//!   终结动作丢失由下一次挂载的恢复扫描幂等收敛）。
//! - 有界 IO 口径（写侧禁无界）：一次性提交与写流建档各 +1 次建档写、
//!   +2 次 fsync（journal 文件 + 父目录项）、终结 +1 次 unlink；journal 体
//!   ≤ 千字节量级，与载荷尺寸无关（O(1) 常数）。
//!
//! # 恢复扫描（处置三态，确定性收敛）
//!
//! 挂载根进入引擎时（[`crate::directory::DirectoryProvider::attach_root`]，
//! `mount_directory` / `register_temp_scope` 两个公开入口的唯一汇聚 seam）
//! 对根做一次全树扫描（只读遍历 + 定向删除，不跟随符号链接、深度与条目数
//! 双预算封顶）：
//!
//! 1. journal 在、在途账未登记（崩溃残留）→ 同名临时物若存在即删除（目标
//!    保持旧态，与既有失败回滚语义同构），journal 撤销；
//! 2. journal 在、临时物不在（已 rename 成功但终结未及、或失败路径已清理）
//!    → 只撤销 journal，**绝不触碰目标文件**；
//! 3. 临时物在、journal 不在（无意图账支撑）→ 计 [`JournalRecoveryReport`]
//!    的 `unbacked_temp_files` 并**保留不删**——「文件存在即删」的粗暴形被
//!    禁止：本 crate 全部在册临时物创建面都先写 journal（协议内不可能出现
//!    无账临时物），无账文件即协议外对象，其归属不可判读，一律不处置。
//!
//! # 并发与锁序（与 `WriteCoordinator` 方言一致，禁第二套锁）
//!
//! - journal 的建档/撤销全部发生在既有路径写锁
//!   （[`crate::write_coord::PathWritePermit`]）覆盖窗口内（`commit_write` /
//!   `copy` 持锁落 Provider；写流锁贯穿流生命周期），本模块**不新增任何
//!   路径锁**；
//! - 进程内在途账（`static` 令牌集 + 全局序号）是叶子锁：取锁后绝不取
//!   其他锁、不跨 IO 长期持有……在途登记先于任何文件系统动作、销账后于
//!   journal 撤销，保证「journal 可见 ⇒ 在途账在册」——恢复扫描据此绝不
//!   误删本进程并发在途临时物（含同进程多管理器实例、重叠根双挂载形态）；
//! - 锁序单向：路径许可 → 在途账（叶），反向不存在（在途账内永不申请
//!   路径许可），无环。
//!
//! # 架构约束（判据边界，README 在册）
//!
//! 目录作用域根在同一时刻至多归属一个活动薯片主机进程（Host 是唯一运行时
//! 承载）；跨进程共挂同一根、由他进程以同名协议写临时物不在契约内。崩溃
//! 恢复窗口即「本进程重启后首次挂载该根」，journal 是唯一的意图权威。

use std::collections::{BTreeMap, BTreeSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

/// 临时物与意图记录的名字前缀（《04.04》§4.8 同目录隐藏临时文件形态；
/// 列举面按 `.` 前缀在册过滤）。
pub const TEMP_FILE_PREFIX: &str = ".chips-tmp-";

/// 意图记录文件相对临时物的后缀（sidecar 配对名，单源判据）。
pub const JOURNAL_FILE_SUFFIX: &str = ".j";

/// 意图记录内容的读取上限（字节；超限按损坏处置）。
pub const JOURNAL_RECORD_MAX_BYTES: u64 = 64 * 1024;

/// 恢复扫描目录树深度预算（受管虚拟路径深度在 PathGuard 侧有长度预算，
/// 本预算为真实文件系统异常形态的兜底封顶）。
pub const RECOVERY_WALK_MAX_DEPTH: usize = 32;

/// 恢复扫描条目访问预算（超限即截断遍历并在报告如实登记，不猜测处置）。
pub const RECOVERY_WALK_MAX_ENTRIES: usize = 100_000;

/// 进程级意图令牌单调序号（`pid` 前缀 + 本序号 = 全进程唯一令牌；跨管理器
/// 实例共用单一取值源，杜绝双 `DirectoryProvider` 实例同 pid 同 seq 碰撞）。
static TOKEN_SEQ: AtomicU64 = AtomicU64::new(1);

/// 进程内在途账（叶子锁：登记/销账均为短临界区，临界区内不做任何跨模块
/// 取锁与 IO）。journal 可见 ⇔ 令牌在册（销账后于 journal 撤销）。
static IN_FLIGHT: OnceLock<Mutex<BTreeSet<String>>> = OnceLock::new();

/// 分配一个全进程唯一的意图令牌（`<pid>-<seq>`，临时物名与 journal 名单源）。
#[must_use]
pub fn next_intent_token() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        TOKEN_SEQ.fetch_add(1, Ordering::Relaxed)
    )
}

fn in_flight() -> &'static Mutex<BTreeSet<String>> {
    IN_FLIGHT.get_or_init(|| Mutex::new(BTreeSet::new()))
}

/// 意图记录是否为本进程在途提交（恢复扫描的在途保护单源判据）。
#[must_use]
pub fn is_in_flight(token: &str) -> bool {
    in_flight()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .contains(token)
}

/// 落盘意图记录内容（JSON，camelCase；相对挂载根路径）。`temp` / `target`
/// 取宿主路径的 lossy 文本（恢复处置以文件名词柄配对为权威，内容仅供判读
/// 与一致性锁测，非 UTF-8 路径不致提交失败）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommitRecord {
    /// 临时物相对挂载根路径（sidecar 同目录）。
    pub temp: String,
    /// 提交目标相对挂载根路径。
    pub target: String,
    /// 建档时刻（Unix 毫秒）。
    pub created_unix_ms: u64,
}

/// 当前 Unix 毫秒时刻（不可得为 0，与 `modified_unix_seconds` 兜底口径同型）。
fn now_unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}

/// 相对挂载根路径文本（异常不在根下时回退全路径 lossy 文本，仅供判读）。
fn relative_lossy(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .into_owned()
}

/// 名字形态判定：`.chips-tmp-` 前缀 + `<数字>-<数字>` 令牌。
fn token_in_prefix(segment: &str) -> Option<&str> {
    let inner = segment.strip_prefix(TEMP_FILE_PREFIX)?;
    let (pid, seq) = inner.split_once('-')?;
    let digits_nonempty =
        |text: &str| !text.is_empty() && text.bytes().all(|byte| byte.is_ascii_digit());
    (digits_nonempty(pid) && digits_nonempty(seq)).then_some(inner)
}

/// 从 journal 文件名提取意图令牌（`.chips-tmp-<token>.j` → `<token>`）。
#[must_use]
pub fn journal_file_token(name: &str) -> Option<&str> {
    let inner = name.strip_suffix(JOURNAL_FILE_SUFFIX)?;
    token_in_prefix(inner)
}

/// 从临时物文件名提取意图令牌（`.chips-tmp-<token>` → `<token>`）。
#[must_use]
pub fn temp_file_token(name: &str) -> Option<&str> {
    token_in_prefix(name)
}

/// journal 名（同目录 sidecar：临时物名 + `.j`）。
fn journal_path_of(temp_path: &Path) -> PathBuf {
    let name = temp_path
        .file_name()
        .map(|name| format!("{}{JOURNAL_FILE_SUFFIX}", name.to_string_lossy()))
        .expect("临时物路径必有文件名（调用方构造保证）");
    temp_path.with_file_name(name)
}

/// 临时物名（由 journal 名还原 sidecar 对端）。
fn temp_path_of_journal(journal_path: &Path) -> PathBuf {
    let name = journal_path
        .file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_suffix(JOURNAL_FILE_SUFFIX))
        .map(str::to_owned)
        .expect("journal 路径必带 .j 后缀名（调用方分拣保证）");
    journal_path.with_file_name(name)
}

/// 同步父目录项（journal 建档的存在性耐久化；非 Unix 平台 std 无目录句柄
/// 语义，按空操作收口并如实登记于模块头 IO 口径）。
fn sync_dir(parent: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        let dir = File::open(parent)?;
        dir.sync_all()?;
    }
    #[cfg(not(unix))]
    {
        let _ = parent;
    }
    Ok(())
}

/// 一次在途提交的意图账票据：建档（prepare）成功即持有，Drop（commit 相
/// 终结或任何错误路径弃置）时撤销 journal 并销账。销账严格后于 journal
///  unlink 尝试，保证「journal 可见 ⇒ 在途在册」不变量。
#[derive(Debug)]
pub struct JournalTicket {
    token: String,
    journal_path: PathBuf,
    record: CommitRecord,
}

impl JournalTicket {
    /// prepare 相建档：登记在途账 → 写 journal（内容 + `sync_all` + 父目录
    /// `sync_all`）。建档任一步失败即销账并上抛 IO 错误（调用方映射
    /// `RESOURCE_WRITE_FAILED`；此时临时物尚未创建，零残留）。
    ///
    /// `root` 为挂载根（仅用于记录内容的相对路径判读文本），`temp_path` 为
    /// 预定临时物路径（sidecar 名由此派生）。
    pub fn prepare(
        root: &Path,
        token: String,
        temp_path: &Path,
        target: &Path,
    ) -> std::io::Result<Self> {
        in_flight()
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .insert(token.clone());
        let journal_path = journal_path_of(temp_path);
        let record = CommitRecord {
            temp: relative_lossy(root, temp_path),
            target: relative_lossy(root, target),
            created_unix_ms: now_unix_millis(),
        };
        let outcome: std::io::Result<()> = (|| {
            let payload = serde_json::to_vec(&record)
                .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
            let mut file = File::create(&journal_path)?;
            file.write_all(&payload)?;
            file.flush()?;
            file.sync_all()?;
            drop(file);
            let parent = temp_path
                .parent()
                .ok_or_else(|| std::io::Error::from(std::io::ErrorKind::InvalidInput))?;
            sync_dir(parent)
        })();
        if let Err(error) = outcome {
            // 建档失败：先撤 journal 半态文件（存在即删——本票据自建的失败
            // 残体，非协议对象），再销账。
            let _ = fs::remove_file(&journal_path);
            release_token(&token);
            return Err(error);
        }
        Ok(Self {
            token,
            journal_path,
            record,
        })
    }

    /// 意图令牌（`<pid>-<seq>`）。
    #[must_use]
    pub fn token(&self) -> &str {
        &self.token
    }

    /// journal 文件路径（sidecar）。
    #[must_use]
    pub fn journal_path(&self) -> &Path {
        &self.journal_path
    }

    /// 落盘意图记录内容（一致性锁测消费面）。
    #[must_use]
    pub fn record(&self) -> &CommitRecord {
        &self.record
    }
}

impl Drop for JournalTicket {
    fn drop(&mut self) {
        // commit 相终结（rename 已落定或错误路径已清理临时物）：撤销
        // journal（单次 unlink，幂等；失败留给恢复扫描收敛）→ 销账。
        let _ = fs::remove_file(&self.journal_path);
        let token = std::mem::take(&mut self.token);
        release_token(&token);
    }
}

fn release_token(token: &str) {
    in_flight()
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .remove(token);
}

/// 恢复扫描报告（挂载根一次扫描的确定性处置账目）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct JournalRecoveryReport {
    /// 撤销的意图记录数（含「仅残记录」态的终结）。
    pub removed_records: usize,
    /// 回滚删除的崩溃残留临时物数（判据 1）。
    pub reclaimed_temp_files: usize,
    /// 因本进程在途账保护而跳过的意图记录数（并发在途零误删判据）。
    pub skipped_in_flight: usize,
    /// 无意图账支撑、按判据 3 保留不删的 `.chips-tmp-*` 临时物数。
    pub unbacked_temp_files: usize,
    /// 处置过程中的 IO 失败次数（不改变挂载成败，逐项如实计数）。
    pub io_failures: usize,
    /// 遍历预算（深度/条目数）触顶截断标记。
    pub walk_truncated: bool,
}

/// 扫描分拣产物：按意图令牌索引的 journal（可多重，按令牌升序处置）与
/// 临时物路径集。
#[derive(Debug, Default)]
struct Walked {
    journals: Vec<(String, PathBuf)>,
    temps: BTreeMap<String, PathBuf>,
    io_failures: usize,
    truncated: bool,
}

/// 深度/条目双预算的只读遍历（不跟随符号链接：`entry.file_type()` 为 lstat
/// 语义，符号链接目录不下钻、符号链接文件不分类）。
fn walk_collect(root: &Path, state: &mut Walked) {
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    let mut visited = 0usize;
    while let Some((dir, depth)) = stack.pop() {
        let Ok(reader) = fs::read_dir(&dir) else {
            state.io_failures += 1;
            continue;
        };
        for entry in reader {
            let Ok(entry) = entry else {
                state.io_failures += 1;
                continue;
            };
            visited += 1;
            if visited > RECOVERY_WALK_MAX_ENTRIES {
                state.truncated = true;
                return;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            let Ok(file_type) = entry.file_type() else {
                state.io_failures += 1;
                continue;
            };
            if file_type.is_dir() {
                if depth + 1 > RECOVERY_WALK_MAX_DEPTH {
                    state.truncated = true;
                    continue;
                }
                stack.push((entry.path(), depth + 1));
                continue;
            }
            if !file_type.is_file() || !name.starts_with(TEMP_FILE_PREFIX) {
                continue;
            }
            if let Some(token) = journal_file_token(&name) {
                state.journals.push((token.to_owned(), entry.path()));
            } else if let Some(token) = temp_file_token(&name) {
                state.temps.insert(token.to_owned(), entry.path());
            }
        }
    }
}

/// 读取并解析意图记录（仅供判读；恢复处置以文件名词柄配对为权威，解析
/// 失败不影响撤销动作）。
#[must_use]
pub fn read_commit_record(journal_path: &Path) -> Option<CommitRecord> {
    let metadata = fs::metadata(journal_path).ok()?;
    if metadata.len() > JOURNAL_RECORD_MAX_BYTES {
        return None;
    }
    let bytes = fs::read(journal_path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

/// 对挂载根执行恢复扫描（模块头「处置三态」的确定性实现；`attach_root`
/// 校验通过后同步调用，公开入口可达性即 `mount_directory` /
/// `register_temp_scope`）。
#[must_use]
pub fn recover_root(root: &Path) -> JournalRecoveryReport {
    let mut report = JournalRecoveryReport::default();
    let mut walked = Walked::default();
    walk_collect(root, &mut walked);
    report.walk_truncated = walked.truncated;
    // sidecar 配对以 journal 名为权威：凡有记录的临时物一律先出无账集
    // （在途跳过、已处置、双记录形态同理），其余临时物才可能计判据 3。
    walked
        .journals
        .sort_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)));
    for (token, _) in &walked.journals {
        walked.temps.remove(token);
    }
    // 判据 1/2：逐条意图记录处置（按令牌升序，同输入必同输出）。
    for (token, journal_path) in walked.journals {
        if is_in_flight(&token) {
            report.skipped_in_flight += 1;
            continue;
        }
        // 判据 1：崩溃残留的 sidecar 临时物先删（目标保持旧态），
        // 再撤记录；判据 2：临时物不在（已提交或已回滚清理）只撤记录。
        let temp_path = temp_path_of_journal(&journal_path);
        if fs::symlink_metadata(&temp_path).is_ok_and(|metadata| metadata.is_file()) {
            match fs::remove_file(&temp_path) {
                Ok(()) => report.reclaimed_temp_files += 1,
                Err(_) => report.io_failures += 1,
            }
        }
        match fs::remove_file(&journal_path) {
            Ok(()) => report.removed_records += 1,
            Err(_) => report.io_failures += 1,
        }
    }
    // 判据 3：无意图账支撑的临时物计数保留，不删（并发他进程在途 /
    // 协议外对象均不可凭「存在即删」处置）。
    report.unbacked_temp_files = walked.temps.len();
    report.io_failures += walked.io_failures;
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(tag: &str) -> PathBuf {
        static SEQ: AtomicU64 = AtomicU64::new(0);
        let base = std::env::temp_dir().join(format!(
            "chips-journal-ut-{}-{}-{}",
            tag,
            std::process::id(),
            SEQ.fetch_add(1, Ordering::SeqCst)
        ));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).expect("夹具根必须可建");
        base
    }

    fn cleanup(base: &Path) {
        let _ = fs::remove_dir_all(base);
    }

    fn write_plain(path: &Path) {
        fs::write(path, b"x").expect("夹具文件必须可写");
    }

    #[test]
    fn test_token_and_name_shapes_are_single_sourced() {
        let token = next_intent_token();
        let temp_name = format!("{TEMP_FILE_PREFIX}{token}");
        let journal_name = format!("{temp_name}{JOURNAL_FILE_SUFFIX}");
        assert_eq!(
            temp_file_token(&temp_name).map(str::to_owned),
            Some(token.clone())
        );
        assert_eq!(
            journal_file_token(&journal_name).map(str::to_owned),
            Some(token)
        );
        // 非在册形态一律不认（防误伤协议外对象）。
        assert!(temp_file_token(".chips-tmp-a-b").is_none());
        assert!(temp_file_token(".chips-tmp-1").is_none());
        assert!(temp_file_token(".chips-tmp-1-2-3").is_none());
        assert!(journal_file_token(".chips-tmp-1-2").is_none());
        assert!(journal_file_token(".chips-tmp-1-2.txt").is_none());
        // sidecar 路径互逆。
        let temp_path = Path::new("/root/sub/.chips-tmp-7-8");
        let journal = journal_path_of(temp_path);
        assert_eq!(journal, Path::new("/root/sub/.chips-tmp-7-8.j"));
        assert_eq!(temp_path_of_journal(&journal), temp_path);
    }

    #[test]
    fn test_prepare_persists_record_and_drop_undoes_it() {
        let base = scratch("prepare");
        let token = next_intent_token();
        let temp_path = base.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let journal = journal_path_of(&temp_path);
        let target = base.join("out.txt");
        let ticket = JournalTicket::prepare(&base, token.clone(), &temp_path, &target)
            .expect("建档必须成功");
        assert!(is_in_flight(ticket.token()));
        assert!(journal.is_file(), "prepare 相 journal 必须先于临时物存在");
        let record = read_commit_record(&journal).expect("在册内容必可解析");
        assert_eq!(
            record.temp,
            temp_path.file_name().unwrap().to_string_lossy()
        );
        assert_eq!(record.target, "out.txt");
        assert!(!temp_path.exists(), "prepare 不创建临时物");
        let token_seen = ticket.token().to_owned();
        drop(ticket);
        assert!(!journal.exists(), "票据弃置即撤 journal");
        assert!(!is_in_flight(&token_seen), "票据弃置即销在途账");
        cleanup(&base);
    }

    #[test]
    fn test_recover_crash_state_removes_temp_and_journal_and_keeps_target() {
        let base = scratch("crash");
        write_plain(&base.join("target.txt"));
        let token = "900001-1".to_owned();
        let temp = base.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let journal = journal_path_of(&temp);
        write_plain(&temp);
        fs::write(
            &journal,
            serde_json::to_vec(&CommitRecord {
                temp: format!("{TEMP_FILE_PREFIX}{token}"),
                target: "target.txt".to_owned(),
                created_unix_ms: 1,
            })
            .expect("夹具记录必可序列化"),
        )
        .expect("夹具 journal 必须可写");
        let report = recover_root(&base);
        assert_eq!(report.removed_records, 1);
        assert_eq!(report.reclaimed_temp_files, 1);
        assert_eq!(report.unbacked_temp_files, 0);
        assert_eq!(report.io_failures, 0);
        assert!(!temp.exists() && !journal.exists(), "崩溃中间态必须收敛");
        assert!(base.join("target.txt").is_file(), "目标保持旧态");
        cleanup(&base);
    }

    #[test]
    fn test_recover_committed_but_unfinalized_journal_never_touches_target() {
        let base = scratch("unfinalized");
        write_plain(&base.join("target.txt"));
        let token = "900002-1".to_owned();
        let temp = base.join(format!("{TEMP_FILE_PREFIX}{token}"));
        fs::write(journal_path_of(&temp), b"not-json-at-all").expect("夹具必可写");
        let report = recover_root(&base);
        assert_eq!(report.removed_records, 1, "损坏记录仍须终结");
        assert_eq!(report.reclaimed_temp_files, 0);
        assert!(base.join("target.txt").is_file(), "已提交态绝不误删目标");
        assert!(!journal_path_of(&temp).exists());
        cleanup(&base);
    }

    #[test]
    fn test_recover_keeps_unbacked_and_in_flight_temps() {
        let base = scratch("keep");
        // 无意图账支撑：保留不删、如实计数。
        let unbacked = base.join(".chips-tmp-900003-1");
        write_plain(&unbacked);
        // 本进程在途：票据在册即整体跳过。
        let token = next_intent_token();
        let temp = base.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let journal = journal_path_of(&temp);
        let ticket = JournalTicket::prepare(&base, token.clone(), &temp, &base.join("live.txt"))
            .expect("建档必须成功");
        write_plain(&temp);
        let report = recover_root(&base);
        assert_eq!(report.skipped_in_flight, 1, "在途记录必须被在途账保护");
        assert_eq!(report.unbacked_temp_files, 1);
        assert_eq!(report.removed_records, 0);
        assert!(unbacked.is_file() && temp.is_file() && journal.is_file());
        drop(ticket);
        assert!(!journal.exists());
        let _ = fs::remove_file(&temp);
        let after = recover_root(&base);
        assert_eq!(after.unbacked_temp_files, 1, "销账后无账临时物仍保留不删");
        cleanup(&base);
    }

    #[test]
    fn test_recover_walk_skips_symlinks_and_respects_budget_shape() {
        let base = scratch("walk");
        let outside = scratch("walk-out");
        write_plain(&outside.join("secret"));
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, base.join("link-dir")).expect("夹具链接必须可建");
        let deep = base.join("a");
        fs::create_dir_all(&deep).expect("子目录必须可建");
        let token = "900004-1".to_owned();
        let temp = deep.join(format!("{TEMP_FILE_PREFIX}{token}"));
        write_plain(&temp);
        fs::write(journal_path_of(&temp), b"{}").expect("夹具必可写");
        let report = recover_root(&base);
        assert_eq!(report.removed_records, 1, "子目录内记录同样收敛");
        assert!(!temp.exists());
        assert!(outside.join("secret").is_file(), "符号链接目录不得下钻处置");
        cleanup(&base);
        cleanup(&outside);
    }

    #[test]
    fn test_recover_walk_flags_depth_budget_truncation() {
        // 深于 `RECOVERY_WALK_MAX_DEPTH` 的层级不下钻：截断如实翻旗，
        // 预算外记录不处置（有界 IO 承诺的锁测）。
        let base = scratch("depth");
        let mut deep = base.clone();
        for level in 0..=RECOVERY_WALK_MAX_DEPTH {
            deep = deep.join(format!("d{level}"));
        }
        fs::create_dir_all(&deep).expect("深目录链必须可建");
        let temp = deep.join(".chips-tmp-900005-1");
        let journal = journal_path_of(&temp);
        write_plain(&temp);
        fs::write(&journal, b"{}").expect("夹具必可写");
        let report = recover_root(&base);
        assert!(report.walk_truncated, "超预算深度必须翻截断旗");
        assert_eq!(report.removed_records, 0, "预算外记录不得处置");
        assert!(journal.is_file() && temp.is_file());
        cleanup(&base);
    }

    #[test]
    fn test_read_commit_record_rejects_oversized_payload() {
        // 超 `JOURNAL_RECORD_MAX_BYTES` 的记录不解析（防御读入预算），
        // 按判读面无账可返回 None；处置仍按文件名词柄走。
        let base = scratch("oversize");
        let journal = base.join(format!("{TEMP_FILE_PREFIX}900006-1{JOURNAL_FILE_SUFFIX}"));
        fs::write(&journal, vec![b' '; JOURNAL_RECORD_MAX_BYTES as usize + 1]).expect("夹具必可写");
        assert!(read_commit_record(&journal).is_none(), "超限记录不解析");
        let small = base.join(format!("{TEMP_FILE_PREFIX}900006-2{JOURNAL_FILE_SUFFIX}"));
        fs::write(&small, b"{").expect("夹具必可写");
        assert!(read_commit_record(&small).is_none(), "半写残记录不解析");
        assert!(
            read_commit_record(&base.join("absent.j")).is_none(),
            "缺席记录无判读"
        );
        cleanup(&base);
    }

    #[cfg(unix)]
    #[test]
    fn test_recover_counts_delete_io_failures() {
        // 只读目录（r-x）内 unlink 必败：临时物与记录处置失败各计一笔
        // io_failures，账目不虚增（恢复面不产错、如实计数的锁测）。
        use std::os::unix::fs::PermissionsExt;
        let base = scratch("delerr");
        let locked = base.join("locked");
        fs::create_dir_all(&locked).expect("夹具子目录必须可建");
        let temp = locked.join(".chips-tmp-900007-1");
        let journal = journal_path_of(&temp);
        write_plain(&temp);
        fs::write(&journal, b"junk").expect("夹具必可写");
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o500)).expect("chmod 必须成功");
        let report = recover_root(&locked);
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o700))
            .expect("chmod 复原必须成功");
        assert_eq!(report.io_failures, 2, "删除失败逐项计数：{report:?}");
        assert_eq!(report.removed_records, 0);
        assert_eq!(report.reclaimed_temp_files, 0);
        assert!(journal.is_file() && temp.is_file(), "处置失败不谎报");
        cleanup(&base);
    }

    #[test]
    fn test_prepare_failure_leaves_no_ledger_or_token() {
        // 建档 IO 失败（父路径不存在 → 创建即败）：销账与 journal 清理
        // 同步完成，错误原样上抛供调用方映射在册写失败码。
        let base = scratch("fail");
        let notdir = base.join("afile");
        fs::write(&notdir, b"x").expect("夹具文件必须可写");
        let token = next_intent_token();
        let temp = notdir.join(format!("{TEMP_FILE_PREFIX}{token}"));
        let _error = JournalTicket::prepare(&base, token.clone(), &temp, &base.join("out.txt"))
            .expect_err("父路径非目录，建档必败");
        assert!(!journal_path_of(&temp).exists(), "败途不留半态 journal");
        assert!(!is_in_flight(&token), "败途必销在途账");
        cleanup(&base);
    }
}
