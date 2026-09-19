import fs from 'node:fs';
import path from 'node:path';
import {
  addViolation,
  addWarning,
  finalizeReport,
  makeReport,
  runGateCli,
  existsDir,
  flagValue,
  isMainModule,
  UsageError,
} from './lib/cli.mjs';
import {
  extractLinks,
  isExternalTarget,
  stripLinkTarget,
  maskCode,
  firstSectionHeading,
  bodyAfterMetadata,
  firstParagraph,
  headingMatches,
  normalizeSpaces,
  canon,
  endsWithDocumentEnd,
} from './lib/markdown.mjs';
import { listDir, readText, toPosix, walkFiles } from './lib/walk.mjs';

const GATE_ID = 'docs';
const TITLE = '文档门禁（G12）';
const USAGE = `用法：node tools/gates/check-docs.mjs [选项]

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --docs-root <dir>       覆盖文档库根目录
  --report-dir <dir>      报告输出目录（默认配置 reports.dir）
  --json                  以 JSON 输出报告
  --no-report             不写入报告文件
  --raw                   连代码块与行内代码内的链接语法一并检查
  --help                  显示本帮助

检查项：相对链接、文档头四行、ADR 元数据、拆分件一致性、README 索引收录。`;

const PIECE = /^(\d+)\.(\d+)-(.+)\.md$/;
const ADR_HUB = /^ADR-\d{3}-.+\.md$/;
const ADR_PIECE = /^\d{3}\.\d+-ADR-\d{3}-/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;

function markdownFiles(root, skipDirs) {
  return walkFiles(root, { skipDirs, filter: (file) => file.endsWith('.md') });
}

function checkLinks(report, docsRoot, files, raw) {
  let total = 0;
  for (const file of files) {
    const text = readText(file);
    const rel = toPosix(path.relative(docsRoot, file));
    for (const link of extractLinks(text, { raw })) {
      total += 1;
      if (isExternalTarget(link.target)) {
        continue;
      }
      const target = stripLinkTarget(link.target);
      if (!target) {
        continue;
      }
      const resolved = path.resolve(path.dirname(file), target);
      const relative = toPosix(path.relative(docsRoot, resolved));
      const inside = resolved === docsRoot || resolved.startsWith(docsRoot + path.sep);
      if (!inside) {
        addViolation(
          report,
          'DOCS002',
          `相对链接越出文档库根：${link.target}（解析为 ${relative}）`,
          {
            file: rel,
            line: link.line,
          }
        );
        continue;
      }
      if (!fs.existsSync(resolved)) {
        addViolation(report, 'DOCS001', `相对链接指向不存在的路径：${link.target}`, {
          file: rel,
          line: link.line,
        });
      }
    }
  }
  return { links: total };
}

function headerFields(text) {
  const head = maskCode(text).split('\n').slice(0, 15).join('\n');
  return {
    head,
    version: (/> 版本：(.*)$/m.exec(head)?.[1] ?? '').trim(),
    date: (/> 日期：(.*)$/m.exec(head)?.[1] ?? '').trim(),
    status: (/> 状态：(.*)$/m.exec(head)?.[1] ?? '').trim(),
    scope: (/> 适用范围：(.*)$/m.exec(head)?.[1] ?? '').trim(),
  };
}

function checkHeader(report, docsRoot, files, config, isAdrHub, isAdrPiece) {
  const keys = config.headerKeys ?? ['版本', '日期', '状态', '适用范围'];
  const statuses = config.statusValues ?? ['正式版', '已废弃'];
  let checked = 0;
  for (const file of files) {
    const rel = toPosix(path.relative(docsRoot, file));
    const base = path.basename(file);
    if (isAdrHub(base) || isAdrPiece(base)) {
      continue;
    }
    checked += 1;
    const text = readText(file);
    if (!endsWithDocumentEnd(text)) {
      addViolation(report, 'DOCS014', '文件结尾缺少 **文档结束**', { file: rel });
    }
    const fields = headerFields(text);
    const positions = keys.map((key) => fields.head.indexOf(`> ${key}：`));
    if (positions.includes(-1)) {
      const missing = keys.filter((key, index) => positions[index] === -1);
      addViolation(
        report,
        'DOCS010',
        `文档头缺失：${missing.map((key) => `> ${key}：`).join(' ')}`,
        { file: rel, line: 1 }
      );
      continue;
    }
    const sorted = [...positions].sort((a, b) => a - b);
    if (positions.some((value, index) => value !== sorted[index])) {
      addViolation(report, 'DOCS011', `文档头四行顺序错误（应为：${keys.join(' / ')}）`, {
        file: rel,
        line: 1,
      });
    }
    if (!statuses.includes(fields.status)) {
      addViolation(
        report,
        'DOCS012',
        `状态取值非法：${fields.status}（允许：${statuses.join(' / ')}）`,
        { file: rel, line: 1 }
      );
    }
    if (!DATE.test(fields.date)) {
      addViolation(report, 'DOCS013', `日期格式非法：${fields.date}（应为 YYYY-MM-DD）`, {
        file: rel,
        line: 1,
      });
    }
    if (!VERSION.test(fields.version)) {
      addViolation(report, 'DOCS013', `版本格式非法：${fields.version}（应为 vX.Y.Z）`, {
        file: rel,
        line: 1,
      });
    }
    if (fields.scope === '') {
      addViolation(report, 'DOCS010', '文档头适用范围为空', { file: rel, line: 1 });
    }
  }
  return { headers: checked };
}

