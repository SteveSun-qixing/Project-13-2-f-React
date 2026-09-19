import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['antd', 'antd/*', '@chips/antd', '@chips/antd/*', '@mui/*', '@chakra-ui/*'],
              message: 'CLI 不引入前端组件库',
            },
            {
              group: ['electron', 'electron/*'],
              message: 'CLI 不依赖 Electron，平台访问一律经 CliClient 端口',
            },
            {
              group: ['@chips/host', '@chips/host/*', '@chips/ui', '@chips/ui/*'],
              message: 'CLI 不直连宿主与共享层，平台访问一律经 CliClient 端口',
            },
          ],
        },
      ],
    },
  },
);
