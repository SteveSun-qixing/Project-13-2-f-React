#!/usr/bin/env python3
"""扫描《薯片生态文档库》全部 Markdown 文件的相对链接，报告坏链。

用法:
    python3 检查文档链接.py [--root <文档库根目录>] [--json] [--raw] [--external]

判定规则:
- 仅检查相对路径链接（跳过 http/https/mailto/tel/# 锚点等）；
- 去掉 `?query` 与 `#fragment` 后按源文件所在目录解析；
- 目标可以是文件或目录（目录存在视为有效）；
- 相对链接解析结果越出文档库根（如 `../../06-...`）同样记为坏链（outside_root）；
- 默认跳过围栏代码块与行内代码中的内容（避免把正则/代码示例误判为链接）；
- `--raw` 关闭跳过逻辑，连代码块内的链接语法一并检查（用于复核代码块内的示例链接）。
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

LINK_RE = re.compile(r"\[[^\]]*\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
FENCE_OPEN_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
def _find_library_root(start: str) -> str:
    """自给定目录逐级向上定位仓库内的《薯片生态文档库》根目录。

    工具目录随 task043 材料整体归档后，固定层级相对偏移会失效
    （曾致默认根指向不存在路径）；向上查找对目录移动稳健。
    找不到时报错退出，绝不静默按空库通过。`--root` 显式传入时不走本推导。
    """
    current = os.path.abspath(start)
    while True:
        candidate = os.path.join(current, "薯片生态文档库")
        if os.path.isdir(candidate):
            return candidate
        parent = os.path.dirname(current)
        if parent == current:
            raise SystemExit(
                "自工具目录逐级向上未找到 薯片生态文档库/，"
                "请用 --root 显式指定文档库根目录"
            )
        current = parent


DEFAULT_ROOT = _find_library_root(os.path.dirname(os.path.abspath(__file__)))


def mask_code(text: str) -> str:
    """把围栏代码块与行内代码替换为等长空白（保留换行与行号）。

    围栏按行解析：开栏由行首（至多 3 个空格缩进）的 ``` / ~~~ 起，
    闭栏必须为同种字符且长度不小于开栏；未闭合的围栏屏蔽到文件末尾。
    """
    lines = text.split("\n")
    out: list[str] = []
    fence: str | None = None
    for line in lines:
        match = FENCE_OPEN_RE.match(line)
        if fence is None:
            if match:
                fence = match.group(1)
                out.append(" " * len(line))
            else:
                out.append(line)
        else:
            closing = re.match(r"^ {0,3}(`{3,}|~{3,})\s*$", line)
            if closing and closing.group(1)[0] == fence[0] and len(closing.group(1)) >= len(fence):
                fence = None
            out.append(" " * len(line))
    masked = "\n".join(out)
    return INLINE_CODE_RE.sub(lambda m: " " * len(m.group(0)), masked)


def iter_markdown(root: str):
    for dirpath, _dirnames, filenames in os.walk(root):
        for name in sorted(filenames):
            if name.endswith(".md"):
                yield os.path.join(dirpath, name)


def is_external(target: str) -> bool:
    return bool(re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target)) or target.startswith("#")


def check(root: str, raw_mode: bool = False):
    root = os.path.abspath(root)
    broken = []
    external = []
    total = 0
    for path in iter_markdown(root):
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        scan_text = text if raw_mode else mask_code(text)
        for match in LINK_RE.finditer(scan_text):
            raw = match.group(1)
            total += 1
            if is_external(raw) or raw.startswith("<") or raw.startswith("//"):
                external.append((path, raw))
                continue
            target = raw.split("#", 1)[0].split("?", 1)[0]
            if not target:
                continue
            resolved = os.path.normpath(os.path.join(os.path.dirname(path), target))
            line = text[: match.start()].count("\n") + 1
            if not resolved.startswith(root + os.sep) and resolved != root:
                broken.append(
                    {
                        "file": os.path.relpath(path, root),
                        "line": line,
                        "raw": raw,
                        "resolved": os.path.relpath(resolved, root),
                        "outside_root": True,
                    }
                )
                continue
            if not os.path.exists(resolved):
                broken.append(
                    {
                        "file": os.path.relpath(path, root),
                        "line": line,
                        "raw": raw,
                        "resolved": os.path.relpath(resolved, root),
                        "outside_root": False,
                    }
                )
    return broken, external, total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=DEFAULT_ROOT)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--raw", action="store_true", help="不跳过代码块，检查全部链接语法")
    parser.add_argument("--external", action="store_true", help="同时列出库内指向库外的链接")
    args = parser.parse_args()

    broken, external, total = check(args.root, raw_mode=args.raw)
    if args.json:
        print(json.dumps({"total": total, "broken": broken}, ensure_ascii=False, indent=2))
        return 1 if broken else 0

    print(f"扫描根目录: {os.path.abspath(args.root)}")
    print(f"模式: {'raw（含代码块）' if args.raw else 'standard（跳过代码块与行内代码）'}")
    print(f"Markdown 链接总数: {total}")
    print(f"坏链数量: {len(broken)}")
    for item in broken:
        print(f"  {item['file']}:{item['line']}  ->  {item['raw']}  (解析为 {item['resolved']})")
    if args.external:
        print(f"\n指向库外的链接: {len(external)}")
        for path, raw in external:
            print(f"  {os.path.relpath(path, os.path.abspath(args.root))}  ->  {raw}")
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main())
