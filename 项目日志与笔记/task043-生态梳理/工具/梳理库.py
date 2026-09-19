#!/usr/bin/env python3
"""薯片生态多维梳理库工具。

用法：
  python3 梳理库.py init          # 创建/升级数据库 schema
  python3 梳理库.py import        # 导入 梳理表/ 下全部分片 TSV（幂等）
  python3 梳理库.py stats         # 覆盖统计（按来源/状态/维度）
  python3 梳理库.py gaps          # 未闭合缺口清单
  python3 梳理库.py query --dimension 平台 --status 缺失 --source 旧文档库
  python3 梳理库.py orphans       # 孤立节点（无维度或无关联）
  python3 梳理库.py export        # 导出 多维梳理表.csv 与 分片统计
  python3 梳理库.py check-links   # 调用文档库坏链检查

数据库文件：项目日志与笔记/task043-生态梳理/梳理表/薯片生态多维梳理.db
分片目录：项目日志与笔记/task043-生态梳理/梳理表/（分片-*.tsv、登记-*.tsv）
TSV 表头（节点表）：节点ID 来源 旧路径 主题 维度标签 新库对应 覆盖状态 建议动作 证据
TSV 表头（登记表）：编号 文档名 路径 权威范围 依赖 状态 负责人
"""

import csv
import json
import os
import sqlite3
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.abspath(os.path.join(BASE, "..", ".."))
TABLE_DIR = os.path.join(BASE, "梳理表")
DB_PATH = os.path.join(TABLE_DIR, "薯片生态多维梳理.db")
LINK_CHECKER = os.path.join(BASE, "工具", "检查文档链接.py")

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=8000;

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT '',
  path TEXT DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  coverage_ref TEXT DEFAULT '',
  status TEXT DEFAULT '',
  action TEXT DEFAULT '',
  evidence TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dimensions (
  name TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS node_dimensions (
  node_id TEXT NOT NULL,
  dimension TEXT NOT NULL,
  PRIMARY KEY (node_id, dimension)
);

CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT '对应',
  evidence TEXT DEFAULT '',
  UNIQUE (from_id, to_id, relation)
);

