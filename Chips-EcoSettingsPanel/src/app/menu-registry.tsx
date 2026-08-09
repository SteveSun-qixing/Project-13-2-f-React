import type { ReactElement } from "react";
import { AppPluginsPage } from "../features/app-plugins/AppPluginsPage";
import { ComponentGalleryPage } from "../features/component-gallery/ComponentGalleryPage";
import { PreviewQualityPage } from "../features/preview-quality/PreviewQualityPage";
import { CardPluginsPage } from "../features/runtime-plugins/CardPluginsPage";
import { LayoutPluginsPage } from "../features/runtime-plugins/LayoutPluginsPage";
import { ModulePluginsPage } from "../features/runtime-plugins/ModulePluginsPage";

export type MenuId =
  | "app-plugins"
  | "card-plugins"
  | "layout-plugins"
  | "module-plugins"
  | "preview-quality"
  | "component-gallery";

export type SettingsCategory = "插件" | "开发者";

export interface MenuRegistration {
  id: MenuId;
  title: string;
  summary: string;
  category: SettingsCategory;
  order: number;
  render: () => ReactElement;
}

const MENU_ENTRIES: MenuRegistration[] = [
  {
    id: "app-plugins",
    title: "应用插件",
    summary: "安装、启停、卸载应用插件",
    category: "插件",
    order: 40,
    render: () => <AppPluginsPage />,
  },
  {
    id: "card-plugins",
    title: "卡片插件",
    summary: "安装、启停、卸载基础卡片插件",
    category: "插件",
    order: 50,
    render: () => <CardPluginsPage />,
  },
  {
    id: "layout-plugins",
    title: "布局插件",
    summary: "安装、启停、卸载布局插件",
    category: "插件",
    order: 60,
    render: () => <LayoutPluginsPage />,
  },
  {
    id: "module-plugins",
    title: "模块插件",
    summary: "安装、启停、卸载模块插件",
    category: "插件",
    order: 70,
    render: () => <ModulePluginsPage />,
  },
  {
    id: "preview-quality",
    title: "预览与质量",
    summary: "查看预览、Contract 与质量报告入口",
    category: "开发者",
    order: 100,
    render: () => <PreviewQualityPage />,
  },
  {
    id: "component-gallery",
    title: "组件展示",
    summary: "平铺展示全部基础组件，用于生态 UI 设计细节调整",
    category: "开发者",
    order: 110,
    render: () => <ComponentGalleryPage />,
  },
];

export const MENU_REGISTRY: MenuRegistration[] = MENU_ENTRIES.sort((left, right) => left.order - right.order);
