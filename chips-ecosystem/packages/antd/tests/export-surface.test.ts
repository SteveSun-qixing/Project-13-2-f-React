import { describe, expect, it } from 'vitest';
import type {
  AlertProps,
  AppProps,
  AvatarProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  CheckboxProps,
  CollapseProps,
  DatePickerProps,
  DescriptionsProps,
  DividerProps,
  DrawerProps,
  DropdownProps,
  EmptyProps,
  FlexProps,
  FormInstance,
  FormItemProps,
  FormProps,
  GetProp,
  GetProps,
  GetRef,
  GlobalToken,
  ImageProps,
  InputProps,
  InputRef,
  ListProps,
  MappingAlgorithm,
  MenuProps,
  ModalProps,
  PaginationProps,
  PopoverProps,
  ProgressProps,
  RadioGroupProps,
  RadioProps,
  RateProps,
  ResultProps,
  SegmentedProps,
  SelectProps,
  SkeletonProps,
  SliderRangeProps,
  SliderSingleProps,
  SpaceProps,
  SpinProps,
  StepsProps,
  SwitchProps,
  TableColumnType,
  TableColumnsType,
  TableProps,
  TabsProps,
  TagProps,
  ThemeConfig,
  TimelineItemProps,
  TimelineProps,
  TooltipProps,
  TypographyProps,
  UploadProps,
  ChipsThemeRootProps,
  ChipsThemeComponent,
} from '../src/index';
import * as chipsAntd from '../src/index';

/** 编译期导出面清单：任一类型不再导出时本文件类型检查失败。 */
export type ExportSurfaceTypes = [
  AlertProps,
  AppProps,
  AvatarProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  CheckboxProps,
  CollapseProps,
  DatePickerProps,
  DescriptionsProps,
  DividerProps,
  DrawerProps,
  DropdownProps,
  EmptyProps,
  FlexProps,
  FormInstance,
  FormItemProps,
  FormProps,
  GetProp<typeof chipsAntd.Button, 'type'>,
  GetProps<typeof chipsAntd.Button>,
  GetRef<typeof chipsAntd.Button>,
  GlobalToken,
  ImageProps,
  InputProps,
  InputRef,
  ListProps<Record<string, never>>,
  MappingAlgorithm,
  MenuProps,
  ModalProps,
  PaginationProps,
  PopoverProps,
  ProgressProps,
  RadioGroupProps,
  RadioProps,
  RateProps,
  ResultProps,
  SegmentedProps,
  SelectProps,
  SkeletonProps,
  SliderRangeProps,
  SliderSingleProps,
  SpaceProps,
  SpinProps,
  StepsProps,
  SwitchProps,
  TableColumnType<Record<string, never>>,
  TableColumnsType<Record<string, never>>,
  TableProps<Record<string, never>>,
  TabsProps,
  TagProps,
  ThemeConfig,
  TimelineItemProps,
  TimelineProps,
  TooltipProps,
  TypographyProps,
  UploadProps,
  ChipsThemeRootProps,
  ChipsThemeComponent,
];

const COMPONENT_EXPORTS = [
  'Alert',
  'App',
  'Avatar',
  'Badge',
  'Button',
  'Card',
  'Checkbox',
  'Collapse',
  'DatePicker',
  'Descriptions',
  'Divider',
  'Drawer',
  'Dropdown',
  'Empty',
  'Flex',
  'Form',
  'Image',
  'Input',
  'InputNumber',
  'List',
  'Menu',
  'Modal',
  'Pagination',
  'Popover',
  'Progress',
  'Radio',
  'Rate',
  'Result',
  'Segmented',
  'Select',
  'Skeleton',
  'Slider',
  'Space',
  'Spin',
  'Steps',
  'Switch',
  'Table',
  'Tabs',
  'Tag',
  'Timeline',
  'Tooltip',
  'Typography',
  'Upload',
] as const;

const THEME_EXPORTS = [
  'ChipsThemeRoot',
  'CHIPS_CSS_VAR_KEY',
  'CHIPS_CSS_VAR_PREFIX',
  'toChipsCssVarName',
  'CHIPS_THEME_COMPONENT_ALLOWLIST',
  'CHIPS_THEME_CONFIG_KEYS',
  'ChipsThemeConfigError',
  'validateChipsThemeConfig',
  'theme',
] as const;

const FORBIDDEN_ANTD_EXPORTS = [
  'ConfigProvider',
  'Layout',
  'Breadcrumb',
  'Anchor',
  'Affix',
  'AutoComplete',
  'BackTop',
  'Calendar',
  'Carousel',
  'Cascader',
  'ColorPicker',
  'FloatButton',
  'Mentions',
  'Popconfirm',
  'QRCode',
  'Splitter',
  'Statistic',
  'TimePicker',
  'Tour',
  'Transfer',
  'Tree',
  'TreeSelect',
  'Watermark',
  'message',
  'notification',
  'modal',
  'version',
] as const;

describe('导出面契约', () => {
  it('白名单组件全部导出且可渲染为组件', () => {
    for (const name of COMPONENT_EXPORTS) {
      expect(chipsAntd[name], `缺少组件导出：${name}`).toBeDefined();
    }
  });

  it('主题桥接导出齐全', () => {
    for (const name of THEME_EXPORTS) {
      expect(chipsAntd[name], `缺少主题导出：${name}`).toBeDefined();
    }
  });

  it('白名单之外的 antd 组件与静态实例不进入导出面', () => {
    for (const name of FORBIDDEN_ANTD_EXPORTS) {
      expect(name in chipsAntd, `禁止出现导出：${name}`).toBe(false);
    }
  });

  it('组件静态成员随组件值转发', () => {
    expect(chipsAntd.Form.Item).toBeDefined();
    expect(typeof chipsAntd.Form.useForm).toBe('function');
    expect(chipsAntd.Input.TextArea).toBeDefined();
    expect(chipsAntd.Input.Password).toBeDefined();
    expect(chipsAntd.Typography.Title).toBeDefined();
    expect(chipsAntd.Typography.Text).toBeDefined();
    expect(chipsAntd.Typography.Paragraph).toBeDefined();
    expect(typeof chipsAntd.App.useApp).toBe('function');
    expect(typeof chipsAntd.theme.useToken).toBe('function');
  });

  it('配套图标集整集再导出', () => {
    expect(chipsAntd.SaveOutlined).toBeDefined();
    expect(chipsAntd.SettingOutlined).toBeDefined();
    expect(chipsAntd.PlusOutlined).toBeDefined();
    const iconExportCount = Object.keys(chipsAntd).filter((name) =>
      /(Outlined|Filled|TwoTone)$/.test(name)
    ).length;
    expect(iconExportCount).toBeGreaterThan(300);
  });
});
