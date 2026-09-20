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
  python3 重构大计划/工具/重构台账.py verify            # 一致性体检（幻想 target/孤儿行 → 退出码 3）
  python3 重构大计划/工具/重构台账.py verify --strict    # 收口期：连“迁移/重写 规划落点未落地”一起清零
  python3 重构大计划/工具/重构台账.py release --owner tool-selftest   # 归还认领 / 返工复位

退出码：0 成功；2 参数错误；3 verify 发现异常；4 数据库锁定重试失败；5 无匹配行 / 越权 / 安全闸口拒绝。
过程留痕：所有写操作追加记录到 `重构大计划/台账操作.log`。
"""

import argparse
import hashlib
import os
import re
import sqlite3
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
  status TEXT DEFAULT '待评估', disposition TEXT, target TEXT, notes TEXT
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
"""

#: 供 `ensure_indexes()` 幂等补建的增量索引（`scan` 走整段 SCHEMA，其余命令走这里）
INCREMENTAL_INDEXES = (
    "CREATE INDEX IF NOT EXISTS idx_files_owner_status ON files(owner, status);",
    "CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);",
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
    """幂等补建增量索引；库被并发写锁住时不阻断只读统计，静默跳过。"""
    try:
        conn = connect(write=True)
        try:
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
        "SELECT id, kind, name, line, exported, status, disposition, target FROM symbols"
        " WHERE file_id=? ORDER BY line, id",
        (args.file,),
    ).fetchall()
    print("symbols: file_id=%d %s/%s owner=%s 文件裁决=%s"
          % (f[0], f[1], f[2], f[3] or "(空)", f[4] or "(未裁决)"))
    if not rows:
        print("  (该文件无登记符号)")
        conn.close()
        return
    print("  %-8s %-10s %-28s %-6s %-4s %-8s %-8s %s" % ("id", "kind", "name", "line", "导出", "状态", "裁决", "target"))
    for s in rows:
        print("  %-8d %-10s %-28s %-6d %-4s %-8s %-8s %s"
              % (s[0], s[1], s[2][:28], s[3], "是" if s[4] else "否", s[5], s[6] or "-", s[7] or "-"))
    decided = sum(1 for s in rows if s[6])
    print("  合计 %d 个符号，已裁决 %d，未裁决 %d" % (len(rows), decided, len(rows) - decided))
    conn.close()


def symbol_dispose(args):
    """符号级裁决落库（只允许改自己认领文件的符号）。"""
    owner = (args.owner or "").strip()
    if not owner:
        die("--owner 不能为空（只能裁决自己认领文件的符号）")
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
            "SELECT s.id, s.file_id, s.name, s.kind, s.line, f.owner, f.repo_id, f.rel_path"
            " FROM symbols s JOIN files f ON f.id = s.file_id WHERE %s" % where,
            params,
        ).fetchall()
        mine = [r for r in rows if r[5] == owner]
        foreign = [r for r in rows if r[5] not in (None, "", owner)]
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
        print("symbol-dispose(dry-run): 命中 %d 个符号，可裁决（owner=%s）%d 个，越权 %d 个"
              % (len(rows), owner, len(mine), len(foreign)))
        return
    if not updated:
        die("没有可裁决的符号：命中的 %d 个符号所属文件均非 owner=%s 认领（先 claim 该文件；越权改写被拒绝）"
            % (len(rows), owner))
    for fid, total, done in progress:
        print("  file_id=%d 符号进度 %d/%d%s" % (fid, done, total, "（已清零）" if done == total else ""))
    if foreign:
        print("  跳过：非本 owner 认领文件的符号 %d 个" % len(foreign))
        for r in foreign[:20]:
            print("    symbol=%d\t%s/%s\towner=%s" % (r[0], r[6], r[7], r[5] or "(空)"))
    print("symbol-dispose: owner=%s 落库 %d 个符号 disposition=%s target=%s"
          % (owner, updated, args.disposition, args.target or "-"))
    log_operation("symbol-dispose", owner, updated,
                  "disposition=%s target=%s files=%s 越权跳过=%d"
                  % (args.disposition, args.target or "-",
                     ",".join(str(p[0]) for p in progress)[:80], len(foreign)))


def verify(args):
    """一致性体检：状态/裁决计数、认领分布、孤儿行、target 落盘存在性（防幻想 target）。"""
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

    p_sd = sub.add_parser("symbol-dispose", help="符号级裁决落库（只允许改自己认领文件的符号）")
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

    args = ap.parse_args()
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    if args.cmd and args.cmd != "scan":
        ensure_indexes()
    if args.cmd == "scan":
        scan(args.force)
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
    elif args.cmd == "verify":
        verify(args)
    elif args.cmd == "release":
        release(args)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
