#!/usr/bin/env python3
"""薯片生态·重构台账工具。

用法：
  python3 重构大计划/工具/重构台账.py scan            # 扫描全部旧仓库/旧文档库，登记文件与符号（已有符号裁决时需 --force）
  python3 重构大计划/工具/重构台账.py mark-old        # 为每个旧仓库写入 旧版-标记.md
  python3 重构大计划/工具/重构台账.py init-workspace  # 创建 chips-ecosystem/ 新工作区骨架
  python3 重构大计划/工具/重构台账.py stats           # 统计（仓库/状态/裁决/类别/符号进度）
  python3 重构大计划/工具/重构台账.py next -n 20      # 取下一批待评估文件（可按 repo/category/ext 过滤）
  python3 重构大计划/工具/重构台账.py dispose --file <id> --disposition 重写 --target <path> --owner <sid>
  python3 重构大计划/工具/重构台账.py report --repo <id>  # 生成仓库重构报告骨架

批量与符号级判定（并行裁决闸口）：
  python3 重构大计划/工具/重构台账.py claim --owner ledger-host-scaffold --repo Chips-Host
  python3 重构大计划/工具/重构台账.py dispose-batch --owner ledger-host-scaffold --disposition 废弃 \\
      --notes "旧 Store 已被 Cordis 能力面替代" --id-file /tmp/ids.txt
  python3 重构大计划/工具/重构台账.py dispose-batch --owner ledger-host-scaffold --disposition 归档 \\
      --notes "过程材料" --repo Chips-Host --dir src/utils
  python3 重构大计划/工具/重构台账.py symbols --file 1234
  python3 重构大计划/工具/重构台账.py symbol-dispose --owner ledger-host-scaffold --file 1234 \\
      --disposition 迁移 --target "chips-ecosystem/packages/host/src/x.ts"
  python3 重构大计划/工具/重构台账.py symbol-dispose --owner ledger-host-scaffold --symbol 88,89,90 \\
      --disposition 重写 --target "chips-ecosystem/packages/host/src/y.ts" --notes "按文档库权威设计"
  python3 重构大计划/工具/重构台账.py verify            # 一致性体检（幻想 target/孤儿行/sweep 一致性 → 退出码 3）
  python3 重构大计划/工具/重构台账.py verify --strict    # 收口期：连“迁移/重写 规划落点未落地”一起清零
  python3 重构大计划/工具/重构台账.py release --owner tool-selftest   # 归还认领 / 返工复位

符号复裁通道（工单032 通道②：已裁决符号的跨路精确点名复裁）：
  python3 重构大计划/工具/重构台账.py symbol-redecide --owner ledger-matrix-gap \\
      --from-owner ledger-sym-office-c --symbol 6591,6592 --append-notes "<收口句>" --write
      # 精确点名两选一：--symbol <symbols.id 清单> 或 --notes-like <含字面文本的精确条件（须 --repo 限定）>；
      # 机器互斥保留：仅 files.owner / symbols.wave_owner 命中 --from-owner 点名原裁决路的符号可改写，
      # 其余路裁决一律拒绝；未裁决符号不走本通道；默认 dry-run 预览，--write 才落库

增量登记通道（工单032 通道①：限定范围的 files+symbols 增量 INSERT，不重建、不触碰已裁决行）：
  python3 重构大计划/工具/重构台账.py scan-incr --repo Chips-Office --dir vendor \\
      --allow-excluded vendor --owner ledger-matrix-gap [--write]
      # --allow-excluded 在本登记范围内显式覆盖 EXCLUDE_DIRS 的目录名排除（如 vendor）；
      # 新增文件行直接归 owner（status=进行中），新增符号行打 wave_owner；默认 dry-run，--write 才落库

符号波认领与继承批量面（symbols.wave_owner 模型，主智能体 W2 裁决口径）：
  python3 重构大计划/工具/重构台账.py symbols-claim --owner sweep-host-expand --repo Chips-Host \\
      --class expand -n 500        # 只对未裁决且未认领的符号置 wave_owner；按仓+类别保证并行路互斥
  python3 重构大计划/工具/重构台账.py symbol-sweep --owner sweep-host-expand [--repo R]
      # 本 owner 已认领的“继承类”符号批量镜像文件裁决落库；默认 dry-run，--write 才落库；展开类一律拒绝并计数报告

迁移波三段生命周期通道（W3-P1-3 波1：勘查稿 #137 第七节裁定「方案 C：三独立只读通道+回执即闸，
set-status 为唯一新增最小写通道」；W4 逐仓准出=preflight+closure 该仓 0 红，W7 终验=全库 closure --strict 0 红+回执归档）：
  python3 重构台账.py preflight --repo Chips-BaseCardPlugin[,Chips-Ui] [--json] [--receipt /tmp/r.json]
      # 迁移前核对（只读库+只读磁盘）：双零前置/源仓快照漂移/target 归一化/02 映射一致性
      # （常量↔02 表自检，两处分叉即红）/两红线机检（凭据三段断言+永不入库四断言）/verify 同源判据仓级切片；
      # 红项退出码 3，--json 出机读回执、--receipt 落回执文件（人审闭环载体）
  python3 重构台账.py migrate-manifest --repo Chips-BaseCardPlugin [--out DIR] [--check-dest]
      # 迁移中执行清单（只读库、可写清单文件）：按仓导出 迁移+重写 files 行+展开符号计数，
      # 经归一化产 canonical 落点，出 TSV/JSON/by-zone 分组；头部嵌行数=DB 命中自检行；
      # --check-dest 做同名/多源同目标冲突预检（server/ 未建落点降 WARN）
  python3 重构台账.py closure [--repo R] [--matrix GLOB] [--json] [--strict]
      # 迁移后闭环校验+矩阵闭合闸（只读）：(a)落点实落（含符号锚段，重写行点名任务豁免）
      # (b)矩阵 §一 计数勾稽+证据路径存在性 (c)残留扫描（凭据/废弃归档同名/未在册顶层目录）
      # (d)--strict 下迁移/重写未到已验证计红；双零残留终口径=待评估0+幻想target0+残留0
      # （待评估>0 落红 PENDING-NOT-ZERO，红触发面与 preflight 双零前置对称，工单048 #162 裁定=补）
  python3 重构台账.py set-status --owner exec-wave-x --id-file /tmp/ids.txt --status 已验证 --evidence "包级测试通过"
      # 执行波回写的唯一最小写通道：仅 owner 原路回写 status（进行中/已完成/已验证）与 notes 追加，
      # 禁碰 disposition/target；命中行含任何非本 owner 行即越权整批拒绝（零写入、退出码 5）

退出码：0 成功；2 参数错误；3 verify 发现异常；4 数据库锁定重试失败；5 无匹配行 / 越权 / 安全闸口拒绝。
过程留痕：所有写操作追加记录到 `重构大计划/台账操作.log`。
"""

import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # 重构大计划/
ROOT = os.path.dirname(BASE)
DB = os.path.join(BASE, "重构台账.db")
NEW_WS = os.path.join(ROOT, "chips-ecosystem")

EXCLUDE_DIRS = {
    "node_modules", ".git", "dist", "build", "out", "target", "coverage",
    ".vite", ".next", ".turbo", ".cache", ".parcel-cache", "test-results",
    ".pnpm-store", "vendor",
}
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".css", ".scss", ".html"}
SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=8000;
CREATE TABLE IF NOT EXISTS repos (
  id TEXT PRIMARY KEY, name TEXT, path TEXT, kind TEXT,
  file_count INTEGER DEFAULT 0, status TEXT DEFAULT '旧版', marked_at TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT, rel_path TEXT, ext TEXT, size INTEGER, lines INTEGER, sha1 TEXT,
  category TEXT, status TEXT DEFAULT '待评估', disposition TEXT, target_path TEXT,
  owner TEXT, wave TEXT, notes TEXT, UNIQUE(repo_id, rel_path)
);
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER, kind TEXT, name TEXT, line INTEGER, exported INTEGER,
  status TEXT DEFAULT '待评估', disposition TEXT, target TEXT, notes TEXT,
  wave_owner TEXT            -- 符号波认领标识（NULL=未认领）；W2 新增列，不改任何既有列语义
);
CREATE TABLE IF NOT EXISTS waves (
  id TEXT PRIMARY KEY, name TEXT, goal TEXT, status TEXT, started_at TEXT, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY, wave_id TEXT, title TEXT, scope TEXT, owner TEXT,
  status TEXT DEFAULT '待开工', deps TEXT, log_path TEXT,
  started_at TEXT, finished_at TEXT, evidence TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo_id);
-- 以下为批量裁决/符号判定引入的**新增索引**（不改任何列语义，只加速认领与符号进度核算）
CREATE INDEX IF NOT EXISTS idx_files_owner_status ON files(owner, status);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_wave_owner ON symbols(wave_owner);
"""

#: 供 `ensure_indexes()` 幂等补建的增量列与增量索引（所有子命令执行前统一补建；
#: `scan` 走整段 SCHEMA 建全新库，增量补建保证既有库缺列时索引可创建）
INCREMENTAL_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_files_owner_status ON files(owner, status);",
    "CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);",
    "CREATE INDEX IF NOT EXISTS idx_symbols_wave_owner ON symbols(wave_owner);",
)

#: 符号波增量的**新增列**（与增量索引同纪律：只加列，不删列、不改任何既有列语义）；
#: 对既有库由 `ensure_indexes()` 检测后 ALTER TABLE 补建。
INCREMENTAL_COLUMNS = (
    ("symbols", "wave_owner", "ALTER TABLE symbols ADD COLUMN wave_owner TEXT"),
)

TS_SYM = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const|enum|let)\s+([A-Za-z_$][\w$]*)",
    re.M,
)
TS_FN = re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.M)
RS_SYM = re.compile(r"^\s*pub\s+(?:async\s+)?(fn|struct|enum|trait|const|type|mod)\s+(\w+)", re.M)

# ---- 批量裁决与符号级判定：口径常量 ----

OP_LOG = os.path.join(BASE, "台账操作.log")

#: 五种合法裁决（与《01-文件台账与消灭流程.md》§二 表格一致）
VALID_DISPOSITIONS = ("迁移", "重写", "保留设计", "废弃", "归档")
#: dispose-batch 允许回写的文件状态（schema `status` 枚举的裁决期子集）
DISPOSE_STATUSES = ("已裁决", "进行中", "已完成", "已验证")

#: 符号波口径（主智能体 W2 裁决）：展开类=迁移/重写文件的符号，须逐符号真判定；
#: 继承类=其余已裁决文件的符号，disposition 镜像所属文件裁决。
EXPAND_DISPOSITIONS = ("迁移", "重写")
#: symbols-claim --class 到 SQL 条件片段的映射（作用于所属文件 f.disposition）
SYMBOL_CLASS_COND = {
    "expand": "f.disposition IN ('%s')" % "','".join(EXPAND_DISPOSITIONS),
    "inherit": "f.disposition IS NOT NULL AND f.disposition NOT IN ('%s')" % "','".join(EXPAND_DISPOSITIONS),
    "all": "f.disposition IS NOT NULL",
}
#: symbol-sweep 继承落库的 notes 固定句式
SWEEP_NOTE_TMPL = "按文件裁决继承（symbol-sweep，源文件 disposition=%s）"
#: 归档继承且文件无说明性 target 时的兜底写法（与既有文件级归档口径一致）
SWEEP_ARCHIVE_FALLBACK_TARGET = "就近归档"

#: verify 需要校验落盘存在性的 target 前缀（新工作区 / 权威文档库 / 本目录产物）
TARGET_CHECK_PREFIXES = ("chips-ecosystem/", "薯片生态文档库/", "重构大计划/")
#: 合法但不要求落盘的 target 写法（只读参考 / 就近归档）
TARGET_ALLOW_VIRTUAL = ("只读参考", "不搬运", "就近归档")

EXIT_ARGS = 2
EXIT_VERIFY = 3
EXIT_LOCK = 4
EXIT_NOOP = 5

LOCK_RETRY_ATTEMPTS = 8
LOCK_RETRY_BASE_DELAY = 0.25

# ---- 迁移波三段生命周期工具常量（W3-P1-3 波1 落地，勘查稿 #137 第七节裁定「方案 C：独立通道+回执即闸」）----

#: 消灭流程步骤 [5][6] 执行波回写的合法状态（`set-status` 唯一写通道的作用域；
#: 与 dispose-batch 的 DISPOSE_STATUSES 同源但不含「已裁决」——回写通道只推进执行态，不回退裁决态）
SET_STATUS_VALUES = ("进行中", "已完成", "已验证")

#: files.status 状态域中的「登记态」——仍处评估/裁决流程、尚未产出裁决的行。
#: 双零判据（preflight 双零前置 / closure 双零终口径）的「待评估」计数唯一口径（工单048）：
#: 仅本集合计入「待评估」；其余状态值一律为裁决/回写产物——已裁决（裁决终态）、
#: 进行中/已完成/已验证（dispose-batch 或 set-status 合法回写的迁移进展态）——不计入。
#: 判据禁以 `status<>'已裁决'` 反选实现：那会把合法回写进展态误计为「待评估」，
#: 任一仓走通 set-status 回写即永久钉红且不可自愈（工单048 复现判据）。
PENDING_STATUSES = ("待评估", "评估中")
#: 双零「待评估」计数的单一 SQL 条件片段（preflight/closure 两通道共用，杜绝口径分叉）
PENDING_STATUS_SQL = "status IN ('%s')" % "','".join(PENDING_STATUSES)

#: 《02-仓库映射与新工作区》§一「新归属」列的机读镜像（权威在 02 文档，本常量为其仓级投影）：
#: repo_id → 允许的 canonical target 前缀集。canonical 均已展开为 `chips-ecosystem/…` 形态；
#: 家族通配（`plugins/apps/*` 等）归一到其目录前缀；W6 服务端 `server/…` 归到 `chips-ecosystem/server/…`。
#: 资产/素材仓（design-assets、scripts、打包、OpenSource、Product）与 doclib 不在 02 §一，故不入本表——
#: 映射一致性检查对其落 WARN（02 未登记，非矛盾）。`map_prefixes_self_check()` 断言本表与 02 §一 零分叉。
REPO_TARGET_PREFIXES = {
    "Chips-Host": ("chips-ecosystem/packages/host", "chips-ecosystem/packages/core-rust", "chips-ecosystem/packages/native"),
    "Chips-SDK": ("chips-ecosystem/packages/sdk",),
    "Chips-Ui": ("chips-ecosystem/packages/ui", "chips-ecosystem/packages/antd"),
    "Chips-Scaffold": ("chips-ecosystem/tools/scaffold",),
    "Chips-EditingEngine": ("chips-ecosystem/plugins/apps/editor",),
    "Chips-Notes": ("chips-ecosystem/plugins/apps/notes",),
    "Chips-Office": ("chips-ecosystem/plugins/apps/office",),
    "Chips-MusicPlayer": ("chips-ecosystem/plugins/apps",),
    "Chips-VideoPlayer": ("chips-ecosystem/plugins/apps",),
    "Chips-BookReader": ("chips-ecosystem/plugins/apps",),
    "Chips-PhotoViewer": ("chips-ecosystem/plugins/apps",),
    "Chips-RichTextEditor": ("chips-ecosystem/plugins/apps",),
    "Chips-UniversalFileViewer": ("chips-ecosystem/plugins/apps",),
    "Chips-CardViewer": ("chips-ecosystem/plugins/apps/viewer",),
    "Chips-EcoSettingsPanel": ("chips-ecosystem/plugins/apps/settings",),
    "Chip-iconMaker": ("chips-ecosystem/plugins/apps/icon-maker",),
    "Chips-CommunityClient": ("chips-ecosystem/plugins/apps/community-client",),
    "Chips-BaseCardPlugin": ("chips-ecosystem/plugins/basecards",),
    "Chips-BoxLayoutPlugin": ("chips-ecosystem/plugins/layouts",),
    "Chips-ModulePlugin": ("chips-ecosystem/plugins/services",),
    "Chips-CommunityPlatformServer": ("chips-ecosystem/server/community",),
    "Chips-PersonalServer": ("chips-ecosystem/server/personal",),
}
#: 任意仓都可能合法的说明性/文档落点前缀（重写/保留设计指向权威文档库或台账产物），映射一致性对其放行
MAP_UNIVERSAL_PREFIXES = ("薯片生态文档库/", "重构大计划/")

#: 凭据模式集（勘查稿 §3.3 凭据红线）：命中即要求 disposition∈(废弃,归档) 且禁落新仓。
#: 仅匹配 basename，`.env.example`/`.envrc` 命名面显式排除（示例/环境脚本非真值凭据）。
CRED_EXACT_BASENAMES = (".env",)
CRED_SUFFIX_BASENAMES = (".pem", ".key")
CRED_PREFIX_BASENAMES = ("id_rsa",)
CRED_DOTTED_PREFIXES = ("secrets.",)
CRED_NAME_EXCLUSIONS = (".env.example", ".envrc")

#: 永不入库红线（勘查稿 §3.3）：两目录名在台账/git/manifest 三面的四段断言对象
NEVER_INGEST_DIRS = ("cordis-main", "deepseek-harness-master")
#: 断言④：根 .gitignore 显式条目（锚定目录写法），缺失即降 WARN（本轮已由波1 落地两行）
NEVER_INGEST_IGNORE_ENTRIES = ("cordis-main/", "deepseek-harness-master/")

#: 覆盖式落点存在性豁免写法（与 TARGET_ALLOW_VIRTUAL 同义，closure 复用）
_MAP_TARGET_VIRTUAL = TARGET_ALLOW_VIRTUAL

#: 覆盖矩阵 §一 计数表可勾稽的裁决列名 → DB disposition 值（按表头列名动态映射，不假设列序）
MATRIX_DISPOSITION_COLS = {
    "废弃": "废弃", "重写": "重写", "迁移": "迁移",
    "保留设计": "保留设计", "归档": "归档",
}


def now():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def die(msg, code=EXIT_NOOP):
    """统一失败出口：stderr 说明原因 + 非 0 退出码。"""
    print("错误：%s" % msg, file=sys.stderr)
    sys.exit(code)


def log_operation(cmd, owner, rows, detail):
    """写操作过程留痕：时间 | 子命令 | owner | 行数 | disposition 分布/说明。"""
    line = "%s\tcmd=%-14s owner=%-24s rows=%-6d %s\n" % (now(), cmd, owner or "-", rows, detail)
    with open(OP_LOG, "a", encoding="utf-8") as f:
        f.write(line)


def run_write(label, work, attempts=LOCK_RETRY_ATTEMPTS):
    """写操作统一执行器：BEGIN IMMEDIATE 单事务 + 失败回滚 + 锁定重试。

    work(conn) 的返回值原样透传；任何异常都回滚后重抛；
    `database is locked` 按指数退避重试，重试耗尽按退出码 4 退出。
    """
    last_err = None
    for i in range(attempts):
        conn = connect(write=True)
        try:
            conn.execute("BEGIN IMMEDIATE")
            result = work(conn)
            conn.commit()
            return result
        except sqlite3.OperationalError as e:  # 锁竞争 / busy
            conn.rollback()
            if "locked" in str(e).lower() or "busy" in str(e).lower():
                last_err = e
                time.sleep(LOCK_RETRY_BASE_DELAY * (2 ** i))
                continue
            die("%s 失败：%s" % (label, e), EXIT_ARGS)
        except Exception as e:
            conn.rollback()
            die("%s 失败（已回滚）：%s" % (label, e), EXIT_ARGS)
        finally:
            conn.close()
    die("%s 失败：数据库锁定，重试 %d 次仍未拿到写锁（%s，请稍后重跑）" % (label, attempts, last_err), EXIT_LOCK)


def norm_exts(exts):
    out = []
    for e in exts or []:
        e = e.strip().lower()
        if not e:
            continue
        out.append(e if e.startswith(".") else "." + e)
    return out


def file_filter_conds(args):
    """把 --repo/--category/--ext 翻译成 files 表的条件片段（不含状态与 owner）。"""
    conds, params = [], []
    repos = getattr(args, "repo", None) or []
    if repos:
        conds.append("repo_id IN (%s)" % ",".join("?" * len(repos)))
        params += list(repos)
    if getattr(args, "category", None):
        conds.append("category = ?")
        params.append(args.category)
    exts = norm_exts(getattr(args, "ext", None))
    if exts:
        conds.append("ext IN (%s)" % ",".join("?" * len(exts)))
        params += exts
    return conds, params


def dir_filter_conds(args):
    """把 --dir（可多值）翻译成目录限定条件；空串/仓库根一律拒绝。"""
    conds, params = [], []
    for d in getattr(args, "dir", None) or []:
        d = d.strip().strip("/")
        if not d or d in (".", "*"):
            die("--dir 不能是空串或仓库根（拒绝无目录限定的整仓库批量裁决）")
        conds.append("(rel_path = ? OR rel_path LIKE ?)")
        params += [d, d + "/%"]
    return conds, params


def read_id_file(path):
    """解析“每行一个 files.id”的清单文件；非法行直接报错，不静默跳过。"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read().splitlines()
    except OSError as e:
        die("--id-file 无法读取：%s（%s）" % (path, e))
    ids, bad = [], []
    for ln in raw:
        line = ln.strip()
        if not line or line.startswith("#"):
            continue
        parts = re.split(r"[\s,]+", line)
        token = parts[0]
        if not re.fullmatch(r"\d+", token):
            bad.append(line)
            continue
        ids.append(int(token))
    if bad:
        die("--id-file 含非法行（每行必须是一个 files.id）：%s" % " / ".join(bad[:5]))
    if not ids:
        die("--id-file 为空清单：%s" % path)
    return sorted(set(ids))


