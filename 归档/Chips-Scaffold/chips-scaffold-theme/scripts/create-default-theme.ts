import { createThemeProject } from '../src';

const main = async (): Promise<void> => {
  await createThemeProject({
    targetDir: '../../ThemePack/Chips-default',
    themeId: 'chips-official.default-theme',
    displayName: '薯片官方 · 默认主题',
    description: 'Chips 官方默认内置主题'
  });
};

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});

