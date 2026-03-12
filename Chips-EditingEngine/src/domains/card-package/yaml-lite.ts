export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

interface YamlLine {
  indent: number;
  content: string;
}

const parseScalar = (raw: string): YamlValue => {
  const value = raw.trim();
  if (value === 'null') {
    return null;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return Number(value);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
};

const splitTopLevel = (input: string, separator: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const previous = index > 0 ? input[index - 1] : '';

    if ((char === '"' || char === "'") && previous !== '\\') {
      if (quote === char) {
        quote = null;
      } else if (quote === null) {
        quote = char;
      }
      current += char;
      continue;
    }

    if (quote === null) {
      if (char === '[') {
        squareDepth += 1;
      } else if (char === ']') {
        squareDepth -= 1;
      } else if (char === '{') {
        curlyDepth += 1;
      } else if (char === '}') {
        curlyDepth -= 1;
      } else if (char === separator && squareDepth === 0 && curlyDepth === 0) {
        parts.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim().length > 0) {
    parts.push(current.trim());
  }

  return parts;
};

const findTopLevelSeparator = (input: string, separator: string): number => {
  let quote: '"' | "'" | null = null;
  let squareDepth = 0;
  let curlyDepth = 0;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;
    const previous = index > 0 ? input[index - 1] : '';

    if ((char === '"' || char === "'") && previous !== '\\') {
      if (quote === char) {
        quote = null;
      } else if (quote === null) {
        quote = char;
      }
      continue;
    }

    if (quote !== null) {
      continue;
    }

    if (char === '[') {
      squareDepth += 1;
      continue;
    }
    if (char === ']') {
      squareDepth -= 1;
      continue;
    }
    if (char === '{') {
      curlyDepth += 1;
      continue;
    }
    if (char === '}') {
      curlyDepth -= 1;
      continue;
    }
    if (char === separator && squareDepth === 0 && curlyDepth === 0) {
      if (separator === ':') {
        const next = input[index + 1];
        if (typeof next === 'string' && next.trim().length > 0) {
          continue;
        }
      }
      return index;
    }
  }

  return -1;
};

const parseInlineValue = (raw: string): YamlValue => {
  const value = raw.trim();
  if (value === '[]') {
    return [];
  }
  if (value === '{}') {
    return {};
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) {
      return [];
    }
    return splitTopLevel(inner, ',').map((part) => parseInlineValue(part));
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) {
      return {};
    }
    const objectValue: Record<string, YamlValue> = {};
    for (const part of splitTopLevel(inner, ',')) {
      const separatorIndex = findTopLevelSeparator(part, ':');
      if (separatorIndex < 0) {
        continue;
      }
      const key = part.slice(0, separatorIndex).trim();
      const nextValue = part.slice(separatorIndex + 1).trim();
      objectValue[key] = parseInlineValue(nextValue);
    }
    return objectValue;
  }
  return parseScalar(value);
};

const normalizeLines = (text: string): YamlLine[] => {
  const lines: YamlLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '  ');
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }

    lines.push({
      indent: line.match(/^\s*/)?.[0].length ?? 0,
      content: line.trim(),
    });
  }
  return lines;
};

const parseNode = (lines: YamlLine[], index: number, indent: number): [YamlValue, number] => {
  const current = lines[index];
  if (!current) {
    return [{}, index];
  }
  if (current.content.startsWith('- ') && current.indent === indent) {
    return parseArray(lines, index, indent);
  }
  return parseObject(lines, index, indent);
};

const readBlockScalar = (
  lines: YamlLine[],
  startIndex: number,
  parentIndent: number,
  style: '|' | '>',
): [string, number] => {
  if (startIndex >= lines.length) {
    return ['', startIndex];
  }

  const first = lines[startIndex];
  if (!first || first.indent <= parentIndent) {
    return ['', startIndex];
  }

  const blockIndent = first.indent;
  const chunks: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index]!;
    if (current.indent < blockIndent) {
      break;
    }
    chunks.push(current.content);
    index += 1;
  }

  return [style === '>' ? chunks.join(' ') : chunks.join('\n'), index];
};

const parseObject = (lines: YamlLine[], startIndex: number, indent: number): [Record<string, YamlValue>, number] => {
  const result: Record<string, YamlValue> = {};
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index]!;
    if (current.indent < indent) {
      break;
    }
    if (current.indent > indent) {
      throw new Error('Invalid indentation in YAML content');
    }
    if (current.content.startsWith('- ')) {
      break;
    }

    const separatorIndex = findTopLevelSeparator(current.content, ':');
    if (separatorIndex < 0) {
      index += 1;
      continue;
    }

    const key = current.content.slice(0, separatorIndex).trim();
    const valueText = current.content.slice(separatorIndex + 1).trim();
    index += 1;

    if (valueText === '|' || valueText === '>') {
      const [blockValue, nextIndex] = readBlockScalar(lines, index, indent, valueText);
      result[key] = blockValue;
      index = nextIndex;
      continue;
    }

    if (valueText.length > 0) {
      result[key] = parseInlineValue(valueText);
      continue;
    }

    if (index < lines.length && lines[index]!.indent > indent) {
      const [child, nextIndex] = parseNode(lines, index, lines[index]!.indent);
      result[key] = child;
      index = nextIndex;
      continue;
    }

    result[key] = {};
  }

  return [result, index];
};

