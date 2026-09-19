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
  CAPABILITY_ID,
  PERMISSION_BASE_ID,
  EVENT_ID,
  backtickedTokens,
  normalizePermissionToken,
  extractTableRows,
  cutSection,
  duplicates,
  diffSets,
  sameStringSet,
  parseTsConstArray,
  parseTsPermissionMapping,
} from './lib/ids.mjs';
import { maskCode } from './lib/markdown.mjs';
import { listDir, readText, matchGlob } from './lib/walk.mjs';

const GATE_ID = 'contracts';
const TITLE = '契约一致性门禁（G8）';
const USAGE = `用法：node tools/gates/check-contracts.mjs [选项]

选项：
  --workspace-root <dir>  工作区根目录（默认取配置文件上级两级）
  --config <file>         门禁配置文件（默认 tools/gates/gates.config.json）
  --generated-dir <dir>   覆盖契约生成物目录
  --capability-doc <file> 覆盖能力契约来源文档
  --permission-doc <file> 覆盖权限清单来源文档
  --event-dir <dir>       覆盖事件契约文档目录
  --report-dir <dir>      报告输出目录（默认配置 reports.dir）
  --json                  以 JSON 输出报告
  --no-report             不写入报告文件
  --help                  显示本帮助

判定：文档库权威表（R19 能力 → 权限、§4.1 权限清单、标准事件）与
tools/contract-gen 生成物（packages/sdk/src/generated/*.ts）逐项一致。`;

function readSection(file, sectionRegex, label) {
  if (!fs.existsSync(file)) {
    throw new UsageError(`${label}来源文档不存在：${file}`);
  }
  const masked = maskCode(readText(file), { inlineCode: false });
  const section = cutSection(masked, sectionRegex);
  if (!section) {
    throw new UsageError(`${label}来源文档中未找到章节：${sectionRegex}（${file}）`);
  }
  return section;
}

export function parseCapabilities(file, sectionRegex) {
  const section = readSection(file, sectionRegex, '能力契约');
  const mapping = new Map();
  for (const cells of extractTableRows(section)) {
    if (cells.length < 2) {
      continue;
    }
    const capabilityIds = backtickedTokens(cells[0]).filter((token) => CAPABILITY_ID.test(token));
    if (capabilityIds.length === 0) {
      continue;
    }
    const permissions = [];
    for (const token of backtickedTokens(cells[1])) {
      const normalized = normalizePermissionToken(token);
      if (normalized) {
        permissions.push(normalized);
      }
    }
    for (const id of capabilityIds) {
      mapping.set(id, permissions.slice());
    }
  }
  return mapping;
}

export function parsePermissions(file, sectionRegex) {
  const section = readSection(file, sectionRegex, '权限清单');
  const permissions = [];
  for (const cells of extractTableRows(section)) {
    if (cells.length === 0) {
      continue;
    }
    for (const token of backtickedTokens(cells[0])) {
      if (PERMISSION_BASE_ID.test(token)) {
        permissions.push(token);
      }
    }
  }
  return permissions;
}

export function parseEvents(dir, filePattern, excludedDomains) {
  if (!existsDir(dir)) {
    throw new UsageError(`事件契约目录不存在：${dir}`);
  }
  const events = [];
  const files = listDir(dir)
    .filter((entry) => entry.isFile() && matchGlob(filePattern, entry.name))
    .map((entry) => path.join(dir, entry.name))
    .sort();
  if (files.length === 0) {
    throw new UsageError(`事件契约目录中未匹配到文档：${filePattern}（${dir}）`);
  }
  const excluded = new Set(excludedDomains ?? []);
  for (const file of files) {
    const masked = maskCode(readText(file), { inlineCode: false });
    for (const line of masked.split('\n')) {
      const match = /^####\s+`?([a-z][a-z0-9-]*):([a-z][a-z0-9-]*)`?\s*$/.exec(line);
      if (!match || excluded.has(match[1])) {
        continue;
      }
      events.push(`${match[1]}:${match[2]}`);
    }
  }
  return events;
}