def in_clause(values):
    return "IN (%s)" % ",".join("?" * len(values))


def dir_of(rel_path):
    return os.path.dirname(rel_path).replace("\\", "/")


def count_by(rows, key):
    out = {}
    for r in rows:
        k = key(r) or "-"
        out[k] = out.get(k, 0) + 1
    return out


def fmt_dist(dist):
    return " ".join("%s=%d" % (k, dist[k]) for k in sorted(dist, key=lambda x: -dist[x]))


def connect(write=False):
    """打开台账连接。

    write=True 时启用 autocommit（isolation_level=None），由 `run_write` 显式
    `BEGIN IMMEDIATE` 掌控单事务；只读路径沿用既有隐式事务语义。
    """
    conn = sqlite3.connect(DB, isolation_level=None if write else "")
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=8000;")
    return conn


def ensure_indexes():
    """幂等补建增量列/索引；库被并发写锁住时不阻断只读统计，静默跳过。

    增量列（`INCREMENTAL_COLUMNS`）先于增量索引补建：`symbols.wave_owner`
    缺失时 `idx_symbols_wave_owner` 无法创建，二者必须同批到位。
    """
    try:
        conn = connect(write=True)
        try:
            for table, col, ddl in INCREMENTAL_COLUMNS:
                cols = {r[1] for r in conn.execute("PRAGMA table_info(%s)" % table)}
                if cols and col not in cols:
                    conn.execute(ddl)
            for ddl in INCREMENTAL_INDEXES:
                conn.execute(ddl)
        finally:
            conn.close()
    except sqlite3.OperationalError:
        pass


def discover_repos():
    repos = []
    for name in sorted(os.listdir(ROOT)):
        full = os.path.join(ROOT, name)
        if not os.path.isdir(full):
            continue
        if name.startswith("旧版-"):
            kind = "doclib"
        elif name.startswith(("Chips-", "Chip-")):
            kind = "repo"
        elif name in ("打包", "scripts", "design-assets", "ProductFinishedProductTestingSpace", "OpenSourceProjectHandlingFolder"):
            kind = "assets"
        else:
            continue
        if name == "chips-ecosystem":
            continue
        repos.append((name, name, kind))
    return repos


def category_of(rel_path, ext):
    p = rel_path.replace("\\", "/").lower()
    if ext in (".md", ".mdx", ".txt"):
        return "doc"
    if "/tests/" in p or "/test/" in p or p.startswith("tests/") or p.endswith((".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".test.js")):
        return "test"
    if ext in CODE_EXT:
        return "code"
    if ext in (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".icns", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".wav", ".pdf", ".epub"):
        return "asset"
    if ext in (".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".env", ".lock"):
        return "config"
    if ext in (".csv", ".db", ".sqlite", ".bin", ".dat"):
        return "data"
    return "other"


def extract_symbols(path, ext):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except OSError:
        return []
    out = []
    if ext in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
        for m in TS_SYM.finditer(text):
            line = text[: m.start()].count("\n") + 1
            kind = re.search(r"(function|class|interface|type|const|enum|let)", m.group(0)).group(1)
            out.append((kind, m.group(1), line, 1))
        for m in TS_FN.finditer(text):
            line = text[: m.start()].count("\n") + 1
            out.append(("function", m.group(1), line, 0))
    elif ext == ".rs":
        for m in RS_SYM.finditer(text):
            line = text[: m.start()].count("\n") + 1
            out.append((m.group(1), m.group(2), line, 1))
    # 去重（同名同行为同符号）
    seen = set()
    uniq = []
    for s in out:
        key = (s[0], s[1], s[2])
        if key not in seen:
            seen.add(key)
            uniq.append(s)
    return uniq


def scan(force=False):
    conn = connect()
    conn.executescript(SCHEMA)
    # scan 会按 file_id 重建 symbols；符号级裁决落库后重扫等于清零判定成果，须显式 --force
    decided = conn.execute(
        "SELECT COUNT(*) FROM symbols WHERE disposition IS NOT NULL"
    ).fetchone()[0]
    if decided and not force:
        die("已有 %d 个符号落裁决：重扫会 DELETE 并重建 symbols、清空这些判定。"
            "确认重扫请加 --force（或改用增量登记前先 release 相关行的符号裁决）" % decided)
    repos = discover_repos()
    total_files = total_symbols = 0
    for rid, name, kind in repos:
        conn.execute(
            "INSERT INTO repos(id,name,path,kind) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind",
            (rid, name, name, kind),
        )
        count = 0
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, name)):
            dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
            for fn in filenames:
                if fn == ".DS_Store":
                    continue
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, os.path.join(ROOT, name))
                ext = os.path.splitext(fn)[1].lower()
                try:
                    size = os.path.getsize(full)
                    with open(full, "rb") as f:
                        data = f.read()
                    sha1 = hashlib.sha1(data).hexdigest()
                    lines = data.count(b"\n") + (1 if data else 0)
                except OSError:
                    continue
                cur = conn.execute(
                    """INSERT INTO files(repo_id, rel_path, ext, size, lines, sha1, category)
                       VALUES(?,?,?,?,?,?,?)
                       ON CONFLICT(repo_id, rel_path) DO UPDATE SET
                         size=excluded.size, lines=excluded.lines, sha1=excluded.sha1, category=excluded.category""",
                    (rid, rel, ext, size, lines, sha1, category_of(rel, ext)),
                )
                fid = cur.lastrowid or conn.execute(
                    "SELECT id FROM files WHERE repo_id=? AND rel_path=?", (rid, rel)
                ).fetchone()[0]
                count += 1
                if ext in CODE_EXT:
                    conn.execute("DELETE FROM symbols WHERE file_id=?", (fid,))
                    syms = extract_symbols(full, ext)
                    for kind_, name_, line, exported in syms:
                        conn.execute(
                            "INSERT INTO symbols(file_id, kind, name, line, exported) VALUES(?,?,?,?,?)",
                            (fid, kind_, name_, line, exported),
                        )
                    total_symbols += len(syms)
        conn.execute("UPDATE repos SET file_count=? WHERE id=?", (count, rid))
        total_files += count
        print(f"  {name}: {count} files")
    conn.commit()
    conn.close()
    print(f"scan done: {len(repos)} repos, {total_files} files, {total_symbols} symbols")


def scan_incr(args):
    """增量登记（工单032 通道①）：限定 --repo + --dir 显式路径清单，只 INSERT 磁盘上未登记的行。

    与 `scan` 的本质区别：不整库重扫、不 DELETE、不触碰任何已登记 files 行及其符号裁决，
    只对范围内磁盘新增行做 files+symbols 两层增量 INSERT。`--allow-excluded` 在本登记范围内
    显式覆盖 `EXCLUDE_DIRS` 的目录名排除（如 `vendor`，含嵌套同名目录），未点名的排除目录仍跳过。
    新文件行直接归 `--owner`（status=进行中、写入 wave），新符号行打 `wave_owner=--owner`，
    后续即可经既有 `dispose-batch` / `symbol-dispose` / `symbol-sweep` 通道落裁决。
    默认 dry-run 预览计数，`--write` 才落库（单事务 + 台账操作.log 留痕）。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（增量登记的新行直接归本路，机器保证认领互斥）")
    if not args.repo:
        die("scan-incr 必须带 --repo <仓库名>（增量登记要求显式仓库面）")
    if len(args.repo) > 1:
        die("scan-incr 只允许一个 --repo（显式仓库面；跨仓请分次执行）")
    rid = args.repo[0]
    dirs = []
    for d in args.dir or []:
        d = d.strip().strip("/")
        if not d or d in (".", "*"):
            die("--dir 不能是空串或仓库根（增量登记要求显式路径清单；整仓库重建请改用 scan --force）")
        if d in dirs:
            continue
        if not os.path.isdir(os.path.join(ROOT, rid, d)):
            die("--dir 在磁盘上不存在：%s/%s" % (rid, d))
        dirs.append(d)
    if not dirs:
        die("scan-incr 必须带至少一个 --dir <仓库内相对目录>（显式路径清单）")
    allow = list(args.allow_excluded or [])
    unknown = [x for x in allow if x not in EXCLUDE_DIRS]
    if unknown:
        die("--allow-excluded 含不在 EXCLUDE_DIRS 中的目录名：%s（可覆盖项：%s）"
            % (" ".join(unknown), " ".join(sorted(EXCLUDE_DIRS))))
    excluded = EXCLUDE_DIRS - set(allow)

    # 只读收集阶段：与 scan 同口径（category_of / extract_symbols / sha1），不改库
    conn = connect()
    try:
        if not conn.execute("SELECT 1 FROM repos WHERE id=?", (rid,)).fetchone():
            die("repos 表中无仓库 %s（请先由 scan 登记仓库面）" % rid)
        existing = set()
        for d in dirs:
            for r in conn.execute(
                "SELECT rel_path FROM files WHERE repo_id=? AND (rel_path=? OR rel_path LIKE ?)",
                (rid, d, d + "/%"),
            ):
                existing.add(r[0])
        new_rows = []   # (rel, ext, size, lines, sha1, category, syms)
        skipped_existing = 0
        seen = set()
        for d in dirs:
            for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, rid, d)):
                dirnames[:] = [x for x in dirnames if x not in excluded]
                for fn in sorted(filenames):
                    if fn == ".DS_Store":
                        continue
                    full = os.path.join(dirpath, fn)
                    rel = os.path.relpath(full, os.path.join(ROOT, rid)).replace("\\", "/")
                    if rel in seen:
                        continue
                    seen.add(rel)
                    if rel in existing:
                        skipped_existing += 1
                        continue
                    ext = os.path.splitext(fn)[1].lower()
                    try:
                        size = os.path.getsize(full)
                        with open(full, "rb") as f:
                            data = f.read()
                    except OSError:
                        continue
                    sha1 = hashlib.sha1(data).hexdigest()
                    lines = data.count(b"\n") + (1 if data else 0)
                    syms = extract_symbols(full, ext) if ext in CODE_EXT else []
                    new_rows.append((rel, ext, size, lines, sha1, category_of(rel, ext), syms))
    finally:
        conn.close()

    total_syms = sum(len(r[6]) for r in new_rows)
    per_dir = count_by(new_rows, lambda r: dir_of(r[0]))
    print("scan-incr: repo=%s owner=%s wave=%s 覆盖排除目录名=%s"
          % (rid, owner, args.wave, ",".join(allow) or "(无)"))
    print("  待登记新行 %d 个文件 / %d 个符号；已登记跳过 %d 行（其行与符号裁决一律不触碰）"
          % (len(new_rows), total_syms, skipped_existing))
    print("  类别分布: %s" % (fmt_dist(count_by(new_rows, lambda r: r[5])) or "-"))
    for d in sorted(per_dir):
        print("    %-52s %d" % (d or "(目录根)", per_dir[d]))
    if args.print_ids:
        for r in new_rows:
            print("rel=%s\t%s\t符号=%d" % (r[0], r[5], len(r[6])))
    if not args.write:
        print("  (dry-run 预览，未落库；加 --write 落库)")
        return
    if not new_rows:
        die("没有可登记的新行（范围内 %d 个磁盘文件均已登记）" % skipped_existing)

    def work(wconn):
        nonlocal skipped_existing
        n_files = n_syms = 0
        for rel, ext, size, lines, sha1, cat, syms in new_rows:
            cur = wconn.execute(
                """INSERT INTO files(repo_id, rel_path, ext, size, lines, sha1, category, status, owner, wave)
                   VALUES(?,?,?,?,?,?,?, '进行中', ?, ?)
                   ON CONFLICT(repo_id, rel_path) DO NOTHING""",
                (rid, rel, ext, size, lines, sha1, cat, owner, args.wave),
            )
            if cur.rowcount == 0:
                skipped_existing += 1
                continue
            fid = cur.lastrowid
            n_files += 1
            for kind_, name_, line, exported in syms:
                wconn.execute(
                    "INSERT INTO symbols(file_id, kind, name, line, exported, wave_owner) VALUES(?,?,?,?,?,?)",
                    (fid, kind_, name_, line, exported, owner),
                )
                n_syms += 1
        wconn.execute("UPDATE repos SET file_count=(SELECT COUNT(*) FROM files WHERE repo_id=?) WHERE id=?",
                      (rid, rid))
        return n_files, n_syms

    n_files, n_syms = run_write("scan-incr", work)
    print("scan-incr: owner=%s 落库 %d 个文件行 + %d 个符号行（增量 INSERT；已登记 %d 行与其裁决未触碰）"
          % (owner, n_files, n_syms, skipped_existing))
    log_operation("scan-incr", owner, n_files,
                  "repo=%s dirs=%s symbols=%d 已登记跳过=%d 覆盖排除=%s write=True"
                  % (rid, ",".join(dirs), n_syms, skipped_existing, ",".join(allow) or "-"))



def mark_old():
    conn = connect()
    conn.executescript(SCHEMA)
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    for rid, name, kind in discover_repos():
        if kind != "repo":
            continue
        marker = os.path.join(ROOT, name, "旧版-标记.md")
        if not os.path.exists(marker):
            with open(marker, "w", encoding="utf-8") as f:
                f.write(
                    f"# 旧版仓库（冻结）\n\n"
                    f"> 标记时间：{stamp}\n"
                    f"> 本仓库已冻结，仅作重构参考；不再修改。\n\n"
                    f"- 新架构权威文档：`薯片生态文档库/`\n"
                    f"- 新实现工作区：`chips-ecosystem/`\n"
                    f"- 重构台账：`重构大计划/重构台账.db`\n"
                )
        conn.execute("UPDATE repos SET marked_at=? WHERE id=?", (stamp, rid))
    conn.commit()
    conn.close()
    print("mark-old done")


def init_workspace():
    dirs = [
        "packages/core-rust", "packages/native", "packages/bridge", "packages/host",
        "packages/sdk", "packages/ui", "packages/antd", "packages/cli",
        "plugins/basecards", "plugins/layouts", "plugins/services", "plugins/apps",
        "tools/scaffold/templates", "tools/contract-gen", "tools/gates",
        "examples/plugins", "tests/e2e", "tests/contract", "tests/perf",
    ]
    for d in dirs:
        os.makedirs(os.path.join(NEW_WS, d), exist_ok=True)
    files = {
        "package.json": """{
  "name": "chips-ecosystem",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "test:coverage": "pnpm -r run test:coverage",
    "test:contract": "pnpm -r run test:contract",
    "docs:check": "node tools/gates/check-docs.mjs"
  }
}
""",
        "pnpm-workspace.yaml": """packages:
  - "packages/*"
  - "plugins/*/*"
  - "tools/*"
  - "examples/plugins/*"
