/**
 * 内容变更判定：从 Univer 命令流中区分「用户编辑产生的内容变更」与
 * 「引擎内部 / 纯视图状态变更」。
 *
 * Univer 的命令分三类：COMMAND（业务编排）、MUTATION（写入快照的可撤销变更）、
 * OPERATION（不进快照的视图状态，如滚动 / 选中 / 缩放）。保存链路只关心
 * MUTATION；其中公式引擎的重算回写、渲染期的派生布局与内部簿记突变不代表
 * 用户编辑，需要排除，避免打开文件后修改标记被误点亮。defined-name 增删属于
 * 用户操作（名称管理器），虽在 formula 命名空间下仍视为内容变更。
 */
import { CommandType, type CommandListener, type ICommandInfo } from "@univerjs/core";

/** 引擎内部回写与派生状态突变：不代表用户编辑，不点亮修改标记 */
const IGNORED_MUTATION_IDS = new Set<string>([
  "sheet.mutation.empty",
  "sheet.mutation.mark-dirty-filter-change",
  "sheet.mutation.data-validation-formula-mark-dirty",
  "sheet.mutation.set-gridlines-color",
  "sheet.mutation.set-worksheet-row-auto-height",
]);

const FORMULA_MUTATION_PREFIX = "formula.mutation.";
/** 公式命名空间下仍属用户编辑的突变（defined names）。 */
const FORMULA_USER_EDIT_MUTATIONS = new Set<string>([
  "formula.mutation.set-defined-name",
  "formula.mutation.remove-defined-name",
]);

export function isUserContentMutation(commandId: string, type?: CommandType): boolean {
  if (type !== CommandType.MUTATION) {
    return false;
  }
  if (IGNORED_MUTATION_IDS.has(commandId)) {
    return false;
  }
  if (commandId.startsWith(FORMULA_MUTATION_PREFIX)) {
    return FORMULA_USER_EDIT_MUTATIONS.has(commandId);
  }
  return true;
}

/** 把内容变更判定装配成命令监听器（onCommandExecuted 直接可用）。 */
export function createContentChangeListener(onChange: () => void): CommandListener {
  return (command: Readonly<ICommandInfo>): void => {
    if (isUserContentMutation(command.id, command.type)) {
      onChange();
    }
  };
}