const parseArray = (lines: YamlLine[], startIndex: number, indent: number): [YamlValue[], number] => {
  const result: YamlValue[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const current = lines[index]!;
    if (current.indent < indent) {
      break;
    }
    if (current.indent !== indent || !current.content.startsWith('- ')) {
      break;
    }

    const valueText = current.content.slice(2).trim();
    index += 1;

    if (valueText === '|' || valueText === '>') {
      const [blockValue, nextIndex] = readBlockScalar(lines, index, indent, valueText);
      result.push(blockValue);
      index = nextIndex;
      continue;
    }

    if (valueText.length === 0) {
      if (index < lines.length && lines[index]!.indent > indent) {
        const [child, nextIndex] = parseNode(lines, index, lines[index]!.indent);
        result.push(child);
        index = nextIndex;
      } else {
        result.push(null);
      }
      continue;
    }

    const separatorIndex = findTopLevelSeparator(valueText, ':');
    if (separatorIndex < 0) {
      result.push(parseInlineValue(valueText));
      continue;
    }

    const objectValue: Record<string, YamlValue> = {};
    const key = valueText.slice(0, separatorIndex).trim();
    const inlineValue = valueText.slice(separatorIndex + 1).trim();

    if (inlineValue.length > 0) {
      objectValue[key] = parseInlineValue(inlineValue);
    } else if (index < lines.length && lines[index]!.indent > indent) {
      const [child, nextIndex] = parseNode(lines, index, lines[index]!.indent);
      objectValue[key] = child;
      index = nextIndex;
    } else {
      objectValue[key] = {};
    }

    if (index < lines.length && lines[index]!.indent > indent && !lines[index]!.content.startsWith('- ')) {
      const [tail, nextIndex] = parseObject(lines, index, lines[index]!.indent);
      Object.assign(objectValue, tail);
      index = nextIndex;
    }

    result.push(objectValue);
  }

  return [result, index];
};

export const parseYamlLite = (text: string): Record<string, YamlValue> => {
  const lines = normalizeLines(text);
  if (lines.length === 0) {
    return {};
  }

  const [value] = parseObject(lines, 0, lines[0]!.indent);
  return value;
};

const stringifyScalar = (value: Exclude<YamlValue, YamlValue[] | { [key: string]: YamlValue }>): string => {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
};

const stringifyInline = (value: YamlValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyInline(item)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value)
      .map(([key, nextValue]) => `${key}: ${stringifyInline(nextValue)}`)
      .join(', ')} }`;
  }
  return stringifyScalar(value);
};

export const stringifyYamlLite = (input: Record<string, YamlValue>, indent = 0): string => {
  const lines: string[] = [];
  const prefix = ' '.repeat(indent);

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${prefix}${key}: []`);
        continue;
      }
      lines.push(`${prefix}${key}:`);
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (entries.length === 0) {
            lines.push(`${prefix}  - {}`);
            continue;
          }
          const [firstKey, firstValue] = entries[0]!;
          if (firstValue && typeof firstValue === 'object' && !Array.isArray(firstValue)) {
            lines.push(`${prefix}  - ${firstKey}:`);
            lines.push(stringifyYamlLite(firstValue as Record<string, YamlValue>, indent + 6));
          } else {
            lines.push(`${prefix}  - ${firstKey}: ${stringifyInline(firstValue)}`);
          }
          for (const [entryKey, entryValue] of entries.slice(1)) {
            if (entryValue && typeof entryValue === 'object' && !Array.isArray(entryValue)) {
              lines.push(`${prefix}    ${entryKey}:`);
              lines.push(stringifyYamlLite(entryValue as Record<string, YamlValue>, indent + 6));
            } else {
              lines.push(`${prefix}    ${entryKey}: ${stringifyInline(entryValue)}`);
            }
          }
          continue;
        }

        lines.push(`${prefix}  - ${stringifyInline(item)}`);
      }
      continue;
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        lines.push(`${prefix}${key}: {}`);
        continue;
      }
      lines.push(`${prefix}${key}:`);
      lines.push(stringifyYamlLite(value as Record<string, YamlValue>, indent + 2));
      continue;
    }

    lines.push(`${prefix}${key}: ${stringifyScalar(value)}`);
  }

  return lines.filter((line) => line.length > 0).join('\n');
};