""",
        "tsconfig.base.json": """{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
""",
        "Cargo.toml": """[workspace]
resolver = "2"
members = ["packages/core-rust", "packages/native"]

[workspace.package]
version = "0.0.0"
edition = "2021"
license = "MIT"

[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
tokio = { version = "1", features = ["full"] }
""",
        ".gitignore": """node_modules/
dist/
target/
*.node
*.cpk
release/
.DS_Store
""",
        "README.md": """# chips-ecosystem

薯片生态新实现工作区（Cordis + Rust 核心 + Neon + Electron + React/@chips/ui）。

- 权威文档：`../薯片生态文档库/`
- 重构台账：`../重构大计划/重构台账.db`
- 开发规范：`../重构大计划/03-并行开发与子智能体规范.md`

构建：`pnpm install`（骨架建立后）→ `pnpm build` → `pnpm test`。
""",
    }
    for rel, content in files.items():
        path = os.path.join(NEW_WS, rel)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
    print("init-workspace done:", NEW_WS)


def stats():
    conn = connect()
    print("== 仓库 ==")
    for r in conn.execute("SELECT id, kind, file_count, status FROM repos ORDER BY file_count DESC"):
        print("  %-32s %-7s %6d %s" % r)
    print("== 文件状态 ==")
    for r in conn.execute("SELECT status, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-10s %d" % r)
    print("== 裁决 ==")
    for r in conn.execute("SELECT COALESCE(disposition,'(未裁决)') d, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-10s %d" % r)
    print("== 类别 ==")
    for r in conn.execute("SELECT category, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-8s %d" % r)
    print("== 符号 ==")
    print("  总数:", conn.execute("SELECT COUNT(*) FROM symbols").fetchone()[0])
    print("  已裁决:", conn.execute("SELECT COUNT(*) FROM symbols WHERE disposition IS NOT NULL").fetchone()[0])
    # 符号级裁决进度（准出标准③：逐文件符号清零）
    n_sym_files, n_full, n_partial = conn.execute(
        """SELECT COUNT(*),
                  SUM(CASE WHEN done = total THEN 1 ELSE 0 END),
                  SUM(CASE WHEN done > 0 AND done < total THEN 1 ELSE 0 END)
           FROM (SELECT file_id, COUNT(*) total,
                        SUM(CASE WHEN disposition IS NOT NULL THEN 1 ELSE 0 END) done
                 FROM symbols GROUP BY file_id)"""
    ).fetchone()
    print("  有符号的文件: %d 个，符号全裁决: %d 个，部分裁决: %d 个"
          % (n_sym_files or 0, n_full or 0, n_partial or 0))
    # 符号波认领维度（symbols.wave_owner）：认领总量与未裁决存量，一行机读
    wo_total, wo_pending = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN disposition IS NULL THEN 1 ELSE 0 END),0)"
        " FROM symbols WHERE wave_owner IS NOT NULL").fetchone()
    print("  wave_owner 认领: %d 个符号（其中未裁决 %d 个，未认领未裁决 %d 个）"
          % (wo_total, wo_pending,
             conn.execute("SELECT COUNT(*) FROM symbols"
                          " WHERE disposition IS NULL AND wave_owner IS NULL").fetchone()[0]))
    print("== 认领分布（非“待评估”行）==")
    rows = conn.execute(
        "SELECT COALESCE(NULLIF(owner,''),'(无 owner)') o, COUNT(*) FROM files WHERE status <> '待评估' GROUP BY 1 ORDER BY 2 DESC"
    ).fetchall()
    if not rows:
        print("  (无)")
    for o, n in rows:
        print("  %-24s %d" % (o, n))
    conn.close()


def next_files(args):
    conds = ["status='待评估'", "owner IS NULL"]
    params = []
    extra_conds, extra_params = file_filter_conds(args)
    conds += extra_conds
    params += extra_params
    conn = connect()
    rows = conn.execute(
        "SELECT id, repo_id, rel_path, category FROM files WHERE %s ORDER BY repo_id, rel_path LIMIT ?"
        % " AND ".join(conds),
        params + [args.n],
    ).fetchall()
    for r in rows:
        print(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}")
    conn.close()


def dispose(args):
    if args.disposition not in VALID_DISPOSITIONS:
        die("--disposition 取值非法：%r（可选：%s）" % (args.disposition, "/".join(VALID_DISPOSITIONS)))

    def work(conn):
        row = conn.execute("SELECT id FROM files WHERE id=?", (args.file,)).fetchone()
        if not row:
            die("files.id=%s 不存在" % args.file)
        conn.execute(
            "UPDATE files SET status='已裁决', disposition=?, target_path=?, owner=?, notes=? WHERE id=?",
            (args.disposition, args.target, args.owner, args.notes or "", args.file),
        )
        return True

    run_write("dispose", work)
    log_operation("dispose", args.owner, 1, "disposition=%s %s" % (args.disposition, _file_ref(args.file)))
    print("dispose done:", args.file, args.disposition)


def _file_ref(file_id):
    conn = connect()
    r = conn.execute("SELECT repo_id, rel_path FROM files WHERE id=?", (file_id,)).fetchone()
    conn.close()
    return "%s/%s" % (r[0], r[1]) if r else "files.id=%s" % file_id


def claim(args):
    """批量认领：把命中的 `status='待评估' AND owner IS NULL` 行打上 owner。

    owner 唯一由本命令的 WHERE 条件机器保证；已被他人认领的行只报告、不改动。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（子智能体标识，如 ledger-host-scaffold）")
    if args.limit is not None and args.limit <= 0:
        die("--limit 必须是正整数")

    f_conds, f_params = file_filter_conds(args)
    d_conds, d_params = dir_filter_conds(args)
    scope_conds = f_conds + d_conds
    scope_params = f_params + d_params
    scope_where = " AND ".join(scope_conds) if scope_conds else "1=1"
    avail_where = scope_where + " AND status='待评估' AND owner IS NULL"

    def work(conn):
        total = conn.execute("SELECT COUNT(*) FROM files WHERE %s" % scope_where, scope_params).fetchone()[0]
        sql = ("SELECT id, repo_id, rel_path, category FROM files WHERE %s ORDER BY repo_id, rel_path"
               % avail_where)
        params = list(scope_params)
        if args.limit is not None:
            sql += " LIMIT ?"
            params.append(args.limit)
        rows = conn.execute(sql, params).fetchall()
        ids = [r[0] for r in rows]
        if ids:
            conn.executemany(
                "UPDATE files SET status='评估中', owner=?, wave=? WHERE id=? AND status='待评估' AND owner IS NULL",
                [(owner, args.wave, i) for i in ids],
            )
        return total, rows

    total, rows = run_write("claim", work)
    if not rows:
        die("没有可认领的行（条件命中 %d 行，均非“待评估且未认领”）" % total)
    for r in rows:
        print("%d\t%s\t%s\t%s" % r)
    skipped = total - len(rows)
    print("claim: owner=%s 认领 %d 行；条件命中 %d 行，跳过（他人已认领或状态非待评估）%d 行%s"
          % (owner, len(rows), total, skipped, "（--limit=%d 截断）" % args.limit if args.limit is not None else ""))
    log_operation("claim", owner, len(rows), "仓库分布=%s 命中=%d 跳过=%d"
                  % (fmt_dist(count_by(rows, lambda r: r[1])), total, skipped))


def dispose_batch(args):
    """批量裁决：只允许改自己认领的行；无 id 清单或目录限定即拒绝。"""
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（只能裁决自己认领的行）")
    if args.disposition not in VALID_DISPOSITIONS:
        die("--disposition 取值非法：%r（可选：%s）" % (args.disposition, "/".join(VALID_DISPOSITIONS)))
    if args.status not in DISPOSE_STATUSES:
        die("--status 取值非法：%r（可选：%s）" % (args.status, "/".join(DISPOSE_STATUSES)))
    if not (args.notes or "").strip():
        die("--notes 不能为空：批量裁决必须写明理由（裁决三问的结论摘要）")

    f_conds, f_params = file_filter_conds(args)
    d_conds, d_params = dir_filter_conds(args)
    scope_conds = list(f_conds + d_conds)
    scope_params = list(f_params + d_params)
    ids = read_id_file(args.id_file) if args.id_file else None

    # 安全闸口：拒绝“整仓库一把梭”
    if ids is None and not (args.repo and d_conds):
        die("拒绝整仓库一把梭式批量裁决：必须提供 --id-file <每行一个 files.id>，"
            "或同时提供 --repo <仓库> 与 --dir <目录前缀>（可多值）的目录级限定", EXIT_NOOP)

    if ids is not None:
        scope_conds.append("id " + in_clause(ids))
        scope_params += ids
    where = " AND ".join(scope_conds) if scope_conds else "1=1"

    def work(conn):
        rows = conn.execute(
            "SELECT id, repo_id, rel_path, owner, status, disposition FROM files WHERE %s" % where,
            scope_params,
        ).fetchall()
        mine, unclaimed, foreign = [], [], []
        for r in rows:
            if r[3] == owner:
                mine.append(r)
            elif r[3] in (None, ""):
                unclaimed.append(r)
            else:
                foreign.append(r)
        if args.allow_unclaimed:
            mine += unclaimed
            unclaimed = []
        if args.dry_run:
            return rows, mine, unclaimed, foreign, 0
        if mine:
            conn.executemany(
                "UPDATE files SET disposition=?, target_path=?, notes=?, status=?, wave=? WHERE id=?",
                [(args.disposition, args.target, args.notes, args.status, args.wave, r[0]) for r in mine],
            )
        return rows, mine, unclaimed, foreign, len(mine)

    rows, mine, unclaimed, foreign, updated = run_write("dispose-batch", work)

    if args.dry_run:
        print("dispose-batch(dry-run): 命中 %d 行，可裁决（owner=%s）%d 行，未认领 %d 行，他人认领 %d 行"
              % (len(rows), owner, len(mine), len(unclaimed), len(foreign)))
        return
    if not updated:
        die("没有可裁决的行：命中的 %d 行中属于 owner=%s 的为 0（先用 claim 认领；越权改写被拒绝）"
            % (len(rows), owner))
    groups = count_by(mine, lambda r: dir_of(r[2]))
    print("dispose-batch: owner=%s 落库 %d 行 disposition=%s status=%s"
          % (owner, updated, args.disposition, args.status))
    print("  目录分组 %d 个：" % len(groups))
    for d in sorted(groups):
        print("    %-46s %d" % (d or "(仓库根)", groups[d]))
    if unclaimed or foreign:
        print("  跳过：未认领 %d 行，他人认领 %d 行（owner 唯一由工具保证）" % (len(unclaimed), len(foreign)))
        for r in (unclaimed + foreign)[:20]:
            print("    %d\t%s/%s\towner=%s" % (r[0], r[1], r[2], r[3] or "(空)"))
        if len(unclaimed) + len(foreign) > 20:
            print("    …（其余 %d 行省略）" % (len(unclaimed) + len(foreign) - 20))
    if args.print_ids:
        for r in mine:
            print("id=%d\t%s/%s" % (r[0], r[1], r[2]))
    log_operation("dispose-batch", owner, updated,
                  "disposition=%s status=%s target=%s notes=%s 目录组=%d 跳过=%d"
                  % (args.disposition, args.status, args.target or "-", (args.notes or "")[:60],
                     len(groups), len(unclaimed) + len(foreign)))


def symbols_cmd(args):
    """列出某文件登记的全部符号及其裁决状态。"""
    conn = connect()
    f = conn.execute("SELECT id, repo_id, rel_path, owner, disposition FROM files WHERE id=?", (args.file,)).fetchone()
    if not f:
        die("files.id=%s 不存在" % args.file)
    rows = conn.execute(
        "SELECT id, kind, name, line, exported, status, disposition, target, wave_owner"
        " FROM symbols WHERE file_id=? ORDER BY line, id",
        (args.file,),
    ).fetchall()
    print("symbols: file_id=%d %s/%s owner=%s 文件裁决=%s"
          % (f[0], f[1], f[2], f[3] or "(空)", f[4] or "(未裁决)"))
    if not rows:
        print("  (该文件无登记符号)")
        conn.close()
        return
    print("  %-8s %-10s %-28s %-6s %-4s %-8s %-8s %-22s %s"
          % ("id", "kind", "name", "line", "导出", "状态", "裁决", "wave_owner", "target"))
    for s in rows:
        print("  %-8d %-10s %-28s %-6d %-4s %-8s %-8s %-22s %s"
              % (s[0], s[1], s[2][:28], s[3], "是" if s[4] else "否", s[5], s[6] or "-",
                 s[8] or "-", s[7] or "-"))
    decided = sum(1 for s in rows if s[6])
    print("  合计 %d 个符号，已裁决 %d，未裁决 %d" % (len(rows), decided, len(rows) - decided))
    conn.close()


def symbol_dispose(args):
    """符号级裁决落库。

    写权限两路（W2 符号波口径）：所属文件 `files.owner` == --owner（历史裁决路），
    **或** 符号 `symbols.wave_owner` == --owner（符号波认领路）；其余一律跳过并计数报告。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（只能裁决自己认领文件或认领的符号）")
    if args.disposition not in VALID_DISPOSITIONS:
        die("--disposition 取值非法：%r（可选：%s）" % (args.disposition, "/".join(VALID_DISPOSITIONS)))
    if bool(args.symbol) == (args.file is not None):
        die("--symbol <ids 逗号分隔> 与 --file <files.id> 必须二选一")

    if args.symbol:
        toks = [t for t in re.split(r"[,\s]+", args.symbol.strip()) if t]
        bad = [t for t in toks if not re.fullmatch(r"\d+", t)]
        if bad:
            die("--symbol 含非法 id：%s" % " ".join(bad[:5]))
        sym_ids = sorted(set(int(t) for t in toks))
        cond, params = "s.id " + in_clause(sym_ids), list(sym_ids)
    else:
        cond, params = "s.file_id = ?", [args.file]
    where = cond + (" AND s.disposition IS NULL" if args.only_pending else "")

    def work(conn):
        rows = conn.execute(
            "SELECT s.id, s.file_id, s.name, s.kind, s.line, f.owner, f.repo_id, f.rel_path,"
            " s.wave_owner, s.disposition"
            " FROM symbols s JOIN files f ON f.id = s.file_id WHERE %s" % where,
            params,
        ).fetchall()
        # r[8]=symbols.wave_owner：文件 owner 路或符号波路任一命中即可写
        mine = [r for r in rows if r[5] == owner or r[8] == owner]
        foreign = [r for r in rows if r[5] not in (None, "", owner) and r[8] not in (None, "", owner)]
        if args.dry_run:
            return rows, mine, foreign, [], 0
        if mine:
            conn.executemany(
                "UPDATE symbols SET disposition=?, target=?, notes=?, status='已裁决' WHERE id=?",
                [(args.disposition, args.target, args.notes, r[0]) for r in mine],
            )
        progress = []
        for fid in sorted({r[1] for r in mine}):
            total, done = conn.execute(
                "SELECT COUNT(*), COALESCE(SUM(CASE WHEN disposition IS NOT NULL THEN 1 ELSE 0 END),0)"
                " FROM symbols WHERE file_id=?",
                (fid,),
            ).fetchone()
            progress.append((fid, total, done))
            if args.auto_file_status and done == total and total > 0:
                conn.execute("UPDATE files SET status='已裁决', wave=? WHERE id=? AND owner=?",
                             (args.wave, fid, owner))
        return rows, mine, foreign, progress, len(mine)

    rows, mine, foreign, progress, updated = run_write("symbol-dispose", work)
    if args.dry_run:
        print("symbol-dispose(dry-run): 命中 %d 个符号，可裁决（files.owner 或 wave_owner=%s）%d 个，越权 %d 个"
              % (len(rows), owner, len(mine), len(foreign)))
        return
    if not updated:
        die("没有可裁决的符号：命中的 %d 个符号既非 owner=%s 认领文件的符号，也未被其 symbols-claim 认领"
            "（先 claim 该文件或 symbols-claim 该符号；越权改写被拒绝）" % (len(rows), owner))
    for fid, total, done in progress:
        print("  file_id=%d 符号进度 %d/%d%s" % (fid, done, total, "（已清零）" if done == total else ""))
    if foreign:
        print("  跳过：非本 owner（files.owner / wave_owner 两路均不命中）的符号 %d 个" % len(foreign))
        for r in foreign[:20]:
            print("    symbol=%d\t%s/%s\towner=%s\twave_owner=%s"
                  % (r[0], r[6], r[7], r[5] or "(空)", r[8] or "(空)"))
    print("symbol-dispose: owner=%s 落库 %d 个符号 disposition=%s target=%s"
          % (owner, updated, args.disposition, args.target or "-"))
    log_operation("symbol-dispose", owner, updated,
                  "disposition=%s target=%s files=%s 越权跳过=%d"
                  % (args.disposition, args.target or "-",
                     ",".join(str(p[0]) for p in progress)[:80], len(foreign)))


def symbols_claim(args):
    """符号波认领：把命中仓+类别下 `disposition IS NULL AND wave_owner IS NULL` 的符号打上 wave_owner。

    互斥由 SQL 条件在单事务内机器保证；重复认领（wave_owner 已有值）只报告、不改动。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（符号波标识，如 sweep-host-expand）")
    if not (args.repo or []):
        die("symbols-claim 必须带 --repo <仓名>（按仓+类别划分保证并行路互斥）")
    if args.limit is not None and args.limit <= 0:
        die("--limit 必须是正整数")
    class_cond = SYMBOL_CLASS_COND[args.class_]

    def work(conn):
        base = ("FROM symbols s JOIN files f ON f.id = s.file_id"
                " WHERE f.repo_id " + in_clause(args.repo) +
                " AND %s AND s.disposition IS NULL" % class_cond)
        params = list(args.repo)
        eligible = conn.execute("SELECT COUNT(*) " + base, params).fetchone()[0]
        claimable = conn.execute(
            "SELECT COUNT(*) " + base + " AND s.wave_owner IS NULL", params).fetchone()[0]
        sql = ("SELECT s.id, f.repo_id, f.rel_path, s.name " + base +
               " AND s.wave_owner IS NULL ORDER BY f.repo_id, f.rel_path, s.id")
        cparams = list(params)
        if args.limit is not None:
            sql += " LIMIT ?"
            cparams.append(args.limit)
        rows = conn.execute(sql, cparams).fetchall()
        ids = [r[0] for r in rows]
        if ids:
            conn.executemany(
                "UPDATE symbols SET wave_owner=? WHERE id=? AND wave_owner IS NULL AND disposition IS NULL",
                [(owner, i) for i in ids],
            )
        return eligible, claimable, rows

    eligible, claimable, rows = run_write("symbols-claim", work)
    already = eligible - claimable
    if not rows:
        die("没有可认领的符号：条件命中未裁决符号 %d 个，其中 %d 个已有 wave_owner（重复认领跳过，归该认领路处置）"
            % (eligible, already))
    dist = count_by(rows, lambda r: r[1])
    print("symbols-claim: owner=%s class=%s 认领 %d 个符号；条件命中未裁决 %d 个，"
          "重复认领跳过（wave_owner 已有值）%d 个%s"
          % (owner, args.class_, len(rows), eligible, already,
             "（--limit=%d 截断，剩余 %d 个可后续再领）" % (args.limit, claimable - len(rows))
             if args.limit is not None and claimable > len(rows) else ""))
    print("  按仓分布: %s" % fmt_dist(dist))
    if args.print_ids:
        for r in rows:
            print("symbol=%d\t%s\t%s" % (r[0], r[1], r[3]))
    log_operation("symbols-claim", owner, len(rows),
                  "class=%s 仓库分布=%s 命中=%d 重复跳过=%d"
                  % (args.class_, fmt_dist(dist), eligible, already))


def _sweep_target(file_disposition, file_target):
    """symbol-sweep 的继承 target 镜像口径（主智能体 W2 裁决）：
    废弃→空 target；归档→说明性 target（按既有归档口径，文件无 target 时兜底“就近归档”）；
    保留设计→按文件 target。
    """
    ft = (file_target or "").strip()
    if file_disposition == "废弃":
        return ""
    if file_disposition == "归档":
        return ft or SWEEP_ARCHIVE_FALLBACK_TARGET
    return ft


def symbol_sweep(args):
    """继承类符号批量落裁决：镜像所属文件 disposition，防误吞展开类真判定。

    只处理本 owner 已 `symbols-claim`（wave_owner 命中）且未裁决、且所属文件裁决 ∉ {迁移, 重写}
    的符号；展开类符号一律拒绝落库并计数报告。默认 dry-run 预览，`--write` 才落库。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（只 sweep 本 owner symbols-claim 认领的符号）")
    repo_cond, repo_params = "", []
    if args.repo:
        repo_cond = " AND f.repo_id " + in_clause(args.repo)
        repo_params = list(args.repo)
    scope = ("FROM symbols s JOIN files f ON f.id = s.file_id"
             " WHERE s.wave_owner = ? AND s.disposition IS NULL%s" % repo_cond)

    def work(conn):
        params = [owner] + repo_params
        inherit_rows = conn.execute(
            ("SELECT s.id, f.disposition, f.target_path, f.repo_id, f.rel_path, s.name " + scope +
             " AND f.disposition NOT IN ('%s') ORDER BY f.repo_id, f.rel_path, s.id"
             ) % "','".join(EXPAND_DISPOSITIONS), params).fetchall()
        expand_pending = conn.execute(
            ("SELECT COUNT(*) " + scope + " AND f.disposition IN ('%s')")
            % "','".join(EXPAND_DISPOSITIONS), params).fetchone()[0]
        claimed_total = conn.execute(
            "SELECT COUNT(*) FROM symbols s JOIN files f ON f.id = s.file_id WHERE s.wave_owner = ?%s"
            % repo_cond, params).fetchone()[0]
        updated = 0
        if inherit_rows and args.write:
            conn.executemany(
                "UPDATE symbols SET disposition=?, target=?, notes=?, status='已裁决' WHERE id=?"
                " AND disposition IS NULL AND wave_owner=?",
                [(r[1], _sweep_target(r[1], r[2]), SWEEP_NOTE_TMPL % r[1], r[0], owner)
                 for r in inherit_rows],
            )
            updated = len(inherit_rows)
        return inherit_rows, expand_pending, claimed_total, updated

    inherit_rows, expand_pending, claimed_total, updated = run_write("symbol-sweep", work)
    dist = count_by(inherit_rows, lambda r: r[1])
    print("symbol-sweep: owner=%s 认领面 %d 个符号（--repo 限定后）" % (owner, claimed_total))
    print("  继承类可落库 %d 个（按文件裁决分布: %s）" % (len(inherit_rows), fmt_dist(dist) or "-"))
    if expand_pending:
        print("  展开类拒绝 %d 个：迁移/重写文件的符号必须逐符号真判定（symbol-dispose），sweep 不落库"
              % expand_pending)
    if not args.write:
        if not inherit_rows:
            print("  (dry-run 预览，未落库) 无继承类符号可落库")
        else:
            print("  (dry-run 预览，未落库；加 --write 落库) 示例:")
            for r in inherit_rows[:10]:
                print("    symbol=%d\t%s/%s\t镜像=%s\ttarget=%s"
                      % (r[0], r[3], r[4], r[1], _sweep_target(r[1], r[2]) or "(空)"))
        return
    if not updated:
        die("没有可落库的继承类符号（owner=%s 认领面内无 未裁决×非迁移/重写 的行；检查是否先 symbols-claim）"
            % owner)
    print("symbol-sweep: owner=%s 落库 %d 个继承类符号（disposition 镜像文件裁决，notes=%r）"
          % (owner, updated, SWEEP_NOTE_TMPL % "<文件裁决>"))
    log_operation("symbol-sweep", owner, updated,
                  "镜像分布=%s 展开类拒绝=%d write=True" % (fmt_dist(dist), expand_pending))


def symbol_redecide(args):
    """已裁决符号精确点名复裁（工单032 通道②）：跨路收口时覆写 disposition/target/notes。

    点名面两选一：`--symbol <symbols.id 清单>` 或 `--notes-like <含字面文本的精确条件>`（后者必须
    带 `--repo` 限定仓库面）——拒绝整表/整仓一把梭。机器互斥语义保留：只有 `files.owner` 或
    `symbols.wave_owner` 命中 `--from-owner <原裁决路>`（可多值，须逐路显式点名）的符号可被改写，
    未点名裁决路的符号一律计越权拒绝；未裁决符号不走本通道（应经 symbols-claim / symbol-dispose）。
    覆写项至少给一个：`--disposition`（五值之一）、`--target`（显式给值即覆写，`""` 即清空）、
    `--notes`（整条覆写）或 `--append-notes`（追加到既有 notes 末尾，「；」分隔）；未给的项保持原值。
    默认 dry-run 预览，`--write` 才落库（单事务 + 台账操作.log 留痕）。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（本路执行者标识，用于操作留痕）")
    from_owners = []
    for o in args.from_owner or []:
        o = o.strip()
        if o and o not in from_owners:
            from_owners.append(o)
    if not from_owners:
        die("symbol-redecide 必须带至少一个 --from-owner <原裁决路>（点名互斥闸口：未点名裁决路的符号一律拒绝复裁）")
    if bool(args.symbol) == bool(args.notes_like):
        die("--symbol <symbols.id 清单> 与 --notes-like <notes 精确条件> 必须二选一（精确点名，拒绝一把梭）")
    if args.notes_like:
        if not re.sub(r"[%_]", "", args.notes_like).strip():
            die("--notes-like 必须含字面文本（拒绝 '%s' 这类全库扫描式条件）" % args.notes_like)
        if not args.repo:
            die("--notes-like 必须同时带 --repo <仓库名> 限定仓库面（精确点名安全闸口）")
    if args.disposition is not None and args.disposition not in VALID_DISPOSITIONS:
        die("--disposition 取值非法：%r（可选：%s）" % (args.disposition, "/".join(VALID_DISPOSITIONS)))
    if args.notes is not None and args.append_notes is not None:
        die("--notes（整条覆写）与 --append-notes（末尾追加）不能同时给")
    if args.disposition is None and args.target is None and args.notes is None and args.append_notes is None:
        die("至少给一个覆写项：--disposition / --target / --notes / --append-notes（复裁不是空转预览的开关）")

    if args.symbol:
        toks = [t for t in re.split(r"[,\s]+", args.symbol.strip()) if t]
        bad = [t for t in toks if not re.fullmatch(r"\d+", t)]
        if bad:
            die("--symbol 含非法 id：%s" % " ".join(bad[:5]))
        sym_ids = sorted(set(int(t) for t in toks))
        cond, params = "s.id " + in_clause(sym_ids), list(sym_ids)
        selector = "--symbol %d 个 id" % len(sym_ids)
    else:
        cond, params = "s.notes LIKE ?", [args.notes_like]
        cond += " AND f.repo_id " + in_clause(args.repo)
        params += list(args.repo)
        selector = "--notes-like %r（repo=%s）" % (args.notes_like, ",".join(args.repo))

    set_parts, set_params = [], []
    if args.disposition is not None:
        set_parts.append("disposition=?")
        set_params.append(args.disposition)
    if args.target is not None:
        set_parts.append("target=?")
        set_params.append(args.target)
    if args.notes is not None:
        set_parts.append("notes=?")
        set_params.append(args.notes)
    elif args.append_notes is not None:
        app = args.append_notes.strip()
        set_parts.append("notes=CASE WHEN notes IS NULL OR notes='' THEN ? ELSE notes || '；' || ? END")
        set_params += [app, app]
    set_sql = ", ".join(set_parts)

    def work(conn):
        rows = conn.execute(
            "SELECT s.id, s.disposition, s.target, s.notes, f.owner, s.wave_owner, f.repo_id, f.rel_path, s.name"
            " FROM symbols s JOIN files f ON f.id = s.file_id WHERE " + cond,
            params,
        ).fetchall()
        pending = [r for r in rows if r[1] is None]
        decided = [r for r in rows if r[1] is not None]
        mine = [r for r in decided if r[4] in from_owners or r[5] in from_owners]
        mine_ids = {r[0] for r in mine}
        foreign = [r for r in decided if r[0] not in mine_ids]
        if args.write and mine:
            conn.executemany(
                "UPDATE symbols SET %s WHERE id=? AND disposition IS NOT NULL" % set_sql,
                [tuple(set_params) + (r[0],) for r in mine],
            )
        return rows, mine, foreign, pending

    rows, mine, foreign, pending = run_write("symbol-redecide", work)
    print("symbol-redecide: owner=%s 点名面=%s 原裁决路点名 from-owner=%s"
          % (owner, selector, ",".join(from_owners)))
    print("  命中 %d 个符号：可复裁（裁决路命中点名）%d 个，越权拒绝（未点名裁决路）%d 个，未裁决跳过 %d 个"
          % (len(rows), len(mine), len(foreign), len(pending)))
    if foreign:
        for r in foreign[:20]:
            print("    symbol=%d\t%s/%s\t%s\towner=%s\twave_owner=%s"
                  % (r[0], r[6], r[7], r[1], r[4] or "(空)", r[5] or "(空)"))
        if len(foreign) > 20:
            print("    …（其余 %d 个省略）" % (len(foreign) - 20))
    if pending:
        print("    未裁决符号不走本通道（应经 symbols-claim / symbol-dispose 落首裁）")
    if not args.write:
        print("  (dry-run 预览，未落库；加 --write 落库)")
        if not mine:
            die("没有可复裁的符号：命中面全部越权或未裁决（检查 --from-owner 点名是否齐全）")
        return
    if not mine:
        die("没有可复裁的符号：命中面全部越权或未裁决（检查 --from-owner 点名是否齐全）")
    print("symbol-redecide: owner=%s 落库 %d 个符号（%s）"
          % (owner, len(mine), set_sql.replace("=?", "'?'")))
    log_operation("symbol-redecide", owner, len(mine),
                  "%s 覆写[%s] from-owner=%s 越权拒绝=%d 未裁决跳过=%d write=True"
                  % (selector, set_sql, ",".join(from_owners), len(foreign), len(pending)))



def verify(args):
    """一致性体检：状态/裁决计数、认领分布、孤儿行、target 落盘存在性（防幻想 target）、
    符号波认领分布与 sweep 一致性（继承类符号 disposition 与所属文件一致性）。"""
    conn = connect()
    limit = args.show or 50
    problems = 0

    print("== 状态计数 ==")
    for status, n in conn.execute("SELECT status, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-10s %d" % (status, n))
    print("== 裁决计数 ==")
    for d, n in conn.execute("SELECT COALESCE(disposition,'(未裁决)') d, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-10s %d" % (d, n))
    print("== 认领分布（非“待评估”行）==")
    owned = conn.execute(
        "SELECT COALESCE(NULLIF(owner,''),'(无 owner)') o, COUNT(*) FROM files"
        " WHERE status <> '待评估' GROUP BY 1 ORDER BY 2 DESC"
    ).fetchall()
    if not owned:
        print("  (无)")
    for o, n in owned:
        print("  %-24s %d" % (o, n))
    print("== 符号裁决 ==")
    total_sym, decided_sym = conn.execute(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN disposition IS NOT NULL THEN 1 ELSE 0 END),0) FROM symbols"
    ).fetchone()
    print("  符号总数 %d，已裁决 %d，未裁决 %d" % (total_sym, decided_sym, total_sym - decided_sym))
    per_file = conn.execute(
        "SELECT file_id, COUNT(*) t, SUM(CASE WHEN disposition IS NOT NULL THEN 1 ELSE 0 END) d"
        " FROM symbols GROUP BY file_id"
    ).fetchall()
    print("  有符号文件 %d 个：符号全裁决 %d 个，部分裁决 %d 个，未开始 %d 个"
          % (len(per_file),
             sum(1 for _, t, d in per_file if d == t),
             sum(1 for _, t, d in per_file if 0 < d < t),
             sum(1 for _, t, d in per_file if d == 0)))
    # 机读终验口径（W2 主智能体裁决）：全部符号 status='已裁决'，即待评估清零
    pending_status = conn.execute(
        "SELECT COUNT(*) FROM symbols WHERE status <> '已裁决'").fetchone()[0]
    print("  终验机读口径：status<>'已裁决'（待评估）的符号 %d 个（收口目标 0）" % pending_status)

    print("== 符号波认领分布（symbols.wave_owner）==")
    wo_rows = conn.execute(
        "SELECT COALESCE(NULLIF(wave_owner,''),'(未认领)') o, COUNT(*),"
        " COALESCE(SUM(CASE WHEN disposition IS NULL THEN 1 ELSE 0 END),0)"
        " FROM symbols GROUP BY 1 ORDER BY 2 DESC").fetchall()
    for o, n, pend in wo_rows:
        print("  %-24s 认领 %d 个，其中未裁决 %d 个" % (o, n, pend))

    print("== sweep 一致性（继承类符号 disposition 必须与所属文件一致）==")
    sweep_mismatch = conn.execute(
        "SELECT s.id, f.repo_id, f.rel_path, s.name, s.disposition, f.disposition"
        " FROM symbols s JOIN files f ON f.id = s.file_id"
        " WHERE s.disposition IS NOT NULL AND f.disposition IS NOT NULL"
        " AND f.disposition NOT IN ('%s') AND s.disposition <> f.disposition"
        " ORDER BY s.id" % "','".join(EXPAND_DISPOSITIONS)).fetchall()
    if not sweep_mismatch:
        print("  (无)")
    else:
        problems += len(sweep_mismatch)
        for r in sweep_mismatch[:limit]:
            print("  sweep 不一致\tsymbol=%d\t%s/%s\t%s\t符号=%s 文件=%s"
                  % (r[0], r[1], r[2], r[3], r[4], r[5]))
        if len(sweep_mismatch) > limit:
            print("  …（共 %d 行，用 --show 放大）" % len(sweep_mismatch))

    print("== 孤儿行（disposition 非空但 status 仍为“待评估”）==")
    orphans = conn.execute(
        "SELECT id, repo_id, rel_path, disposition, status FROM files"
        " WHERE disposition IS NOT NULL AND status='待评估' ORDER BY id"
    ).fetchall()
    if not orphans:
        print("  (无)")
    else:
        problems += len(orphans)
        for r in orphans[:limit]:
            print("  %d\t%s/%s\tdisposition=%s status=%s" % (r[0], r[1], r[2], r[3], r[4]))
        if len(orphans) > limit:
            print("  …（共 %d 行，用 --show 放大）" % len(orphans))

    print("== 符号裁决悬空（符号有 disposition 但所属文件没有）==")
    dangling = conn.execute(
        "SELECT COUNT(*) FROM symbols s JOIN files f ON f.id = s.file_id"
        " WHERE s.disposition IS NOT NULL AND f.disposition IS NULL"
    ).fetchone()[0]
    print("  %d 个符号（提示级，不计异常：文件级裁决未回写即收口为悬空）" % dangling)

    print("== target 落盘校验（防“幻想 target”）==")
    if args.skip_target_check:
        print("  (--skip-target-check：本轮跳过)")
    else:
        cand = conn.execute(
            "SELECT id, repo_id, rel_path, target_path, disposition, status FROM files"
            " WHERE target_path IS NOT NULL AND target_path <> '' ORDER BY id"
        ).fetchall()
        checked, broken, planned, unchecked = 0, [], [], []
        for r in cand:
            tp = r[3].split("#")[0].strip()
            if not tp or any(ch in tp for ch in "*?") or any(k in tp for k in TARGET_ALLOW_VIRTUAL):
                unchecked.append(r)
                continue
            if not tp.startswith(TARGET_CHECK_PREFIXES):
                continue  # 旧仓库保留 / 就近归档等写法不要求落盘于新工作区
            checked += 1
            full = tp if os.path.isabs(tp) else os.path.join(ROOT, tp)
            if os.path.exists(full):
                continue
            # 迁移/重写在实现开工前允许 target 尚未落地（规划落点，提示级）；
            # 其余情形（已声称进行中/完成/验证，或废弃/归档/保留设计这类“去处即落点”）缺失即异常。
            if r[4] in ("迁移", "重写") and r[5] in ("待评估", "评估中", "已裁决"):
                planned.append((r, tp))
            else:
                broken.append((r, tp))
        print("  校验 %d 行（target 指向新工作区/文档库/台账产物）：幻想 target %d 行，"
              "规划中未落地 %d 行，写法不校验 %d 行" % (checked, len(broken), len(planned), len(unchecked)))
        for r, tp in broken[:limit]:
            print("  幻想 target\t%d\t%s/%s\t%s|%s\t->\t%s" % (r[0], r[1], r[2], r[4], r[5], tp))
        if len(broken) > limit:
            print("  …（其余 %d 行用 --show 放大）" % (len(broken) - limit))
        problems += len(broken)
        if args.strict:
            problems += len(planned)
            for r, tp in planned[:limit]:
                print("  规划未落地\t%d\t%s/%s\t%s|%s\t->\t%s" % (r[0], r[1], r[2], r[4], r[5], tp))
        for r in unchecked[:limit]:
            print("  不校验\t%d\t%s/%s\t->\t%s" % (r[0], r[1], r[2], r[3]))

    print("== 结论 ==")
    if problems:
        print("  发现 %d 项一致性问题（退出码 %d）" % (problems, EXIT_VERIFY))
    else:
        print("  一致性问题 0 项")
    conn.close()
    if problems and not args.allow_issues:
        sys.exit(EXIT_VERIFY)


