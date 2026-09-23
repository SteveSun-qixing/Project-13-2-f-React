import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const configDir = dirname(fileURLToPath(import.meta.url));

const restrictedImportPaths = [
  {
    name: 'antd',
    message: '禁止直接使用 antd，请从 @chips/ui 导入',
  },
  {
    name: '@chips/antd',
    message: '禁止直接导入 @chips/antd，请从 @chips/ui 导入',
  },
];

const restrictedImportPatterns = [
  {
    group: ['antd/**'],
    message: '禁止直接使用 antd，请从 @chips/ui 导入',
  },
  {
    group: ['@chips/antd/**'],
    message: '禁止直接导入 @chips/antd，请从 @chips/ui 导入',
  },
  {
    group: ['@mui/**', '@chakra-ui/**'],
    message: '禁止引入第二套组件库，请从 @chips/ui 导入',
  },
];

const restrictedImportPathsForUi = [
  {
    name: 'antd',
    message: 'packages/ui 只能使用 fork 后的 @chips/antd',
  },
];

const restrictedImportPatternsForUi = [
  {
    group: ['antd/**'],
    message: 'packages/ui 只能使用 fork 后的 @chips/antd',
  },
  {
    group: ['@mui/**', '@chakra-ui/**'],
    message: '禁止引入第二套组件库，请从 @chips/ui 导入',
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/target/**',
      '**/release/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '**/fixtures/**',
      '**/归档/**',
      '**/*.node',
      '**/*.cpk',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // 插件渲染入口 `render.js` 是 `src/render.tsx` 的构建产物，运行环境是宿主渲染帧（web 侧），
    // 不是 Node：按事实声明浏览器全局，避免 `no-undef` 在打包面上误判。
    files: ['plugins/**/render.js', 'examples/plugins/**/render.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.config.ts'],
        },
        tsconfigRootDir: configDir,
      },
    },
    plugins: {
      'import-x': importX,
    },
    settings: {
      'import-x/extensions': ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'],
      'import-x/resolver': {
        typescript: true,
      },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'import-x/no-cycle': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedImportPaths,
          patterns: restrictedImportPatterns,
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: restrictedImportPathsForUi,
          patterns: restrictedImportPatternsForUi,
        },
      ],
    },
  },
  {
    files: ['packages/antd/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@chips/*', '@chips/*/*'],
              message: 'fork antd 禁止依赖任何 @chips/* 包，只允许 react 与上游 antd 依赖',
            },
            {
              group: ['@mui/**', '@chakra-ui/**'],
              message: '禁止引入第二套组件库，请从 @chips/ui 导入',
            },
          ],
        },
      ],
    },
  },
  prettierConfig
);
