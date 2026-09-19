/**
 * TypeScript 声明归一：文档代码块 → 稳定声明模型（角色接口、帧协议共用）。
 *
 * 只使用语法树中不携带注释的 `getText()`（含 `getStart()` 语义），
 * 因此文档中的注释改动不会影响快照，成员名、可选性、类型与顺序的改动必然进入差异。
 */

import ts from 'typescript';

import { collapse } from '../markdown.js';

export interface NormalizedMember {
  readonly name: string;
  readonly optional: boolean;
  /** 归一后的成员签名（单行、无注释）。 */
  readonly signature: string;
}

export interface NormalizedInterface {
  readonly name: string;
  readonly kind: 'interface';
  readonly heritage: readonly string[];
  readonly members: readonly NormalizedMember[];
}

export interface NormalizedTypeAlias {
  readonly name: string;
  readonly kind: 'type';
  /** 归一后的类型文本（单行）。 */
  readonly text: string;
}

export type NormalizedDeclaration = NormalizedInterface | NormalizedTypeAlias;

export interface NormalizedStringConstant {
  readonly name: string;
  readonly value: string;
}

export interface NormalizedCodeBlock {
  readonly declarations: readonly NormalizedDeclaration[];
  readonly stringConstants: readonly NormalizedStringConstant[];
}

function memberSignature(member: ts.TypeElement, source: ts.SourceFile): NormalizedMember {
  if (ts.isPropertySignature(member) && member.name !== undefined) {
    const name = member.name.getText(source).replace(/^['"]|['"]$/g, '');
    const optional = member.questionToken !== undefined;
    const readonly =
      member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword) ??
      false;
    const type = member.type === undefined ? 'unknown' : collapse(member.type.getText(source));
    return {
      name,
      optional,
      signature: `${readonly ? 'readonly ' : ''}${name}${optional ? '?' : ''}: ${type}`,
    };
  }
  if (ts.isMethodSignature(member) && member.name !== undefined) {
    const name = member.name.getText(source);
    const optional = member.questionToken !== undefined;
    const typeParameters =
      member.typeParameters === undefined
        ? ''
        : `<${member.typeParameters.map((parameter) => collapse(parameter.getText(source))).join(', ')}>`;
    const parameters = member.parameters
      .map((parameter) => collapse(parameter.getText(source)))
      .join(', ');
    const returnType = member.type === undefined ? 'void' : collapse(member.type.getText(source));
    return {
      name,
      optional,
      signature: `${name}${optional ? '?' : ''}${typeParameters}(${parameters}): ${returnType}`,
    };
  }
  return {
    name: `#${ts.SyntaxKind[member.kind]}`,
    optional: false,
    signature: collapse(member.getText(source)),
  };
}

function interfaceDeclaration(
  statement: ts.InterfaceDeclaration,
  source: ts.SourceFile
): NormalizedInterface {
  const heritage = (statement.heritageClauses ?? []).flatMap((clause) =>
    clause.types.map((type) => collapse(type.getText(source)))
  );
  return {
    name: statement.name.text,
    kind: 'interface',
    heritage,
    members: statement.members.map((member) => memberSignature(member, source)),
  };
}

/** 解析一段 TypeScript 代码块，返回声明与顶层字符串常量。 */
export function normalizeCodeBlock(content: string): NormalizedCodeBlock {
  const source = ts.createSourceFile(
    'contract-doc.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const declarations: NormalizedDeclaration[] = [];
  const stringConstants: NormalizedStringConstant[] = [];
  for (const statement of source.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      declarations.push(interfaceDeclaration(statement, source));
      continue;
    }
    if (ts.isTypeAliasDeclaration(statement)) {
      declarations.push({
        name: statement.name.text,
        kind: 'type',
        text: collapse(statement.type.getText(source)),
      });
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (
          initializer !== undefined &&
          ts.isStringLiteral(initializer) &&
          ts.isIdentifier(declaration.name)
        ) {
          stringConstants.push({ name: declaration.name.text, value: initializer.text });
        }
      }
    }
  }
  return { declarations, stringConstants };
}

/** 类型别名是否为联合类型；返回成员类型文本（`A | B` → `['A', 'B']`），非联合返回空数组。 */
export function unionMembers(declaration: NormalizedTypeAlias): readonly string[] {
  const members = declaration.text
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return members.length > 1 ? members : [];
}

/** 取接口中值为字符串字面量的成员（帧消息的 `type` 判别字段）。 */
export function stringLiteralMember(
  declaration: NormalizedInterface,
  memberName: string
): string | undefined {
  const member = declaration.members.find((entry) => entry.name === memberName);
  if (member === undefined) {
    return undefined;
  }
  const match = /^(?:readonly\s+)?\w+\??\s*:\s*'([^']+)'$/.exec(member.signature);
  return match === null || match[1] === undefined ? undefined : match[1];
}
