# ADR-008: React + fork antd 前端技术栈

## 元数据

- **状态**: 已接受
- **日期**: 2026-09-19
- **影响范围**: 所有前端开发

---

## 决策

React + fork antd + @chips/ui 共享层作为唯一前端技术栈。

---

## 技术栈

```
插件 UI 层
  - React 组件
  - @chips/ui 共享组件
  - fork antd 基础组件
  - 简体中文直写
        ↕
@chips/ui (共享层)
  - 基于 fork antd 封装
  - 薯片特有组件
  - Design Tokens 集成
        ↕
fork antd (基础组件库)
  - Button、Input、Select 等
  - 薯片生态专属 fork
        ↕
React 18+
  - Hooks
  - TypeScript
```

---

## fork antd 实施

### 目录结构

```
packages/
├── antd-fork/              # fork 的 antd
│   ├── components/         # 所有组件
│   ├── style/              # 样式系统
│   └── package.json        # @chips/antd
│
└── ui/                     # @chips/ui 共享层
    ├── components/         # 薯片特有组件
    ├── hooks/              # 共享 Hooks
    ├── tokens/             # Design Tokens
    └── package.json
```

### fork 策略

```bash
# Fork antd 仓库
git clone https://github.com/ant-design/ant-design.git antd-fork
cd antd-fork
git checkout -b chips-fork

# 修改 package.json
{
  "name": "@chips/antd",
  "version": "5.0.0-chips.1"
}

# 深度定制
# - 移除国际化
# - 深度集成 Design Tokens
# - 移除不需要的组件
```

---

## @chips/ui 共享层

### 基础组件封装

```typescript
// packages/ui/src/components/Button/index.tsx
import { Button as AntdButton, ButtonProps } from '@chips/antd';

export const Button: React.FC<ButtonProps> = (props) => {
  return <AntdButton {...props} />;
};
```

### 薯片特有组件

```typescript
// packages/ui/src/components/CardView/index.tsx
export interface CardViewProps {
  cardId: string;
  preview?: boolean;
  onClick?: () => void;
}

export const CardView: React.FC<CardViewProps> = ({ cardId, preview, onClick }) => {
  const cardData = useCardData(cardId);
  
  return (
    <Card onClick={onClick}>
      {preview ? <CardPreview data={cardData} /> : <CardFull data={cardData} />}
    </Card>
  );
};
```

---

## 架构红线

### 红线 1：唯一组件库

```typescript
// ✅ 允许
import { Button } from '@chips/ui';

// ❌ 禁止
import { Button } from '@chips/antd';   // 仅 packages/ui 内部可使用，业务代码必须通过 @chips/ui
import { Button } from 'antd';          // 禁止直接使用 antd
import { Button } from '@mui/material'; // 禁止第二套组件库
```

### 红线 2：禁止硬编码样式

```typescript
// ❌ 禁止
<div style={{ color: '#1890ff' }}>文本</div>

// ✅ 正确：使用 Design Tokens
import { theme } from '@chips/ui';
const { token } = theme.useToken();
<div style={{ color: token.colorPrimary }}>文本</div>
```

### 红线 3：简体中文直写

```typescript
// ❌ 禁止
<Button>{t('save')}</Button>

// ✅ 正确
<Button>保存</Button>
```

---

## ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['antd', 'antd/*'],
            message: '禁止直接使用 antd，请从 @chips/ui 导入',
          },
          {
            group: ['@chips/antd', '@chips/antd/*'],
            message: '仅 packages/ui 内部可直接使用 @chips/antd，业务代码请从 @chips/ui 导入',
          },
          {
            group: ['@mui/*', '@chakra-ui/*'],
            message: '不允许引入第二套组件库',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // packages/ui 是 @chips/antd（fork antd）的唯一合法使用方
      files: ['packages/ui/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['antd', 'antd/*'],
                message: '请从 @chips/antd（fork antd）导入',
              },
              {
                group: ['@mui/*', '@chakra-ui/*'],
                message: '不允许引入第二套组件库',
              },
            ],
          },
        ],
      },
    },
  ],
};
```

---

## 实施要求

### Phase 1: fork antd

- Fork ant-design 仓库
- 创建 chips-fork 分支
- 修改 package.json
- 移除国际化

### Phase 2: @chips/ui

- 创建共享层项目
- 封装基础组件
- 实现薯片特有组件
- 类型定义

### Phase 3: 工具链

- ESLint 规则配置
- 脚手架模板
- 组件文档

---

---

## 现状注记

> 本节记录本 ADR 之后由正式文档落实或修订的口径，不修改上文原文。

1. React + antd（fork）+ `@chips/ui` 的唯一技术栈决策保持有效；落地规范以[02-TypeScript编码规范](../../02-开发规范/02-TypeScript编码规范.md)、[03-React组件开发规范](../../02-开发规范/03-React组件开发规范.md)与生态共用技术文档的前端基础规范为准。
2. 主题系统与多语言系统已废弃（[ADR-006](ADR-006-主题系统与多语言系统.md)）：删除 `useTheme` / `ThemeContext` / CSS Modules / `styles.css` 等残留，统一 Design Tokens + `theme.useToken()` + `@chips/ui` 主题定制；界面文案简体中文直写。
3. 示例组件 `CardView` 因与渲染视图命名冲突更名：渲染视图统一为 `CardRenderView` / `BoxRenderView`（[03-核心接口规范](../../05-接口与契约/03-核心接口规范.md) §6.6），业务展示组件使用不冲突的名称（如 `CardPreviewTile`）。
4. fork antd 的包名、目录与依赖方向以[01-代码组织规范](../../02-开发规范/01-代码组织规范.md)与[02-构建与打包](../../06-开发与运维/02-构建与打包.md)为准；禁止引入第二套组件库（R4）。
5. 示例版本号 `5.0.0-chips.1` 作废：平台与插件版本统一为语义化版本（平台版本起点 `0.1.0`），fork 包的版本口径与依赖方向以后续正式工程文档为准（[04-版本与迁移规范](../../04-文件格式规范/04-版本与迁移规范.md) §2、[01-代码组织规范](../../02-开发规范/01-代码组织规范.md)）。

**文档结束**
