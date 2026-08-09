# Data-Form P0 第一批组件规范

## 1. 范围

本规范记录阶段七第一批 Data-Form 能力的当前正式口径：

- `ChipsForm`
- `ChipsVirtualList`

任务016.03 已将早期字段与分组表单能力统一迁移为 `ChipsForm.Root / Section / Field / Label / Control / Error / Hint` Compound API。早期单体字段、分组 scope 与 token 源文件已归档，不再作为正式公开契约。生态对外表单标准以 `生态共用技术文档/组件库` 中的 Form 契约为准。

## 2. 统一状态与契约

组件统一继承状态优先级：

`disabled > loading > error > active > focus > hover > idle`

并强制输出 `data-scope/data-part/data-state`。

## 3. 组件规范

### 3.1 ChipsForm

- `data-scope="form"`
- `data-part="root|section|field|label|required|control|hint|error|status"`
- Compound API：
  - `Root / Section / Field / Label / Control / Error / Hint`
- 状态语义：
  - `aria-required`
  - `aria-invalid`
  - `aria-describedby`
  - `Label` 与 `Control` 通过稳定 id 关联
  - `Hint` 与 `Error` 统一进入字段级描述信息

### 3.2 ChipsVirtualList

- `data-scope="virtual-list"`
- `data-part="root|viewport|content|item|status"`
- 语义：
  - viewport：`role="list"`
  - item：`role="listitem"`
- 虚拟化：
  - 统一窗口计算：`computeVirtualWindow`
  - 支持 `overscan`
  - 支持键盘导航：`ArrowUp/ArrowDown/Home/End`

## 4. Token 映射

新增组件 token：

- `chips.comp.form.*`
- `chips.comp.virtual-list.*`

对应源文件：

- `packages/tokens/tokens/comp/form.json`
- `packages/tokens/tokens/comp/virtual-list.json`

## 5. 主题契约

对应契约：

- `packages/theme-contracts/contracts/components/form.contract.json`
- `packages/theme-contracts/contracts/components/virtual-list.contract.json`

已归档的旧字段与分组契约、token 仅用于历史追溯，不参与正式 contract 校验和主题包构建。

## 6. 验证结果（2026-03-05）

- token 校验通过
- 主题契约校验通过
- 组件测试通过
- `npm run verify` 全量通过（113 token keys / 16 contracts / 83 tests）

## 7. 阶段七后续

Data-Form 第二批组件规范见：

- `20-Data-Form-P1第二批组件规范.md`
