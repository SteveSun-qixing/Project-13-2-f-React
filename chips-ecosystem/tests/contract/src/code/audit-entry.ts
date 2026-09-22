/**
 * 权限审计条目实现侧装载（工单046 段一：条目面单一事实源锁测的数据源）。
 *
 * - Bridge 协议层：读取 `packages/bridge/src/protocol/permission.ts` 源码文本，
 *   走与文档代码块同一套语法树归一（`ts-declarations`），声明逐字段可比；
 * - SDK 转发面：读取 `packages/sdk/src/types/capabilities/permission.ts`，
 *   以 AST 事实核验四个权威声明只做 `@chips/bridge` 锚定转发、不本地再声明；
 * - 异型扫描：跨包源码文本中禁止再现已收口异型名 `IPermissionAuditRecord`
 *   （禁三型并存账的机械闸）。
 *
 * 装载函数一律接受「文本」注入，真实文件读取只是缺省实现，
 * 偏差注入与锁测共用同一判定管线。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { normalizeCodeBlock, type NormalizedDeclaration } from '../docs/ts-declarations.js';
import { WORKSPACE_ROOT } from '../paths.js';

/** 实现侧被锁定的源码文件（展示路径，进入偏差定位）。 */
export const BRIDGE_PERMISSION_FILE = 'packages/bridge/src/protocol/permission.ts';
export const SDK_PERMISSION_FILE = 'packages/sdk/src/types/capabilities/permission.ts';

/** 已收口异型名：任何实现侧源码文本再现该声明即破坏单一事实源。 */
export const FORBIDDEN_AUDIT_RECORD_SHAPE = 'IPermissionAuditRecord';

const BRIDGE_PERMISSION_ABSOLUTE = path.join(WORKSPACE_ROOT, BRIDGE_PERMISSION_FILE);
const SDK_PERMISSION_ABSOLUTE = path.join(WORKSPACE_ROOT, SDK_PERMISSION_FILE);

/** 异型扫描的包源码根（bridge/sdk/host 三面 src；跳过测试文件）。 */
const FORBIDDEN_SCAN_ROOTS: readonly string[] = [
  path.join(WORKSPACE_ROOT, 'packages/bridge/src'),
  path.join(WORKSPACE_ROOT, 'packages/sdk/src'),
  path.join(WORKSPACE_ROOT, 'packages/host/src'),
];

export interface BridgePermissionCodeModel {
  /** 声明名 → 归一声明（缺失即未落地）。 */
  readonly declarations: ReadonlyMap<string, NormalizedDeclaration>;
}

export interface SdkPermissionAnchorModel {
  /** 自 `@chips/bridge` `import type` 引入的名字集合。 */
  readonly importedFromBridge: ReadonlySet<string>;
  /** 本模块对外再导出的名字集合（含 `export type { ... }` 与行内导出）。 */
  readonly reexported: ReadonlySet<string>;
  /** 本模块本地声明（interface / type alias）的名字集合。 */
  readonly locallyDeclared: ReadonlySet<string>;
}

/** 解析 bridge 协议层权限模块文本，归一其顶层声明。 */
export function parseBridgePermissionText(sourceText: string): BridgePermissionCodeModel {
  const declarations = new Map<string, NormalizedDeclaration>();
  for (const declaration of normalizeCodeBlock(sourceText).declarations) {
    if (!declarations.has(declaration.name)) {
      declarations.set(declaration.name, declaration);
    }
  }
  return { declarations };
}

function exportedNameNames(statement: ts.ExportDeclaration, source: ts.SourceFile): string[] {
  const names: string[] = [];
  if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
    for (const specifier of statement.exportClause.elements) {
      names.push(specifier.name.getText(source).replace(/^['"]|['"]$/g, ''));
    }
  }
  return names;
}

/** 解析 SDK 权限治理模块文本，抽取「桥锚定转发」三类 AST 事实。 */
export function parseSdkPermissionAnchorText(sourceText: string): SdkPermissionAnchorModel {
  const importedFromBridge = new Set<string>();
  const reexported = new Set<string>();
  const locallyDeclared = new Set<string>();
  const source = ts.createSourceFile(
    'contract-sdk-permission.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.moduleSpecifier.getText(source) === "'@chips/bridge'"
    ) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          importedFromBridge.add(element.name.getText(source));
        }
      }
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      // `export type { X }` 与 `export type { X } from '…'`（后者同时计一次来源锚定）。
      for (const name of exportedNameNames(statement, source)) {
        reexported.add(name);
      }
      const specifier = statement.moduleSpecifier?.getText(source);
      if (specifier === "'@chips/bridge'") {
        for (const name of exportedNameNames(statement, source)) {
          importedFromBridge.add(name);
        }
      }
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      locallyDeclared.add(statement.name.getText(source));
      if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        reexported.add(statement.name.getText(source));
      }
      continue;
    }
  }
  return { importedFromBridge, reexported, locallyDeclared };
}

/** 扫描给定文本集合，返回出现异型名声明的文件展示路径清单（升序）。 */
export function findForbiddenShapeHits(texts: ReadonlyMap<string, string>): readonly string[] {
  const hits: string[] = [];
  const pattern = new RegExp(`(interface|type)\\s+${FORBIDDEN_AUDIT_RECORD_SHAPE}\\b`);
  for (const [name, text] of texts) {
    if (pattern.test(text)) {
      hits.push(name);
    }
  }
  return hits.sort((left, right) => left.localeCompare(right));
}

function walkSourceFiles(roots: readonly string[]): readonly string[] {
  const files: string[] = [];
  const visit = (absoluteDir: string): void => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absolute = path.join(absoluteDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name)
      ) {
        files.push(path.relative(WORKSPACE_ROOT, absolute).split(path.sep).join('/'));
      }
    }
  };
  for (const root of roots) {
    if (existsSync(root)) {
      visit(root);
    }
  }
  return files;
}

/** 读取真实实现侧文件文本（相对工作区路径 → 文本），供异型扫描与两侧装载。 */
export function loadAuditEntryCodeTexts(): ReadonlyMap<string, string> {
  const texts = new Map<string, string>();
  texts.set(BRIDGE_PERMISSION_FILE, readFileSync(BRIDGE_PERMISSION_ABSOLUTE, 'utf8'));
  texts.set(SDK_PERMISSION_FILE, readFileSync(SDK_PERMISSION_ABSOLUTE, 'utf8'));
  for (const relative of walkSourceFiles(FORBIDDEN_SCAN_ROOTS)) {
    if (!texts.has(relative)) {
      texts.set(relative, readFileSync(path.join(WORKSPACE_ROOT, relative), 'utf8'));
    }
  }
  return texts;
}
