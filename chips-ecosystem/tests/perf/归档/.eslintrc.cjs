module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  plugins: ['@typescript-eslint'],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          { group: ['antd', 'antd/*'], message: '请使用 @chips/ui' },
          {
            group: ['@chips/antd', '@chips/antd/*'],
            message: '仅 packages/ui 可直接使用 @chips/antd',
          },
          { group: ['@mui/*', '@chakra-ui/*'], message: '禁止引入第二套组件库' },
        ],
      },
    ],
  },
};
