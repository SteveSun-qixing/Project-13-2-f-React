#!/usr/bin/env python3
"""一次性维护：校验《薯片生态文档库》全部 `NN.MM-<母文档>-<章节>.md` 拆分件。

检查项：
1. 命名一致：文件名中的章节标题与文件内首个正文标题是否一致；
2. 空壳：正文不足 3 行；
3. 重复：相邻拆分件首段相同，或首个正文标题与本组更早拆分件重复。

输出报告：`梳理表/拆分件校验报告.md`。
"""
from __future__ import annotations

import argparse
import os
import re
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.abspath(os.path.join(BASE, "..", "..", "薯片生态文档库"))
TABLE = os.path.join(BASE, "梳理表")
PIECE_RE = re.compile(r"^(\d+)\.(\d+)-(.+)\.md$")
HEADING_RE = re.compile(r"^(#{2,4})\s+(.+?)\s*$")
ANY_HEADING_RE = re.compile(r"^#{1,4}\s+\S")
FOOTER_RE = re.compile(r"\n---\s*\n+\*\*文档结束\*\*\s*$")


def normalize(text: str) -> str:
    text = text.replace("`", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_filename(name: str, siblings: set[str]):
    """返回 (母文档名, 章节标题)，无法定位母文档时返回 (None, None)。"""
    m = PIECE_RE.match(name)
    if not m:
        return None, None
    remainder = m.group(3)
    hubs = sorted(
        (s for s in siblings if not PIECE_RE.match(s) and s.endswith(".md")),
        key=len,
        reverse=True,
    )
    for hub in hubs:
        stem = hub[:-3]
        if remainder == stem:
            return stem, stem
        if remainder.startswith(stem + "-"):
            return stem, remainder[len(stem) + 1:]
    return None, None


def body_of(text: str) -> str:
    """去掉母文档元数据前言与结尾固定形态，返回正文。"""
    text = FOOTER_RE.sub("", text)
    text = re.sub(r"\n+\*\*文档结束\*\*\s*$", "", text)
    lines = text.splitlines()
    body_start = 0
    for index, line in enumerate(lines[:30]):
        if HEADING_RE.match(line):
            break
        if line.strip() == "---":
            body_start = index + 1
            break
    body = "\n".join(lines[body_start:])
    body = re.sub(r"\n+---\s*$", "", body)
    return body.strip("\n")


def body_lines(body: str) -> list[str]:
    return [line for line in body.splitlines() if line.strip()]


def first_heading(body: str) -> str | None:
    for line in body.splitlines():
        m = HEADING_RE.match(line)
        if m:
            return normalize(m.group(2))
    return None


def first_paragraph(body: str) -> str:
    """首个实质段落：跳过标题、代码块与"示例：/规则："类引导行。"""
    block: list[str] = []
    fence = False
    seen = 0
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("```") or stripped.startswith("~~~"):
            fence = not fence
            block = []
            continue
        if fence:
            continue
        if not stripped:
            if block:
                paragraph = normalize(" ".join(block))
                if len(paragraph) >= 16:
                    return paragraph
                seen += 1
                if seen >= 6:
                    return ""
                block = []
            continue
        if ANY_HEADING_RE.match(line) or stripped == "---":
            block = []
            continue
        block.append(stripped)
    paragraph = normalize(" ".join(block))
    return paragraph if len(paragraph) >= 16 else ""


def number_of(text: str) -> str:
    m = re.match(r"^(\d+(?:\.\d+)*)\s", text.strip())
    return m.group(1) if m else ""


def canon(text: str) -> str:
    """归一化：去掉 `*_`~`、斜杠、空格等文件名净化字符的差异。"""
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", text.lower())


def heading_matches(section: str, heading: str | None) -> bool:
    if heading is None:
        return False
    tail = normalize(section)
    head = normalize(heading)
    # 合并拆分件（如 7.16+7.17 合并为一个文件）标题文字可不同，但节号必须一致
    tail_number = number_of(tail) or number_of(tail.split("-")[-1])
    if tail_number and tail_number == number_of(head):
        return True
    if tail == head or tail.endswith("-" + head):
        return True
    if canon(tail) == canon(head):
        return True
    if re.match(r"^\d+(\.\d+)*\s", head) and canon(tail).endswith(canon(head)):
        return True
    # 子拆分件采用"父标题在前、子标题在后"的写法：首个标题即父标题
    ct, ch = canon(tail), canon(head)
    if len(ch) > 1 and ct.startswith(ch) and re.match(r"^\d", ct[len(ch):]):
        return True
    return False


def scan():
    pieces: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for dirpath, _dirs, files in os.walk(LIB):
        siblings = set(files)
        for name in sorted(files):
            if not PIECE_RE.match(name):
                continue
            hub, section = split_filename(name, siblings)
            if hub is None:
                continue
            path = os.path.join(dirpath, name)
            with open(path, encoding="utf-8") as fh:
                text = fh.read()
            body = body_of(text)
            lines = body_lines(body)
            content_lines = [l for l in lines if not HEADING_RE.match(l)]
            heading = first_heading(body)
            rel_dir = os.path.relpath(dirpath, LIB)
            pieces[(rel_dir, hub)].append(
                {
                    "file": name,
                    "path": os.path.relpath(path, LIB),
                    "dir": rel_dir,
                    "hub": hub,
                    "section": section,
                    "heading": heading,
                    "shell": len(content_lines) < 3,
                    "content_lines": len(content_lines),
                    "paragraph": first_paragraph(body),
                    "match": heading_matches(section, heading),
                }
            )
    return pieces


def build_report(pieces) -> tuple[str, dict]:
    mismatches, shells, duplicates = [], [], []
    total = 0
    for key in sorted(pieces):
        group = pieces[key]
        total += len(group)
        seen_headings: dict[str, str] = {}
        seen_paras: dict[str, str] = {}
        prev = None
        for item in group:
            if not item["match"]:
                mismatches.append(item)
            if item["shell"]:
                shells.append(item)
            if item["heading"] and item["heading"] in seen_headings:
                duplicates.append((item, seen_headings[item["heading"]], "同标题"))
            if item["paragraph"] and prev is not None and item["paragraph"] == prev["paragraph"]:
                duplicates.append((item, prev, "相邻首段"))
            if item["paragraph"] and item["paragraph"] in seen_paras:
                duplicates.append((item, seen_paras[item["paragraph"]], "同首段"))
            if item["heading"]:
                seen_headings.setdefault(item["heading"], item)
            if item["paragraph"]:
                seen_paras.setdefault(item["paragraph"], item)
            prev = item

    def unique(items):
        out, seen = [], set()
        for item in items:
            if isinstance(item, tuple):
                key = (item[0]["file"], item[1]["file"], item[2])
            else:
                key = item["file"]
            if key not in seen:
                seen.add(key)
                out.append(item)
        return out

    mismatches = unique(mismatches)
    shells = unique(shells)
    duplicates = unique(duplicates)

    lines = [
        "# 拆分件校验报告",
        "",
        "> 版本：v1.0.0",
        "> 日期：2026-09-19",
        "> 状态：正式版",
        "> 适用范围：`薯片生态文档库/` 下全部 `NN.MM-<母文档>-<章节>.md` 拆分件的命名一致性、空壳与重复检查结果；由 `工具/校验拆分件.py` 生成，一次性维护材料。",
        "",
        "---",
        "",
        "## 一、总览",
        "",
        f"- 拆分件总数：{total}",
        f"- 母文档分组：{len(pieces)}",
        f"- 命名不一致：{len(mismatches)}",
        f"- 空壳（正文 < 3 行）：{len(shells)}",
        f"- 重复（同标题/同首段）：{len(duplicates)}",
        "",
        "---",
        "",
        "## 二、命名不一致清单",
        "",
        "| 目录 | 拆分件 | 文件名章节 | 文件内首个标题 |",
        "|---|---|---|---|",
    ]
    for item in sorted(mismatches, key=lambda x: (x["dir"], x["file"])):
        heading = item["heading"] or "（无正文标题）"
        lines.append(f"| {item['dir']} | {item['file']} | {item['section']} | {heading} |")
    lines += ["", "---", "", "## 三、空壳清单", "",
              "正文不足 3 行的短章节；命名一致者为母文档本身的短节（正常），命名不一致或标题为空者为错位缺陷。", "",
              "| 目录 | 拆分件 | 正文行数 | 文件内首个标题 | 命名 |", "|---|---|---|---|---|"]
    for item in sorted(shells, key=lambda x: (x["dir"], x["file"])):
        naming = "一致" if item["match"] and item["heading"] else "不一致"
        lines.append(f"| {item['dir']} | {item['file']} | {item['content_lines']} | {item['heading'] or '（无）'} | {naming} |")
    lines += ["", "---", "", "## 四、重复清单", "", "| 目录 | 拆分件 | 重复对象 | 判据 |", "|---|---|---|---|"]
    for item, other, kind in sorted(duplicates, key=lambda x: (x[0]["dir"], x[0]["file"])):
        lines.append(f"| {item['dir']} | {item['file']} | {other['file']} | {kind} |")
    lines += [
        "",
        "---",
        "",
        "**文档结束**",
        "",
    ]
    stats = {
        "total": total,
        "groups": len(pieces),
        "mismatch": len(mismatches),
        "shell": len(shells),
        "duplicate": len(duplicates),
    }
    return "\n".join(lines), stats


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", default=os.path.join(TABLE, "拆分件校验报告.md"))
    args = parser.parse_args()
    pieces = scan()
    report, stats = build_report(pieces)
    with open(args.report, "w", encoding="utf-8") as fh:
        fh.write(report)
    print(
        f"拆分件 {stats['total']}，母文档分组 {stats['groups']}，"
        f"不一致 {stats['mismatch']}，空壳 {stats['shell']}，重复 {stats['duplicate']}"
    )
    print("报告:", os.path.relpath(args.report, os.path.dirname(BASE)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
