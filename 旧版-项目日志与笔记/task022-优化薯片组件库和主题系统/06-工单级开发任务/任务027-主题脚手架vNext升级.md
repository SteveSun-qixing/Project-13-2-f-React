# 任务027：主题脚手架 vNext 升级

## 1. 任务目标

升级 `chips-scaffold-theme`，让新建主题包默认满足五层 token、组件 contract、图标字体、motion、构建、校验和 Host 安装运行标准。

## 2. 对应阶段任务

- `05-开发任务方案/任务24-主题包全量升级与视觉一致性.md`
- `05-开发任务方案/任务25-全类型脚手架升级.md`

## 3. 涉及项目

- `Chips-Scaffold/chips-scaffold-theme`
- `ThemePack/*`
- `Chips-ComponentLibrary/packages/tokens`
- `Chips-ComponentLibrary/packages/theme-contracts`
- `Chips-Host`
- `生态共用技术文档/主题系统`

## 4. 开发内容

1. 重新核对主题脚手架模板、测试和两个正式主题包。
2. 默认生成 `tokens/ref.json`、`tokens/sys.json`、`tokens/motion.json`、`tokens/layout.json`、`tokens/comp/*.json`。
3. 默认生成 `src/build-tokens.ts`、`src/build-css.ts`、`src/validate-theme.ts` 和 contract 测试。
4. 默认生成 `manifest.yaml` 中 `type: theme`、entry、displayName、themeId、runtime 相关字段。
5. 默认携带图标字体目录约定、SOURCE 说明和运行时 CSS 输出规则。
6. 默认接入组件库正式 theme contract 校验，不维护脚手架私有最小 token 列表。
7. 增加生成主题包安装到 Host 开发工作区后的 smoke 测试。

## 5. 验收标准

- 新主题包可以构建 `dist/tokens.json` 与 `dist/theme.css`。
- 新主题包可以通过 Host 安装、启用、切换和 contract 校验。
- 生成主题包与默认/暗色主题包结构一致。
- 主题脚手架不会生成跨生态未冻结协议。

## 6. 验证命令

```bash
cd Chips-Scaffold/chips-scaffold-theme
npm run build
npm test

cd ../../ThemePack/Chips-default
npm run build
npm run validate:theme
```

## 7. 注意事项

- 主题脚手架只生成主题包工程，不生成应用视觉业务代码。
- 本任务开发前必须重新核对主题系统公共文档、正式主题包代码和 Host 主题服务。
