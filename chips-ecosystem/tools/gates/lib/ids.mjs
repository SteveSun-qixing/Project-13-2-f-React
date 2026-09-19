export const CAPABILITY_ID = /^[a-z][a-z0-9-]*:[a-z][A-Za-z0-9-]*$/;
export const PERMISSION_BASE_ID = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
export const EVENT_ID = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
export const ERROR_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/;

export function backtickedTokens(text) {
  const tokens = [];
  const regex = /`([^`\n]+)`/g;
  let match = regex.exec(text);
  while (match !== null) {
    tokens.push(match[1].trim());
    match = regex.exec(text);
  }
  return tokens;
}

export function normalizePermissionToken(token) {
  const cut = Math.min(
    ...[token.indexOf('['), token.indexOf('<'), token.indexOf('$')]
      .filter((value) => value >= 0)
      .concat([token.length])
  );
  const base = token.slice(0, cut).replace(/:+$/, '');
  return PERMISSION_BASE_ID.test(base) ? base : null;
}

export function extractTableRows(sectionText) {
  const rows = [];
  const lines = sectionText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
      continue;
    }
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) {
      continue;
    }
    rows.push(cells);
  }
  return rows;
}

export function cutSection(text, sectionRegex) {
  const lines = text.split('\n');
  const startPattern = new RegExp(sectionRegex);
  let start = -1;
  let level = 3;
  for (let index = 0; index < lines.length; index += 1) {
    if (startPattern.test(lines[index])) {
      start = index;
      const heading = /^(#{1,6})\s/.exec(lines[index]);
      level = heading ? heading[1].length : 3;
      break;
    }
  }
  if (start < 0) {
    return null;
  }
  const stopPattern = new RegExp(`^#{1,${level}}\\s`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (stopPattern.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

export function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated].sort();
}

export function sameStringSet(left, right) {
  const a = uniqueSorted(left);
  const b = uniqueSorted(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function diffSets(expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((value) => !actualSet.has(value)),
    extra: actual.filter((value) => !expectedSet.has(value)),
  };
}

const TS_CONST_ARRAY = (name) => new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`);
const TS_MAPPING = /export const CAPABILITY_PERMISSIONS[^=]*=\s*\{([\s\S]*?)\n\};/;

export function parseTsConstArray(content, name) {
  const match = TS_CONST_ARRAY(name).exec(content);
  if (!match) {
    return null;
  }
  return [...match[1].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
}

export function parseTsPermissionMapping(content) {
  const match = TS_MAPPING.exec(content);
  if (!match) {
    return null;
  }
  const mapping = new Map();
  for (const line of match[1].split('\n')) {
    const row = /^\s*'([^']+)':\s*\[([^\]]*)\],\s*$/.exec(line);
    if (!row) {
      if (line.trim() === '' || line.trim().startsWith('//')) {
        continue;
      }
      return null;
    }
    const permissions = [...row[2].matchAll(/'([^']*)'/g)].map((entry) => entry[1]);
    mapping.set(row[1], permissions);
  }
  return mapping;
}
