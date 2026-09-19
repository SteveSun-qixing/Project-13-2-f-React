/**
 * 角色接口解析：从 07–10 四份接口文档的契约章节抽取 TypeScript 声明并归一。
 *
 * 归一使用 TypeScript 编译器 API（语法树）而不是文本正则：
 * - 注释与格式变化不影响快照；
 * - 成员顺序、成员名、可选性与签名文本稳定可评审。
 */

import { findSection, fencedCodeBlocks, inlineCodeTokens } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { ROLE_SOURCES, type RoleName, type SectionSelector } from './sources.js';
import { normalizeCodeBlock, type NormalizedDeclaration } from './ts-declarations.js';

export interface DocRoleDeclaration extends DocRef {
  readonly declaration: NormalizedDeclaration;
}

export interface DocRole {
  readonly role: RoleName;
  readonly declarations: readonly DocRoleDeclaration[];
  readonly refs: readonly DocRef[];
}

export interface DocExportClaim {
  readonly role: RoleName;
  readonly file: string;
  readonly names: readonly string[];
}

export interface DocRoleModel {
  readonly roles: readonly DocRole[];
  readonly claims: readonly DocExportClaim[];
}

const EXPORT_CLAIM_PATTERN = /本文全部接口与类型（([^）]+)）均从 `@chips\/sdk` 主入口导出/;

function parseRole(
  reader: DocReader,
  role: RoleName,
  selectors: readonly SectionSelector[]
): DocRole {
  const declarations: DocRoleDeclaration[] = [];
  const refs: DocRef[] = [];
  for (const selector of selectors) {
    const text = reader.read(selector.file);
    const body = findSection(text, selector.level, selector.heading);
    if (body === null) {
      throw new Error(`未找到角色接口章节：${selector.file} §${selector.heading}`);
    }
    const ref: DocRef = { file: selector.file, section: selector.section ?? selector.heading };
    refs.push(ref);
    const blocks = fencedCodeBlocks(body, ['typescript', 'ts']);
    if (blocks.length === 0) {
      throw new Error(`角色接口章节缺少 TypeScript 代码块：${selector.file} §${selector.heading}`);
    }
    for (const block of blocks) {
      for (const declaration of normalizeCodeBlock(block.content).declarations) {
        declarations.push({ ...ref, declaration });
      }
    }
  }
  if (declarations.length === 0) {
    throw new Error(`角色 ${role} 未解析出任何接口声明`);
  }
  return { role, declarations, refs };
}

function parseExportClaims(reader: DocReader): readonly DocExportClaim[] {
  const claims: DocExportClaim[] = [];
  const seenFiles = new Set<string>();
  for (const roleSource of ROLE_SOURCES) {
    for (const selector of roleSource.selectors) {
      if (seenFiles.has(selector.file)) {
        continue;
      }
      seenFiles.add(selector.file);
      const text = reader.read(selector.file);
      const match = EXPORT_CLAIM_PATTERN.exec(text);
      if (match === null || match[1] === undefined) {
        continue;
      }
      claims.push({
        role: roleSource.role,
        file: selector.file,
        names: inlineCodeTokens(match[1]),
      });
    }
  }
  return claims;
}

export function parseRoleModel(reader: DocReader): DocRoleModel {
  return {
    roles: ROLE_SOURCES.map((roleSource) =>
      parseRole(reader, roleSource.role, roleSource.selectors)
    ),
    claims: parseExportClaims(reader),
  };
}
