/**
 * 保留区登记面锁测（W5 T-ws 工作区作用域臂，工单036 残段收尾波）。
 *
 * 权威：`13-工作区设计` §三（13.03）逐字清单——§3.1 目录布局（`.chips/` 平台保留目录）、
 * §3.2「不进入扫描的条目」表（保留目录 / 平台保留前缀 / 系统生成物 / 临时物四类）、
 * §3.3 命名与冲突规则第 3 条（保留前缀禁止，违者 `WORKSPACE_RESERVED_PATH`）；
 * `13.06` §6.3（保留区保护：只由平台组件访问）。
 *
 * 锁定面：
 * - 清单常量逐字（保留目录名、保留前缀、在册临时物前缀族、系统生成物保留名）；
 * - `isReservedPath` 判定表逐条钉死（13.03 清单每一项 + fail-closed 上位判据 + 非保留正样例）；
 * - 单源存在性锁：文档域内保留判定函数与 `.chips` 字面量唯一落点（禁第二套保留区判定，
 *   蓝图 §〇.5 红线）。
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_RESERVED_DIRECTORY_NAME,
  WORKSPACE_RESERVED_PLATFORM_PREFIX,
  WORKSPACE_RESERVED_SYSTEM_GENERATED_NAMES,
  WORKSPACE_RESERVED_TEMP_ITEM_PREFIXES,
  isReservedPath,
} from '../src/capabilities/document/scope-reserved-paths.js';

describe('保留区登记面 · 清单常量逐字（13.03 §三）', () => {
  it('保留目录名与平台保留前缀逐字为 ".chips"（§3.1 布局 + §3.2 平台保留前缀行）', () => {
    expect(WORKSPACE_RESERVED_DIRECTORY_NAME).toBe('.chips');
    expect(WORKSPACE_RESERVED_PLATFORM_PREFIX).toBe('.chips');
  });

  it('在册临时物前缀族逐字：保存 / 导出暂存 / 解包三族（§3.2 平台保留前缀行括注）', () => {
    expect([...WORKSPACE_RESERVED_TEMP_ITEM_PREFIXES]).toEqual(['.chips-save-', '.chips-export-', '.chips-unpack-']);
  });

  it('系统生成物保留名逐字：__MACOSX / .DS_Store / Thumbs.db / desktop.ini（§3.2 系统生成物行）', () => {
    expect([...WORKSPACE_RESERVED_SYSTEM_GENERATED_NAMES]).toEqual([
      '__MACOSX',
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
    ]);
  });
});

describe('保留区登记面 · isReservedPath 判定表（13.03 清单逐条钉死）', () => {
  it('保留目录 `.chips/`：根与任意层级、整棵子树内一律保留（§3.2 保留目录行）', () => {
    expect(isReservedPath('/workspace/.chips')).toBe(true);
    expect(isReservedPath('/workspace/.chips/')).toBe(true);
    expect(isReservedPath('/workspace/.chips/workspace.json')).toBe(true);
    expect(isReservedPath('/workspace/.chips/state/instance.lock')).toBe(true);
    expect(isReservedPath('/workspace/.chips/cache/thumbnails/x.png')).toBe(true);
    expect(isReservedPath('/workspace/项目/.chips/state/host-state.json')).toBe(true);
  });

  it('平台保留前缀：任意层级以 `.chips` 开头的条目（§3.2 平台保留前缀行）', () => {
    expect(isReservedPath('/workspace/.chips-save-a1b2c3')).toBe(true);
    expect(isReservedPath('/workspace/.chips-export-a1b2c3')).toBe(true);
    expect(isReservedPath('/workspace/.chips-unpack-a1b2c3')).toBe(true);
    expect(isReservedPath('/workspace/旅行日记.card/.chips-export-a1b2c3')).toBe(true);
    expect(isReservedPath('/workspace/.chips-manifest')).toBe(true);
  });

  it('系统生成物保留名：__MACOSX / .DS_Store / Thumbs.db / desktop.ini（§3.2 系统生成物行）', () => {
    expect(isReservedPath('/workspace/__MACOSX')).toBe(true);
    expect(isReservedPath('/workspace/__MACOSX/旅行日记.card/')).toBe(true);
    expect(isReservedPath('/workspace/.DS_Store')).toBe(true);
    expect(isReservedPath('/workspace/项目/.DS_Store')).toBe(true);
    expect(isReservedPath('/workspace/Thumbs.db')).toBe(true);
    expect(isReservedPath('/workspace/desktop.ini')).toBe(true);
  });

  it('fail-closed 上位判据：任意层级以 `.` 开头的隐藏条目一律保留（§3.2 系统生成物行「其他隐藏条目」）', () => {
    expect(isReservedPath('/workspace/.hidden')).toBe(true);
    expect(isReservedPath('/workspace/.hidden.card')).toBe(true);
    expect(isReservedPath('/workspace/项目/.临时')).toBe(true);
    expect(isReservedPath('/workspace/项目/.config/nested.card')).toBe(true);
    // 卷语义大小写折叠的系统生成物变体同判（13.03 §3.3 第 6 条目录态名称遵循卷语义）。
    expect(isReservedPath('/workspace/__macosx')).toBe(true);
    expect(isReservedPath('/workspace/THUMBS.DB')).toBe(true);
  });

  it('非保留正样例：用户文档名、嵌套子目录、段内点号与中文一律放行（§3.1 用户文件区）', () => {
    expect(isReservedPath('/workspace/旅行日记.card')).toBe(false);
    expect(isReservedPath('/workspace/旅行日记.card/manifest.yaml')).toBe(false);
    expect(isReservedPath('/workspace/2026-东京.box')).toBe(false);
    expect(isReservedPath('/workspace/笔记.md')).toBe(false);
    expect(isReservedPath('/workspace/项目/照片.card')).toBe(false);
    expect(isReservedPath('/workspace/my.folder/notes.card')).toBe(false);
    expect(isReservedPath('/workspace/卡片-v2.box')).toBe(false);
    expect(isReservedPath('/workspace/未命名卡片-2.card')).toBe(false);
  });

  it('导航段不属保留清单：`.` / `..` 由调用方路径合法性闸拒收，本判据不代管、不误判保留', () => {
    expect(isReservedPath('/workspace/.')).toBe(false);
    expect(isReservedPath('/workspace/..')).toBe(false);
    // 空输入同理：拒收属调用方输入闸，本判据只回答「是否落保留清单」。
    expect(isReservedPath('')).toBe(false);
  });

  it('分隔符形态：POSIX 与 win32 分隔符同判；相对路径与绝对路径同判', () => {
    expect(isReservedPath('C:\\workspace\\.chips\\state\\host-state.json')).toBe(true);
    expect(isReservedPath('C:\\workspace\\.chips-export-a1b2c3')).toBe(true);
    expect(isReservedPath('C:\\workspace\\旅行日记.card')).toBe(false);
    expect(isReservedPath('.chips/state/cleanup.json')).toBe(true);
    expect(isReservedPath('旅行日记.card')).toBe(false);
  });
});

describe('保留区登记面 · 单源存在性锁（禁第二套保留区判定）', () => {
  /** 文档域 src 递归收集 ts 源文件（相对 `src/capabilities/document` 的 POSIX 风格路径）。 */
  function collectDocumentSources(directory: string, prefix: string): string[] {
    const found: string[] = [];
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, item.name);
      const relative = prefix.length === 0 ? item.name : `${prefix}/${item.name}`;
      if (item.isDirectory()) {
        found.push(...collectDocumentSources(absolute, relative));
      } else if (item.isFile() && item.name.endsWith('.ts')) {
        found.push(relative);
      }
    }
    return found;
  }

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const documentSourceRoot = join(packageRoot, 'src', 'capabilities', 'document');

  it('`.chips` 字面量在文档域 src 内唯一落点 = scope-reserved-paths.ts 常量定义位', () => {
    const carriers: string[] = [];
    for (const relative of collectDocumentSources(documentSourceRoot, '')) {
      const text = readFileSync(join(documentSourceRoot, relative), 'utf8');
      if (text.includes("'.chips'") || text.includes('".chips"')) {
        carriers.push(relative);
      }
    }
    expect(carriers).toEqual(['scope-reserved-paths.ts']);
  });

  it('保留判定函数在文档域 src 内唯一导出落点 = scope-reserved-paths.ts', () => {
    const carriers: string[] = [];
    for (const relative of collectDocumentSources(documentSourceRoot, '')) {
      const text = readFileSync(join(documentSourceRoot, relative), 'utf8');
      if (text.includes('export function isReservedPath')) {
        carriers.push(relative);
      }
    }
    expect(carriers).toEqual(['scope-reserved-paths.ts']);
  });
});
