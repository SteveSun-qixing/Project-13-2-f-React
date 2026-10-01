/**
 * 基础组件白名单：fork antd 对 `@chips/ui` 开放的全部组件与 Props 类型。
 *
 * - 白名单之外的 antd 组件不在本包导出面内；新增组件必须先更新本文件与
 *   `tests/export-surface.test.ts` 的导出面契约，再更新《08-@chips-ui共享层使用指南》。
 * - 组件静态成员（`Form.Item`、`Form.useForm`、`Input.TextArea`、`Typography.Title` 等）
 *   随组件值转发，无需逐个声明。
 */

export { Alert } from 'antd';
export type { AlertProps } from 'antd';
export { App } from 'antd';
export type { AppProps } from 'antd';
export { Avatar } from 'antd';
export type { AvatarProps } from 'antd';
export { Badge } from 'antd';
export type { BadgeProps } from 'antd';
export { Button } from 'antd';
export type { ButtonProps } from 'antd';

export { Card } from 'antd';
export type { CardProps } from 'antd';
export { Checkbox } from 'antd';
export type { CheckboxProps } from 'antd';
export { Collapse } from 'antd';
export type { CollapseProps } from 'antd';

export { DatePicker } from 'antd';
export type { DatePickerProps } from 'antd';
export { Descriptions } from 'antd';
export type { DescriptionsProps } from 'antd';
export { Divider } from 'antd';
export type { DividerProps } from 'antd';
export { Drawer } from 'antd';
export type { DrawerProps } from 'antd';
export { Dropdown } from 'antd';
export type { DropdownProps } from 'antd';

export { Empty } from 'antd';
export type { EmptyProps } from 'antd';

export { Flex } from 'antd';
export type { FlexProps } from 'antd';
export { Form } from 'antd';
export type { FormInstance, FormItemProps, FormProps } from 'antd';

export { Image } from 'antd';
export type { ImageProps } from 'antd';
export { Input } from 'antd';
export type { InputProps, InputRef } from 'antd';
export { InputNumber } from 'antd';
export type { InputNumberProps } from 'antd';

export { List } from 'antd';
export type { ListProps } from 'antd';

export { Menu } from 'antd';
export type { MenuProps } from 'antd';
export { Modal } from 'antd';
export type { ModalProps } from 'antd';

export { Pagination } from 'antd';
export type { PaginationProps } from 'antd';
export { Popover } from 'antd';
export type { PopoverProps } from 'antd';
export { Progress } from 'antd';
export type { ProgressProps } from 'antd';

export { Radio } from 'antd';
export type { RadioGroupProps, RadioProps } from 'antd';
export { Rate } from 'antd';
export type { RateProps } from 'antd';
export { Result } from 'antd';
export type { ResultProps } from 'antd';

export { Segmented } from 'antd';
export type { SegmentedProps } from 'antd';
export { Select } from 'antd';
export type { SelectProps } from 'antd';
export { Skeleton } from 'antd';
export type { SkeletonProps } from 'antd';
export { Slider } from 'antd';
export type { SliderRangeProps, SliderSingleProps } from 'antd';
export { Space } from 'antd';
export type { SpaceProps } from 'antd';
export { Spin } from 'antd';
export type { SpinProps } from 'antd';
export { Steps } from 'antd';
export type { StepsProps } from 'antd';
export { Switch } from 'antd';
export type { SwitchProps } from 'antd';

export { Table } from 'antd';
export type { TableColumnType, TableColumnsType, TableProps } from 'antd';
export { Tabs } from 'antd';
export type { TabsProps } from 'antd';
export { Tag } from 'antd';
export type { TagProps } from 'antd';
export { Timeline } from 'antd';
export type { TimelineItemProps, TimelineProps } from 'antd';
export { Tooltip } from 'antd';
export type { TooltipProps } from 'antd';
export { Typography } from 'antd';
export type { TypographyProps } from 'antd';

export { Upload } from 'antd';
export type { UploadProps } from 'antd';

export type { GetProp, GetProps, GetRef } from 'antd';