CREATE TABLE IF NOT EXISTS gaps (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  severity TEXT DEFAULT 'P2',
  evidence TEXT DEFAULT '',
  proposal TEXT DEFAULT '',
  doc_path TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  owner TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS docs (
  path TEXT PRIMARY KEY,
  title TEXT DEFAULT '',
  section TEXT DEFAULT '',
  status TEXT DEFAULT '',
  owner TEXT DEFAULT '',
  note TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE VIEW IF NOT EXISTS v_gaps AS
  SELECT id, topic, status, action, coverage_ref, evidence, owner
  FROM nodes
  WHERE status IN ('缺失', '冲突', '部分');

CREATE VIEW IF NOT EXISTS v_coverage_by_source AS
  SELECT source_type, status, COUNT(*) AS n
  FROM nodes GROUP BY source_type, status ORDER BY source_type, status;

CREATE VIEW IF NOT EXISTS v_coverage_by_dimension AS
  SELECT d.dimension, n.status, COUNT(*) AS n
  FROM node_dimensions d JOIN nodes n ON n.id = d.node_id
  GROUP BY d.dimension, n.status ORDER BY d.dimension, n.status;
"""

STATUS_ALIASES = {
    "已覆盖": "已覆盖", "覆盖": "已覆盖", "已完善": "已覆盖", "无需动作": "已覆盖",
    "部分": "部分", "部分覆盖": "部分", "部分完成": "部分",
    "缺失": "缺失", "无": "缺失",
    "冲突": "冲突", "已替代": "已替代", "替代": "已替代", "被替代": "已替代",
    "已废弃": "已废弃", "不适用": "不适用",
}

# 受控维度词表（用户草稿 14 维 + 产品/工程扩展），其余自由标签按关键词归并
CANONICAL_DIMENSIONS = [
    "文件", "功能", "架构", "抽象", "插件", "模块", "链路", "接口契约",
    "入口", "平台", "生命周期", "安全", "性能", "扩展",
    "交互", "视觉", "运维", "工程治理", "规范质量", "工具链", "产品",
    "数据", "演进", "服务端", "前端", "测试", "合规", "参考资产",
    "网络", "日志", "无障碍", "内容", "版本",
]

DIMENSION_RULES = [
    (("接口", "契约", "协议", "api", "sdk"), "接口契约"),
    (("功能", "能力", "业务"), "功能"),
    (("架构",), "架构"),
    (("抽象",), "抽象"),
    (("插件",), "插件"),
    (("模块",), "模块"),
    (("链路", "流程"), "链路"),
    (("入口", "启动", "加载"), "入口"),
    (("平台", "跨端", "接入", "系统能力"), "平台"),
    (("生命周期", "状态机", "事件"), "生命周期"),
    (("安全", "权限", "合规", "许可"), "安全"),
    (("性能",), "性能"),
    (("扩展", "未来"), "扩展"),
    (("交互", "ux", "ui/ux", "拖动", "拖放"), "交互"),
    (("视觉", "主题", "图标", "设计资产", "组件库", "界面"), "视觉"),
    (("运维", "部署", "发布", "监控"), "运维"),
    (("工程", "过程", "治理", "归档", "元信息", "清单", "文档治理", "文档导航"), "工程治理"),
    (("规范", "测试", "质量", "审查"), "规范质量"),
    (("工具", "cli", "构建", "打包"), "工具链"),
    (("产品", "内容组织", "概述"), "产品"),
    (("数据", "存储", "文件格式", "文件", "资源"), "数据"),
    (("迁移", "更新", "演进"), "演进"),
    (("服务器", "社区", "个人服务器", "服务端"), "服务端"),
    (("前端", "组件", "hooks", "框架"), "前端"),
    (("日志",), "日志"),
    (("网络",), "网络"),
    (("无障碍", "a11y"), "无障碍"),
    (("内容体系", "内容"), "内容"),
    (("版本",), "版本"),
]


def normalize_status(raw):
    raw = (raw or "").strip()
    if raw in STATUS_ALIASES:
        return STATUS_ALIASES[raw]
    if raw.startswith("完全覆盖") or raw.startswith("已覆盖"):
        return "已覆盖"
    if raw.startswith("部分"):
        return "部分"
    if raw.startswith("缺失") or raw in ("无", "缺失"):
        return "缺失"
    if raw.startswith("冲突"):
        return "冲突"
    if raw.startswith("被替代") or raw.startswith("已替代"):
        return "已替代"
    if raw.startswith("已废弃"):
        return "已废弃"
    if raw.startswith("不适用"):
        return "不适用"
    return raw


def normalize_dimension(raw):
    raw = (raw or "").strip()
    if not raw:
        return ""
    if raw in CANONICAL_DIMENSIONS:
        return raw
    low = raw.lower()
    for keys, dim in DIMENSION_RULES:
        for k in keys:
            if k in low:
                return dim
    return "其他"

HEADER_ALIASES = {
    "节点ID": "id", "ID": "id", "编号": "id",
    "来源": "source_type", "来源类型": "source_type",
    "旧路径": "path", "旧路径或新路径": "path", "路径": "path",
    "主题": "topic", "能力域": "topic", "功能": "topic",
    "新库对应": "coverage_ref", "覆盖": "coverage_ref", "对应": "coverage_ref",
    "覆盖状态": "status", "状态": "status",
    "建议动作": "action", "动作": "action",
    "证据": "evidence",
    "维度标签": "dimensions", "维度": "dimensions", "标签": "dimensions",
    "负责人": "owner", "作者": "owner",
}


def connect():
    os.makedirs(TABLE_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=8000;")
    return conn


def init():
    conn = connect()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
    print("schema ok:", DB_PATH)


def _norm_header(name):
    name = (name or "").strip().lstrip("\ufeff")
    return HEADER_ALIASES.get(name, name)


def _split_dims(raw):
    raw = (raw or "").replace("，", ",").replace("；", ",").replace(";", ",")
    return [d.strip() for d in raw.split(",") if d.strip()]


def import_shard(conn, path, owner):
    with open(path, "r", encoding="utf-8") as f:
        rows = list(csv.reader(f, delimiter="\t"))
    if not rows:
        return 0
    header = [_norm_header(h) for h in rows[0]]
    if "id" not in header or "topic" not in header:
        print("skip (unrecognized header):", os.path.basename(path))
        return 0
    n = 0
    for raw in rows[1:]:
        if not any(cell.strip() for cell in raw):
            continue
        rec = {}
        for i, cell in enumerate(raw):
            if i < len(header):
                rec.setdefault(header[i], cell.strip())
        node_id = rec.get("id", "").strip()
        topic = rec.get("topic", "").strip()
        if not node_id or not topic:
            continue
        conn.execute(
            """INSERT INTO nodes (id, source_type, path, topic, coverage_ref, status, action, evidence, owner, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,datetime('now'))
               ON CONFLICT(id) DO UPDATE SET
                 source_type=excluded.source_type, path=excluded.path, topic=excluded.topic,
                 coverage_ref=excluded.coverage_ref, status=excluded.status, action=excluded.action,
                 evidence=excluded.evidence, owner=excluded.owner, updated_at=datetime('now')""",
            (
                node_id,
                rec.get("source_type", ""),
                rec.get("path", ""),
                topic,
                rec.get("coverage_ref", ""),
                normalize_status(rec.get("status", "")),
                rec.get("action", ""),
                rec.get("evidence", ""),
                rec.get("owner", "") or owner,
            ),
        )
        conn.execute("DELETE FROM node_dimensions WHERE node_id=?", (node_id,))
        for dim in _split_dims(rec.get("dimensions", "")):
            dim = normalize_dimension(dim)
            conn.execute("INSERT OR IGNORE INTO dimensions(name) VALUES (?)", (dim,))
            conn.execute("INSERT OR IGNORE INTO node_dimensions(node_id, dimension) VALUES (?,?)", (node_id, dim))
        ref = rec.get("coverage_ref", "").strip()
        if ref and not ref.startswith("无"):
            for token in _split_dims(ref):
                conn.execute("INSERT OR IGNORE INTO edges(from_id, to_id, relation, evidence) VALUES (?,?,?,?)",
                             (node_id, token, "对应", rec.get("evidence", "")))
        n += 1
    return n


def import_all():
    conn = connect()
    total = 0
    for name in sorted(os.listdir(TABLE_DIR)):
        if not name.endswith(".tsv"):
            continue
        owner = name.replace(".tsv", "")
        if name.startswith("登记-"):
            continue
        total += import_shard(conn, os.path.join(TABLE_DIR, name), owner)
    # 登记表：编号 文档名 路径 权威范围 依赖 状态 负责人
    for name in sorted(os.listdir(TABLE_DIR)):
        if not (name.startswith("登记-") and name.endswith(".tsv")):
            continue
        with open(os.path.join(TABLE_DIR, name), encoding="utf-8") as f:
            rows = list(csv.reader(f, delimiter="\t"))
        if not rows:
            continue
        header = [_norm_header(h) for h in rows[0]]
        for raw in rows[1:]:
            if not any(c.strip() for c in raw):
                continue
            rec = dict(zip(header, [c.strip() for c in raw]))
            path = rec.get("path", "")
            if not path:
                continue
            conn.execute(
                """INSERT INTO docs (path, title, section, status, owner, note, updated_at)
                   VALUES (?,?,?,?,?,?,datetime('now'))
                   ON CONFLICT(path) DO UPDATE SET
                     title=excluded.title, section=excluded.section, status=excluded.status,
                     owner=excluded.owner, note=excluded.note, updated_at=datetime('now')""",
                (path, rec.get("文档名", ""), "", rec.get("status", ""), rec.get("owner") or name, rec.get("权威范围", "")),
            )
    # 缺口处理表：缺口ID 状态 新文档路径 说明（状态：done/planned/wontfix）
    for name in sorted(os.listdir(TABLE_DIR)):
        if not (name.startswith("缺口处理-") and name.endswith(".tsv")):
            continue
        with open(os.path.join(TABLE_DIR, name), encoding="utf-8") as f:
            rows = list(csv.reader(f, delimiter="\t"))
        if not rows:
            continue
        for raw in rows[1:]:
            if not any(c.strip() for c in raw):
                continue
            gap_id, status, doc_path, note = (list(raw) + ["", "", "", ""])[:4]
            gap_id, status, doc_path, note = gap_id.strip(), status.strip(), doc_path.strip(), note.strip()
            if not gap_id:
                continue
            conn.execute(
                "UPDATE gaps SET status=?, doc_path=?, owner=?, updated_at=datetime('now') WHERE id=?",
                (status or "done", doc_path, name.replace(".tsv", ""), gap_id),
            )
            if doc_path:
                conn.execute(
                    "INSERT OR IGNORE INTO edges(from_id, to_id, relation, evidence) VALUES (?,?,?,?)",
                    (gap_id, doc_path, "已解决", note),
                )
    # 自动登记缺口（缺失/冲突/部分为 open；仅重建未处理缺口，保留人工关闭状态）
    conn.execute("DELETE FROM gaps WHERE status='open'")
    conn.execute("""INSERT OR IGNORE INTO gaps (id, topic, severity, evidence, proposal, status)
                    SELECT id, topic,
                           CASE WHEN status='缺失' THEN 'P1' WHEN status='冲突' THEN 'P1' ELSE 'P2' END,
                           evidence, action, 'open'
                    FROM nodes WHERE status IN ('缺失','冲突','部分')""")
    conn.commit()
    print(f"imported nodes: {total}")
    conn.close()


def stats():
    conn = connect()
    print("== 节点总数 ==")
    print(conn.execute("SELECT COUNT(*) FROM nodes").fetchone()[0])
    print("== 按来源/状态 ==")
    for row in conn.execute("SELECT source_type, status, COUNT(*) FROM nodes GROUP BY 1,2 ORDER BY 1,2"):
        print("  %-12s %-8s %d" % row)
    print("== 按维度 ==")
    for row in conn.execute("""SELECT dimension, COUNT(*) FROM node_dimensions GROUP BY 1 ORDER BY 2 DESC"""):
        print("  %-10s %d" % row)
    print("== 缺口统计（gaps）==")
    for row in conn.execute("SELECT status, severity, COUNT(*) FROM gaps GROUP BY 1,2 ORDER BY 1,2"):
        print("  %-8s %-4s %d" % row)
    print("== 已登记新文档 ==", conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0])
    conn.close()


def gaps():
    conn = connect()
    for row in conn.execute("""SELECT g.severity, g.topic, n.source_type, n.evidence, g.proposal
                               FROM gaps g LEFT JOIN nodes n ON n.id=g.id
                               WHERE g.status='open' ORDER BY g.severity, n.source_type"""):
        print(" | ".join(str(x or "") for x in row))
    conn.close()


def query(args):
    dim = args.get("dimension")
    status = args.get("status")
    src = args.get("source")
    sql = "SELECT DISTINCT n.id, n.source_type, n.topic, n.status, n.action FROM nodes n"
    where, params = [], []
    if dim:
        sql += " JOIN node_dimensions d ON d.node_id=n.id"
        where.append("d.dimension=?")
        params.append(dim)
    if status:
        where.append("n.status=?")
        params.append(status)
    if src:
        where.append("n.source_type LIKE ?")
        params.append(f"%{src}%")
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY n.id"
    conn = connect()
    for row in conn.execute(sql, params):
        print(" | ".join(str(x or "") for x in row))
    conn.close()


def orphans():
    conn = connect()
    print("== 无维度节点 ==")
    for row in conn.execute("SELECT id, topic FROM nodes WHERE id NOT IN (SELECT node_id FROM node_dimensions) LIMIT 50"):
        print("  ", row[0], row[1])
    print("== 无关联节点（既非覆盖引用也无入边） ==")
    for row in conn.execute("""SELECT id, topic FROM nodes
        WHERE (coverage_ref IS NULL OR coverage_ref='' OR coverage_ref LIKE '无%')
          AND id NOT IN (SELECT to_id FROM edges) LIMIT 50"""):
        print("  ", row[0], row[1])
    conn.close()


def export():
    conn = connect()
    out = os.path.join(TABLE_DIR, "多维梳理表.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["节点ID", "来源", "路径", "主题", "维度", "新库对应", "覆盖状态", "建议动作", "证据", "负责人"])
        for row in conn.execute("""SELECT n.id, n.source_type, n.path, n.topic,
                                          (SELECT group_concat(dimension, ',') FROM node_dimensions d WHERE d.node_id=n.id),
                                          n.coverage_ref, n.status, n.action, n.evidence, n.owner
                                   FROM nodes n ORDER BY n.id"""):
            w.writerow(row)
    print("export:", out)
    conn.close()


def check_links():
    r = subprocess.run([sys.executable, LINK_CHECKER], capture_output=True, text=True)
    print(r.stdout.strip().splitlines()[-2:] if r.stdout else r.stderr)
    return r.returncode


def reconcile():
    """按优先级重放全部分片：done（带文档）> done > wontfix > planned > open。

    解决多子智能体并发写缺口状态时的后写覆盖问题。
    """
    conn = connect()
    rank = {"done": 3, "wontfix": 2, "planned": 1, "open": 0}
    best = {}
    for name in sorted(os.listdir(TABLE_DIR)):
        if not (name.startswith("缺口处理-") and name.endswith(".tsv")):
            continue
        with open(os.path.join(TABLE_DIR, name), encoding="utf-8") as f:
            rows = list(csv.reader(f, delimiter="\t"))
        if not rows:
            continue
        for raw in rows[1:]:
            if not any(c.strip() for c in raw):
                continue
            gid, status, doc, note = (list(raw) + ["", "", "", ""])[:4]
            gid, status, doc, note = gid.strip(), status.strip(), doc.strip(), note.strip()
            if not gid or not status:
                continue
            r = rank.get(status, 0)
            if status == "done" and not doc:
                r = 2
            cur = best.get(gid)
            if cur is None or r > cur[0] or (r == cur[0] and doc and not cur[2]):
                best[gid] = (r, status, doc, name.replace(".tsv", ""), note)

    conn.execute("DELETE FROM gaps WHERE status='open'")
    for gid, (r, status, doc, owner, note) in best.items():
        row = conn.execute("SELECT topic, evidence, action FROM nodes WHERE id=?", (gid,)).fetchone()
        if conn.execute("SELECT 1 FROM gaps WHERE id=?", (gid,)).fetchone():
            conn.execute(
                "UPDATE gaps SET status=?, doc_path=?, owner=?, updated_at=datetime('now') WHERE id=?",
                (status, doc, owner, gid),
            )
        else:
            conn.execute(
                """INSERT OR REPLACE INTO gaps (id, topic, severity, evidence, proposal, status, doc_path, owner, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,datetime('now'))""",
                (gid, row[0] if row else gid, "P2", row[1] if row else "", row[2] if row else "", status, doc, owner),
            )
        if doc:
            conn.execute(
                "INSERT OR IGNORE INTO edges(from_id, to_id, relation, evidence) VALUES (?,?,?,?)",
                (gid, doc, "已解决" if status == "done" else "计划解决", note),
            )
    # 未处理节点重新登记为 open
    conn.execute(
        """INSERT OR IGNORE INTO gaps (id, topic, severity, evidence, proposal, status)
           SELECT id, topic, CASE WHEN status IN ('缺失','冲突') THEN 'P1' ELSE 'P2' END,
                  evidence, action, 'open'
           FROM nodes WHERE status IN ('缺失','冲突','部分')
             AND id NOT IN (SELECT id FROM gaps)"""
    )
    conn.commit()
    print("== 重放后缺口统计 ==")
    for row in conn.execute("SELECT status, severity, COUNT(*) FROM gaps GROUP BY 1,2 ORDER BY 1,2"):
        print("  %-8s %-4s %d" % row)
    conn.close()


def main():
    args = sys.argv[1:]
    cmd = args[0] if args else "stats"
    opts = {}
    i = 1
    while i < len(args):
        if args[i].startswith("--") and i + 1 < len(args):
            opts[args[i][2:]] = args[i + 1]
            i += 2
        else:
            i += 1
    if cmd == "init":
        init()
    elif cmd == "import":
        init()
        import_all()
    elif cmd == "stats":
        stats()
    elif cmd == "gaps":
        gaps()
    elif cmd == "query":
        query(opts)
    elif cmd == "orphans":
        orphans()
    elif cmd == "reconcile":
        init()
        reconcile()
    elif cmd == "export":
        export()
    elif cmd == "check-links":
        sys.exit(check_links())
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