def release(args):
    """归还认领 / 返工复位：把 owner 名下行打回“待评估”，符号一并回滚。"""
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空")
    scope_conds, scope_params = file_filter_conds(args)
    d_conds, d_params = dir_filter_conds(args)
    scope_conds += d_conds
    scope_params += d_params
    ids = read_id_file(args.id_file) if args.id_file else None
    if ids is not None:
        scope_conds.append("id " + in_clause(ids))
        scope_params += ids
    scope_conds.append("owner = ?")
    scope_params += [owner]
    where = " AND ".join(scope_conds)

    def work(conn):
        rows = conn.execute(
            "SELECT id, repo_id, rel_path, disposition FROM files WHERE %s ORDER BY id" % where,
            scope_params,
        ).fetchall()
        if not rows:
            return rows, 0, 0
        decided = [r for r in rows if r[3]]
        if decided and not args.force and not args.keep_disposition:
            die("命中 %d 行，其中 %d 行已落裁决：release 默认只回收未裁决认领，"
                "确认连裁决一起清空请加 --force，或改用 --keep-disposition 只归还认领"
                % (len(rows), len(decided)))
        fids = [r[0] for r in rows]
        n_sym = conn.execute(
            "SELECT COUNT(*) FROM symbols WHERE file_id " + in_clause(fids) +
            " AND (disposition IS NOT NULL OR target IS NOT NULL OR notes IS NOT NULL OR status <> '待评估')",
            fids,
        ).fetchone()[0]
        if args.keep_disposition:
            conn.executemany("UPDATE files SET status='待评估', owner=NULL WHERE id=?", [(i,) for i in fids])
        else:
            conn.executemany(
                "UPDATE files SET status='待评估', owner=NULL, disposition=NULL, target_path=NULL,"
                " notes=NULL, wave=NULL WHERE id=?",
                [(i,) for i in fids],
            )
            conn.execute(
                "UPDATE symbols SET status='待评估', disposition=NULL, target=NULL, notes=NULL WHERE file_id "
                + in_clause(fids),
                fids,
            )
        return rows, len(fids), (0 if args.keep_disposition else n_sym)

    rows, n_files, n_syms = run_write("release", work)
    if not rows:
        die("没有 owner=%s 认领的行可释放（检查 --repo/--dir/--id-file 过滤条件）" % owner)
    for r in rows:
        print("%d\t%s\t%s" % (r[0], r[1], r[2]))
    print("release: owner=%s 归还 %d 行（status=待评估、owner 清空%s），复位带裁决的符号 %d 个"
          % (owner, n_files, "，裁决保留" if args.keep_disposition else "，disposition/target/notes/wave 清空", n_syms))
    log_operation("release", owner, n_files,
                  "files=%d symbols=%d keep_disposition=%s 仓库分布=%s"
                  % (n_files, n_syms, str(bool(args.keep_disposition)),
                     fmt_dist(count_by(rows, lambda r: r[1]))))


