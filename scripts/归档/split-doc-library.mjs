#!/usr/bin/env node
/**
 * 薯片生态文档库拆分脚本
 *
 * 设计原则：
 * - 遍历薯片生态文档库下全部 .md（跳过归档目录、README、< 300 行的文件）
 * - 解析每个文档的二级标题（## 一、xx / ## xx）作为切分点
 * - 如果切出的某个二级章节超过 300 行，再按三级标题（### N.M xx / ### xx）继续切
 * - 每个新文件保留：
 *     - 文档级头部（标题 + 元数据 + 适用范围）
 *     - 当前节内容
 *     - 文档级尾部（自检清单 + 相关文档区段，完整拷贝）
 *     - 顶部导航：返回原文档、上一节、下一节
 * - 原文件改写为"目录索引页"：保留原标题与元数据 + 新增目录列表
 *
 * 输出：
 *   每个长文档同目录下创建 _sections/ 子目录
 *   新文件命名：{分区编号}{原序号}{子序号}-{二级标题}.md
 *   子序号为两位数字，从 01 开始顺延
 *
 * 运行：
 *   node scripts/split-doc-library.mjs
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ===== 配置 =====
const DOC_LIB = path.resolve(
  '薯片生态文档库',
);
const TARGET_MAX_LINES = 300; // 单文件目标上限（包含头/导航/尾部）
const READ_MAX_LINES = 250; // 短于此行数不拆分
const SECTIONS_DIR = '_sections'; // 输出子目录名
const SKIP_DIRS = new Set(['归档', 'node_modules', '.git', SECTIONS_DIR]);
const SKIP_FILES = new Set(['README.md']); // 跳过 README（每个分区单独处理）
const DRY_RUN = process.argv.includes('--dry-run'); // dry-run 模式：只打印不写盘
const ONLY_FILE = (() => {
  const idx = process.argv.indexOf('--file');
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

// ===== 工具函数 =====

/**
 * 读取文件并按行返回数组
 */
async function readLines(file) {
  const content = await fs.readFile(file, 'utf8');
  // 保留尾部换行符的语义：用 \n 分割
  return content.split('\n');
}

/**
 * 写文件（带 BOM-less UTF-8，保留 LF 换行）
 */
async function writeLines(file, lines) {
  if (DRY_RUN) {
    console.log(`    [dry-run] 写文件：${file} (${lines.length} 行)`);
    return;
  }
  const content = lines.join('\n');
  await fs.writeFile(file, content, 'utf8');
}

/**
 * mkdir 包装
 */
async function ensureDir(dir) {
  if (DRY_RUN) {
    console.log(`    [dry-run] mkdir：${dir}`);
    return;
  }
  await fs.mkdir(dir, { recursive: true });
}

/**
 * 安全文件名：去掉 Windows 非法字符、控制字符；保留中文
 */
function safeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[。！？，、；：（）【】《》「」『』]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * 规范化用于文件名的标题（去除序号与装饰符号）
 *   "## 一、定位与边界"     -> "定位与边界"
 *   "## 决策"                -> "决策"
 *   "## @chips/ui 共享层"    -> "@chips-ui-共享层"
 *   "### 1.1 定位"           -> "1.1-定位"
 */
