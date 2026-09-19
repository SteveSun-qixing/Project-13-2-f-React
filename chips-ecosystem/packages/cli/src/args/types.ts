/**
 * 参数模型类型（[CLI 完整参考] §5.2）：
 * 11 种参数类型、`position` / `short` / `mapsTo` / `default` / `choices` / `multiple` /
 * `validation` / `path` / `batch` / `ui` 的声明形状。内建命令与插件命令共用同一模型。
 */

/** 参数类型（11 种）。 */
export type CliParameterType =
  | 'string'
  | 'stringList'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'enum'
  | 'path'
  | 'json'
  | 'jsonFile'
  | 'text'
  | 'textFile';

/** 路径规则（[CLI 完整参考] §5.2）。 */
export interface IPathRules {
  readonly kind?: 'file' | 'directory' | 'any';
  readonly role?: 'input' | 'output';
  readonly exists?: boolean;
  readonly create?: boolean;
  readonly extensions?: readonly string[];
  readonly overwrite?: 'fail' | 'overwrite' | 'rename' | 'skip';
}

/** 批量规则（[CLI 完整参考] §5.2）。 */
export interface IBatchRules {
  readonly format?: 'lines' | 'json-array';
  readonly itemType?: 'value' | 'path';
  readonly itemPath?: IPathRules;
}

/** TUI 控件提示（[CLI 完整参考] §5.2）。 */
export interface IUiControl {
  readonly control?:
    | 'select'
    | 'multiSelect'
    | 'toggle'
    | 'stepper'
    | 'slider'
    | 'pathInput'
    | 'pasteBox'
    | 'textarea';
  readonly choices?: readonly unknown[];
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly placeholder?: string;
}

/** 取值校验规则。 */
export interface IValidationRules {
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
}

/** 单个参数声明。 */
export interface IParameterDeclaration {
  readonly name: string;
  readonly short?: string;
  readonly type: CliParameterType;
  /** 仅位置参数：非负整数，同命令内唯一。 */
  readonly position?: number;
  readonly required?: boolean;
  readonly default?: unknown;
  /** payload 点分路径；缺省为参数名。 */
  readonly mapsTo?: string;
  readonly choices?: readonly unknown[];
  readonly multiple?: boolean;
  readonly validation?: IValidationRules;
  readonly path?: IPathRules;
  readonly batch?: IBatchRules;
  readonly ui?: IUiControl;
}

/** 一个命令的参数集合。 */
export interface IParameterSet {
  readonly arguments?: readonly IParameterDeclaration[];
  readonly options?: readonly IParameterDeclaration[];
}

/** 输出冲突策略。 */
export type OutputOverwritePolicy = 'fail' | 'overwrite' | 'rename' | 'skip';
