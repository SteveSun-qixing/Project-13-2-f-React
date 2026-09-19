#!/usr/bin/env python3
"""P1 残留收口与网络清理（一次性维护脚本，可审计）。

用法：python3 项目日志与笔记/task043-生态梳理/工具/收口-P1与网络清理.py
作用：
1. 按正式标识统一 card_type / 插件 ID / 包路径残留（保护"别名/历史"说明行）；
2. 修复具体文档级 P1：Markdown 卡片标识、图片类型、窗口模型、包管理表述、看板状态；
3. 清理悬空边、补齐无维度节点的维度；
4. 写入缺口处理-S46.tsv 并输出迁移与未决清单。
"""

import os
import re
import sqlite3

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.abspath(os.path.join(BASE, "..", "..", "薯片生态文档库"))
TABLE = os.path.join(BASE, "梳理表")
DB = os.path.join(TABLE, "薯片生态多维梳理.db")

# 正式标识替换（跳过含"别名/历史/旧"的保护行）
TOKENS = [
    ("VideoCard", "base.video"), ("ImageCard", "base.image"), ("MusicCard", "base.music"),
    ("WebPageCard", "base.webpage"), ("ScoreCard", "base.score"), ("MarkdownCard", "base.markdown"),
    ("RichTextCard", "base.richtext"), ("FileCard", "base.file"), ("BookCard", "base.book"),
]
ALIAS_FILES = [
    "02-开发规范/10-设计资产与图标规范.md",
    "03-插件开发/09-官方插件与应用目录.md",
    "03-插件开发/02.09-02-插件清单规范-九、校验规则与常见错误.md",
    "03-插件开发/02.07-02-插件清单规范-七、四角色专有字段.md",
    "03-插件开发/02.10-02-插件清单规范-十、自检清单.md",
    "05-接口与契约/14.05-14-资源打开与默认处理器契约-五、启动载荷.md",
    "05-接口与契约/14.09-14-资源打开与默认处理器契约-九、完整示例.md",
    "04-文件格式规范/01.05-01-卡片文件格式-五、structure.yaml.md",
    "04-文件格式规范/01.06-01-卡片文件格式-六、content-.yaml.md",
    "04-文件格式规范/01.08-01-卡片文件格式-六、content-.yaml-6.2 视频卡片（VideoCard）.md",
    "04-文件格式规范/01.11-01-卡片文件格式-六、content-.yaml-6.5 网页卡片（WebPageCard）.md",
    "04-文件格式规范/01.14-01-卡片文件格式-六、content-.yaml-6.8 音乐卡片（MusicCard）.md",
    "04-文件格式规范/01.15-01-卡片文件格式-六、content-.yaml-6.9 文件卡片（FileCard）.md",
    "04-文件格式规范/01.16-01-卡片文件格式-六、content-.yaml-6.10 其他基础卡片类型.md",
    "04-文件格式规范/01-卡片文件格式.md",
    "08-产品与交互/08-官方应用功能总览.md",
    "01-架构设计/01-子系统设计/03.08-03-插件架构设计-八、通信规则.md",
]
GUARD = ("别名", "历史", "旧名", "读取归一")

