#!/usr/bin/env python3
"""薯片生态多维梳理监控台。

启动：
  python3 项目日志与笔记/task043-生态梳理/工具/梳理监控台.py [--port 8477] [--no-open]

浏览器打开 http://127.0.0.1:8477 即可实时查看多维梳理库（每 3 秒自动刷新）。

特性：只读访问 SQLite（WAL + query_only），与梳理库.py 的 import 并发安全。
"""

import argparse
import json
import os
import sqlite3
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE, "梳理表", "薯片生态多维梳理.db")
HTML_PATH = os.path.join(BASE, "工具", "监控台.html")
NETWORK_HTML_PATH = os.path.join(BASE, "工具", "监控台-网络视图.html")

STATUS_ORDER = ["已覆盖", "部分", "缺失", "冲突", "已替代", "已废弃", "不适用"]
SEVERITY_ORDER = ["P0", "P1", "P2", "P3"]


def connect_ro():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, timeout=8)
    conn.execute("PRAGMA query_only=ON;")
    conn.execute("PRAGMA busy_timeout=8000;")
    conn.row_factory = sqlite3.Row
    return conn


def rows(conn, sql, params=()):
    return [dict(r) for r in conn.execute(sql, params)]


def api_meta(conn):
    st = os.stat(DB_PATH)
    return {
        "db": os.path.relpath(DB_PATH, os.path.dirname(BASE)),
        "db_mtime": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
        "db_size": st.st_size,
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


def api_stats(conn):
    by_status = rows(conn, "SELECT status AS k, COUNT(*) AS n FROM nodes GROUP BY 1")
    by_source = rows(conn, """SELECT source_type AS source, status, COUNT(*) AS n
                              FROM nodes GROUP BY 1,2 ORDER BY 1,2""")
    by_dim = rows(conn, """SELECT d.dimension AS dimension, n.status AS status, COUNT(*) AS n
                           FROM node_dimensions d JOIN nodes n ON n.id=d.node_id
                           GROUP BY 1,2 ORDER BY 1,2""")
    gaps = rows(conn, "SELECT status, severity, COUNT(*) AS n FROM gaps GROUP BY 1,2 ORDER BY 1,2")
    docs = rows(conn, "SELECT COUNT(*) AS n FROM docs")[0]["n"]
    edges = rows(conn, "SELECT COUNT(*) AS n FROM edges")[0]["n"]
    dims = [r["name"] for r in conn.execute("SELECT name FROM dimensions ORDER BY name")]
    sources = [r["source_type"] for r in conn.execute("SELECT DISTINCT source_type FROM nodes ORDER BY 1")]
    last_update = rows(conn, "SELECT MAX(updated_at) AS t FROM nodes")[0]["t"]
    return {
        "by_status": by_status, "by_source": by_source, "by_dimension": by_dim,
        "gaps": gaps, "docs": docs, "edges": edges, "dimensions": dims,
        "sources": sources, "last_node_update": last_update,
        "status_order": STATUS_ORDER, "severity_order": SEVERITY_ORDER,
    }


def api_nodes(conn, q):
    where, params = [], []
    for key, col in (("status", "n.status"), ("source", "n.source_type"), ("owner", "n.owner")):
        val = q.get(key, [""])[0]
        if val:
            where.append(f"{col}=?")
            params.append(val)
    dim = q.get("dimension", [""])[0]
    if dim:
        where.append("n.id IN (SELECT node_id FROM node_dimensions WHERE dimension=?)")
        params.append(dim)
    kw = q.get("q", [""])[0].strip()
    if kw:
        where.append("(n.id LIKE ? OR n.topic LIKE ? OR n.path LIKE ? OR n.evidence LIKE ? OR n.coverage_ref LIKE ?)")
        params += [f"%{kw}%"] * 5
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    total = conn.execute(f"SELECT COUNT(*) FROM nodes n {where_sql}", params).fetchone()[0]
    limit = min(int(q.get("limit", ["100"])[0]), 500)
    offset = int(q.get("offset", ["0"])[0])
    data = rows(conn, f"""SELECT n.id, n.source_type, n.path, n.topic, n.status, n.action,
                                 n.evidence, n.coverage_ref, n.owner, n.updated_at,
                                 (SELECT group_concat(dimension, ',') FROM node_dimensions d WHERE d.node_id=n.id) AS dimensions
                          FROM nodes n {where_sql}
                          ORDER BY n.id LIMIT ? OFFSET ?""", params + [limit, offset])
    return {"total": total, "limit": limit, "offset": offset, "items": data}


def api_gaps(conn, q):
    where, params = [], []
    sev = q.get("severity", [""])[0]
    if sev:
        where.append("g.severity=?")
        params.append(sev)
    st = q.get("status", [""])[0]
    if st:
        where.append("g.status=?")
        params.append(st)
    src = q.get("source", [""])[0]
    if src:
        where.append("n.source_type=?")
        params.append(src)
    kw = q.get("q", [""])[0].strip()
    if kw:
        where.append("(g.id LIKE ? OR g.topic LIKE ? OR g.evidence LIKE ? OR g.proposal LIKE ?)")
        params += [f"%{kw}%"] * 4
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""
    total = conn.execute(f"SELECT COUNT(*) FROM gaps g LEFT JOIN nodes n ON n.id=g.id {where_sql}", params).fetchone()[0]
    limit = min(int(q.get("limit", ["100"])[0]), 500)
    offset = int(q.get("offset", ["0"])[0])
    data = rows(conn, f"""SELECT g.id, g.topic, g.severity, g.status, g.evidence, g.proposal,
                                 g.doc_path, g.owner, g.updated_at,
                                 n.source_type, n.action,
                                 (SELECT group_concat(dimension, ',') FROM node_dimensions d WHERE d.node_id=g.id) AS dimensions
                          FROM gaps g LEFT JOIN nodes n ON n.id=g.id {where_sql}
                          ORDER BY g.severity, g.id LIMIT ? OFFSET ?""", params + [limit, offset])
    return {"total": total, "limit": limit, "offset": offset, "items": data}


def api_docs(conn, q):
    return {"items": rows(conn, "SELECT path, title, status, owner, note, updated_at FROM docs ORDER BY updated_at DESC")}


def api_edges(conn, q):
    limit = min(int(q.get("limit", ["200"])[0]), 1000)
    return {"items": rows(conn, f"SELECT from_id, to_id, relation, evidence FROM edges ORDER BY id DESC LIMIT ?", [limit])}


def api_graph(conn, q):
    """返回完整网络图数据：全部节点（含维度标签、缺口信息）与全部关系边。

    专供网络视图（Obsidian 风格双向关联图）一次性加载，前端本地做筛选/搜索/高亮，
    避免图谱交互时反复请求分页接口。
    """
    node_where, node_params = [], []
    status_f = q.get("status", [""])[0]
    if status_f:
        node_where.append("n.status=?")
        node_params.append(status_f)
    source_f = q.get("source", [""])[0]
    if source_f:
        node_where.append("n.source_type=?")
        node_params.append(source_f)
    where_sql = ("WHERE " + " AND ".join(node_where)) if node_where else ""

    nodes = rows(conn, f"""SELECT n.id, n.source_type, n.path, n.topic, n.status, n.action,
                                  n.coverage_ref, n.evidence, n.owner, n.updated_at,
                                  (SELECT group_concat(dimension, ',') FROM node_dimensions d WHERE d.node_id=n.id) AS dimensions
                           FROM nodes n {where_sql}
                           ORDER BY n.id""", node_params)

    gap_rows = rows(conn, "SELECT id, severity, status AS gap_status FROM gaps")
    gap_map = {g["id"]: g for g in gap_rows}
    for n in nodes:
        g = gap_map.get(n["id"])
        n["gap_severity"] = g["severity"] if g else None
        n["gap_status"] = g["gap_status"] if g else None
        n["dimensions"] = (n["dimensions"] or "").split(",") if n["dimensions"] else []

    node_ids = {n["id"] for n in nodes}
    edges = rows(conn, "SELECT from_id, to_id, relation, evidence FROM edges")
    if node_where:
        edges = [e for e in edges if e["from_id"] in node_ids and e["to_id"] in node_ids]

    dims = [r["name"] for r in conn.execute("SELECT name FROM dimensions ORDER BY name")]
    sources = [r["source_type"] for r in conn.execute("SELECT DISTINCT source_type FROM nodes ORDER BY 1")]
    relations = [r[0] for r in conn.execute("SELECT DISTINCT relation FROM edges ORDER BY 1")]

    return {
        "nodes": nodes, "edges": edges,
        "dimensions": dims, "sources": sources, "relations": relations,
        "status_order": STATUS_ORDER, "severity_order": SEVERITY_ORDER,
    }


API = {
    "/api/meta": lambda c, q: api_meta(c),
    "/api/stats": lambda c, q: api_stats(c),
    "/api/nodes": api_nodes,
    "/api/gaps": api_gaps,
    "/api/docs": api_docs,
    "/api/edges": api_edges,
    "/api/graph": api_graph,
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        from urllib.parse import urlparse, parse_qs
        parsed = urlparse(self.path)
        path = parsed.path
        if path in ("/", "/index.html"):
            with open(HTML_PATH, "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
            return
        if path == "/network":
            with open(NETWORK_HTML_PATH, "rb") as f:
                self._send(200, f.read(), "text/html; charset=utf-8")
            return
        if path not in API:
            self._send(404, {"error": "not found"})
            return
        if not os.path.exists(DB_PATH):
            self._send(503, {"error": "数据库不存在，请先运行 梳理库.py import"})
            return
        try:
            conn = connect_ro()
            try:
                result = API[path](conn, parse_qs(parsed.query))
            finally:
                conn.close()
            self._send(200, result)
        except Exception as exc:  # noqa: BLE001
            self._send(500, {"error": str(exc)})

    def log_message(self, *args):  # 静默访问日志
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8477)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()
    if not os.path.exists(DB_PATH):
        print("数据库不存在：", DB_PATH)
        print("请先运行：python3 工具/梳理库.py import")
        return
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"薯片生态多维梳理监控台已启动：{url}")
    print("Ctrl+C 停止")
    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()
