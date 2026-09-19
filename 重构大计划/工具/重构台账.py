#!/usr/bin/env python3
"""薯片生态·重构台账工具。

用法：
  python3 重构大计划/工具/重构台账.py scan            # 扫描全部旧仓库/旧文档库，登记文件与符号
  python3 重构大计划/工具/重构台账.py mark-old        # 为每个旧仓库写入 旧版-标记.md
  python3 重构大计划/工具/重构台账.py init-workspace  # 创建 chips-ecosystem/ 新工作区骨架
  python3 重构大计划/工具/重构台账.py stats           # 统计（仓库/状态/裁决/类别）
  python3 重构大计划/工具/重构台账.py next -n 20      # 取下一批待评估文件
  python3 重构大计划/工具/重构台账.py dispose --file <id> --disposition 重写 --target <path> --owner <sid>
  python3 重构大计划/工具/重构台账.py report --repo <id>  # 生成仓库重构报告骨架
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
"""

TS_SYM = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|const|enum|let)\s+([A-Za-z_$][\w$]*)",
    re.M,
)
TS_FN = re.compile(r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.M)
RS_SYM = re.compile(r"^\s*pub\s+(?:async\s+)?(fn|struct|enum|trait|const|type|mod)\s+(\w+)", re.M)


def connect():
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=8000;")
    return conn


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


def scan():
    conn = connect()
    conn.executescript(SCHEMA)
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
    conn.close()


def next_files(limit):
    conn = connect()
    rows = conn.execute(
        "SELECT id, repo_id, rel_path, category FROM files WHERE status='待评估' AND owner IS NULL ORDER BY repo_id, rel_path LIMIT ?",
        (limit,),
    ).fetchall()
    for r in rows:
        print(f"{r[0]}\t{r[1]}\t{r[2]}\t{r[3]}")
    conn.close()


def dispose(args):
    conn = connect()
    conn.execute(
        "UPDATE files SET status='已裁决', disposition=?, target_path=?, owner=?, notes=? WHERE id=?",
        (args.disposition, args.target, args.owner, args.notes or "", args.file),
    )
    conn.commit()
    conn.close()
    print("dispose done:", args.file, args.disposition)


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


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("scan")
    sub.add_parser("mark-old")
    sub.add_parser("init-workspace")
    sub.add_parser("stats")
    p_next = sub.add_parser("next")
    p_next.add_argument("-n", type=int, default=20)
    p_dis = sub.add_parser("dispose")
    p_dis.add_argument("--file", type=int, required=True)
    p_dis.add_argument("--disposition", required=True)
    p_dis.add_argument("--target", default="")
    p_dis.add_argument("--owner", default="")
    p_dis.add_argument("--notes", default="")
    p_rep = sub.add_parser("report")
    p_rep.add_argument("--repo", required=True)
    args = ap.parse_args()
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    if args.cmd == "scan":
        scan()
    elif args.cmd == "mark-old":
        mark_old()
    elif args.cmd == "init-workspace":
        init_workspace()
    elif args.cmd == "stats":
        stats()
    elif args.cmd == "next":
        next_files(args.n)
    elif args.cmd == "dispose":
        dispose(args)
    elif args.cmd == "report":
        report(args.repo)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