def report(repo_id):
    conn = connect()
    rows = conn.execute(
        "SELECT disposition, COUNT(*) FROM files WHERE repo_id=? GROUP BY 1", (repo_id,)
    ).fetchall()
    out = os.path.join(BASE, f"报告-{repo_id}.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# {repo_id} 重构报告\n\n")
        f.write(f"> 生成时间：{time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("## 裁决统计\n\n| 裁决 | 数量 |\n|---|---|\n")
        for d, n in rows:
            f.write(f"| {d or '未裁决'} | {n} |\n")
    print("report:", out)
    conn.close()


# ============================================================================
# 迁移波三段生命周期工具：preflight / migrate-manifest / closure / set-status
# 勘查稿 #137 第七节裁定「方案 C：独立通道+回执即闸」落地；三只读 + 一最小写；
# 真库只读纪律：preflight/migrate-manifest/closure 一律 connect()（不写库、不落 --write）。
# ============================================================================

_PAREN_RE = re.compile(r"（[^（）]*）|\([^()]*\)")


def normalize_target(raw):
    """target 归一化文法（勘查稿 §3.1 通道① / 第七节裁定 3）。

    返回 (canonical, anchor, kind)：kind ∈
      "path"（canonical 为归一路径）/ "virtual"（只读参考/不搬运/就近归档等合法不落盘写法）/
      "empty"（空 target，如废弃/归档）/ "unparsed"（解析失败，交人工裁）。
    文法（依序）：剥 `#锚点` 尾段 → 剥「计划归属：/计划归属:」前缀 → 剥波次前缀 `W\\d+ ` →
      去全/半角括注 `（…）`/`(…)` → 截「；/。」句读 → 取首个空白分隔 token 为路径主体 →
      W6 别名 `server/…`→`chips-ecosystem/server/…` → 通配 `*`/`?` 归到其目录前缀。
    """
    if raw is None:
        return ("", "", "empty")
    s = str(raw).strip()
    if not s:
        return ("", "", "empty")
    anchor = ""
    if "#" in s:
        head, _, tail = s.partition("#")
        s = head
        anchor = tail.strip()
    s = re.sub(r"^计划归属[:：]\s*", "", s)
    s = re.sub(r"^W\d+\s+", "", s)
    s = _PAREN_RE.sub("", s)
    s = re.split(r"[；。]", s)[0]
    virtual = any(k in s for k in _MAP_TARGET_VIRTUAL)
    tokens = s.split()
    token = tokens[0] if tokens else ""
    if not token:
        return ("", anchor, "virtual" if virtual else "unparsed")
    path = re.split(r"[*?]", token)[0].rstrip("/：:，, ")
    if path.startswith("server/") or path == "server":
        path = "chips-ecosystem/" + path
    path = path.rstrip("/")
    if not path:
        return ("", anchor, "virtual" if virtual else "unparsed")
    if virtual and not path.startswith(TARGET_CHECK_PREFIXES):
        return (path, anchor, "virtual")
    return (path, anchor, "path")


def _cred_basename(rel_path):
    return rel_path.replace("\\", "/").rsplit("/", 1)[-1]


def is_credential_path(rel_path):
    """凭据模式判定（勘查稿 §3.3 凭据红线）：仅匹配 basename，排除 .env.example/.envrc。"""
    b = _cred_basename(rel_path)
    if b in CRED_NAME_EXCLUSIONS:
        return False
    if b in CRED_EXACT_BASENAMES:
        return True
    if b.endswith(CRED_SUFFIX_BASENAMES):
        return True
    if b.startswith(CRED_PREFIX_BASENAMES):
        return True
    if b.startswith(CRED_DOTTED_PREFIXES):
        return True
    return False


def _expand_02_repo_cell(cell):
    """把 02 §一 首格（可含家族 `/` 分隔、裸名）展开为 repo_id 列表（只保留 Chip* 平台仓）。

    doclib 行（`旧版-*`、`-2` 后缀等）无代码落点、只读参考，一律跳过——机读镜像只覆盖有落点的仓。
    """
    out = []
    for tok in re.split(r"\s*/\s*", cell.strip()):
        tok = tok.strip().strip("`")
        if not tok or tok.startswith("旧版") or tok.startswith("-"):
            continue
        rid = tok if tok.startswith("Chip") else "Chips-" + tok
        if rid.startswith("Chip"):
            out.append(rid)
    return out


def _canon_02_token(tok):
    t = _PAREN_RE.sub("", tok.strip()).strip()
    t = re.sub(r"[*?]+$", "", t).strip(" /")
    if not t or t == "只读参考":
        return ""
    if t.startswith(TARGET_CHECK_PREFIXES):
        return t.rstrip("/")
    if t.startswith("server/") or t == "server":
        return ("chips-ecosystem/" + t).rstrip("/")
    if t.startswith(("packages/", "plugins/", "tools/")):
        return ("chips-ecosystem/" + t).rstrip("/")
    return t.rstrip("/")


def parse_02_repo_prefixes(md_path):
    """解析《02-仓库映射与新工作区》§一表：repo_id → 允许 canonical 前缀集合（与常量同构，供自检比对）。"""
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except OSError as e:
        die("无法读取 02 映射文档：%s（%s）" % (md_path, e))
    mapping = {}
    in_sec1 = False
    for ln in lines:
        stripped = ln.strip()
        if stripped.startswith("## "):
            if stripped.lstrip("# ").startswith("一") and "仓库" in stripped:
                in_sec1 = True
                continue
            if in_sec1:
                break  # 越过 §一 之后的下一个 ## 标题即停
        if not in_sec1 or not stripped.startswith("|"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if len(cells) < 3:
            continue
        repo_cell, owner_cell = cells[0], cells[-1]
        if repo_cell in ("旧仓库", "") or set(repo_cell) <= set("-: "):
            continue
        prefixes = sorted({_canon_02_token(t) for t in re.findall(r"`([^`]+)`", owner_cell)} - {""})
        for rid in _expand_02_repo_cell(repo_cell):
            mapping[rid] = tuple(prefixes)
    return mapping


def map_prefixes_self_check(md_path):
    """常量↔02 表一致性自检（第七节裁定 3）：两处分叉即返回 issue 列表（空=一致）。"""
    derived = parse_02_repo_prefixes(md_path)
    issues = []
    const_repos, doc_repos = set(REPO_TARGET_PREFIXES), set(derived)
    for rid in sorted(const_repos - doc_repos):
        issues.append("REPO-MAP-DRIFT: 常量含仓 %s 但 02 §一 无对应行" % rid)
    for rid in sorted(doc_repos - const_repos):
        issues.append("REPO-MAP-DRIFT: 02 §一 含仓 %s 但常量未镜像" % rid)
    for rid in sorted(const_repos & doc_repos):
        if tuple(sorted(REPO_TARGET_PREFIXES[rid])) != tuple(derived[rid]):
            issues.append("REPO-MAP-DRIFT: 仓 %s 前缀集分叉 常量=%s 02=%s"
                          % (rid, list(REPO_TARGET_PREFIXES[rid]), list(derived[rid])))
    return issues


def _map_allowed_prefixes(repo_id):
    return tuple(REPO_TARGET_PREFIXES.get(repo_id, ())) + MAP_UNIVERSAL_PREFIXES


def _target_matches_repo_map(repo_id, canonical):
    """仓级映射一致性：canonical target 是否落在本仓允许前缀集内。"""
    return any(canonical == p or canonical.startswith(p.rstrip("/") + "/") or canonical.startswith(p)
               for p in _map_allowed_prefixes(repo_id) if p)


def walk_source_snapshot(repo_id):
    """只读 walk 旧仓磁盘（沿用 EXCLUDE_DIRS 与 .DS_Store 跳过），返回 rel_path → sha1（与 files.sha1 同口径）。"""
    base = os.path.join(ROOT, repo_id)
    out = {}
    if not os.path.isdir(base):
        return out
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn == ".DS_Store":
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, base).replace("\\", "/")
            try:
                with open(full, "rb") as f:
                    out[rel] = hashlib.sha1(f.read()).hexdigest()
            except OSError:
                continue
    return out


def _git_ls_files(paths):
    """只读子进程 `git ls-files -- <paths>`（勘查稿 §3.3 永不入库②）；异常/无仓时返回 None 表不确定。"""
    try:
        proc = subprocess.run(["git", "ls-files", "--"] + list(paths),
                              cwd=ROOT, capture_output=True, text=True)
        if proc.returncode != 0:
            return None
        return [x for x in proc.stdout.splitlines() if x.strip()]
    except (OSError, ValueError):
        return None


def _new_issue(bucket, code, level, repo, detail, requires_ack=False):
    bucket.append({"code": code, "level": level, "repo": repo or "-",
                   "detail": detail, "requires_ack": requires_ack})


def _expand_rows(conn, repo_ids=None):
    """files 表 disposition∈(迁移,重写) 行（可选按仓过滤）：[(id,repo,rel,disp,target,status,sha1,notes)]。"""
    where = "disposition IN ('%s')" % "','".join(EXPAND_DISPOSITIONS)
    params = []
    if repo_ids:
        where += " AND repo_id " + in_clause(repo_ids)
        params += list(repo_ids)
    return conn.execute(
        "SELECT id, repo_id, rel_path, disposition, target_path, status, sha1, COALESCE(notes,'')"
        " FROM files WHERE %s ORDER BY repo_id, rel_path" % where, params).fetchall()


def _cred_rows(conn, repo_ids=None):
    """台账面凭据模式命中行：[(repo, rel, disposition, target_path)]。"""
    rows = conn.execute(
        "SELECT repo_id, rel_path, disposition, COALESCE(target_path,'') FROM files").fetchall()
    return [(r[0], r[1], r[2], r[3]) for r in rows
            if is_credential_path(r[1]) and (not repo_ids or r[0] in repo_ids)]


def _zone_of(canonical):
    parts = [p for p in canonical.split("/") if p]
    return "/".join(parts[:4]) if len(parts) > 4 else (canonical or "(未归类)")


def preflight(args):
    """迁移前核对（只读库+只读磁盘）：六检查序列 + 两红线机检，红项退出码 3。"""
    repos = []
    for chunk in (args.repo if isinstance(args.repo, list) else [args.repo]) or []:
        for r in str(chunk).split(","):
            r = r.strip()
            if r and r not in repos:
                repos.append(r)
    if not repos:
        die("preflight 必须带 --repo <id>[,<id>...]")
    for r in repos:
        if r in NEVER_INGEST_DIRS:
            die("preflight 拒绝为『永不入库』目录 %s 出工单（勘查稿 §3.3 红线）" % r, EXIT_NOOP)
    conn = connect()
    issues, warnings, checks = [], [], {}

    # 0) 常量↔02 表一致性自检（镜像腐化即红，第七节裁定 3）
    map_issues = map_prefixes_self_check(os.path.join(BASE, "02-仓库映射与新工作区.md"))
    for it in map_issues:
        _new_issue(issues, "REPO-MAP-DRIFT", "red", None, it)
    checks["map_self_check"] = "红" if map_issues else "绿"

    unparsed, map_unregistered = [], set()
    for rid in repos:
        # 1) 双零前置
        pending = conn.execute(
            "SELECT COUNT(*) FROM files WHERE repo_id=? AND " + PENDING_STATUS_SQL,
            (rid,)).fetchone()[0]
        empty_target = conn.execute(
            "SELECT COUNT(*) FROM files WHERE repo_id=? AND disposition IN ('%s')"
            " AND (target_path IS NULL OR target_path='')" % "','".join(EXPAND_DISPOSITIONS),
            (rid,)).fetchone()[0]
        if pending:
            _new_issue(issues, "PENDING-NOT-ZERO", "red", rid,
                       "登记态（待评估/评估中）行 %d（双零前置未成立）" % pending)
        if empty_target:
            _new_issue(issues, "EXPAND-EMPTY-TARGET", "red", rid, "迁移/重写空 target %d 行" % empty_target)
        checks.setdefault("double_zero", {})[rid] = "绿" if not (pending or empty_target) else "红"

        # 2) 快照漂移（沿用 EXCLUDE_DIRS walk）
        db_map = {rel: (sha1 or "") for rel, sha1 in conn.execute(
            "SELECT rel_path, sha1 FROM files WHERE repo_id=?", (rid,)).fetchall()}
        disk_map = walk_source_snapshot(rid)
        added = sorted(set(disk_map) - set(db_map))
        deleted = sorted(set(db_map) - set(disk_map))
        changed = sorted(rel for rel in set(db_map) & set(disk_map) if db_map[rel] != disk_map[rel])
        for rel in changed:
            _new_issue(issues, "SNAPSHOT-DRIFT", "red", rid, "源仓变更（违规改动）：%s" % rel)
        for rel in added:
            _new_issue(warnings, "SNAPSHOT-ADD", "warn", rid, "磁盘新增未登记：%s" % rel)
        for rel in deleted:
            _new_issue(warnings, "SNAPSHOT-DEL", "warn", rid, "台账有磁盘无：%s" % rel)
        checks.setdefault("snapshot", {})[rid] = ("红" if changed
            else ("WARN(增%d/删%d)" % (len(added), len(deleted)) if (added or deleted) else "绿"))

        # 3) target 归一化 + 4) 映射一致性（本仓展开行）
        allowed = REPO_TARGET_PREFIXES.get(rid)
        for fid, rel, disp, raw in conn.execute(
                "SELECT id, rel_path, disposition, target_path FROM files"
                " WHERE repo_id=? AND disposition IN ('%s')" % "','".join(EXPAND_DISPOSITIONS), (rid,)):
            canon, _a, kind = normalize_target(raw)
            if kind == "unparsed":
                unparsed.append({"repo": rid, "file_id": fid, "rel_path": rel, "raw": raw})
                continue
            if kind in ("virtual", "empty"):
                continue
            if allowed is None:
                map_unregistered.add(rid)
                continue
            if not _target_matches_repo_map(rid, canon):
                _new_issue(issues, "MAP-MISMATCH", "red", rid,
                           "files.id=%s %s canonical=%s 不在 02 允许前缀集" % (fid, rel, canon))

        # 6) verify 同源判据的仓级切片（sweep 一致性 + 孤儿行）
        sweep_bad = conn.execute(
            "SELECT COUNT(*) FROM symbols s JOIN files f ON f.id=s.file_id"
            " WHERE f.repo_id=? AND s.disposition IS NOT NULL AND f.disposition IS NOT NULL"
            " AND f.disposition NOT IN ('%s') AND s.disposition <> f.disposition"
            % "','".join(EXPAND_DISPOSITIONS), (rid,)).fetchone()[0]
        orphans = conn.execute(
            "SELECT COUNT(*) FROM files WHERE repo_id=? AND disposition IS NOT NULL AND status='待评估'",
            (rid,)).fetchone()[0]
        if sweep_bad:
            _new_issue(issues, "SWEEP-MISMATCH", "red", rid, "继承类符号与文件裁决不一致 %d 个" % sweep_bad)
        if orphans:
            _new_issue(issues, "ORPHAN-ROW", "red", rid, "孤儿行（有裁决却待评估）%d 行" % orphans)
        checks.setdefault("slice", {})[rid] = "绿" if not (sweep_bad or orphans) else "红"

    # 5) 两条红线机检
    #   凭据三段断言（①台账面 ②新仓面=closure ③轮换签收位）
    cred_hit = 0
    cred_rotation = []
    for repo, rel, disp, tp in _cred_rows(conn, set(repos)):
        cred_hit += 1
        canon, _a, _k = normalize_target(tp)
        if disp not in ("废弃", "归档") or canon.startswith("chips-ecosystem/"):
            _new_issue(issues, "CRED-LEDGER", "red", repo,
                       "凭据行 %s/%s disposition=%s canonical=%s（须废弃/归档且禁落新仓）"
                       % (repo, rel, disp, canon or "-"))
        _new_issue(cred_rotation, "CRED-ROTATION", "ack", repo,
                   "须由主智能体在 W6 完成轮换并签收：%s/%s" % (repo, rel), requires_ack=True)
    checks["cred_ledger"] = ("绿（命中 %d 行，全部废弃/归档且未落新仓）" % cred_hit) if cred_hit else "绿（无命中）"

    #   永不入库四断言（①DB无行 ②git无跟踪 ③manifest入口=preflight/manifest 前置拦截 ④gitignore显式条目）
    for d in NEVER_INGEST_DIRS:
        n = conn.execute("SELECT COUNT(*) FROM repos WHERE id=?", (d,)).fetchone()[0] + \
            conn.execute("SELECT COUNT(*) FROM files WHERE repo_id=?", (d,)).fetchone()[0]
        if n:
            _new_issue(issues, "NEVER-INGEST-DB", "red", d, "台账面出现 %d 行（断言①破）" % n)
    tracked = _git_ls_files(list(NEVER_INGEST_DIRS))
    if tracked is None:
        _new_issue(warnings, "NEVER-INGEST-GIT", "warn", None, "git ls-files 不可判定（断言②跳过）")
    elif tracked:
        _new_issue(issues, "NEVER-INGEST-GIT", "red", None,
                   "git 已跟踪 %d 项（断言②破）：%s" % (len(tracked), ", ".join(tracked[:5])))
    gi_path = os.path.join(ROOT, ".gitignore")
    gi = ""
    if os.path.exists(gi_path):
        with open(gi_path, "r", encoding="utf-8") as f:
            gi = f.read()
    for entry in NEVER_INGEST_IGNORE_ENTRIES:
        if entry not in gi:
            _new_issue(warnings, "NEVER-INGEST-IGNORE", "warn", None,
                       "根 .gitignore 缺显式条目 %s（断言④未落地）" % entry)
    checks["never_ingest"] = "绿" if not any(
        i["code"].startswith("NEVER-INGEST") and i["level"] == "red" for i in issues) else "红"

    for rid in sorted(map_unregistered):
        _new_issue(warnings, "MAP-UNREGISTERED", "warn", rid, "该仓未在 02 §一 登记，映射一致性跳过（非矛盾）")

    reds = [i for i in issues if i["level"] == "red"]
    result = {"channel": "preflight", "repos": repos, "red": len(reds), "warn": len(warnings),
              "unparsed": unparsed, "issues": issues, "warnings": warnings, "checks": checks,
              "cred_rotation_ack": cred_rotation}
    if args.json:
        payload = json.dumps(result, ensure_ascii=False, indent=2)
        if args.receipt:
            with open(args.receipt, "w", encoding="utf-8") as f:
                f.write(payload + "\n")
            print("preflight 回执已写入：%s" % args.receipt)
        print(payload)
    else:
        print("== preflight（迁移前核对，只读）==")
        for k, v in checks.items():
            print("  %-16s %s" % (k, " ".join("%s=%s" % (a, b) for a, b in v.items())
                                  if isinstance(v, dict) else v))
        print("  红项 %d / 警告 %d / 归一化失败 %d / 凭据轮换签收项 %d"
              % (len(reds), len(warnings), len(unparsed), len(cred_rotation)))
        for it in (issues + warnings)[:50]:
            print("   [%s|%s] %s: %s" % (it["level"], it["code"], it["repo"], it["detail"]))
        if len(issues) + len(warnings) > 50:
            print("   …（其余 %d 项从略，用 --json 看全量）" % (len(issues) + len(warnings) - 50))
        if unparsed:
            print("  归一化失败待人工裁（unparsed）%d 行：" % len(unparsed))
            for u in unparsed[:20]:
                print("    files.id=%s %s/%s raw=%s" % (u["file_id"], u["repo"], u["rel_path"], u["raw"]))
    conn.close()
    if reds:
        sys.exit(EXIT_VERIFY)


def migrate_manifest(args):
    """迁移中执行清单（只读库、可写清单文件）：TSV+JSON+by-zone，行数=DB 命中自检行入头部。"""
    repo = (args.repo or "").strip()
    if not repo:
        die("migrate-manifest 必须带 --repo <id>")
    if repo in NEVER_INGEST_DIRS:
        die("migrate-manifest 拒绝为『永不入库』目录 %s 出清单（勘查稿 §3.3 断言③入口拦截）" % repo, EXIT_NOOP)
    if args.class_ != "expand":
        die("migrate-manifest --class 目前仅支持 expand（迁移+重写执行清单）；实际取值=%s" % args.class_, EXIT_ARGS)
    conn = connect()
    rows = _expand_rows(conn, [repo])
    symcount = {r[0]: (r[1], r[2]) for r in conn.execute(
        "SELECT s.file_id,"
        " SUM(CASE WHEN s.disposition IN ('%s') THEN 1 ELSE 0 END),"
        " SUM(CASE WHEN s.target LIKE '%%#%%' THEN 1 ELSE 0 END)"
        " FROM symbols s JOIN files f ON f.id=s.file_id WHERE f.repo_id=? GROUP BY s.file_id"
        % "','".join(EXPAND_DISPOSITIONS), (repo,)).fetchall()}
    conn.close()
    entries = []
    for fid, rrepo, rel, disp, raw_target, status, sha1, notes in rows:
        canon, anchor, kind = normalize_target(raw_target)
        exp, anc = symcount.get(fid, (0, 0))
        entries.append({"file_id": fid, "repo_id": rrepo, "rel_path": rel, "sha1": sha1 or "",
                        "disposition": disp, "canonical_target": canon, "target_kind": kind,
                        "anchor": anchor, "expand_symbol_count": int(exp or 0),
                        "anchor_count": int(anc or 0), "status": status, "notes": (notes or "")[:80]})
    anchor_total = sum(e["anchor_count"] for e in entries)

    outdir = args.out or os.path.join("/tmp", "manifest-%s" % repo)
    os.makedirs(outdir, exist_ok=True)
    tsv_path = os.path.join(outdir, "manifest-%s.tsv" % repo)
    json_path = os.path.join(outdir, "manifest-%s.json" % repo)
    header = "# repo=%s rows=%d (DB命中自检) anchor_total=%d generated=%s" % (
        repo, len(entries), anchor_total, now())
    cols = ["file_id", "repo_id", "rel_path", "sha1", "disposition", "canonical_target",
            "target_kind", "expand_symbol_count", "anchor_count", "status", "notes"]
    with open(tsv_path, "w", encoding="utf-8") as f:
        f.write(header + "\n")
        f.write("\t".join(cols) + "\n")
        for e in entries:
            f.write("\t".join(str(e.get(c, "")).replace("\t", " ") for c in cols) + "\n")

    conflict_issues = []
    if args.check_dest:
        by_target = {}
        for e in entries:
            if e["target_kind"] == "path" and e["canonical_target"]:
                by_target.setdefault(e["canonical_target"], []).append(e["rel_path"])
        for ct, srcs in sorted(by_target.items()):
            if len(srcs) > 1:
                conflict_issues.append("MULTI-SOURCE %s ← %d 源（%s…）" % (ct, len(srcs), ", ".join(srcs[:3])))
            full = os.path.join(ROOT, ct)
            if ct.startswith("chips-ecosystem/server/") and not os.path.isdir(full):
                conflict_issues.append("WARN-DEST-MISSING（W6 未创建，降级）%s" % ct)
            elif os.path.isfile(full) and not any(ct.endswith(ext) for ext in
                     (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".css", ".scss", ".html")):
                conflict_issues.append("DEST-COLLIDE 目标已存在同名文件：%s" % ct)

    receipt = {"channel": "migrate-manifest", "repo": repo, "row_count": len(entries),
               "db_count": len(rows), "db_count_matches": len(entries) == len(rows),
               "anchor_total": anchor_total,
               "check_dest": ({"issues": conflict_issues} if args.check_dest else None),
               "entries": entries}
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(receipt, f, ensure_ascii=False, indent=2)

    zonedir = os.path.join(outdir, "by-zone")
    if os.path.isdir(zonedir):
        shutil.rmtree(zonedir)
    os.makedirs(zonedir, exist_ok=True)
    zones = {}
    for e in entries:
        zones.setdefault(_zone_of(e["canonical_target"]), []).append(e)
    for zone, es in sorted(zones.items()):
        safe = zone.replace("/", "_") or "(root)"
        with open(os.path.join(zonedir, "zone-%s.tsv" % safe), "w", encoding="utf-8") as f:
            f.write("# zone=%s rows=%d\n" % (zone, len(es)))
            for e in sorted(es, key=lambda x: x["rel_path"]):
                f.write("%s\t%s\t%s\n" % (e["disposition"], e["rel_path"], e["canonical_target"]))

    print("migrate-manifest: repo=%s 行数=%d（=DB 命中 %d，自检 %s）展开符号锚点合计=%d"
          % (repo, len(entries), len(rows), "OK" if len(entries) == len(rows) else "MISMATCH", anchor_total))
    print("  TSV: %s\n  JSON: %s\n  by-zone: %s（%d 个落点分组）" % (tsv_path, json_path, zonedir, len(zones)))
    if args.check_dest:
        if conflict_issues:
            print("  落点冲突预检：WARN %d 项（不改变退出码）" % len(conflict_issues))
            for c in conflict_issues[:30]:
                print("    " + c)
        else:
            print("  落点冲突预检：无冲突")
    if len(entries) != len(rows):
        sys.exit(EXIT_VERIFY)


def _matrix_parse(path):
    """解析矩阵 §一 计数表：返回 (repo → {disposition:count})，按表头列名动态映射（不假设列序）。"""
    with open(path, "r", encoding="utf-8") as f:
        lines = f.read().splitlines()
    in_sec1 = False
    header_cols = None
    got_data = False
    data = {}
    for ln in lines:
        s = ln.strip()
        if s.startswith("## "):
            # §一 即计数表所在节；实测 11 份矩阵标题写法不一（裁决计数总览/裁决统计/真实计数），
            # 一律以「一、」定位，行级再以表头首格「仓库」把关，误入他节也不会误读。
            if s.lstrip("# ").startswith("一"):
                in_sec1 = True
                continue
            if in_sec1:
                break
        if not in_sec1:
            continue
        if not s.startswith("|"):
            # 只勾稽 §一 的文件级计数表（契约「files GROUP BY repo_id, disposition 逐项比对」）；
            # 部分矩阵 §一 还含符号级等后续表（如服务端两仓），首表数据段后即收口，防串表误读。
            if got_data:
                break
            continue
        cells = [c.strip().strip("*").strip() for c in s.strip("|").split("|")]
        if header_cols is None:
            if cells and cells[0] == "仓库":
                header_cols = cells
            continue
        if set("".join(cells)) <= set("-: "):
            continue
        repo = cells[0]
        if repo in ("合计", "总计", ""):
            continue
        counts = {}
        for i, col in enumerate(header_cols):
            if i == 0 or i >= len(cells):
                continue
            disp = MATRIX_DISPOSITION_COLS.get(col.replace("*", "").strip())
            if disp and re.fullmatch(r"\d+", cells[i] or ""):
                counts[disp] = int(cells[i])
        if counts:
            data[repo] = counts
            got_data = True
    return data


def _extract_path_tokens(text):
    """从证据列抽取路径 token（带扩展名），供存在性抽样复核（只核路径、不核行号）。"""
    toks = set()
    for m in re.finditer(r"[\w.\-/\u4e00-\u9fff]+/[\w.\-/\u4e00-\u9fff]+", text):
        t = m.group(0).strip(".,;:、（）()")
        t = re.sub(r":\d+.*$", "", t)
        if re.search(r"\.(ts|tsx|js|jsx|mjs|cjs|rs|json|md|css|scss|html|yaml|yml|py)$", t):
            toks.add(t)
    return toks


def closure(args):
    """迁移后闭环校验 + 矩阵闭合闸（只读）：落点实落 / 矩阵勾稽 / 残留扫描 / strict 终验。"""
    repos = None
    if args.repo:
        repos = []
        for chunk in (args.repo if isinstance(args.repo, list) else [args.repo]):
            for r in str(chunk).split(","):
                r = r.strip()
                if r and r not in repos:
                    repos.append(r)
    matrix_glob = args.matrix or os.path.join(ROOT, "项目日志与笔记/重构计划/旧功能覆盖矩阵-*.md")
    issues, warnings = [], []
    conn = connect()

    # (a) 落点实落（含符号 target 锚前段；重写行 `#点名任务`/尾注豁免至波次结束）
    landed = planned = exempt = 0
    for fid, repo, rel, disp, raw_target, status, _s, _n in _expand_rows(conn, repos):
        canon, _a, kind = normalize_target(raw_target)
        if kind in ("virtual", "empty") or not canon.startswith(TARGET_CHECK_PREFIXES):
            continue
        if os.path.exists(os.path.join(ROOT, canon)):
            landed += 1
            continue
        if disp == "重写" and ("点名任务" in (raw_target or "")):
            exempt += 1
            continue
        planned += 1
        _new_issue(issues if args.strict else warnings, "LANDING-MISSING",
                   "red" if args.strict else "warn", repo,
                   "files.id=%s %s canonical=%s 落点未实落" % (fid, rel, canon))
    symbol_checked = symbol_missing = 0
    sym_where = ("SELECT s.id, f.repo_id, s.target FROM symbols s JOIN files f ON f.id=s.file_id"
                 " WHERE f.disposition IN ('%s') AND s.target IS NOT NULL AND s.target<>''"
                 % "','".join(EXPAND_DISPOSITIONS))
    sym_params = []
    if repos:
        sym_where += " AND f.repo_id " + in_clause(repos)
        sym_params = list(repos)
    for sid, repo, starget in conn.execute(sym_where, sym_params).fetchall():
        canon, _a, kind = normalize_target(starget)
        if kind != "path" or not canon.startswith(TARGET_CHECK_PREFIXES):
            continue
        symbol_checked += 1
        if not os.path.exists(os.path.join(ROOT, canon)):
            symbol_missing += 1
            if args.strict:
                _new_issue(issues, "SYM-TARGET-MISSING", "red", repo,
                           "symbols.id=%d 锚前段 canonical=%s 未实落" % (sid, canon))

    # (b) 矩阵勾稽
    matrix_files = sorted(glob.glob(matrix_glob))
    if matrix_files:
        db_counts = {}
        for repo, disp, n in conn.execute(
                "SELECT repo_id, disposition, COUNT(*) FROM files WHERE disposition IS NOT NULL"
                " GROUP BY repo_id, disposition"):
            db_counts.setdefault(repo, {})[disp] = n
        for mf in matrix_files:
            name = os.path.basename(mf)
            for repo, counts in sorted(_matrix_parse(mf).items()):
                for disp, declared in counts.items():
                    actual = db_counts.get(repo, {}).get(disp, 0)
                    if declared != actual:
                        _new_issue(issues, "MATRIX-COUNT", "red", repo,
                                   "矩阵 %s 声明 %s=%d 但 DB=%d" % (name, disp, declared, actual))
            with open(mf, "r", encoding="utf-8") as f:
                for line in f:
                    if "|" not in line:
                        continue
                    for tok in _extract_path_tokens(line):
                        if not tok.startswith(("packages/", "plugins/", "tools/", "tests/", "crates/", "examples/")):
                            continue
                        cand = "chips-ecosystem/" + tok
                        if not os.path.exists(os.path.join(ROOT, cand)):
                            _new_issue(issues if args.strict else warnings, "MATRIX-EVIDENCE",
                                       "red" if args.strict else "warn", repo,
                                       "矩阵 %s 证据路径缺失：%s" % (name, cand))

    # (c) 残留扫描
    #   契约 §3.1(c)(ii)：命中「废弃/归档行的 repo_id/rel_path 同名尾部」才计红——
    #   即新仓路径以 <repo_id>/<rel_path> 结尾（旧仓整目录被连根搬进新仓的形态）；
    #   裸 rel_path 相等不算（README.md/package.json 等通用根文件在新仓自有、与旧仓裁决无关）。
    retired_tails = {r[0] + "/" + r[1] for r in conn.execute(
        "SELECT repo_id, rel_path FROM files WHERE disposition IN ('废弃','归档')").fetchall()}
    residual_cred = residual_dup = residual_top = 0
    for dirpath, dirnames, filenames in os.walk(NEW_WS):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for fn in filenames:
            rel = os.path.relpath(os.path.join(dirpath, fn), NEW_WS).replace("\\", "/")
            if is_credential_path(rel):
                residual_cred += 1
                _new_issue(issues, "RESIDUAL-CRED", "red", None,
                           "新仓凭据残留（断言②）：chips-ecosystem/%s" % rel)
            hit = next((rp for rp in retired_tails
                        if rel == rp or rel.endswith("/" + rp)), None)
            if hit:
                residual_dup += 1
                _new_issue(issues, "RESIDUAL-DUP", "red", None,
                           "新仓出现废弃/归档行同名尾部（契约 §3.1(c)(ii)）：chips-ecosystem/%s ← %s" % (rel, hit))
    # 工作区级 Cargo 源覆盖配置（chips-ecosystem/.cargo/config.toml，已入库），属在册顶层结构；
    # 2026-09-23 主智能体裁定补登记（#184 裁②兑现）。
    known_top = {"packages", "plugins", "server", "tools", "tests", "examples", "docs",
                 "node_modules", "coverage", "reports", "target", "dist", "归档", ".git",
                 ".cargo"}
    for name in sorted(os.listdir(NEW_WS)):
        if os.path.isdir(os.path.join(NEW_WS, name)) and name not in known_top:
            residual_top += 1
            _new_issue(issues, "RESIDUAL-TOPDIR", "red", None, "新工作区顶层未在册目录：%s" % name)
    for d in NEVER_INGEST_DIRS:
        n = conn.execute("SELECT COUNT(*) FROM repos WHERE id=?", (d,)).fetchone()[0] + \
            conn.execute("SELECT COUNT(*) FROM files WHERE repo_id=?", (d,)).fetchone()[0]
        if n:
            _new_issue(issues, "NEVER-INGEST-DB", "red", d, "台账面出现 %d 行（断言①破）" % n)
        if os.path.isdir(os.path.join(NEW_WS, d)):
            _new_issue(issues, "NEVER-INGEST-WS", "red", d, "新工作区出现 %s/（断言破）" % d)

    # (d) status 终验：strict 下迁移/重写未到「已验证」计红
    not_verified = 0
    if args.strict:
        where = "disposition IN ('%s') AND status <> '已验证'" % "','".join(EXPAND_DISPOSITIONS)
        params = []
        if repos:
            where += " AND repo_id " + in_clause(repos)
            params = list(repos)
        for fid, repo, rel, status in conn.execute(
                "SELECT id, repo_id, rel_path, status FROM files WHERE %s" % where, params).fetchall():
            not_verified += 1
            _new_issue(issues, "STATUS-NOT-VERIFIED", "red", repo,
                       "files.id=%s %s status=%s（未到已验证）" % (fid, rel, status))

    # 双零残留终口径：待评估 0 + 幻想 target 0 + 残留 0
    # 「待评估」计登记态行（PENDING_STATUS_SQL，与 preflight 同源，工单048）——合法回写进展态不计
    # 红触发面两通道对称（工单048 #162 §升级1 裁定=补）：pending>0 即落红 PENDING-NOT-ZERO，
    # 与 preflight 双零前置红臂（本函数 preflight 段）共用同一 code、同一 PENDING_STATUS_SQL 口径；
    # 无条件计红（同残留三红母型，不受 --strict 门控）。回执 JSON 既有键名/键序零改动，仅 issues 面增红项。
    pending_all = conn.execute(
        "SELECT COUNT(*) FROM files WHERE " + PENDING_STATUS_SQL).fetchone()[0]
    if pending_all:
        _new_issue(issues, "PENDING-NOT-ZERO", "red", None,
                   "登记态（待评估/评估中）行 %d（双零残留终口径未成立）" % pending_all)
    fantasy = 0
    all_rows = conn.execute(
        "SELECT repo_id, rel_path, disposition, target_path, status FROM files"
        " WHERE target_path IS NOT NULL AND target_path<>''").fetchall()
    for repo, rel, disp, raw, status in all_rows:
        canon, _a, kind = normalize_target(raw)
        if kind == "path" and canon.startswith(TARGET_CHECK_PREFIXES) and not os.path.exists(os.path.join(ROOT, canon)):
            if disp in ("废弃", "归档", "保留设计") or status in ("进行中", "已完成", "已验证"):
                fantasy += 1
    residual_total = residual_cred + residual_dup + residual_top
    reds = [i for i in issues if i["level"] == "red"]
    conn.close()
    result = {"channel": "closure", "repos": repos or "ALL", "strict": bool(args.strict),
              "red": len(reds), "warn": len(warnings),
              "double_zero_residual": {"待评估": pending_all, "幻想target": fantasy,
                                       "残留": residual_total},
              "landing": {"landed": landed, "planned_missing": planned, "exempt": exempt,
                          "symbol_checked": symbol_checked, "symbol_missing": symbol_missing},
              "matrix_files": len(matrix_files), "not_verified": not_verified,
              "issues": issues, "warnings": warnings}
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("== closure（迁移后闭环校验，只读%s）==" % ("，--strict 终验" if args.strict else ""))
        print("  落点实落：已落 %d / 未落 %d / 重写点名任务豁免 %d；符号锚段 检 %d 缺 %d"
              % (landed, planned, exempt, symbol_checked, symbol_missing))
        print("  矩阵勾稽：%d 份分表" % len(matrix_files))
        print("  残留扫描：凭据 %d / 同名 %d / 未在册顶层目录 %d" % (residual_cred, residual_dup, residual_top))
        print("  双零残留终口径：待评估=%d 幻想target=%d 残留=%d（三项全 0 即终口径达成）"
              % (pending_all, fantasy, residual_total))
        if args.strict:
            print("  status 终验：迁移/重写未到已验证 %d 行" % not_verified)
        print("  红项 %d / 警告 %d" % (len(reds), len(warnings)))
        for it in (issues + warnings)[:50]:
            print("   [%s|%s] %s: %s" % (it["level"], it["code"], it["repo"], it["detail"]))
        if len(issues) + len(warnings) > 50:
            print("   …（其余 %d 项从略，用 --json 看全量）" % (len(issues) + len(warnings) - 50))
    if reds:
        sys.exit(EXIT_VERIFY)


def set_status(args):
    """执行波回写的唯一最小写通道：仅 owner 原路回写 status 与 notes 追加，禁碰 disposition/target。

    复用 run_write()（BEGIN IMMEDIATE + 退避重试）与 log_operation()；批次内混入任何
    owner 不匹配的行即整批越权拒绝（零写入），执行波必须把清单洗净后重发。
    """
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（只回写本 owner 名下行；越权改写一律拒绝）")
    if args.status not in SET_STATUS_VALUES:
        die("--status 取值非法：%r（可选：%s）" % (args.status, "/".join(SET_STATUS_VALUES)))
    ids = read_id_file(args.id_file)
    append_text = ("执行回写 %s" % args.status if not args.evidence
                   else "执行回写 %s：%s" % (args.status, args.evidence.strip()))

    def work(conn):
        rows = conn.execute(
            "SELECT id, repo_id, rel_path, owner, disposition FROM files WHERE id " + in_clause(ids),
            ids).fetchall()
        mine = [r for r in rows if r[3] == owner]
        foreign = [r for r in rows if r[3] != owner]
        # 越权整批拒绝（全有或全无）：命中行里只要有一行不属于本 owner，
        # 本事务不回写任何行——混合批次绝不部分落库，避免执行波账目半推进。
        if not foreign and mine:
            conn.executemany(
                "UPDATE files SET status=?,"
                " notes=CASE WHEN notes IS NULL OR notes='' THEN ? ELSE notes || '；' || ? END"
                " WHERE id=? AND owner=?",
                [(args.status, append_text, append_text, r[0], owner) for r in mine],
            )
            updated = len(mine)
        else:
            updated = 0
        return rows, mine, foreign, updated

    rows, mine, foreign, updated = run_write("set-status", work)
    if not rows:
        die("没有命中的行：--id-file 点名的 files.id 在库内均不存在（无可回写）", EXIT_NOOP)
    if foreign:
        print("越权整批拒绝：命中 %d 行中 %d 行非 owner=%s 名下（执行波只能原路回写自己认领的行；"
              "含任一越权行则整批零回写）：" % (len(rows), len(foreign), owner), file=sys.stderr)
        for r in foreign[:20]:
            print("    %d\t%s/%s\towner=%s" % (r[0], r[1], r[2], r[3] or "(空)"), file=sys.stderr)
        if len(foreign) > 20:
            print("    …（其余 %d 行省略）" % (len(foreign) - 20), file=sys.stderr)
        die("set-status 越权整批拒绝，本批次回写 0 行", EXIT_NOOP)
    for r in mine[:50]:
        print("%d\t%s/%s\t→%s" % (r[0], r[1], r[2], args.status))
    if len(mine) > 50:
        print("…（其余 %d 行省略）" % (len(mine) - 50))
    print("set-status: owner=%s 回写 %d 行 status=%s（disposition/target 零触碰）"
          % (owner, updated, args.status))
    log_operation("set-status", owner, updated,
                  "status=%s evidence=%s 越权整批拒绝=0"
                  % (args.status, (args.evidence or "-")[:60]))


def add_scope_args(p, with_dir=True):
    """认领/裁决/归还共用的过滤面：--repo（可多值）/--category/--ext（可多值）/[--dir]。"""
    p.add_argument("--repo", action="append", metavar="REPO_ID",
                   help="按仓库过滤，可重复传（如 --repo Chips-Host --repo Chips-Scaffold）")
    p.add_argument("--category", choices=("code", "doc", "config", "asset", "test", "data", "other"),
                   help="按文件类别过滤")
    p.add_argument("--ext", action="append", metavar="EXT",
                   help="按扩展名过滤，可重复传（.ts 与 ts 等价）")
    if with_dir:
        p.add_argument("--dir", action="append", metavar="REL_DIR",
                       help="目录级限定（仓库内相对路径前缀，可重复传）；批量裁决的安全闸口之一")


def add_dry_run_arg(p):
    p.add_argument("--dry-run", action="store_true", help="只报命中与可写行数，不落库")


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd")
    p_scan = sub.add_parser("scan", help="全量重扫旧仓库并重建文件/符号登记（符号裁决会被重建，需 --force）")
    p_scan.add_argument("--force", action="store_true", help="已有符号裁决时仍然重扫")

    p_si = sub.add_parser("scan-incr",
                          help="增量登记（工单032 通道①）：限定 --repo+--dir 显式路径清单，"
                               "只 INSERT 磁盘未登记行（files+symbols 两层），不重建、不触碰已裁决行；"
                               "--allow-excluded 覆盖 EXCLUDE_DIRS 目录名排除；默认 dry-run，--write 才落库")
    p_si.add_argument("--repo", action="append", metavar="REPO_ID",
                      help="登记仓库面（必填且只允许一个，如 --repo Chips-Office）")
    p_si.add_argument("--dir", action="append", metavar="REL_DIR",
                      help="显式路径清单：仓库内相对目录（可重复传；空串/仓库根拒绝）")
    p_si.add_argument("--allow-excluded", action="append", metavar="DIR_NAME",
                      help="本范围内显式覆盖的 EXCLUDE_DIRS 目录名排除（如 vendor，可重复传）")
    p_si.add_argument("--owner", required=True,
                      help="新文件行 owner / 新符号行 wave_owner 归属（如 ledger-matrix-gap）")
    p_si.add_argument("--wave", default="W2", help="写入新行的波次标识（默认 W2）")
    p_si.add_argument("--write", action="store_true", help="真正落库（默认 dry-run 只预览计数）")
    p_si.add_argument("--print-ids", action="store_true", help="打印本次登记范围的新行 rel_path 与符号数")
    sub.add_parser("mark-old")
    sub.add_parser("init-workspace")
    sub.add_parser("stats")
    p_next = sub.add_parser("next", help="取下一批待评估文件（只读，不落 owner）")
    p_next.add_argument("-n", type=int, default=20)
    add_scope_args(p_next, with_dir=False)
    p_dis = sub.add_parser("dispose")
    p_dis.add_argument("--file", type=int, required=True)
    p_dis.add_argument("--disposition", required=True)
    p_dis.add_argument("--target", default="")
    p_dis.add_argument("--owner", default="")
    p_dis.add_argument("--notes", default="")
    p_rep = sub.add_parser("report")
    p_rep.add_argument("--repo", required=True)

    p_claim = sub.add_parser("claim", help="批量认领：待评估且未认领的行打 owner，机器保证 owner 唯一")
    p_claim.add_argument("--owner", required=True, help="子智能体标识，如 ledger-host-scaffold")
    add_scope_args(p_claim)
    p_claim.add_argument("--wave", default="W2", help="写入 files.wave 的波次标识（默认 W2）")
    p_claim.add_argument("-n", "--limit", type=int, default=None, help="最多认领多少行（默认不限）")

    p_db = sub.add_parser("dispose-batch", help="批量裁决落库（只能裁决自己认领的行）")
    p_db.add_argument("--owner", required=True)
    p_db.add_argument("--disposition", required=True, choices=VALID_DISPOSITIONS)
    p_db.add_argument("--target", default="", help="新归属路径（新工作区/文档库相对路径，或说明性写法）")
    p_db.add_argument("--notes", default="", help="裁决理由（三问结论摘要），批量裁决必填")
    p_db.add_argument("--id-file", help="每行一个 files.id 的清单文件（推荐由 claim 输出转存）")
    add_scope_args(p_db)
    p_db.add_argument("--status", default="已裁决", choices=DISPOSE_STATUSES,
                      help="回写的文件状态（默认 已裁决；进入实现的行可写 进行中）")
    p_db.add_argument("--wave", default="W2", help="写入 files.wave 的波次标识（默认 W2）")
    p_db.add_argument("--allow-unclaimed", action="store_true",
                      help="允许裁决 owner 为空的行（限 id-file 精确点名场景）")
    p_db.add_argument("--print-ids", action="store_true", help="打印本次落库的 files.id 清单")
    add_dry_run_arg(p_db)

    p_syms = sub.add_parser("symbols", help="列出某文件登记的符号及裁决状态")
    p_syms.add_argument("--file", type=int, required=True, help="files.id")

    p_sd = sub.add_parser("symbol-dispose", help="符号级裁决落库（所属文件 files.owner 或符号 wave_owner 任一命中本 owner 即可写）")
    p_sd.add_argument("--owner", required=True)
    p_sd.add_argument("--symbol", help="symbols.id 列表，逗号或空格分隔")
    p_sd.add_argument("--file", type=int, help="files.id：裁决该文件全部符号")
    p_sd.add_argument("--disposition", required=True, choices=VALID_DISPOSITIONS)
    p_sd.add_argument("--target", default="", help="符号新归属（文件路径，可带 #name 锚点）")
    p_sd.add_argument("--notes", default="", help="符号裁决理由")
    p_sd.add_argument("--only-pending", action="store_true", help="跳过该文件里已裁决的符号")
    p_sd.add_argument("--auto-file-status", action="store_true",
                      help="符号全部清零时把所属文件 status 回写为“已裁决”")
    p_sd.add_argument("--wave", default="W2", help="随 auto-file-status 回写的波次标识")
    add_dry_run_arg(p_sd)

    p_sr = sub.add_parser("symbol-redecide",
                          help="已裁决符号精确点名复裁（工单032 通道②）：--symbol id 清单或 --notes-like"
                               " 精确条件（须 --repo 限定）点名，仅 --from-owner 显式点名的原裁决路符号可"
                               "覆写 disposition/target/notes，其余一律越权拒绝；默认 dry-run，--write 才落库")
    p_sr.add_argument("--owner", required=True, help="本路执行者标识（操作留痕，如 ledger-matrix-gap）")
    p_sr.add_argument("--from-owner", action="append", metavar="SRC_OWNER",
                      help="点名的原裁决路（匹配 symbols.wave_owner 或 files.owner，可重复传；必填）")
    p_sr.add_argument("--symbol", help="symbols.id 列表，逗号或空格分隔（与 --notes-like 二选一）")
    p_sr.add_argument("--notes-like", help="notes 精确 LIKE 条件（须含字面文本，且必须带 --repo 限定；与 --symbol 二选一）")
    p_sr.add_argument("--repo", action="append", metavar="REPO_ID",
                      help="限定 --notes-like 点名面的仓库（可重复传；--symbol 场景不需要）")
    p_sr.add_argument("--disposition", default=None, choices=VALID_DISPOSITIONS,
                      help="覆写 disposition（不给则维持现裁决不变）")
    p_sr.add_argument("--target", default=None,
                      help="显式覆写 target（传空串即清空；不给则维持原 target 不变）")
    p_sr.add_argument("--notes", default=None, help="整条覆写 notes")
    p_sr.add_argument("--append-notes", default=None, help="追加到既有 notes 末尾（「；」分隔），不丢历史判定理由")
    p_sr.add_argument("--write", action="store_true", help="真正落库（默认 dry-run 只预览命中与越权计数）")

    p_sc = sub.add_parser("symbols-claim",
                          help="符号波认领：未裁决且未认领的符号打 wave_owner，按仓+类别保证并行路互斥")
    p_sc.add_argument("--owner", required=True, help="符号波标识，如 sweep-host-expand")
    p_sc.add_argument("--repo", action="append", required=True, metavar="REPO_ID",
                      help="按仓库过滤，可重复传（必填：认领面按仓划分保证互斥）")
    p_sc.add_argument("--class", dest="class_", choices=("expand", "inherit", "all"), default="all",
                      help="符号类别：expand=迁移/重写文件的符号（逐符号真判定），"
                           "inherit=其余已裁决文件的符号（symbol-sweep 继承面），all=两类都要（默认）")
    p_sc.add_argument("-n", "--limit", type=int, default=None, help="最多认领多少个符号（默认不限）")
    p_sc.add_argument("--print-ids", action="store_true", help="打印本次认领的 symbols.id 清单")

    p_sw = sub.add_parser("symbol-sweep",
                          help="继承类符号批量落裁决（镜像所属文件 disposition；展开类拒绝）")
    p_sw.add_argument("--owner", required=True, help="本路 symbols-claim 使用的 owner 标识")
    p_sw.add_argument("--repo", action="append", metavar="REPO_ID",
                      help="按仓库过滤，可重复传（默认 sweep 本 owner 全部认领面）")
    p_sw.add_argument("--write", action="store_true",
                      help="真正落库（默认 dry-run 只预览计数与示例）")

    p_verify = sub.add_parser("verify", help="一致性体检（有异常时退出码 3）")
    p_verify.add_argument("--show", type=int, default=50, help="异常清单最多打印多少行（默认 50）")
    p_verify.add_argument("--skip-target-check", action="store_true", help="跳过 target 落盘校验")
    p_verify.add_argument("--strict", action="store_true",
                          help="把“迁移/重写 但 target 尚未落地”的规划行也计为异常（消灭收口期使用）")
    p_verify.add_argument("--allow-issues", action="store_true", help="发现问题仍以退出码 0 结束（仅出报告用）")

    p_rel = sub.add_parser("release", help="归还认领 / 返工复位：owner 行打回“待评估”，符号一并回滚")
    p_rel.add_argument("--owner", required=True)
    p_rel.add_argument("--id-file", help="每行一个 files.id 的清单文件（只归还这些行）")
    add_scope_args(p_rel)
    p_rel.add_argument("--keep-disposition", action="store_true",
                       help="只归还认领（status→待评估、owner 清空），保留已有裁决")
    p_rel.add_argument("--force", action="store_true", help="连已落裁决的行一起清空 disposition/target/notes/wave")

    p_pre = sub.add_parser("preflight",
                           help="迁移前核对（只读库+只读磁盘，波1 通道①）：双零前置/源仓快照漂移/target 归一化/"
                                "02 映射一致性（含常量↔02 自检）/两红线机检（凭据三段+永不入库四断言）/"
                                "verify 同源判据仓级切片；红项退出码 3。--repo 逗号或多值，--json 出回执，"
                                "--receipt <file> 落回执文件")
    p_pre.add_argument("--repo", action="append", required=True, metavar="REPO_ID",
                       help="待核对仓库（可逗号分隔或重复传）")
    p_pre.add_argument("--json", action="store_true", help="以 JSON 输出机读回执")
    p_pre.add_argument("--receipt", metavar="FILE", help="把 JSON 回执写入指定文件（人审闭环载体）")

    p_mm = sub.add_parser("migrate-manifest",
                          help="迁移中执行清单（只读库、可写清单文件，波1 通道②）：按仓导出 迁移+重写 files 行"
                               "+名下展开符号计数，经归一化产 canonical 落点，出 TSV/JSON/by-zone 分组；"
                               "行数=DB 命中自检行入头部；--check-dest 同名/多源冲突预检（server/ 未建落点降 WARN）")
    p_mm.add_argument("--repo", required=True, metavar="REPO_ID", help="出清单的仓库（单个）")
    p_mm.add_argument("--class", dest="class_", default="expand", choices=("expand",),
                      help="清单类别（当前仅 expand=迁移+重写）")
    p_mm.add_argument("--out", metavar="DIR", help="清单输出目录（默认 /tmp/manifest-<repo>）")
    p_mm.add_argument("--check-dest", action="store_true", help="目标区同名冲突+多源同目标合并冲突检测")

    p_cl = sub.add_parser("closure",
                          help="迁移后闭环校验+矩阵闭合闸（只读，波1 通道③）：(a)落点实落（含符号锚段，重写行"
                               "点名任务豁免）(b)矩阵 §一 计数勾稽+证据路径抽样存在性 (c)残留扫描（凭据/废弃归档"
                               "同名/未在册顶层目录三红）(d)--strict 下迁移/重写未到已验证计红。"
                               "双零残留终口径=待评估0+幻想target0+残留0")
    p_cl.add_argument("--repo", action="append", metavar="REPO_ID", help="限定仓库（可逗号或多值；默认全库）")
    p_cl.add_argument("--matrix", metavar="GLOB", help="覆盖矩阵 md 的 glob（默认 项目日志与笔记/重构计划/旧功能覆盖矩阵-*.md）")
    p_cl.add_argument("--json", action="store_true", help="以 JSON 输出机读回执")
    p_cl.add_argument("--strict", action="store_true", help="收口终验：落点未实落/证据缺失/未到已验证均计红")

    p_ss = sub.add_parser("set-status",
                          help="执行波回写的唯一最小写通道（波1 通道④）：仅 owner 原路回写 status（进行中/已完成/已验证）"
                               "与 notes 追加，禁碰 disposition/target；复用 run_write+log_operation；越权整批拒绝")
    p_ss.add_argument("--owner", required=True, help="本路执行者标识（须与行 owner 一致，否则越权拒绝）")
    p_ss.add_argument("--id-file", required=True, help="每行一个 files.id 的清单文件")
    p_ss.add_argument("--status", required=True, choices=SET_STATUS_VALUES,
                      help="回写的执行态（进行中/已完成/已验证；不含已裁决，不回退裁决态）")
    p_ss.add_argument("--evidence", default="", help="执行证据（追加到 notes 末尾，「；」分隔，保留历史判定理由）")

    args = ap.parse_args()
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    # 增量列/索引统一由 ensure_indexes() 幂等补建（scan 也先补建：
    # 既有库缺 symbols.wave_owner 时 SCHEMA 尾部的增量索引无法创建）
    if args.cmd:
        ensure_indexes()
    if args.cmd == "scan":
        scan(args.force)
    elif args.cmd == "scan-incr":
        scan_incr(args)
    elif args.cmd == "mark-old":
        mark_old()
    elif args.cmd == "init-workspace":
        init_workspace()
    elif args.cmd == "stats":
        stats()
    elif args.cmd == "next":
        next_files(args)
    elif args.cmd == "dispose":
        dispose(args)
    elif args.cmd == "report":
        report(args.repo)
    elif args.cmd == "claim":
        claim(args)
    elif args.cmd == "dispose-batch":
        dispose_batch(args)
    elif args.cmd == "symbols":
        symbols_cmd(args)
    elif args.cmd == "symbol-dispose":
        symbol_dispose(args)
    elif args.cmd == "symbol-redecide":
        symbol_redecide(args)
    elif args.cmd == "symbols-claim":
        symbols_claim(args)
    elif args.cmd == "symbol-sweep":
        symbol_sweep(args)
    elif args.cmd == "verify":
        verify(args)
    elif args.cmd == "release":
        release(args)
    elif args.cmd == "preflight":
        preflight(args)
    elif args.cmd == "migrate-manifest":
        migrate_manifest(args)
    elif args.cmd == "closure":
        closure(args)
    elif args.cmd == "set-status":
        set_status(args)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
