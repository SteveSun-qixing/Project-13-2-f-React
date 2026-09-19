#!/usr/bin/env python3
"""一次性维护：修复拆分工具偏移错位产生的章节文档。

原理：偏移错位的拆分件仍是母文档正文的连续切片（相互重叠/重复）。把同一
母文档区间的拆分件按编号顺序做序列拼接（去重叠、去重复），得到母章节的完整
正文，再按母文档章节目录的既定拆分件清单重新切分回填。

用法：
    python3 修复拆分错位.py            # 预览（不写文件）
    python3 修复拆分错位.py --apply    # 归档原件后回填
"""
from __future__ import annotations

import argparse
import os
import re
import shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.abspath(os.path.join(BASE, "..", "..", "薯片生态文档库"))
ARCHIVE = os.path.join(BASE, "归档-拆分错位件-原始")
INDEX_RE = re.compile(r"^\d+\.\s+\[(.+?)\]\(\./(.+?\.md)\)")
PIECE_RE = re.compile(r"^(\d+)\.(\d+)-")
HEADING_RE = re.compile(r"^(#{2,4})\s+(.+?)\s*$")

GROUPS = [
    ("04-文件格式规范/01-卡片文件格式.md", 6, 16),
    ("03-插件开发/04-基础卡片插件开发指南.md", 9, 19),
    ("03-插件开发/05-箱子布局插件开发指南.md", 7, 14),
    ("05-接口与契约/05-事件契约规范.md", 4, 14),
    ("05-接口与契约/08-基础卡片插件接口.md", 9, 15),
    ("05-接口与契约/09-箱子布局插件接口.md", 8, 10),
    # 11-社区平台API契约 已由并行槽位按"父标题在前"写法修复并通过校验（0 不一致），
    # 本工具不再纳入，避免重新拼接时丢掉父标题行。
    ("05-接口与契约/16-卡片传输协议.md", 3, 13),
    ("06-开发与运维/07-CLI完整参考.md", 5, 13),
]

# 父拆分件内含无独立拆分件的子节（与章节目录标题「（含 4.9 命令）」一致）
PARENT_EXTRA = {
    "05-接口与契约/05-事件契约规范.md": ["4.9"],
}

# 特殊来源集合：05.04 已被并行修订为完整父节（含 4.9），4.10/4.11 只在旧切片中，
# 两段来源分别拼接后取用，避免新旧内容混拼产生截断。
SOURCE_OVERRIDES = {
    "05-接口与契约/05-事件契约规范.md": [(4, 4), (5, 14)],
}


def canon(text: str) -> str:
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", text.lower())


def read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def body_of(text: str) -> list[str]:
    text = re.sub(r"\n---\s*\n+\*\*文档结束\*\*\s*$", "", text)
    text = re.sub(r"\n+\*\*文档结束\*\*\s*$", "", text)
    lines = text.splitlines()
    start = 0
    for index, line in enumerate(lines[:30]):
        if HEADING_RE.match(line):
            break
        if line.strip() == "---":
            start = index + 1
            break
    body = "\n".join(lines[start:])
    body = re.sub(r"\n+---\s*$", "", body)
    return body.strip("\n").splitlines()


def sequence_index(master: list[str], frag: list[str]) -> bool:
    n = len(frag)
    return any(master[i:i + n] == frag for i in range(0, len(master) - n + 1))


def overlap(master: list[str], frag: list[str]) -> int:
    for k in range(min(len(master), len(frag)), 0, -1):
        if master[-k:] == frag[:k]:
            return k
    return 0


def prefix_in_master(master: list[str], frag: list[str]) -> int:
    for p in range(len(frag), 0, -1):
        if sequence_index(master, frag[:p]):
            return p
    return 0


def stitch(fragments: list[list[str]]) -> list[str]:
    master: list[str] = []
    for frag in fragments:
        if not frag:
            continue
        if not master:
            master = frag[:]
            continue
        k = overlap(master, frag)
        if k:
            master = master + frag[k:]
            continue
        p = prefix_in_master(master, frag)
        if p >= len(frag):
            continue
        master = master + frag[p:]
    return master


