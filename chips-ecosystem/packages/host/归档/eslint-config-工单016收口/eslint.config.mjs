import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '归档/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // 包内脚本（构建、清理）运行在 Node 环境。
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['antd', 'antd/*'], message: '禁止直接使用 antd，请从 @chips/ui 导入' },
            {
              group: ['@chips/antd', '@chips/antd/*'],
              message: '禁止直接导入 @chips/antd，请从 @chips/ui 导入',
            },
            { group: ['@mui/*', '@chakra-ui/*'], message: '禁止引入第二套组件库' },
            { group: ['electron/*'], message: 'Electron 只允许从 electron 包入口导入' },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
