const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const INLINE_CODE = /`[^`\n]*`/g;
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const SECTION_HEADING = /^(#{2,4})\s+(.+?)\s*$/;

export function maskCode(text, { inlineCode = true } = {}) {
  const lines = text.split('\n');
  const output = [];
  let fence = null;
  for (const line of lines) {
    const open = FENCE_OPEN.exec(line);
    if (fence === null) {
      if (open) {
        fence = open[1];
        output.push(' '.repeat(line.length));
      } else {
        output.push(line);
      }
      continue;
    }
    const close = FENCE_CLOSE.exec(line);
    if (close && close[1][0] === fence[0] && close[1].length >= fence.length) {
      fence = null;
    }
    output.push(' '.repeat(line.length));
  }
  const masked = output.join('\n');
  return inlineCode ? masked.replace(INLINE_CODE, (match) => ' '.repeat(match.length)) : masked;
}

export function extractLinks(text, { raw = false } = {}) {
  const scan = raw ? text : maskCode(text);
  const results = [];
  LINK.lastIndex = 0;
  let match = LINK.exec(scan);
  while (match !== null) {
    const line = scan.slice(0, match.index).split('\n').length;
    results.push({ target: match[1], line, index: match.index });
    match = LINK.exec(scan);
  }
  return results;
}

export function isExternalTarget(target) {
  if (target.startsWith('#')) {
    return true;
  }
  if (target.startsWith('<') || target.startsWith('//')) {
    return true;
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target);
}

export function stripLinkTarget(target) {
  return target.split('#', 1)[0].split('?', 1)[0];
}

export function headings(text, { masked = false } = {}) {
  const scan = masked ? text : maskCode(text);
  const results = [];
  scan.split('\n').forEach((line, index) => {
    const match = HEADING.exec(line);
    if (match) {
      results.push({ level: match[1].length, text: match[2], line: index + 1 });
    }
  });
  return results;
}

export function firstSectionHeading(text) {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const match = SECTION_HEADING.exec(lines[index]);
    if (match) {
      return { level: match[1].length, text: match[2], line: index + 1 };
    }
  }
  return null;
}

const FOOTER = /\n+---\s*\n+\*\*文档结束\*\*\s*$/;

export function stripDocumentFooter(text) {
  return text.replace(FOOTER, '').replace(/\n+\*\*文档结束\*\*\s*$/, '');
}

export function bodyAfterMetadata(text, { maxScanLines = 30 } = {}) {
  const stripped = stripDocumentFooter(text);
  const lines = stripped.split('\n');
  let bodyStart = 0;
  for (let index = 0; index < Math.min(maxScanLines, lines.length); index += 1) {
    if (SECTION_HEADING.test(lines[index])) {
      break;
    }
    if (lines[index].trim() === '---') {
      bodyStart = index + 1;
      break;
    }
  }
  let body = lines.slice(bodyStart).join('\n');
  body = body.replace(/\n+---\s*$/, '');
  return body.trim();
}

export function firstParagraph(body, { minLength = 16 } = {}) {
  const blocks = [];
  let block = [];
  let fence = false;
  for (const line of body.split('\n')) {
    const stripped = line.trim();
    if (stripped.startsWith('```') || stripped.startsWith('~~~')) {
      fence = !fence;
      block = [];
      continue;
    }
    if (fence) {
      continue;
    }
    if (stripped === '') {
      if (block.length > 0) {
        blocks.push(normalizeSpaces(block.join(' ')));
        block = [];
      }
      continue;
    }
    if (HEADING.test(line) || stripped === '---') {
      block = [];
      continue;
    }
    block.push(stripped);
  }
  if (block.length > 0) {
    blocks.push(normalizeSpaces(block.join(' ')));
  }
  return blocks.find((paragraph) => paragraph.length >= minLength) ?? '';
}

export function normalizeSpaces(text) {
  return text.replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

export function canon(text) {
  return text.toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff]+/g, '');
}

export function headingNumber(text) {
  const match = /^(\d+(?:\.\d+)*)\s/.exec(text.trim());
  return match ? match[1] : '';
}

export function headingMatches(section, heading) {
  if (!heading) {
    return false;
  }
  const tail = normalizeSpaces(section);
  const head = normalizeSpaces(heading);
  const tailNumber = headingNumber(tail) || headingNumber(tail.split('-').pop());
  if (tailNumber && tailNumber === headingNumber(head)) {
    return true;
  }
  if (tail === head || tail.endsWith(`-${head}`)) {
    return true;
  }
  if (canon(tail) === canon(head)) {
    return true;
  }
  if (/^\d+(\.\d+)*\s/.test(head) && canon(tail).endsWith(canon(head))) {
    return true;
  }
  const canonTail = canon(tail);
  const canonHead = canon(head);
  if (
    canonHead.length > 1 &&
    canonTail.startsWith(canonHead) &&
    /^\d/.test(canonTail.slice(canonHead.length))
  ) {
    return true;
  }
  return false;
}

export function endsWithDocumentEnd(text) {
  return text.trimEnd().endsWith('**文档结束**');
}