EXACT = {
    "05-接口与契约/02.08-02-SDK-API规范-八、脚手架（@chips-sdk-scaffold）.md": [
        (r"chips\.official\.markdown-card", "chips.basecard.markdown"),
    ],
    "05-接口与契约/15.02-15-文件处理契约-二、总体架构.md": [
        (r"chips\.official\.file-processing/contracts", "chips.service.file-processing/contracts"),
    ],
    "05-接口与契约/15.03-15-文件处理契约-三、会话契约.md": [
        (r"chips\.official\.file-processing/contracts", "chips.service.file-processing/contracts"),
    ],
    "05-接口与契约/13.08-13-命令系统契约-八、完整示例.md": [
        (r"com\.chips\.iconmaker", "chips.official.iconmaker"),
    ],
    "04-文件格式规范/03.02-03-插件包格式-二、包结构.md": [
        (r"图片（`\.svg`、`\.png`、`\.jpg`、`\.webp`、`\.gif`）",
         "图片（`.svg`、`.png`、`.jpg`、`.webp`、`.gif`、`.ico`、`.icns`）"),
    ],
    "02-开发规范/11-第三方参考资产清单.md": [
        (r"`package\.json` / `package-lock\.json`", "`package.json` / `pnpm-lock.yaml`（Cargo 侧 `Cargo.lock`）"),
    ],
    "01-架构设计/01-子系统设计/12.08-12-编辑引擎设计-八、官方编辑引擎应用参考架构.md": [
        (r"\| 卡片窗口 \| 独立窗口（`window:create`，`window:control`） \|",
         "| 卡片窗口 | 应用内窗口层（不创建独立窗口；窗口状态机见《08-产品与交互/01-编辑引擎产品与交互设计》§5） |"),
        (r"\| 箱子窗口 \| 独立窗口 \|",
         "| 箱子窗口 | 应用内窗口层（同上） |"),
    ],
    "03-插件开发/09-官方插件与应用目录.md": [
        (r"cardTypes: \[MarkdownCard\]", "cardTypes: [base.markdown]"),
        (r"\| `chips\.basecard\.markdown` \| `MarkdownCard` \|", "| `chips.basecard.markdown` | `base.markdown` |"),
        (r"\| `chips\.layout\.board` \| 看板布局 \| 多列分类视图，条目可列间移动 \| 无（仅平台链路） \| 同上 \| 已设计 \|",
         "| `chips.layout.board` | 看板布局 | 多列分类视图，条目可列间移动 | 无（仅平台链路） | 同上 | 已设计（新设计待实现） |"),
        (r"\| `chips\.layout\.composite` \| 复合卡片布局 \| 条目按顺序垂直排列，形成线性阅读流 \| 无（仅平台链路） \| 同上 \| 已设计 \|",
         "| `chips.layout.composite` | 复合卡片布局 | 条目按顺序垂直排列，形成线性阅读流 | 无（仅平台链路） | 同上 | 已设计（新设计待实现） |"),
        (r"已知偏差：`@chips/sdk/scaffold` 文档示例使用 `chips\.official\.markdown-card` 作为基础卡片插件 ID，与 R20 官方基础卡片命名空间冲突；正式 ID 以本目录 `chips\.basecard\.markdown` 为准，示例按本目录修订。",
         "已收口：`@chips/sdk/scaffold` 文档示例统一使用 `chips.basecard.markdown`；正式 ID 以本目录为准。"),
    ],
}

GAP_DONE = {
    "ND-S24-010": "SDK 脚手架示例统一 chips.basecard.markdown",
    "ND-S24-011": "文件处理契约包路径统一 chips.service.file-processing/contracts",
    "ND-S24-012": "命令示例统一 chips.official.iconmaker",
    "ND-S26-010": "插件包图片类型补充 .ico/.icns",
    "ND-S29-006": "Markdown 卡片标识统一 base.markdown",
    "ND-S29-008": "插件清单规范正式标识统一",
    "ND-S29-009": "启动载荷 cardType 统一 base.*",
    "ND-S32-002": "依赖清单表述改 pnpm-lock.yaml",
    "ND-S36-132": "目录登记表卡片类型统一 base.*",
    "ND-S36-133": "校验规则示例统一 base.*",
    "ND-S36-136": "资源打开启动载荷统一 base.*",
    "S37-006": "文档窗口模型统一为应用内窗口层（08/01 口径）",
    "S42-001": "README 与文档编写规范已补 08/09 分区",
}
GAP_PLANNED = {
    "ND-S36-135": "电子书载荷口径以 14-资源打开契约 §5.4 与官方插件目录为准（待二次核对）",
    "ND-S36-138": "看板/复合卡片布局为新设计待实现（Phase 3）",
    "S35-021": "图标服务为旧实现迁移项（Phase 3 官方插件重写）",
    "S35-022": "颜色提取为旧实现迁移项（内容处理服务已登记）",
}


def patch_file(path, rules, apply=True):
    full = os.path.join(LIB, path)
    if not os.path.exists(full):
        return 0
    with open(full, encoding="utf-8") as f:
        text = f.read()
    orig = text
    changed = 0
    for pat, rep in rules:
        new, n = re.subn(pat, rep, text)
        if n:
            text, changed = new, changed + n
    if apply and text != orig:
        with open(full, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"  patch {path}: {changed} 处")
    return changed