def parse_index(hub_path: str) -> list[tuple[str, str]]:
    entries = []
    for line in read(hub_path).splitlines():
        m = INDEX_RE.match(line.strip())
        if m:
            entries.append((m.group(1), m.group(2)))
    return entries


def candidate_titles(title: str) -> list[str]:
    out = [title]
    annotation = re.search(r"（含[^（）]*）$", title)
    stripped = title[: annotation.start()].strip() if annotation else ""
    if stripped and stripped != title:
        out.append(stripped)
    for base in [title, stripped] if stripped else [title]:
        parts = base.split("-")
        for i in range(1, len(parts)):
            out.append("-".join(parts[i:]))
    seen, unique = set(), []
    for candidate in out:
        if candidate and candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def headings_of(master: list[str]) -> list[tuple[int, int, str]]:
    out = []
    for index, line in enumerate(master):
        m = HEADING_RE.match(line)
        if m:
            out.append((index, len(m.group(1)), m.group(2).strip()))
    return out


def section_content(master: list[str], heads, index: int, level: int) -> list[str]:
    stop = len(master)
    for next_index, next_level, _ in heads:
        if next_index <= index:
            continue
        if (level == 2 and next_level > 2) or (level > 2 and next_level <= level):
            stop = next_index
            break
    content = master[index:stop]
    while content and not content[-1].strip():
        content.pop()
    return content


def looks_contaminated(content: list[str]) -> bool:
    """检测错位残留：正文中混入母文档元数据前言。"""
    for line in content[:40]:
        if line.startswith("> 版本：") or line.startswith("> 日期："):
            return True
    return False


def extract(masters: list[list[str]], heads_list, targets):
    results = []
    positions = [0] * len(masters)
    for title, filename in targets:
        content = None
        heading = None
        level = None
        for master_index, (master, heads) in enumerate(zip(masters, heads_list)):
            for candidate in candidate_titles(title):
                target = canon(candidate)
                matches = [
                    (index, lv, h)
                    for index, lv, h in heads
                    if index >= positions[master_index] and canon(h) == target
                ]
                for index, lv, h in matches:
                    chunk = section_content(master, heads, index, lv)
                    if chunk and not looks_contaminated(chunk):
                        content, heading, level = chunk, h, lv
                        positions[master_index] = index + len(chunk)
                        break
                if content is not None:
                    break
            if content is not None:
                break
        if content is None:
            raise SystemExit(f"未找到章节标题：{title}")
        results.append((title, filename, content, heading, level))
    return results


def preamble_of(hub_path: str) -> list[str]:
    lines = read(hub_path).splitlines()
    for index, line in enumerate(lines):
        if line.strip() == "---":
            return lines[:index + 1]
    raise SystemExit(f"母文档缺少元数据分隔线：{hub_path}")


def number_of(text: str) -> str:
    m = re.match(r"^(\d+(?:\.\d+)*)\s", text.strip())
    return m.group(1) if m else ""


def existing_path(hub_dir: str, filename: str) -> str:
    path = os.path.join(hub_dir, filename)
    if os.path.exists(path):
        return path
    prefix = filename[:5] + "-"
    candidates = sorted(n for n in os.listdir(hub_dir) if n.startswith(prefix))
    if len(candidates) == 1:
        return os.path.join(hub_dir, candidates[0])
    raise SystemExit(f"拆分件不存在或同名多份：{path}")


