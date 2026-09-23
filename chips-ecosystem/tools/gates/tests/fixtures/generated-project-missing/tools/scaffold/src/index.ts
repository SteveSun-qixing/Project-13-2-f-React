/**
 * 缺文件夹具：计划与模板清单一致但缺核心文件 `manifest.yaml`，
 * 并携带一个空正文文件，驱动生成工程门禁的「关键文件齐备/落盘一致」负例面（GP040）。
 */

interface IFakeFile {
  readonly path: string;
  readonly content: string;
}

const manifest = {
  id: 'chips.basecard.gatecheck',
  version: '0.1.0',
  name: '门禁样例',
  type: 'basecard',
  runtime: { targets: ['host'] },
};

const files: readonly IFakeFile[] = [
  {
    path: 'package.json',
    content:
      '{"name":"@chips/plugin-gatecheck","version":"0.1.0","scripts":{"build":"vite build","test":"vitest run"}}\n',
  },
  {
    path: 'tsconfig.json',
    content: '{"extends":"../../tsconfig.base.json","include":["src"]}\n',
  },
  { path: 'README.md', content: '' },
  { path: 'src/index.ts', content: 'export const ready = true;\n' },
];

export function listScaffoldTemplates() {
  return [{ role: 'basecard', description: '缺文件夹具', files: files.map((item) => item.path) }];
}

export function createScaffoldPlan(options: { role: string; targetDir: string }) {
  return {
    targetDir: options.targetDir,
    template: { role: options.role, description: '缺文件夹具', files: files.map((item) => item.path) },
    manifest,
    files,
  };
}