function checkAdrMetadata(report, docsRoot, files, config) {
  let checked = 0;
  const prefixes = config.adrStatusPrefixes ?? ['已接受', '已废弃'];
  for (const file of files) {
    const base = path.basename(file);
    if (!ADR_HUB.test(base)) {
      continue;
    }
    checked += 1;
    const rel = toPosix(path.relative(docsRoot, file));
    const text = readText(file);
    if (!endsWithDocumentEnd(text)) {
      addViolation(report, 'DOCS014', '文件结尾缺少 **文档结束**', { file: rel });
    }
    const dir = path.dirname(file);
    const pit = listDir(dir)
      .filter(
        (entry) => entry.isFile() && entry.name.includes('元数据') && entry.name.endsWith('.md')
      )
      .map((entry) => readText(path.join(dir, entry.name)));
    const source = pit.length > 0 ? pit.join('\n') : text;
    const statusMatch = /-\s*\*\*状态\*\*[:：]\s*(.+)/.exec(source);
    if (!statusMatch) {
      addViolation(
        report,
        'DOCS015',
        'ADR 元数据缺少 **状态**（主文档内联或 *-元数据.md 拆分件）',
        { file: rel }
      );
      continue;
    }
    const status = statusMatch[1].trim();
    if (!prefixes.some((prefix) => status.startsWith(prefix))) {
      addViolation(
        report,
        'DOCS015',
        `ADR 状态非法：${status}（允许以 ${prefixes.join(' / ')} 开头）`,
        { file: rel }
      );
    }
    if (!/-\s*\*\*日期\*\*[:：]\s*\d{4}-\d{2}-\d{2}/.test(source)) {
      addViolation(report, 'DOCS015', 'ADR 元数据缺少合法日期', { file: rel });
    }
  }
  return { adr: checked };
}

function splitFilename(name, siblings) {
  const match = PIECE.exec(name);
  if (!match) {
    return { hub: null, section: null };
  }
  const remainder = match[3];
  const hubs = siblings
    .filter((sibling) => !PIECE.test(sibling) && sibling.endsWith('.md'))
    .sort((a, b) => b.length - a.length);
  for (const hub of hubs) {
    const stem = hub.slice(0, -3);
    if (remainder === stem) {
      return { hub: stem, section: stem };
    }
    if (remainder.startsWith(`${stem}-`)) {
      return { hub: stem, section: remainder.slice(stem.length + 1) };
    }
  }
  return { hub: null, section: null };
}

