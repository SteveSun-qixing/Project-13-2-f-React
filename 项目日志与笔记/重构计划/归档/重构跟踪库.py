#!/usr/bin/env python3
"""薯片生态爆炸式重构跟踪库工具。

用法：
  python3 重构跟踪库.py init        # 建立数据库
  python3 重构跟踪库.py scan        # 扫描全部旧生态文件入库（含行数/摘要/分类）
  python3 重构跟踪库.py symbols     # 抽取代码符号（函数/类/接口/类型）入库
  python3 重构跟踪库.py stats       # 统计（按仓库/类型/语言/决策/阶段）
  python3 重构跟踪库.py next [--wave N]   # 查看下一批待处理任务
  python3 重构跟踪库.py decide <文件ID> <决策> [--reason "..."] [--owner X]
  python3 重构跟踪库.py export      # 导出 文件清单.csv 与 决策报表.md

数据库：项目日志与笔记/重构计划/重构跟踪.db
决策口径：migrate（迁移） / rewrite（重写） / keep-design（保留设计，弃代码） / archive（归档） / drop（废弃）
"""

import argparse
import csv
import hashlib
import os
import re
import sqlite3
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
DB = os.path.join(BASE, "重构跟踪.db")

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", "output", "test-results", ".vite", ".next",
    "target", ".turbo", "coverage", ".cache", "electron-user-data", ".DS_Store",
    "__pycache__", ".pytest_cache", ".specstory", ".omo", ".VSCodeCounter",
}
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".py", ".html", ".css", ".scss"}
DOC_EXT = {".md", ".mdx", ".txt", ".rst"}
CONFIG_EXT = {".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".env", ".lock"}
ASSET_EXT = {".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".icns", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".pdf", ".epub", ".bin", ".pk", ".package"}
ARCHIVE_HINTS = ("归档", "旧版", "archive", "legacy")

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  ext TEXT, lang TEXT, kind TEXT,
  bytes INTEGER, lines INTEGER, sha1 TEXT,
  area TEXT, group_name TEXT,
  decision TEXT DEFAULT '', decision_reason TEXT DEFAULT '',
  phase TEXT DEFAULT '', status TEXT DEFAULT '待评估', owner TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  kind TEXT, name TEXT, line INTEGER,
  decision TEXT DEFAULT '', note TEXT DEFAULT '',
  UNIQUE(file_id, kind, name, line)
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  phase TEXT, wave INTEGER, stream TEXT,
  title TEXT NOT NULL, detail TEXT DEFAULT '', deps TEXT DEFAULT '',
  scope TEXT DEFAULT '', status TEXT DEFAULT 'todo', owner TEXT DEFAULT '',
  evidence TEXT DEFAULT '', updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT DEFAULT (datetime('now')), actor TEXT, action TEXT, target TEXT, note TEXT
);
CREATE INDEX IF NOT EXISTS idx_files_repo ON files(repo);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
"""

AREA_RULES = [
    ("内核", ("kernel", "context", "fork", "service", "event-bus")),
    ("Bridge", ("bridge", "capability", "permission", "schema")),
    ("宿主", ("host", "main", "preload", "ipc", "window", "pal")),
    ("解析", ("parse", "parser", "zip", "yaml", "schema", "document")),
    ("资源", ("resource", "cache", "stream", "provider", "file")),
    ("渲染", ("render", "frame", "iframe", "view")),
    ("编辑", ("edit", "editor", "drag", "cover", "export")),
    ("前端", ("ui", "component", "antd", "theme", "token", "page", "scene", "view")),
    ("插件", ("plugin", "manifest", "cpk", "basecard", "layout", "module")),
    ("SDK", ("sdk", "client", "testing", "scaffold")),
    ("CLI", ("cli", "command")),
    ("服务端", ("server", "community", "personal", "api")),
    ("测试", ("test", "spec", "e2e", "fixture", "mock")),
    ("文档", ("docs", "doc", "readme", "技术文档", "需求文档")),
    ("工具链", ("script", "tool", "build", "pack", "ci")),
]


def connect():
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=8000;")
    return conn


def classify_kind(path, ext):
    low = path.lower()
    if any(h in path for h in ARCHIVE_HINTS) or any(h in low for h in ("archive", "legacy")):
        return "archive"
    if ext in CODE_EXT:
        return "code"
    if ext in DOC_EXT:
        return "doc"
    if ext in CONFIG_EXT:
        return "config"
    if ext in ASSET_EXT:
        return "asset"
    return "other"


def lang_of(ext):
    return {
        ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript",
        ".mjs": "JavaScript", ".cjs": "JavaScript", ".rs": "Rust", ".py": "Python",
        ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".md": "Markdown",
    }.get(ext, ext.lstrip(".") or "unknown")


def area_of(path):
    low = path.lower()
    for area, keys in AREA_RULES:
        if any(k in low for k in keys):
            return area
    return "其他"


def scan():
    conn = connect()
    count = 0
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if name == ".DS_Store":
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, ROOT)
            try:
                st = os.stat(full)
            except OSError:
                continue
            ext = os.path.splitext(name)[1].lower()
            repo = rel.split(os.sep)[0]
            kind = classify_kind(rel, ext)
            lines = 0
            sha = ""
            if kind in ("code", "doc", "config") and st.st_size < 4 * 1024 * 1024:
                try:
                    with open(full, "rb") as f:
                        data = f.read()
                    lines = data.count(b"\n") + 1
                    sha = hashlib.sha1(data).hexdigest()[:12]
                except OSError:
                    pass
            conn.execute(
                """INSERT INTO files (repo, path, ext, lang, kind, bytes, lines, sha1, area, group_name)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(path) DO UPDATE SET
                     bytes=excluded.bytes, lines=excluded.lines, sha1=excluded.sha1,
                     kind=excluded.kind, area=excluded.area, updated_at=datetime('now')""",
                (repo, rel, ext, lang_of(ext), kind, st.st_size, lines, sha, area_of(rel), ""),
            )
            count += 1
    conn.commit()
    print(f"扫描文件 {count} 个 → {DB}")
    conn.close()


TS_SYMBOL_RE = re.compile(
    r"^\s*(?:export\s+)?(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?"
    r"(?:(class|interface|enum|type|function)\s+([A-Za-z_$][\w$]*)"
    r"|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\())",
    re.M,
)
RS_SYMBOL_RE = re.compile(
    r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(fn|struct|enum|trait|impl|type)\s+([A-Za-z_][\w]*)",
    re.M,
)


def symbols():
    conn = connect()
    rows = conn.execute(
        "SELECT id, path, ext, kind FROM files WHERE kind='code' AND ext IN ('.ts','.tsx','.js','.jsx','.mjs','.cjs','.rs')"
    ).fetchall()
    total = 0
    for fid, path, ext, _kind in rows:
        full = os.path.join(ROOT, path)
        try:
            with open(full, encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except OSError:
            continue
        rx = RS_SYMBOL_RE if ext == ".rs" else TS_SYMBOL_RE
        for m in rx.finditer(text):
            if ext == ".rs":
                sym_kind, name = m.group(1), m.group(2)
            elif m.group(1):
                sym_kind, name = m.group(1), m.group(2)
            else:
                sym_kind, name = "const", m.group(3)
            line = text[: m.start()].count("\n") + 1
            conn.execute(
                "INSERT OR IGNORE INTO symbols (file_id, kind, name, line) VALUES (?,?,?,?)",
                (fid, sym_kind, name, line),
            )
            total += 1
    conn.commit()
    print(f"抽取符号 {total} 个")
    conn.close()


def stats():
    conn = connect()
    print("== 文件总数 ==", conn.execute("SELECT COUNT(*) FROM files").fetchone()[0])
    print("== 按仓库 ==")
    for r in conn.execute("SELECT repo, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC LIMIT 40"):
        print("  %-38s %d" % r)
    print("== 按类型 ==")
    for r in conn.execute("SELECT kind, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-8s %d" % r)
    print("== 按语言 ==")
    for r in conn.execute("SELECT lang, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC LIMIT 15"):
        print("  %-12s %d" % r)
    print("== 按区域 ==")
    for r in conn.execute("SELECT area, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC LIMIT 20"):
        print("  %-8s %d" % r)
    print("== 决策 ==")
    for r in conn.execute("SELECT COALESCE(NULLIF(decision,''),'待评估'), COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
        print("  %-10s %d" % r)
    print("== 符号 ==", conn.execute("SELECT COUNT(*) FROM symbols").fetchone()[0])
    conn.close()


def decide(args):
    conn = connect()
    fid, dec = args.id, args.decision
    conn.execute(
        "UPDATE files SET decision=?, decision_reason=?, owner=?, status='已决策', updated_at=datetime('now') WHERE id=?",
        (dec, args.reason or "", args.owner or "", fid),
    )
    conn.execute("INSERT INTO events (actor, action, target, note) VALUES (?,?,?,?)",
                 (args.owner or "", "decide", str(fid), f"{dec}: {args.reason or ''}"))
    conn.commit()
    print("ok")
    conn.close()


def next_tasks(args):
    conn = connect()
    wave = args.wave or 1
    rows = conn.execute(
        "SELECT id, stream, title, deps, status FROM tasks WHERE wave=? AND status!='done' ORDER BY id",
        (wave,),
    ).fetchall()
    print(f"== Wave {wave} 待办 {len(rows)} 条 ==")
    for r in rows:
        print("  %-10s %-12s %-40s deps=%s status=%s" % r)
    conn.close()


def export():
    conn = connect()
    out1 = os.path.join(BASE, "文件清单.csv")
    with open(out1, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ID", "仓库", "路径", "类型", "语言", "行数", "字节", "区域", "决策", "状态", "负责人", "理由"])
        for r in conn.execute(
            "SELECT id, repo, path, kind, lang, lines, bytes, area, decision, status, owner, decision_reason FROM files ORDER BY id"
        ):
            w.writerow(r)
    out2 = os.path.join(BASE, "决策统计.md")
    with open(out2, "w", encoding="utf-8") as f:
        f.write("# 重构决策统计\n\n")
        f.write("| 仓库 | 待评估 | 迁移 | 重写 | 保留设计 | 归档 | 废弃 | 合计 |\n|---|---|---|---|---|---|---|---|\n")
        for repo, total in conn.execute("SELECT repo, COUNT(*) FROM files GROUP BY 1 ORDER BY 2 DESC"):
            row = dict(conn.execute(
                """SELECT
                   SUM(decision='') AS pending, SUM(decision='migrate') AS migrate,
                   SUM(decision='rewrite') AS rewrite, SUM(decision='keep-design') AS keepd,
                   SUM(decision='archive') AS archive, SUM(decision='drop') AS drop
                   FROM files WHERE repo=?""", (repo,)).fetchone() and {})
            vals = conn.execute(
                """SELECT
                   SUM(decision=''), SUM(decision='migrate'), SUM(decision='rewrite'),
                   SUM(decision='keep-design'), SUM(decision='archive'), SUM(decision='drop')
                   FROM files WHERE repo=?""", (repo,)).fetchone()
            f.write(f"| {repo} | " + " | ".join(str(v or 0) for v in vals) + f" | {total} |\n")
    print("导出：", out1, "与", out2)
    conn.close()


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd")
    sub.add_parser("init")
    sub.add_parser("scan")
    sub.add_parser("symbols")
    sub.add_parser("stats")
    p_next = sub.add_parser("next"); p_next.add_argument("--wave", type=int, default=1)
    p_dec = sub.add_parser("decide"); p_dec.add_argument("id"); p_dec.add_argument("decision")
    p_dec.add_argument("--reason"); p_dec.add_argument("--owner")
    sub.add_parser("export")
    args = ap.parse_args()
    if args.cmd == "init":
        conn = connect(); conn.executescript(SCHEMA); conn.commit(); conn.close(); print("schema ok")
    elif args.cmd == "scan":
        scan()
    elif args.cmd == "symbols":
        symbols()
    elif args.cmd == "stats":
        stats()
    elif args.cmd == "next":
        next_tasks(args)
    elif args.cmd == "decide":
        decide(args)
    elif args.cmd == "export":
        export()
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
