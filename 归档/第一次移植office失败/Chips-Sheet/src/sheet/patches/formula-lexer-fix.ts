/**
 * 移植自 GenOffice apps/sheets/src/renderer/formula-lexer-fix.ts（Apache-2.0）。
 *
 * 转义引号词法修复。Univer 的 LexerTreeBuilder._nodeMaker 会把字符串字面量里
 * 的转义引号（""）两个字符放进同一个序列槽位，而 getSequenceNode 把槽位下标
 * 当作字符下标使用，导致转义对之后的每个节点 startIndex/endIndex 集体左移
 * （STRING 记号还会丢一个引号）。sheets-ui 的 normalizeFormulaString 按这些
 * 下标拼接提交公式，会把 `="a"""&B1` 静默改写成 `="a"""B11`；autofill 的
 * moveFormulaRefOffset 与 F4 的 convertRefersToAbsolute 也会同样拼错。
 *
 * 本包装用同一套引号/括号状态机重扫公式，构建词法器本应产出的槽位→字符映射，
 * 返回修正了下标与记号的克隆节点。节点已经能重组回源文本的公式原样放行。
 */
import { LexerTreeBuilder, type sequenceNodeType } from "@univerjs/engine-formula";
import type { Univer } from "@univerjs/core";

export interface SequenceNodeLike {
  nodeType: sequenceNodeType;
  token: string;
  startIndex: number;
  endIndex: number;
}

export type SequenceEntry = SequenceNodeLike | string;

/** 复刻 _nodeMaker 的输入预处理 */
function formulaBody(formula: string): string {
  const flattened = formula.replace(/\r\n$|\r|\n/g, " ");
  return flattened.startsWith("=") ? flattened.slice(1) : flattened;
}

/** 槽位下标 → body 内字符下标，复刻词法器状态： */
function buildSlotMap(body: string): number[] {
  const map: number[] = [];
  let inDouble = false;
  let inSingle = false;
  let bracketDepth = 0;
  for (let at = 0; at < body.length; at += 1) {
    const char = body[at];
    map.push(at);
    if (inDouble) {
      if (char === '"') {
        if (body[at + 1] === '"') {
          at += 1;
        } else {
          inDouble = false;
        }
      }
    } else if (inSingle) {
      if (char === "'") {
        if (body[at + 1] === "'") {
          map.push(at + 1);
          at += 1;
        } else {
          inSingle = false;
        }
      }
    } else if (char === '"' && bracketDepth === 0) {
      inDouble = true;
    } else if (char === "'") {
      inSingle = true;
    } else if (char === "[") {
      bracketDepth += 1;
    } else if (char === "]" && bracketDepth > 0) {
      bracketDepth -= 1;
    }
  }
  return map;
}

export function fixSequenceNodes(
  formula: string,
  nodes: SequenceEntry[] | undefined | null,
): SequenceEntry[] | undefined | null {
  if (!nodes) {
    return nodes;
  }
  const body = formulaBody(formula);
  const reassembled = nodes.map((node) => (typeof node === "string" ? node : node.token)).join("");
  if (reassembled === body) {
    return nodes;
  }
  const map = buildSlotMap(body);
  let changed = false;
  const fixed = nodes.map((node) => {
    if (typeof node === "string") {
      return node;
    }
    const startIndex = map[node.startIndex];
    const boundary = map[node.endIndex + 1] ?? body.length;
    if (startIndex === undefined) {
      return node;
    }
    const endIndex = boundary - 1;
    if (startIndex === node.startIndex && endIndex === node.endIndex) {
      return node;
    }
    changed = true;
    return { ...node, startIndex, endIndex, token: body.slice(startIndex, endIndex + 1) };
  });
  return changed ? fixed : nodes;
}

export function wrapLexer(lexer: LexerTreeBuilder): { dispose(): void } {
  const original = lexer.sequenceNodesBuilder.bind(lexer) as (
    formula: string,
  ) => SequenceEntry[] | undefined | null;
  const wrapped = (formula: string) => fixSequenceNodes(formula, original(formula));
  (lexer as { sequenceNodesBuilder: typeof wrapped }).sequenceNodesBuilder = wrapped;
  return {
    dispose() {
      delete (lexer as { sequenceNodesBuilder?: typeof wrapped }).sequenceNodesBuilder;
    },
  };
}

/** 包装注入器中的 LexerTreeBuilder 单例——sheets-ui（提交规范化）、
 * sheets-formula-ui（高亮）与 engine-formula（autofill/F4 偏移改写）解析到的
 * 都是同一实例。 */
export function installFormulaLexerFix(runtime: { univer: Univer }): { dispose(): void } {
  return wrapLexer(runtime.univer.__getInjector().get(LexerTreeBuilder));
}
