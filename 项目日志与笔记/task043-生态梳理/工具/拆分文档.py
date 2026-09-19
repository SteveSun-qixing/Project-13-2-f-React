#!/usr/bin/env python3
"""按 Markdown 二级章节拆分薯片生态文档库中的大型文档。

默认行为会把大型文档改为目录页，并在原目录中生成章节文档。
使用 --dry-run 可只预览，不写入任何文件。
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parents[3] / "薯片生态文档库"
MIN_LINES = 300
TARGET_LINES = 240
HARD_SECTION_LINES = 400
HEADING_RE = re.compile(r"^( {0,3})(#{1,6})[ \t]+(.+?)\s*$")
SOURCE_PREFIX_RE = re.compile(r"^(?P<prefix>(?:ADR-\d+|\d+))[-_]")
INVALID_FILENAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


@dataclass
class Section:
    level: int
    title: str
    start: int
    end: int


@dataclass
class SplitPlan:
    source: Path
    title: str
    preamble: list[str]
    sections: list[Section]
    parts: list[tuple[str, list[str]]]


def is_fence(line: str) -> bool:
    return bool(re.match(r"^ {0,3}(`{3,}|~{3,})", line))


def headings(lines: list[str]) -> list[tuple[int, int, str]]:
    result: list[tuple[int, int, str]] = []
    fence_char: str | None = None
    fence_length = 0
    for index, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if fence_char is not None:
            closing = re.match(r"^ {0,3}(`{3,}|~{3,})\s*$", line)
            if closing and closing.group(1)[0] == fence_char and len(closing.group(1)) >= fence_length:
                fence_char = None
            continue
        if is_fence(line):
            marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line).group(1)
            fence_char, fence_length = marker[0], len(marker)
            continue
        if match:
            result.append((index, len(match.group(2)), match.group(3).strip()))
    return result


def clean_title(title: str) -> str:
    title = re.sub(r"[*_`~]", "", title)
    title = re.sub(r"\s+", " ", title).strip()
    return INVALID_FILENAME_RE.sub("-", title).strip(" .") or "未命名章节"


def document_title(lines: list[str], source: Path) -> str:
    for line in lines:
        match = re.match(r"^#\s+(.+?)\s*$", line)
        if match:
            return match.group(1).strip()
    return source.stem


def source_prefix(source: Path) -> str:
    match = SOURCE_PREFIX_RE.match(source.stem)
    if not match:
        return "00"
    value = match.group("prefix")
    return value.removeprefix("ADR-")


def metadata(lines: list[str]) -> list[str]:
    result: list[str] = []
    for line in lines:
        if line.startswith("## "):
            break
        if line.strip() == "**文档结束**":
            continue
        result.append(line)
    while result and not result[-1].strip():
        result.pop()
    return result


def make_sections(lines: list[str]) -> tuple[list[str], list[Section]]:
    found = headings(lines)
    level_two = [(i, level, title) for i, level, title in found if level == 2]
    if not level_two:
        return lines, []
    sections = [Section(2, title, start, level_two[n + 1][0] if n + 1 < len(level_two) else len(lines)) for n, (start, _, title) in enumerate(level_two)]
    return lines[: sections[0].start], sections


def split_large_section(lines: list[str], section: Section) -> list[tuple[str, list[str]]]:
    content = lines[section.start : section.end]
    if len(content) <= HARD_SECTION_LINES:
        return [(section.title, content)]
    subheads = [
        (index - section.start, title)
        for index, level, title in headings(content)
        if level == 3
    ]
    if not subheads:
        return [(section.title, content)]
    boundaries = [(0, section.title)] + subheads
    parts: list[tuple[str, list[str]]] = []
    for index, (start, title) in enumerate(boundaries):
        end = boundaries[index + 1][0] if index + 1 < len(boundaries) else len(content)
        chunk = content[start:end]
        if index == 0 and len(chunk) <= 4:
            continue
        part_title = section.title if index == 0 else f"{section.title}-{title}"
        parts.append((part_title, chunk))
    return parts or [(section.title, content)]


def build_plan(source: Path) -> SplitPlan | None:
    lines = source.read_text(encoding="utf-8").splitlines()
    if len(lines) < MIN_LINES:
        return None
    preamble, sections = make_sections(lines)
    if not sections:
        return None
    parts: list[tuple[str, list[str]]] = []
    for section in sections:
        parts.extend(split_large_section(lines, section))
    return SplitPlan(source, document_title(lines, source), preamble, sections, parts)


def part_name(plan: SplitPlan, number: int, title: str) -> str:
    prefix = source_prefix(plan.source)
    stem = clean_title(plan.source.stem)
    return f"{prefix}.{number:02d}-{stem}-{clean_title(title)}.md"


def with_footer(lines: list[str]) -> list[str]:
    result = lines[:]
    while result and not result[-1].strip():
        result.pop()
    if result and result[-1].strip() != "---":
        result.extend(["", "---"])
    result.extend(["", "**文档结束**", ""])
    return result


def part_content(plan: SplitPlan, title: str, lines: list[str]) -> str:
    result = plan.preamble[:]
    if result and result[-1].strip():
        result.append("")
    result.extend(lines)
    return "\n".join(with_footer(result))


def index_content(plan: SplitPlan) -> str:
    result = plan.preamble[:]
    while result and not result[-1].strip():
        result.pop()
    result.extend(["", "---", "", "## 章节目录", ""])
    for number, (title, _) in enumerate(plan.parts, 1):
        result.append(f"{number}. [{title}](./{part_name(plan, number, title)})")
    result.extend(["", "---", "", "拆分说明：本文档保留元数据与章节目录，正文内容位于目录中的章节文档。", "", "**文档结束**", ""])
    return "\n".join(result)


def iter_sources(root: Path):
    for source in sorted(root.rglob("*.md")):
        if source.name == "README.md" or "归档" in source.parts:
            continue
        if re.match(r"^(?:\d+|ADR-\d+)\.\d+-", source.name):
            continue
        yield source


def validate_plan(plan: SplitPlan) -> list[str]:
    errors: list[str] = []
    expected = sum(len(lines) for _, lines in plan.parts)
    actual = sum(len(text.splitlines()) for title, lines in plan.parts for text in [part_content(plan, title, lines)])
    if expected <= 0 or actual <= 0:
        errors.append("拆分内容为空")
    names = [part_name(plan, index, title) for index, (title, _) in enumerate(plan.parts, 1)]
    if len(names) != len(set(names)):
        errors.append("生成了重复文件名")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="文档库根目录")
    parser.add_argument("--dry-run", action="store_true", help="只显示拆分计划，不写文件")
    args = parser.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        parser.error(f"文档库目录不存在：{root}")
    plans = [plan for source in iter_sources(root) if (plan := build_plan(source))]
    print(f"候选文档：{len(plans)} 份")
    for plan in plans:
        errors = validate_plan(plan)
        if errors:
            print(f"跳过：{plan.source.relative_to(root)}（{'；'.join(errors)}）")
            continue
        print(f"{plan.source.relative_to(root)}：{len(plan.parts)} 个章节文档")
        for number, (title, lines) in enumerate(plan.parts, 1):
            print(f"  {part_name(plan, number, title)} ({len(lines)} 行正文)")
        if args.dry_run:
            continue
        for number, (title, lines) in enumerate(plan.parts, 1):
            output = plan.source.with_name(part_name(plan, number, title))
            output.write_text(part_content(plan, title, lines), encoding="utf-8")
        plan.source.write_text(index_content(plan), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