def alias_sweep():
    print("== 1. 正式标识替换（保护别名说明行） ==")
    total = 0
    for path in ALIAS_FILES:
        full = os.path.join(LIB, path)
        if not os.path.exists(full):
            continue
        with open(full, encoding="utf-8") as f:
            lines = f.read().splitlines(keepends=True)
        changed = 0
        for i, line in enumerate(lines):
            if any(g in line for g in GUARD):
                continue
            new = line
            for token, formal in TOKENS:
                new = re.sub(rf"(?<![A-Za-z0-9_.]){token}(?![A-Za-z0-9_])", formal, new)
            if new != line:
                lines[i] = new
                changed += 1
        if changed:
            with open(full, "w", encoding="utf-8") as f:
                f.writelines(lines)
            print(f"  alias {path}: {changed} 行")
            total += changed
    print(f"  合计 {total} 行")


def exact_fixes():
    print("== 2. 文档级 P1 精确修复 ==")
    total = 0
    for path, rules in EXACT.items():
        total += patch_file(path, rules)
    print(f"  合计 {total} 处")


def network_cleanup():
    print("== 3. 网络清理 ==")
    conn = sqlite3.connect(DB)
    conn.execute("PRAGMA busy_timeout=8000")
    node_ids = {r[0] for r in conn.execute("SELECT id FROM nodes")}
    doc_paths = {r[0] for r in conn.execute("SELECT path FROM docs")}
    removed = 0
    for eid, to_id in conn.execute("SELECT id, to_id FROM edges").fetchall():
        keep = to_id in node_ids or to_id in doc_paths or ("/" in to_id and to_id.endswith(".md"))
        if not keep:
            conn.execute("DELETE FROM edges WHERE id=?", (eid,))
            removed += 1
    filled = conn.execute(
        """INSERT OR IGNORE INTO node_dimensions(node_id, dimension)
           SELECT id, '其他' FROM nodes WHERE id NOT IN (SELECT node_id FROM node_dimensions)"""
    ).rowcount
    conn.commit()
    print(f"  删除悬空边 {removed}；补维度节点 {max(filled, 0)}")
    conn.close()


def write_gap_status():
    print("== 4. 缺口状态落盘 ==")
    path = os.path.join(TABLE, "缺口处理-S46.tsv")
    with open(path, "w", encoding="utf-8") as f:
        f.write("缺口ID\t状态\t新文档路径\t说明\n")
        for gid, note in GAP_DONE.items():
            f.write(f"{gid}\tdone\t\t{note}\n")
        for gid, note in GAP_PLANNED.items():
            f.write(f"{gid}\tplanned\t\t{note}\n")
    print("  ", path)


def export_backlog():
    print("== 5. 迁移与未决清单 ==")
    conn = sqlite3.connect(DB)
    rows = conn.execute(
        """SELECT g.severity, g.status, g.id, g.topic, n.source_type, g.doc_path, g.proposal
           FROM gaps g LEFT JOIN nodes n ON n.id = g.id
           WHERE g.status IN ('open','planned') ORDER BY g.status, g.severity, g.id"""
    ).fetchall()
    out = os.path.join(BASE, "迁移与未决清单.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# 迁移与未决清单\n\n")
        f.write(f"> 生成时间：自动生成；共 {len(rows)} 条（open + planned）。\n")
        f.write("> planned = 旧实现迁移项或已规划设计（Phase 3/5）；open = 待设计/待裁决。\n\n")
        f.write("| 严重度 | 状态 | 编号 | 主题 | 来源 | 落点/说明 |\n|---|---|---|---|---|---|\n")
        for sev, st, gid, topic, src, doc_path, proposal in rows:
            note = doc_path or proposal or ""
            f.write(f"| {sev} | {st} | {gid} | {str(topic)[:80]} | {src or ''} | {str(note)[:110]} |\n")
    print("  ", out, f"({len(rows)} 条)")
    conn.close()


if __name__ == "__main__":
    alias_sweep()
    exact_fixes()
    network_cleanup()
    write_gap_status()
    export_backlog()
    print("完成。请运行：python3 项目日志与笔记/task043-生态梳理/工具/梳理库.py import && ... reconcile")