function checkPieces(report, docsRoot, files, config) {
  const minLines = config.minPieceContentLines ?? 3;
  const byDir = new Map();
  for (const file of files) {
    const dir = path.dirname(file);
    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir).push(file);
  }
  let pieces = 0;
  let shells = 0;
  let duplicates = 0;
  for (const dirFiles of byDir.values()) {
    const siblings = dirFiles.map((file) => path.basename(file));
    const hubTexts = new Map();
    for (const file of dirFiles) {
      const base = path.basename(file);
      if (!PIECE.test(base)) {
        hubTexts.set(base, readText(file));
      }
    }
    const groups = new Map();
    for (const file of dirFiles) {
      const base = path.basename(file);
      if (!PIECE.test(base)) {
        continue;
      }
      const { hub, section } = splitFilename(base, siblings);
      const key = hub ?? '';
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({ file, base, section });
    }
    for (const [hub, group] of groups) {
      if (hub === '') {
        for (const item of group) {
          pieces += 1;
          addViolation(report, 'DOCS020', '拆分件无法定位母文档', {
            file: toPosix(path.relative(docsRoot, item.file)),
          });
        }
        continue;
      }
      const seenHeadings = new Map();
      const seenParagraphs = new Map();
      let previousParagraph = '';
      for (const { file, base, section } of group) {
        pieces += 1;
        const rel = toPosix(path.relative(docsRoot, file));
        if (!hubTexts.has(`${hub}.md`) || !hubTexts.get(`${hub}.md`).includes(base)) {
          addViolation(report, 'DOCS021', `拆分件未被母文档目次收录：${hub}.md`, { file: rel });
        }
        const text = readText(file);
        const body = bodyAfterMetadata(text);
        const heading = firstSectionHeading(body);
        if (!headingMatches(section, heading?.text)) {
          addViolation(
            report,
            'DOCS020',
            `拆分件章节与正文标题不一致：文件名「${section}」/ 标题「${heading?.text ?? '（无）'}」`,
            {
              file: rel,
              line: heading?.line ?? 1,
            }
          );
        }
        const contentLines = body
          .split('\n')
          .filter((line) => line.trim() !== '' && !/^#{2,4}\s/.test(line));
        if (contentLines.length < minLines) {
          shells += 1;
          if (!heading) {
            addViolation(report, 'DOCS022', '拆分件无正文标题且内容不足（疑似错位空壳）', {
              file: rel,
            });
          } else {
            addWarning(report, 'DOCS090', `短章节（正文 ${contentLines.length} 行）`, {
              file: rel,
            });
          }
        }
        if (heading) {
          const key = canon(normalizeSpaces(heading.text));
          if (seenHeadings.has(key)) {
            duplicates += 1;
            addViolation(
              report,
              'DOCS023',
              `拆分件标题与本组既有拆分件重复：${heading.text}（亦见 ${seenHeadings.get(key)}）`,
              {
                file: rel,
              }
            );
          }
          seenHeadings.set(key, rel);
        }
        const paragraph = firstParagraph(body);
        if (paragraph !== '') {
          if (previousParagraph === paragraph) {
            duplicates += 1;
            addViolation(report, 'DOCS024', '拆分件首段与上一拆分件完全相同（疑似重复件）', {
              file: rel,
            });
          } else if (seenParagraphs.has(paragraph)) {
            duplicates += 1;
            addViolation(
              report,
              'DOCS024',
              `拆分件首段与本组既有拆分件重复（亦见 ${seenParagraphs.get(paragraph)}）`,
              { file: rel }
            );
          }
          seenParagraphs.set(paragraph, rel);
          previousParagraph = paragraph;
        }
      }
    }
  }
  return { pieces, shells, duplicates };
}

function checkReadmeIndex(report, docsRoot, files, config) {
  const indexName = config.index ?? 'README.md';
  const indexFile = path.join(docsRoot, indexName);
  if (!fs.existsSync(indexFile)) {
    throw new UsageError(`README 索引不存在：${indexFile}`);
  }
  const targets = new Set();
  for (const link of extractLinks(readText(indexFile))) {
    if (isExternalTarget(link.target)) {
      continue;
    }
    const target = stripLinkTarget(link.target);
    if (!target) {
      continue;
    }
    targets.add(toPosix(path.normalize(target)));
  }
  let formal = 0;
  for (const file of files) {
    const base = path.basename(file);
    const rel = toPosix(path.relative(docsRoot, file));
    if (rel === indexName || PIECE.test(base)) {
      continue;
    }
    formal += 1;
    if (!targets.has(rel) && !targets.has(`./${rel}`)) {
      addViolation(report, 'DOCS030', '正式文档未被 README 索引收录', { file: rel });
    }
  }
  return { formalDocs: formal };
}

export async function runCheck({ workspaceRoot, config, flags }) {
  const report = makeReport(GATE_ID, TITLE);
  const docsConfig = config.docs ?? {};
  const docsRoot = path.resolve(
    workspaceRoot,
    flagValue(flags, 'docs-root', docsConfig.root ?? 'docs')
  );
  if (!existsDir(docsRoot)) {
    throw new UsageError(`文档库根目录不存在：${docsRoot}`);
  }
  const skipDirs = docsConfig.skipDirs ?? ['归档', 'node_modules', '.git'];
  const files = markdownFiles(docsRoot, skipDirs);
  const raw = flags.get('raw') === true;
  const linkStats = checkLinks(report, docsRoot, files, raw);
  const headerStats = checkHeader(
    report,
    docsRoot,
    files,
    docsConfig,
    (base) => ADR_HUB.test(base),
    (base) => ADR_PIECE.test(base)
  );
  const adrStats = checkAdrMetadata(report, docsRoot, files, docsConfig);
  const pieceStats = checkPieces(report, docsRoot, files, docsConfig);
  const indexStats = checkReadmeIndex(report, docsRoot, files, docsConfig);
  return finalizeReport(report, {
    files: files.length,
    links: linkStats.links,
    headers: headerStats.headers,
    adr: adrStats.adr,
    pieces: pieceStats.pieces,
    shells: pieceStats.shells,
    duplicates: pieceStats.duplicates,
    formalDocs: indexStats.formalDocs,
  });
}

if (isMainModule(import.meta.url, process.argv[1])) {
  runGateCli({
    importMeta: import.meta.url,
    gateId: GATE_ID,
    title: TITLE,
    runCheck,
    usage: USAGE,
  }).then((code) => {
    process.exitCode = code;
  });
}