def process(hub_rel: str, first: int, last: int, apply: bool) -> tuple[int, int]:
    hub_path = os.path.join(LIB, hub_rel)
    hub_dir = os.path.dirname(hub_path)
    hub_stem = os.path.basename(hub_path)[:-3]
    entries = parse_index(hub_path)
    targets = []
    for title, filename in entries:
        m = PIECE_RE.match(filename)
        if m and first <= int(m.group(2)) <= last:
            targets.append((title, filename))
    if not targets:
        raise SystemExit(f"未解析到拆分件清单：{hub_rel}")

    pieces = []
    source_sets = SOURCE_OVERRIDES.get(hub_rel)
    if source_sets is None:
        source_sets = [(first, last)]
    masters = []
    for lower, upper in source_sets:
        fragments = []
        for _title, filename in targets:
            number = int(PIECE_RE.match(filename).group(2))
            if not (lower <= number <= upper):
                continue
            path = existing_path(hub_dir, filename)
            if path not in pieces:
                pieces.append(path)
            fragments.append(body_of(read(path)))
        masters.append(stitch(fragments))
    heads = headings_of(masters[0])
    all_heads = [headings_of(master) for master in masters]

    # 校验：目标区间内的全部标题都应在目标清单中（防止丢章节）
    extra = PARENT_EXTRA.get(hub_rel, [])
    covered_nums = {number_of(c) for title, _ in targets for c in candidate_titles(title)}
    covered_nums |= set(extra)
    covered_nums.discard("")
    covered_canons = {canon(c) for title, _ in targets for c in candidate_titles(title)}
    warnings = []
    for _index, level, heading in heads:
        if level > 3:
            continue
        if number_of(heading) in covered_nums or canon(heading) in covered_canons:
            continue
        if canon(heading).startswith("相关文档"):
            continue
        # 父级整节标题（如"八、完整示例：…"）不在拆分件清单时，属于被跳过的短前言
        if not number_of(heading):
            warnings.append(heading)
            continue
        if heading.startswith("六、content/*.yaml"):
            continue
        raise SystemExit(f"发现未登记标题：{hub_rel} / {heading}")
    for heading in warnings:
        print(f"  [提示] 父级标题未建拆分件（短前言，按既有清单跳过）：{heading}")

    results = extract(masters, all_heads, targets)
    if extra:
        parent_i = next(i for i, item in enumerate(results) if item[4] == 2)
        parts = [results[parent_i][2]]
        for number in extra:
            matches = [
                (index, level, h)
                for index, level, h in all_heads[0]
                if number_of(h) == number
            ]
            if not matches:
                raise SystemExit(f"未找到并节标题：{hub_rel} / {number}")
            index, level, heading = matches[0]
            parts.append(section_content(masters[0], all_heads[0], index, level))
        title, filename, _content, heading, _level = results[parent_i]
        merged = parts[0] + [""] + parts[1]
        results[parent_i] = (title, filename, merged, heading, 2)
    preamble = preamble_of(hub_path)

    if apply:
        group_archive = os.path.join(ARCHIVE, hub_stem)
        os.makedirs(group_archive, exist_ok=True)
        for path in pieces:
            dest = os.path.join(group_archive, os.path.basename(path))
            if not os.path.exists(dest):
                shutil.copy2(path, dest)
        for title, filename, content, heading, _level in results:
            old_path = existing_path(hub_dir, filename)
            canonical = os.path.join(hub_dir, filename)
            if old_path != canonical:
                os.remove(old_path)
            text = "\n".join(preamble) + "\n\n" + "\n".join(content) + "\n\n---\n\n**文档结束**\n"
            with open(canonical, "w", encoding="utf-8") as fh:
                fh.write(text)

    changes = 0
    for title, filename, content, heading, _level in results:
        canonical = os.path.join(hub_dir, filename)
        new = "\n".join(preamble) + "\n\n" + "\n".join(content) + "\n\n---\n\n**文档结束**\n"
        same = os.path.exists(canonical) and read(canonical) == new
        flag = "同" if same else "改"
        if flag == "改":
            changes += 1
        tag = "（含并节）" if extra and _level == 2 else ""
        print(f"  [{flag}] {filename[:72]:72s} {len(content):4d} 行 -> {heading}{tag}")
    return len(targets), changes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="归档原件并回填")
    parser.add_argument("--only", default="", help="只处理包含该子串的母文档")
    args = parser.parse_args()
    total = changed = 0
    for hub_rel, first, last in GROUPS:
        if args.only and args.only not in hub_rel:
            continue
        print(f"== {hub_rel}")
        count, changes = process(hub_rel, first, last, args.apply)
        total += count
        changed += changes
    print(f"目标拆分件 {total}，需回填 {changed}，模式：{'回填' if args.apply else '预览'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
