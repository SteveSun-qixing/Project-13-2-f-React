/**
 * 脏生成物夹具：manifest 合法、package.json 形状合法，但文件正文集中植入
 * 占位符（GP030）、TODO（GP031）、绝对路径裸直读（GP033）、相对引用悬空（GP022）、
 * 语法级编译诊断（GP020）与坏 JSON（GP021），驱动生成工程门禁的负例面。
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
    path: 'manifest.yaml',
    content:
      'id: chips.basecard.gatecheck\nversion: 0.1.0\nname: "门禁样例"\ntype: basecard\nruntime:\n  targets:\n    - host\n',
  },
  {
    path: 'package.json',
    content:
      '{"name":"@chips/plugin-gatecheck","version":"0.1.0","scripts":{"build":"vite build","test":"vitest run"}}\n',
  },
  {
    path: 'tsconfig.json',
    content: '{"extends":"../../tsconfig.base.json","include":["src","tests"]}\n',
  },
  {
    path: 'README.md',
    content: '# 门禁样例\n\nTODO: 待接入\n标识：{{PLUGIN_ID}}\n',
  },
  {
    path: 'src/index.ts',
    content:
      "import leak from '/Users/dev/outside-project';\nimport { missingThing } from './no-such-module';\nexport const id = '{{PLUGIN_ID}}';\nconst = ; // TODO 语法破坏\nexport { leak, missingThing, id };\n",
  },
  {
    path: 'assets/schemas/gatecheck-config.schema.json',
    content: '{"$schema": "https://json-schema.org/draft/2020-12/schema", "type": object}',
  },
];

export function listScaffoldTemplates() {
  return [{ role: 'basecard', description: '脏生成物夹具', files: files.map((item) => item.path) }];
}

export function createScaffoldPlan(options: { role: string; targetDir: string }) {
  return {
    targetDir: options.targetDir,
    template: { role: options.role, description: '脏生成物夹具', files: files.map((item) => item.path) },
    manifest,
    files,
  };
}