function loadGeneratedArray(report, generatedDir, fileName, exportName) {
  const file = path.resolve(generatedDir, fileName);
  if (!fs.existsSync(file)) {
    addViolation(report, 'CONTRACT001', `契约生成物缺失：${toReportPath(file)}（先执行契约生成）`);
    return null;
  }
  const values = parseTsConstArray(readText(file), exportName);
  if (values === null) {
    addViolation(
      report,
      'CONTRACT002',
      `契约生成物缺少导出数组 ${exportName}：${toReportPath(file)}`
    );
    return null;
  }
  return { file, values };
}

function loadGeneratedMapping(report, generatedDir, fileName) {
  const file = path.resolve(generatedDir, fileName);
  if (!fs.existsSync(file)) {
    addViolation(report, 'CONTRACT001', `契约生成物缺失：${toReportPath(file)}（先执行契约生成）`);
    return null;
  }
  const mapping = parseTsPermissionMapping(readText(file));
  if (mapping === null) {
    addViolation(
      report,
      'CONTRACT002',
      `契约生成物缺少导出常量 CAPABILITY_PERMISSIONS 或结构非法：${toReportPath(file)}`
    );
    return null;
  }
  return { file, mapping };
}

function toReportPath(file) {
  return file.split(path.sep).join('/');
}

function checkGeneratedIds(report, values, label, pattern, file) {
  const repeated = duplicates(values);
  for (const id of repeated) {
    addViolation(report, 'CONTRACT013', `生成物 ${label} 存在重复 ID：${id}`, {
      file: toReportPath(file),
    });
  }
  for (const id of values) {
    if (!pattern.test(id)) {
      addViolation(report, 'CONTRACT013', `生成物 ${label} 存在文法非法 ID：${id}`, {
        file: toReportPath(file),
      });
    }
  }
}

