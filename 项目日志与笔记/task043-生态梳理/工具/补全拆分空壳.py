#!/usr/bin/env python3
"""收口：补全拆分空壳 + R15 分区口径统一 + S47 缺口状态。

1. 从母文档回填被拆分工具清空的章节文件；
2. 把仍写"8 分区/八个分区"的口径统一为 9 分区（新增 08-产品与交互）；
3. 写 缺口处理-S47.tsv（关闭 S45 与 R15 相关 P1，其余转 planned）。
"""

import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.abspath(os.path.join(BASE, "..", "..", "薯片生态文档库"))
TABLE = os.path.join(BASE, "梳理表")
SPLIT_RE = re.compile(r"^(\d+)\.(\d+)-(.+)\.md$")


def is_shell(text):
    body = [l for l in text.splitlines() if l.strip() and not l.startswith(("#", ">", "**", "---"))]
    return len(body) <= 2


def section_of(hub_text, title):
    lines = hub_text.splitlines(keepends=True)
    target = None
    for i, line in enumerate(lines):
        m = re.match(r"^(#{1,4})\s+(.*?)\s*$", line.rstrip("\n"))
        if m and title.strip() and title.strip() in m.group(2):
            target = (i, len(m.group(1)))
            break
    if target is None:
        return None
    start, level = target
    out = [lines[start]]
    for line in lines[start + 1:]:
        m = re.match(r"^(#{1,6})\s+", line)
        if m and len(m.group(1)) <= level:
            break
        out.append(line)
    return "".join(out).strip("\n")


def header_of(hub_text):
    lines = hub_text.splitlines(keepends=True)
    out = []
    for line in lines:
        if line.startswith("# "):
            out.append(line)
            continue
        if out and (line.startswith("## ") or line.startswith("### ")):
            break
        if out:
            out.append(line)
    return "".join(out).strip("\n")


def fill_shells():
    fixed = []
    for root, _dirs, files in os.walk(LIB):
        for name in sorted(files):
            m = SPLIT_RE.match(name)
            if not m:
                continue
            path = os.path.join(root, name)
            with open(path, encoding="utf-8") as f:
                shell = f.read()
            if not is_shell(shell):
                continue
            major = m.group(1)
            hubs = [f for f in files
                    if f.startswith(f"{major}-") and not re.match(rf"^{major}\.\d+-", f)]
            if not hubs:
                continue
            hub_name = hubs[0]
            hub_path = os.path.join(root, hub_name)
            with open(hub_path, encoding="utf-8") as f:
                hub = f.read()
            hubbase = hub_name[:-3]
            idx = name.find(hubbase)
            tail = name[idx + len(hubbase) + 1:-3] if idx >= 0 else ""
            candidates = [tail] + [tail.split("-")[-1], tail.split("-")[-2] if "-" in tail else ""]
            section = None
            for cand in candidates:
                if cand:
                    section = section_of(hub, cand)
                    if section:
                        break
            if not section:
                continue
            new = f"{header_of(hub)}\n\n---\n\n{section}\n\n---\n\n**文档结束**\n"
            if len(new) > len(shell):
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new)
                fixed.append(name)
    print(f"回填空壳 {len(fixed)} 个")
    for n in fixed:
        print("  ", n)


def fix_partitions():
    rules = [
        ("00-愿景与原则/01.09-01-架构原则-附录：规则编号表（R1-R20）.md",
         "库根固定 8 分区：`00-愿景与原则`、`01-架构设计`、`02-开发规范`、`03-插件开发`、`04-文件格式规范`、`05-接口与契约`、`06-开发与运维`、`07-工程管理`。",
         "库根固定 9 分区：`00-愿景与原则`、`01-架构设计`、`02-开发规范`、`03-插件开发`、`04-文件格式规范`、`05-接口与契约`、`06-开发与运维`、`07-工程管理`、`08-产品与交互`。"),
        ("07-工程管理/01.03-01-超大型工程管理体系-三、文档体系（四层）.md",
         "`docs/` 固定八个分区", "`docs/` 固定九个分区"),
        ("07-工程管理/01.04-01-超大型工程管理体系-四、开发生命周期（六阶段）.md",
         "八个分区文档完成并评审", "九个分区文档完成并评审"),
        ("07-工程管理/02.03-02-开发流程与阶段计划-三、Phase 0：文档与预研.md",
         "8 个分区全部完成并进入正式版", "9 个分区全部完成并进入正式版"),
        ("01-架构设计/00-整体架构图.md",
         "全部正式技术文档的唯一落位（8 分区）", "全部正式技术文档的唯一落位（9 分区）"),
    ]
    n = 0
    for path, old, new in rules:
        full = os.path.join(LIB, path)
        if not os.path.exists(full):
            continue
        with open(full, encoding="utf-8") as f:
            text = f.read()
        if old in text:
            with open(full, "w", encoding="utf-8") as f:
                f.write(text.replace(old, new))
            n += 1
            print("  R15:", path)
    print(f"分区口径修订 {n} 处")


def write_s47():
    rows = [
        ("ND-S42-001", "done", "", "R15 与工程管理/整体架构图口径统一为 9 分区"),
        ("ND-S45-010", "done", "", "11 系列拆分空壳已从母文档回填"),
        ("ND-S45-011", "planned", "", "服务端旧插件/主题口径按 Phase 3 重写"),
        ("ND-S45-013", "planned", "", "旧 multipart 上传按控制面契约重写（Phase 3）"),
        ("ND-S45-016", "planned", "", "管理后台旧主题/多语言按 ADR-006 清理（Phase 3）"),
    ]
    path = os.path.join(TABLE, "缺口处理-S47.tsv")
    with open(path, "w", encoding="utf-8") as f:
        f.write("缺口ID\t状态\t新文档路径\t说明\n")
        for r in rows:
            f.write("\t".join(r) + "\n")
    print("写入", path)


if __name__ == "__main__":
    fill_shells()
    fix_partitions()
    write_s47()