function normalizeTitle(rawTitle) {
  let t = rawTitle.trim();
  // 去掉常见中文序号前缀：一、二、……
  t = t.replace(/^[一二三四五六七八九十百千]+[、.]\s*/, '');
  // 去掉引号与装饰
  t = t.replace(/[`*_~]/g, '');
  // @chips/ui 变成 @chips-ui
  t = t.replace(/@chips\//g, '@chips-');
  // 首尾空白
  t = t.trim();
  if (!t) t = 'untitled';
  return t;
}

/**
 * 从文档名（如 "04-能力契约规范.md" 或 "04-能力契约规范"）提取
 *   {分区号, 原序号, 基础名}
 *  - 分区号：前两位 "04"
 *  - 原序号：第三位开始直到 "-" 之前的数字 "1"
 *  - 基础名：去掉前缀
 */
function parseDocName(filename) {
  const stem = filename.replace(/\.md$/, '');
  const m = stem.match(/^(\d{2})-(\d{2,3})-(.+)$/);
  if (!m) {
    return { prefix: '', baseName: stem };
  }
  return {
    prefix: `${m[1]}${m[2]}`,
    baseName: m[3],
  };
}

/**
 * 在文档行数组中找出所有 H2 标题（## 开头）的位置
 * 排除代码块内部的 ## 行
 */
function findH2Indices(lines) {
  const indices = [];
  let inFence = false;
  let fenceMarker = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 检测围栏代码块（``` 或 ~~~）
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;
    // 仅匹配顶层 H2：行首 ## 开头且不是 ###
    if (/^##\s+\S/.test(line) && !/^###\s/.test(line)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * 在文档行数组中找出所有 H3 标题（### 开头）的位置（不含代码块）
 */
function findH3Indices(lines) {
  const indices = [];
  let inFence = false;
  let fenceMarker = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;
    if (/^###\s+\S/.test(line)) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * 提取文档级元数据：从第1行 H1 标题后开始，连续的 `> ` 开头的行。
 * 返回 { title, front, startOffset }
 *   - title：H1 文本（不含 "# "）
 *   - front：元数据行（含 `> ` 前缀，可能为空数组）
 *   - startOffset：第一个主体章节 H2 的行号（若没有则等于 lines.length）
 */
function extractFrontMatter(lines) {
  let i = 0;
  // 跳过前导空行
  while (i < lines.length && lines[i].trim() === '') i++;
  // 读 H1 标题
  let title = '';
  if (i < lines.length) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) {
      title = m[1];
      i++;
    }
  }
  // 跳过标题后的空行
  while (i < lines.length && lines[i].trim() === '') i++;

  // 读元数据：连续的 `> ` 行
  const front = [];
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('> ')) {
      front.push(line);
      i++;
    } else if (line.trim() === '') {
      i++;
    } else {
      break;
    }
  }

  // 跳过分隔线和空行，找到第一个 H2
  while (i < lines.length) {
    const line = lines[i];
    if (/^---+$/.test(line.trim()) || line.trim() === '') {
      i++;
      continue;
    }
    if (/^##\s+/.test(line)) break;
    i++;
  }
  return { title, front, startOffset: i };
}

/**
 * 已知"文档级尾部"标题集合。
 * 找到最后一个 H2 之后，若它是尾部集合成员，则向前找上一个 H2。
 * 递归直到找到一个"非尾部" H2。
 */
const KNOWN_TAIL_HEADINGS = new Set([
  '自检清单',
  '相关文档',
  '参考资料',
  '相关 ADR',
  '现状注记',
  '附录：规则编号表（R1-R20）',
  '附录：规则编号表',
  '总结：薯片哲学的核心',
  '总结',
  '附录',
  '附录 A：术语表',
  '附录 B：文件格式检查清单',
  '文档结束',
]);

/**
 * 把 H2 标题文本规整为"尾部判定核心"：去掉序号、引号、空格
 */
function tailCore(text) {
  let t = text.trim();
  // 去掉末尾的括号注
  t = t.replace(/\s*[（(].*?[）)]\s*$/, '');
  // 去掉中文序号
  t = t.replace(/^[一二三四五六七八九十百千]+\s*[、.]\s*/, '');
  return t.trim();
}

/**
 * 找到文档尾部区段起点（最后一个 H2 标题，但排除属于"尾部集合"的 H2）。
 * 返回 -1 表示无尾部（即整个文档都是主体）。
 */
function findTailStart(lines) {
  const h2Indices = [];
  let inFence = false;
  let fenceMarker = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[2][0];
      if (!inFence) {
        inFence = true;
        fenceMarker = marker;
      } else if (marker === fenceMarker) {
        inFence = false;
        fenceMarker = null;
      }
      continue;
    }
    if (inFence) continue;
    if (/^##\s+\S/.test(line) && !/^###\s/.test(line)) {
      h2Indices.push({ line: i, text: line.match(/^##\s+(.+?)\s*$/)?.[1] ?? '' });
    }
  }
  if (h2Indices.length === 0) return -1;
  // 从末尾向前找到第一个不属于尾部集合的 H2
  for (let k = h2Indices.length - 1; k >= 0; k--) {
    const text = h2Indices[k].text;
    if (!KNOWN_TAIL_HEADINGS.has(text) && !KNOWN_TAIL_HEADINGS.has(tailCore(text))) {
      return h2Indices[k].line;
    }
  }
  return -1;
}

/**
 * 对单个文档执行拆分
 */
async function splitDocument(filePath) {
  const lines = await readLines(filePath);
  if (lines.length < READ_MAX_LINES) {
    return { skipped: true, reason: `仅 ${lines.length} 行` };
  }

  const { title, front } = extractFrontMatter(lines);
  const titleLine = `# ${title}`;

  // 找 H2 切点
  const h2Indices = findH2Indices(lines);
  if (h2Indices.length < 2) {
    return { skipped: true, reason: 'H2 数量不足' };
  }

  // 找到尾部起点
  const tailStart = findTailStart(lines);
  // 主体切点：第一个 H2 → 尾部起点
  const mainH2s = h2Indices.filter((i) => (tailStart === -1 ? true : i < tailStart));

  if (mainH2s.length < 2) {
    return { skipped: true, reason: '主体 H2 数量不足' };
  }

  // 构造每个切片的 [startLine, endLine) 区间
  const slices = [];
  for (let i = 0; i < mainH2s.length; i++) {
    const start = mainH2s[i];
    const end = i + 1 < mainH2s.length ? mainH2s[i + 1] : (tailStart === -1 ? lines.length : tailStart);
    slices.push({ start, end });
  }

  // 切片内行数（含 H2 标题），若超过上限则按 H3 进一步切
  // 注意：每个切片最终会附带导航 + 文档头 + 文档尾部 ≈ 25 行额外开销
  const finalSlices = []; // { start, end, title, level: 2|3 }
  const OVERHEAD_LINES = 30; // 导航 + 元数据 + 尾部预留
  for (const slice of slices) {
    const count = slice.end - slice.start;
    const headingText = lines[slice.start].match(/^##\s+(.+?)\s*$/)?.[1] ?? '';
    if (count + OVERHEAD_LINES <= TARGET_MAX_LINES) {
      finalSlices.push({ ...slice, title: headingText, level: 2 });
      continue;
    }
    // 切片过大，按 H3 切
    const subH3s = findH3Indices(lines.slice(slice.start, slice.end))
      .map((idx) => idx + slice.start)
      .filter((idx) => idx > slice.start);
    if (subH3s.length === 0) {
      finalSlices.push({ ...slice, title: headingText, level: 2 });
      continue;
    }
    const subSlices = [];
    for (let j = 0; j < subH3s.length; j++) {
      const sStart = subH3s[j];
      const sEnd = j + 1 < subH3s.length ? subH3s[j + 1] : slice.end;
      subSlices.push({ start: sStart, end: sEnd });
    }
    // 第一个 sub slice 把 H2 标题也包进来
    if (subSlices.length > 0) {
      subSlices[0].start = slice.start;
    }
    // 给每个 H3 子切片：title 只用 H3 文本（不带 H2 前缀）；额外记录所属 H2
    for (const sub of subSlices) {
      const subTitle = lines[sub.start].match(/^#{2,3}\s+(.+?)\s*$/)?.[1] ?? '';
      const isH3 = lines[sub.start].startsWith('### ');
      finalSlices.push({ ...sub, title: subTitle, parentTitle: headingText, level: isH3 ? 3 : 2 });
    }
  }

  // 文件名编号：基于原文档前缀
  const fileName = path.basename(filePath);
  const { prefix, baseName } = parseDocName(fileName);
  const dir = path.dirname(filePath);
  const outDir = path.join(dir, SECTIONS_DIR);

  // 构造输出文件列表
  const outputFiles = []; // { fileName, sliceIndex, title, parentTitle?, lines }
  finalSlices.forEach((s, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    const filePrefix = prefix ? `${prefix}-${num}` : `${num}`;
    const titleSlug = safeFileName(normalizeTitle(s.title));
    const outName = `${filePrefix}-${titleSlug}.md`;
    outputFiles.push({
      fileName: outName,
      slice: s,
      title: s.title,
      parentTitle: s.parentTitle,
      sliceNumber: idx + 1,
      totalSlices: finalSlices.length,
    });
  });

  // 创建输出目录
  await ensureDir(outDir);

  // 写每个切片
  for (const f of outputFiles) {
    const outPath = path.join(outDir, f.fileName);
    const sliceLines = lines.slice(f.slice.start, f.slice.end);

    // 切片前面附加：导航 + 文档头部（H1 + 元数据 + 适用范围）
    // 切片尾部附加：原文档尾部（自检清单/相关文档）
    const tailLines = tailStart >= 0 ? lines.slice(tailStart) : [];

    const navLines = buildNavLines({
      outFileName: f.fileName,
      origFile: fileName,
      origFileRel: path.relative(outDir, filePath),
      sliceNumber: f.sliceNumber,
      totalSlices: f.totalSlices,
      siblings: outputFiles.map((o) => ({
        fileName: o.fileName,
        title: o.title,
        parentTitle: o.parentTitle,
      })),
      titleText: f.title,
      parentTitle: f.parentTitle,
      origTitle: title,
    });

    const headLines = [
      `# ${stripH1(titleLine)}`,
      '',
      ...front,
      '',
      '---',
      '',
      `> 来源文档：[${path.relative(outDir, filePath).split(path.sep).join('/')}](../${path.relative(outDir, filePath).split(path.sep).join('/')})`,
      '',
    ];

    const composedLines = [
      ...navLines,
      '',
      ...headLines,
      ...sliceLines,
      '',
      '---',
      '',
      '## 文档尾部（自检清单 / 相关文档）',
      '',
      ...tailLines,
    ];

    // 给 H3 子切片在 head 之后、sliceLines 之前插入所属 H2 的引用行
    // 这样单文件阅读时仍知道"这一节属于哪个大节"
    if (f.parentTitle) {
      // 找到 "来源文档" 行后插入
      const idx = composedLines.findIndex((l) => l.startsWith('> 来源文档：'));
      if (idx >= 0) {
        composedLines.splice(idx + 1, 0, '', `> 本节属于：\u3000**${f.parentTitle}**`);
      }
    }

    await writeLines(outPath, composedLines);
  }

  // 写原文件的目录索引页
  const indexLines = buildIndexLines({
    titleLine,
    front,
    origFile: fileName,
    outputFiles,
    outDir,
    dir,
  });
  await writeLines(filePath, indexLines);

  return {
    skipped: false,
    outputCount: outputFiles.length,
    outDir: path.relative(process.cwd(), outDir),
  };
}

function stripH1(line) {
  return line.replace(/^#\s+/, '').trim();
}

/**
 * 构建每个新文件顶部的导航
 */
function buildNavLines({ outFileName, origFile, origFileRel, sliceNumber, totalSlices, siblings, titleText, parentTitle, origTitle }) {
  const lines = [];
  const parentInfo = parentTitle ? `（所属大节：${parentTitle}）` : '';
  lines.push(`> **导航**：本文档是《${origTitle}》拆分后的第 ${sliceNumber}/${totalSlices} 节${parentInfo}`);
  lines.push(`> - 原始文档：[${origFile}](../${origFileRel.split(path.sep).join('/')})`);
  // 上下节
  const prev = siblings[sliceNumber - 2];
  const next = siblings[sliceNumber];
  if (prev) {
    const prevRel = `./${prev.fileName}`;
    const prevParent = prev.parentTitle ? `（${prev.parentTitle}）` : '';
    lines.push(`> - 上一节：[${prev.title}](${prevRel})${prevParent}`);
  }
  if (next) {
    const nextRel = `./${next.fileName}`;
    const nextParent = next.parentTitle ? `（${next.parentTitle}）` : '';
    lines.push(`> - 下一节：[${next.title}](${nextRel})${nextParent}`);
  }
  lines.push(`> - 本节标题：${titleText}`);
  return lines;
}

/**
 * 构造目录索引页内容
 */
function buildIndexLines({ titleLine, front, origFile, outputFiles, outDir, dir }) {
  const lines = [];
  lines.push(titleLine);
  lines.push('');
  if (front && front.length > 0) {
    lines.push(...front);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('> 本文档已被拆分为以下小节，请按需进入：');
  lines.push('');
  lines.push('| 序号 | 节标题 | 文件 |');
  lines.push('|---|---|---|');
  outputFiles.forEach((f, idx) => {
    const rel = path.relative(dir, path.join(outDir, f.fileName)).split(path.sep).join('/');
    const num = String(idx + 1).padStart(2, '0');
    lines.push(`| ${num} | ${f.title} | [${f.fileName}](${rel}) |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> 说明：');
  lines.push('> - 拆分目标为单文件 ≤ 300 行，便于阅读与精确定位。');
  lines.push('> - 每个小节顶部带有"返回原始文档 / 上一节 / 下一节"导航；');
  lines.push('> - 每个小节末尾保留原文档的**自检清单**与**相关文档**区段，单文件即可独立阅读。');
  lines.push(`> - 拆分由 \`scripts/split-doc-library.mjs\` 自动完成。`);
  lines.push('');
  return lines;
}

// ===== 主流程 =====
async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(p)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      if (SKIP_FILES.has(entry.name)) continue;
      out.push(p);
    }
  }
  return out;
}

async function main() {
  const absLib = DOC_LIB;
  console.log(`> 文档库根：${absLib}`);
  if (DRY_RUN) console.log('> 模式：DRY-RUN（不会写盘）');
  let files = await walk(absLib);
  if (ONLY_FILE) {
    files = files.filter((f) => f.endsWith(ONLY_FILE));
    console.log(`> --file 过滤后：${files.length} 个文件`);
  }
  console.log(`> 共扫描到 ${files.length} 个 .md 文件`);

  let processed = 0;
  let skipped = 0;
  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    try {
      const r = await splitDocument(file);
      if (r.skipped) {
        console.log(`  跳过：${rel}（${r.reason}）`);
        skipped++;
      } else {
        console.log(`  拆分：${rel} → ${r.outDir}/ (${r.outputCount} 个文件)`);
        processed++;
      }
    } catch (err) {
      console.error(`  失败：${rel}`, err);
    }
  }

  console.log('---');
  console.log(`> 已拆分：${processed} 个文档`);
  console.log(`> 已跳过：${skipped} 个文档`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});