export async function runCheck({ workspaceRoot, config, flags }) {
  const report = makeReport(GATE_ID, TITLE);
  const contracts = config.contracts ?? {};
  const sources = contracts.sources ?? {};
  const generatedConfig = contracts.generated ?? {};

  const capabilityFile = path.resolve(
    workspaceRoot,
    flagValue(flags, 'capability-doc', sources.capabilities?.file ?? '')
  );
  const capabilitySection = sources.capabilities?.section ?? '^###\\s+6\\.2';
  const permissionFile = path.resolve(
    workspaceRoot,
    flagValue(flags, 'permission-doc', sources.permissions?.file ?? '')
  );
  const permissionSection = sources.permissions?.section ?? '^###\\s+4\\.1';
  const eventDir = path.resolve(
    workspaceRoot,
    flagValue(flags, 'event-dir', sources.events?.dir ?? '.')
  );
  const eventPattern = sources.events?.files ?? '*.md';

  const docCapabilities = parseCapabilities(capabilityFile, capabilitySection);
  const docPermissions = parsePermissions(permissionFile, permissionSection);
  const docEvents = parseEvents(
    eventDir,
    eventPattern,
    sources.events?.excludedDomains ?? ['internal']
  );

  const declaredPattern = sources.capabilities?.declaredCount;
  if (typeof declaredPattern === 'string' && declaredPattern.length > 0) {
    const declared = new RegExp(declaredPattern).exec(readText(capabilityFile));
    if (!declared) {
      addViolation(
        report,
        'CONTRACT042',
        `能力契约来源文档未找到声明的能力计数：/${declaredPattern}/`,
        {
          file: toReportPath(capabilityFile),
        }
      );
    } else if (Number(declared[1]) !== docCapabilities.size) {
      addViolation(
        report,
        'CONTRACT042',
        `能力数与文档声明不一致：解析 ${docCapabilities.size}，声明 ${declared[1]}`,
        {
          file: toReportPath(capabilityFile),
        }
      );
    }
  }

  const permissionSet = new Set(docPermissions);
  for (const [id, permissions] of docCapabilities) {
    for (const permission of permissions) {
      if (!permissionSet.has(permission)) {
        addViolation(report, 'CONTRACT041', `能力 ${id} 引用了权限词表之外的权限：${permission}`, {
          file: toReportPath(capabilityFile),
        });
      }
    }
  }
  const lowerCaseConflicts = [...docCapabilities.keys()].filter(
    (id) => !/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(id)
  );
  if (lowerCaseConflicts.length > 0) {
    addWarning(
      report,
      'CONTRACT091',
      `能力 ID 含大写字母（04.03 §3.1 全小写与 canonical R19 表冲突，已登记问题工单 003）：${lowerCaseConflicts.join(', ')}`
    );
  }

  const generatedDir = path.resolve(
    workspaceRoot,
    flagValue(flags, 'generated-dir', generatedConfig.dir ?? '')
  );
  if (!existsDir(generatedDir)) {
    addViolation(
      report,
      'CONTRACT001',
      `契约生成物目录缺失：${toReportPath(generatedDir)}（先执行契约生成）`
    );
    return finalizeReport(report, {
      docsCapabilities: docCapabilities.size,
      docsPermissions: docPermissions.length,
      docsEvents: docEvents.length,
      generated: 'missing',
    });
  }
  const generatedCapabilities = loadGeneratedArray(
    report,
    generatedDir,
    generatedConfig.capabilities ?? 'capability-ids.ts',
    'CAPABILITY_IDS'
  );
  const generatedPermissions = loadGeneratedArray(
    report,
    generatedDir,
    generatedConfig.permissions ?? 'permission-ids.ts',
    'PERMISSION_IDS'
  );
  const generatedEvents = loadGeneratedArray(
    report,
    generatedDir,
    generatedConfig.events ?? 'event-ids.ts',
    'EVENT_IDS'
  );
  const generatedMapping = loadGeneratedMapping(
    report,
    generatedDir,
    generatedConfig.mapping ?? 'capability-permissions.ts'
  );

  if (
    generatedCapabilities === null &&
    generatedPermissions === null &&
    generatedEvents === null &&
    generatedMapping === null
  ) {
    return finalizeReport(report, {
      docsCapabilities: docCapabilities.size,
      docsPermissions: docPermissions.length,
      docsEvents: docEvents.length,
      generated: 'missing',
    });
  }

  if (generatedCapabilities !== null) {
    checkGeneratedIds(
      report,
      generatedCapabilities.values,
      '能力 ID',
      CAPABILITY_ID,
      generatedCapabilities.file
    );
    const diff = diffSets([...docCapabilities.keys()], generatedCapabilities.values);
    for (const id of diff.missing) {
      addViolation(report, 'CONTRACT010', `生成物缺少能力 ID：${id}`, {
        file: toReportPath(generatedCapabilities.file),
      });
    }
    for (const id of diff.extra) {
      addViolation(report, 'CONTRACT011', `生成物多余能力 ID：${id}`, {
        file: toReportPath(generatedCapabilities.file),
      });
    }
  }

  if (generatedPermissions !== null) {
    checkGeneratedIds(
      report,
      generatedPermissions.values,
      '权限 ID',
      PERMISSION_BASE_ID,
      generatedPermissions.file
    );
    const diff = diffSets(docPermissions, generatedPermissions.values);
    for (const id of diff.missing.slice(0, 50)) {
      addViolation(report, 'CONTRACT020', `生成物缺少权限 ID：${id}`, {
        file: toReportPath(generatedPermissions.file),
      });
    }
    for (const id of diff.extra.slice(0, 50)) {
      addViolation(report, 'CONTRACT021', `生成物多余权限 ID：${id}`, {
        file: toReportPath(generatedPermissions.file),
      });
    }
  }

  if (generatedEvents !== null) {
    checkGeneratedIds(report, generatedEvents.values, '事件 ID', EVENT_ID, generatedEvents.file);
    const diff = diffSets([...new Set(docEvents)], generatedEvents.values);
    for (const id of diff.missing.slice(0, 50)) {
      addViolation(report, 'CONTRACT030', `生成物缺少事件 ID：${id}`, {
        file: toReportPath(generatedEvents.file),
      });
    }
    for (const id of diff.extra.slice(0, 50)) {
      addViolation(report, 'CONTRACT031', `生成物多余事件 ID：${id}`, {
        file: toReportPath(generatedEvents.file),
      });
    }
  }

  if (generatedMapping !== null) {
    const expectedIds = new Set(docCapabilities.keys());
    const actualIds = new Set(generatedMapping.mapping.keys());
    for (const id of expectedIds) {
      if (!actualIds.has(id)) {
        addViolation(report, 'CONTRACT043', `生成物能力 → 权限映射缺少能力键：${id}`, {
          file: toReportPath(generatedMapping.file),
        });
      }
    }
    for (const id of actualIds) {
      if (!expectedIds.has(id)) {
        addViolation(report, 'CONTRACT043', `生成物能力 → 权限映射存在多余能力键：${id}`, {
          file: toReportPath(generatedMapping.file),
        });
      }
    }
    for (const [id, permissions] of generatedMapping.mapping) {
      const repeated = duplicates(permissions);
      for (const permission of repeated) {
        addViolation(
          report,
          'CONTRACT013',
          `生成物能力 ${id} 的权限数组存在重复项：${permission}`,
          {
            file: toReportPath(generatedMapping.file),
          }
        );
      }
      for (const permission of permissions) {
        if (!PERMISSION_BASE_ID.test(permission)) {
          addViolation(
            report,
            'CONTRACT013',
            `生成物能力 ${id} 的权限 ID 文法非法：${permission}`,
            {
              file: toReportPath(generatedMapping.file),
            }
          );
        } else if (!permissionSet.has(permission)) {
          addViolation(
            report,
            'CONTRACT041',
            `生成物能力 ${id} 引用了权限词表之外的权限：${permission}`,
            {
              file: toReportPath(generatedMapping.file),
            }
          );
        }
      }
      const expected = docCapabilities.get(id);
      if (expected !== undefined && !sameStringSet(expected, permissions)) {
        addViolation(
          report,
          'CONTRACT012',
          `能力 ${id} 的权限映射与 R19 表不一致：生成物 [${[...permissions].sort().join(', ')}] / 文档 [${[...expected].sort().join(', ')}]`,
          { file: toReportPath(generatedMapping.file) }
        );
      }
    }
  }

  const capabilitySet = new Set(generatedCapabilities?.values ?? [...docCapabilities.keys()]);
  const generatedPermissionSet = new Set(generatedPermissions?.values ?? docPermissions);
  const generatedEventSet = new Set(generatedEvents?.values ?? docEvents);
  for (const id of capabilitySet) {
    if (generatedPermissionSet.has(id)) {
      addViolation(report, 'CONTRACT040', `能力 ID 与权限 ID 冲突（R3）：${id}`);
    }
    if (generatedEventSet.has(id)) {
      addViolation(report, 'CONTRACT040', `能力 ID 与事件 ID 冲突：${id}`);
    }
  }
  for (const id of generatedPermissionSet) {
    if (generatedEventSet.has(id)) {
      addViolation(report, 'CONTRACT040', `权限 ID 与事件 ID 冲突：${id}`);
    }
  }

  return finalizeReport(report, {
    docsCapabilities: docCapabilities.size,
    docsPermissions: docPermissions.length,
    docsEvents: docEvents.length,
    generated: toReportPath(generatedDir),
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
