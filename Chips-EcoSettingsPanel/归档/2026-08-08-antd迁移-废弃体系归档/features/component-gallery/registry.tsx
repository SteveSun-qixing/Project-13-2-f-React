import React from "react";
import {
  ChipsButton,
  ChipsCardShell,
  ChipsCheckbox,
  ChipsCommandPalette,
  ChipsDataGrid,
  ChipsDateTime,
  ChipsDialog,
  ChipsDockPanel,
  ChipsEmptyState,
  ChipsErrorBoundary,
  ChipsForm,
  ChipsInspector,
  ChipsInput,
  ChipsLoadingBoundary,
  ChipsMenu,
  ChipsMenuBar,
  ChipsContextMenu,
  ChipsNotification,
  ChipsPanelHeader,
  ChipsPopover,
  ChipsRadioGroup,
  ChipsSelect,
  ChipsSkeleton,
  ChipsSplitPane,
  ChipsSwitch,
  ChipsTabs,
  ChipsToast,
  ChipsTooltip,
  ChipsToolWindow,
  ChipsTree,
  ChipsNavigationSplitView,
  ChipsShortcut,
  ChipsToolbar,
  ChipsVirtualList,
  P0_BASE_INTERACTIVE_COMPONENTS,
  P0_DATA_FORM_COMPONENTS,
  STAGE7_DATA_ADVANCED_COMPONENTS,
  STAGE7_WORKBENCH_COMPONENTS,
  STAGE8_SYSTEM_UX_COMPONENTS,
} from "@chips/component-library";
import { useI18n } from "../../app/providers/I18nProvider";
import { useRuntimeContext } from "../../app/providers/RuntimeProvider";

export interface ComponentPreviewRegistration {
  name: string;
  scope: string;
  parts: string[];
  summaryKey: string;
  emphasis: "hero" | "wide" | "standard";
  preview: () => React.ReactElement;
}

export interface ComponentGroup {
  id: string;
  titleKey: string;
  descriptionKey: string;
  items: ComponentPreviewRegistration[];
}

interface ComponentCatalogItem {
  name: string;
  scope: string;
  parts: string[];
}

function PreviewShell({ children }: React.PropsWithChildren): React.ReactElement {
  return <div className="gallery-preview">{children}</div>;
}

function useThemeTokenPreview(variableName: string, fallback: string): string {
  const { currentTheme } = useRuntimeContext();
  const [value, setValue] = React.useState(fallback);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextValue = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    setValue(nextValue || fallback);
  }, [currentTheme?.themeId, currentTheme?.version, fallback, variableName]);

  return value;
}

function ButtonPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsButton>{t("settingsPanel.gallery.preview.button.action")}</ChipsButton>
    </PreviewShell>
  );
}

function InputPreview(): React.ReactElement {
  const { t } = useI18n();
  const [value, setValue] = React.useState(t("settingsPanel.gallery.preview.input.value"));
  return (
    <PreviewShell>
      <ChipsInput
        value={value}
        placeholder={t("settingsPanel.gallery.preview.input.placeholder")}
        onValueChange={setValue}
      />
    </PreviewShell>
  );
}

function CheckboxPreview(): React.ReactElement {
  const { t } = useI18n();
  const [checked, setChecked] = React.useState(true);
  return (
    <PreviewShell>
      <ChipsCheckbox
        checked={checked}
        label={t("settingsPanel.gallery.preview.checkbox.label")}
        onCheckedChange={setChecked}
      />
    </PreviewShell>
  );
}

function RadioPreview(): React.ReactElement {
  const { t } = useI18n();
  const [value, setValue] = React.useState("compact");
  return (
    <PreviewShell>
      <ChipsRadioGroup
        name="layout-mode"
        value={value}
        onValueChange={setValue}
        options={[
          { value: "compact", label: t("settingsPanel.gallery.preview.radio.compact") },
          { value: "comfortable", label: t("settingsPanel.gallery.preview.radio.comfortable") },
        ]}
      />
    </PreviewShell>
  );
}

function SwitchPreview(): React.ReactElement {
  const { t } = useI18n();
  const [checked, setChecked] = React.useState(false);
  return (
    <PreviewShell>
      <ChipsSwitch
        checked={checked}
        label={t("settingsPanel.gallery.preview.switch.label")}
        onCheckedChange={setChecked}
      />
    </PreviewShell>
  );
}

function SelectPreview(): React.ReactElement {
  const { t } = useI18n();
  const [value, setValue] = React.useState("light");
  return (
    <PreviewShell>
      <ChipsSelect
        value={value}
        placeholder={t("settingsPanel.gallery.preview.select.placeholder")}
        onValueChange={setValue}
        options={[
          { value: "light", label: t("settingsPanel.gallery.preview.select.light") },
          { value: "dark", label: t("settingsPanel.gallery.preview.select.dark") },
          { value: "system", label: t("settingsPanel.gallery.preview.select.system") },
        ]}
      />
    </PreviewShell>
  );
}

function DialogPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsDialog
        triggerContent={t("settingsPanel.gallery.preview.dialog.trigger")}
        title={t("settingsPanel.gallery.preview.dialog.title")}
        description={t("settingsPanel.gallery.preview.dialog.description")}
      >
        <div className="gallery-inline-stack">
          <ChipsButton>{t("settingsPanel.gallery.preview.dialog.confirm")}</ChipsButton>
        </div>
      </ChipsDialog>
    </PreviewShell>
  );
}

function PopoverPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsPopover triggerContent={t("settingsPanel.gallery.preview.popover.trigger")}>
        <div className="gallery-inline-stack">
          <strong>{t("settingsPanel.gallery.preview.popover.title")}</strong>
          <span>{t("settingsPanel.gallery.preview.popover.description")}</span>
        </div>
      </ChipsPopover>
    </PreviewShell>
  );
}

function TabsPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsTabs
        items={[
          {
            value: "theme",
            label: t("settingsPanel.gallery.preview.tabs.themeLabel"),
            content: <span>{t("settingsPanel.gallery.preview.tabs.themeContent")}</span>,
          },
          {
            value: "layout",
            label: t("settingsPanel.gallery.preview.tabs.layoutLabel"),
            content: <span>{t("settingsPanel.gallery.preview.tabs.layoutContent")}</span>,
          },
        ]}
      />
    </PreviewShell>
  );
}

function MenuPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsMenu
        triggerContent={t("settingsPanel.gallery.preview.menu.trigger")}
        items={[
          { value: "rename", label: t("settingsPanel.gallery.preview.menu.rename") },
          { value: "duplicate", label: t("settingsPanel.gallery.preview.menu.duplicate") },
        ]}
      />
    </PreviewShell>
  );
}

function TooltipPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsTooltip
        triggerContent={t("settingsPanel.gallery.preview.tooltip.trigger")}
        content={t("settingsPanel.gallery.preview.tooltip.content")}
      />
    </PreviewShell>
  );
}

function getGalleryCommands(t: (key: string, params?: Record<string, string | number>) => string) {
  return [
    {
      commandId: "settings.gallery.theme",
      titleKey: "settingsPanel.gallery.preview.commands.theme",
      descriptionKey: "settingsPanel.gallery.preview.commands.themeDescription",
      shortcut: "⌘T",
      menuPlacement: [{ menuId: "settings", groupId: "governance", order: 10 }],
      toolbarPlacement: [{ toolbarId: "gallery", groupId: "primary", order: 10 }],
      paletteKeywords: [t("settingsPanel.gallery.preview.commands.keywordTheme")],
    },
    {
      commandId: "settings.gallery.plugins",
      titleKey: "settingsPanel.gallery.preview.commands.plugins",
      descriptionKey: "settingsPanel.gallery.preview.commands.pluginsDescription",
      shortcut: "⌘P",
      menuPlacement: [{ menuId: "settings", groupId: "governance", order: 20 }],
      toolbarPlacement: [{ toolbarId: "gallery", groupId: "primary", order: 20 }],
      paletteKeywords: [t("settingsPanel.gallery.preview.commands.keywordPlugins")],
    },
  ];
}

function ToolbarPreview(): React.ReactElement {
  const { t } = useI18n();
  const commands = getGalleryCommands(t);
  return (
    <PreviewShell>
      <ChipsToolbar commands={commands} i18n={t} toolbarId="gallery" ariaLabel={t("settingsPanel.gallery.preview.toolbar.ariaLabel")} />
    </PreviewShell>
  );
}

function MenuBarPreview(): React.ReactElement {
  const { t } = useI18n();
  const commands = getGalleryCommands(t);
  return (
    <PreviewShell>
      <ChipsMenuBar
        commands={commands}
        i18n={t}
        menus={[{ menuId: "settings", label: t("settingsPanel.gallery.preview.menuBar.settings") }]}
        ariaLabel={t("settingsPanel.gallery.preview.menuBar.ariaLabel")}
      />
    </PreviewShell>
  );
}

function ContextMenuPreview(): React.ReactElement {
  const { t } = useI18n();
  const commands = getGalleryCommands(t);
  return (
    <PreviewShell>
      <ChipsContextMenu commands={commands} i18n={t} menuId="settings" triggerContent={t("settingsPanel.gallery.preview.contextMenu.trigger")} />
    </PreviewShell>
  );
}

function ShortcutPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsShortcut shortcut="⌘⇧K" ariaLabel={t("settingsPanel.gallery.preview.shortcut.ariaLabel")} />
    </PreviewShell>
  );
}

function FormPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsForm.Root>
        <ChipsForm.Section
          title={t("settingsPanel.gallery.preview.form.title")}
          description={t("settingsPanel.gallery.preview.form.description")}
        >
          <ChipsForm.Field name="workspace" required>
            <ChipsForm.Label>{t("settingsPanel.gallery.preview.form.workspaceLabel")}</ChipsForm.Label>
            <ChipsForm.Control as="input" defaultValue={t("settingsPanel.gallery.preview.form.workspaceValue")} />
            <ChipsForm.Hint>{t("settingsPanel.gallery.preview.form.workspaceHint")}</ChipsForm.Hint>
          </ChipsForm.Field>
          <ChipsForm.Field name="startup">
            <ChipsForm.Label>{t("settingsPanel.gallery.preview.form.startupLabel")}</ChipsForm.Label>
            <ChipsForm.Hint>{t("settingsPanel.gallery.preview.form.startupHint")}</ChipsForm.Hint>
            <div className="gallery-inline-stack">
              <ChipsCheckbox defaultChecked label={t("settingsPanel.gallery.preview.form.restoreTheme")} />
              <ChipsCheckbox label={t("settingsPanel.gallery.preview.form.openDashboard")} />
            </div>
          </ChipsForm.Field>
        </ChipsForm.Section>
      </ChipsForm.Root>
    </PreviewShell>
  );
}

function VirtualListPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsVirtualList
        height={180}
        items={Array.from({ length: 12 }, (_, index) => ({
          value: index,
          label: t("settingsPanel.gallery.preview.virtualList.item", { index: index + 1 }),
        }))}
      />
    </PreviewShell>
  );
}

function DataGridPreview(): React.ReactElement {
  const { t } = useI18n();
  const surfaceToken = useThemeTokenPreview("--chips-sys-color-surface", "var(--chips-sys-color-surface)");
  const primaryToken = useThemeTokenPreview("--chips-sys-color-primary", "var(--chips-sys-color-primary)");
  return (
    <PreviewShell>
      <ChipsDataGrid
        ariaLabel={t("settingsPanel.gallery.preview.dataGrid.ariaLabel")}
        columns={[
          { key: "token", label: t("settingsPanel.gallery.preview.dataGrid.token") },
          { key: "value", label: t("settingsPanel.gallery.preview.dataGrid.value") },
        ]}
        rows={[
          { id: "1", token: t("settingsPanel.gallery.preview.dataGrid.surface"), value: surfaceToken },
          { id: "2", token: t("settingsPanel.gallery.preview.dataGrid.primary"), value: primaryToken },
        ]}
      />
    </PreviewShell>
  );
}

function TreePreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsTree
        ariaLabel={t("settingsPanel.gallery.preview.tree.ariaLabel")}
        defaultExpandedIds={["appearance"]}
        nodes={[
          {
            id: "appearance",
            label: t("settingsPanel.gallery.preview.tree.appearance"),
            children: [
              { id: "theme", label: t("settingsPanel.gallery.preview.tree.theme") },
              { id: "language", label: t("settingsPanel.gallery.preview.tree.language") },
            ],
          },
          { id: "plugins", label: t("settingsPanel.gallery.preview.tree.plugins") },
        ]}
      />
    </PreviewShell>
  );
}

function DateTimePreview(): React.ReactElement {
  const { t } = useI18n();
  const [value, setValue] = React.useState("2026-03-11T10:00");
  return (
    <PreviewShell>
      <ChipsDateTime
        label={t("settingsPanel.gallery.preview.dateTime.label")}
        value={value}
        onValueChange={setValue}
      />
    </PreviewShell>
  );
}

function CommandPalettePreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsCommandPalette
        ariaLabel={t("settingsPanel.gallery.preview.commandPalette.trigger")}
        inputPlaceholder={t("settingsPanel.gallery.preview.commandPalette.searchPlaceholder")}
        items={[
          {
            id: "theme",
            title: t("settingsPanel.gallery.preview.commandPalette.openTheme"),
            keywords: [
              t("settingsPanel.gallery.preview.commandPalette.keywordTheme"),
              t("settingsPanel.gallery.preview.commandPalette.keywordAppearance"),
            ],
          },
          {
            id: "plugins",
            title: t("settingsPanel.gallery.preview.commandPalette.managePlugins"),
            keywords: [
              t("settingsPanel.gallery.preview.commandPalette.keywordPlugins"),
              t("settingsPanel.gallery.preview.commandPalette.keywordInstall"),
            ],
          },
        ]}
      />
    </PreviewShell>
  );
}

function NavigationSplitViewPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsNavigationSplitView.Root ariaLabel={t("settingsPanel.gallery.preview.navigationSplitView.ariaLabel")}>
        <ChipsNavigationSplitView.Sidebar ariaLabel={t("settingsPanel.gallery.preview.navigationSplitView.sidebar")}>
          <div className="gallery-pane">{t("settingsPanel.gallery.preview.navigationSplitView.sidebarContent")}</div>
        </ChipsNavigationSplitView.Sidebar>
        <ChipsNavigationSplitView.Content ariaLabel={t("settingsPanel.gallery.preview.navigationSplitView.content")}>
          <div className="gallery-pane">{t("settingsPanel.gallery.preview.navigationSplitView.contentBody")}</div>
        </ChipsNavigationSplitView.Content>
        <ChipsNavigationSplitView.Detail ariaLabel={t("settingsPanel.gallery.preview.navigationSplitView.detail")}>
          <div className="gallery-pane">{t("settingsPanel.gallery.preview.navigationSplitView.detailBody")}</div>
        </ChipsNavigationSplitView.Detail>
      </ChipsNavigationSplitView.Root>
    </PreviewShell>
  );
}

function SplitPanePreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsSplitPane
        ariaLabel={t("settingsPanel.gallery.preview.splitPane.ariaLabel")}
        start={<div className="gallery-pane">{t("settingsPanel.gallery.preview.splitPane.menu")}</div>}
        end={<div className="gallery-pane">{t("settingsPanel.gallery.preview.splitPane.content")}</div>}
      />
    </PreviewShell>
  );
}

function DockPanelPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsDockPanel
        ariaLabel={t("settingsPanel.gallery.preview.dockPanel.ariaLabel")}
        panels={[
          {
            id: "summary",
            title: t("settingsPanel.gallery.preview.dockPanel.summary"),
            content: <span>{t("settingsPanel.gallery.preview.dockPanel.summaryContent")}</span>,
          },
          {
            id: "logs",
            title: t("settingsPanel.gallery.preview.dockPanel.logs"),
            content: <span>{t("settingsPanel.gallery.preview.dockPanel.logsContent")}</span>,
          },
        ]}
        defaultActivePanelId="summary"
      />
    </PreviewShell>
  );
}

function InspectorPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsInspector
        ariaLabel={t("settingsPanel.gallery.preview.inspector.ariaLabel")}
        defaultOpenSectionIds={["surface"]}
        sections={[
          {
            id: "surface",
            title: t("settingsPanel.gallery.preview.inspector.surface"),
            content: <span>{t("settingsPanel.gallery.preview.inspector.surfaceContent")}</span>,
          },
          {
            id: "text",
            title: t("settingsPanel.gallery.preview.inspector.text"),
            content: <span>{t("settingsPanel.gallery.preview.inspector.textContent")}</span>,
          },
        ]}
      />
    </PreviewShell>
  );
}

function PanelHeaderPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsPanelHeader
        title={t("settingsPanel.gallery.preview.panelHeader.title")}
        actions={<ChipsButton>{t("settingsPanel.gallery.preview.panelHeader.action")}</ChipsButton>}
      />
    </PreviewShell>
  );
}

function CardShellPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsCardShell
        title={t("settingsPanel.gallery.preview.cardShell.title")}
        toolbar={<StatusPill label={t("settingsPanel.gallery.preview.cardShell.badge")} />}
        footer={<ChipsButton>{t("settingsPanel.gallery.preview.cardShell.action")}</ChipsButton>}
      >
        <span>{t("settingsPanel.gallery.preview.cardShell.content")}</span>
      </ChipsCardShell>
    </PreviewShell>
  );
}

function ToolWindowPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsToolWindow
        title={t("settingsPanel.gallery.preview.toolWindow.title")}
        ariaLabel={t("settingsPanel.gallery.preview.toolWindow.ariaLabel")}
      >
        <div className="gallery-inline-stack">
          <span>{t("settingsPanel.gallery.preview.toolWindow.content")}</span>
        </div>
      </ChipsToolWindow>
    </PreviewShell>
  );
}

function ErrorBoundaryPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsErrorBoundary
        title={t("settingsPanel.gallery.preview.errorBoundary.title")}
      >
        <span>{t("settingsPanel.gallery.preview.errorBoundary.content")}</span>
      </ChipsErrorBoundary>
    </PreviewShell>
  );
}

function LoadingBoundaryPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsLoadingBoundary loading delayMs={0} loadingText={t("settingsPanel.gallery.preview.loadingBoundary.loadingText")}>
        <span>{t("settingsPanel.gallery.preview.loadingBoundary.content")}</span>
      </ChipsLoadingBoundary>
    </PreviewShell>
  );
}

function NotificationPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsNotification
        ariaLabel={t("settingsPanel.gallery.preview.notification.ariaLabel")}
        items={[
          {
            id: "theme-updated",
            tone: "success",
            title: t("settingsPanel.gallery.preview.notification.title"),
            message: t("settingsPanel.gallery.preview.notification.message"),
            durationMs: 0,
          },
        ]}
      />
    </PreviewShell>
  );
}

function ToastPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsToast
        ariaLabel={t("settingsPanel.gallery.preview.toast.ariaLabel")}
        entries={[
          {
            id: "toast-item",
            tone: "info",
            message: t("settingsPanel.gallery.preview.toast.message"),
            durationMs: 0,
          },
        ]}
      />
    </PreviewShell>
  );
}

function EmptyStatePreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsEmptyState
        ariaLabel={t("settingsPanel.gallery.preview.emptyState.ariaLabel")}
        title={t("settingsPanel.gallery.preview.emptyState.title")}
        description={t("settingsPanel.gallery.preview.emptyState.description")}
      />
    </PreviewShell>
  );
}

function SkeletonPreview(): React.ReactElement {
  const { t } = useI18n();
  return (
    <PreviewShell>
      <ChipsSkeleton ariaLabel={t("settingsPanel.gallery.preview.skeleton.ariaLabel")} loading lines={4} />
    </PreviewShell>
  );
}

function StatusPill({ label }: { label: string }): React.ReactElement {
  return <span className="gallery-status-pill">{label}</span>;
}

const SUMMARY_KEY_BY_NAME: Record<string, string> = {
  ChipsButton: "settingsPanel.gallery.components.button.summary",
  ChipsInput: "settingsPanel.gallery.components.input.summary",
  ChipsCheckbox: "settingsPanel.gallery.components.checkbox.summary",
  ChipsRadioGroup: "settingsPanel.gallery.components.radioGroup.summary",
  ChipsSwitch: "settingsPanel.gallery.components.switch.summary",
  ChipsSelect: "settingsPanel.gallery.components.select.summary",
  ChipsDialog: "settingsPanel.gallery.components.dialog.summary",
  ChipsPopover: "settingsPanel.gallery.components.popover.summary",
  ChipsTabs: "settingsPanel.gallery.components.tabs.summary",
  ChipsMenu: "settingsPanel.gallery.components.menu.summary",
  ChipsToolbar: "settingsPanel.gallery.components.toolbar.summary",
  ChipsMenuBar: "settingsPanel.gallery.components.menuBar.summary",
  ChipsContextMenu: "settingsPanel.gallery.components.contextMenu.summary",
  ChipsShortcut: "settingsPanel.gallery.components.shortcut.summary",
  ChipsTooltip: "settingsPanel.gallery.components.tooltip.summary",
  ChipsForm: "settingsPanel.gallery.components.form.summary",
  ChipsVirtualList: "settingsPanel.gallery.components.virtualList.summary",
  ChipsDataGrid: "settingsPanel.gallery.components.dataGrid.summary",
  ChipsTree: "settingsPanel.gallery.components.tree.summary",
  ChipsDateTime: "settingsPanel.gallery.components.dateTime.summary",
  ChipsCommandPalette: "settingsPanel.gallery.components.commandPalette.summary",
  ChipsNavigationSplitView: "settingsPanel.gallery.components.navigationSplitView.summary",
  ChipsSplitPane: "settingsPanel.gallery.components.splitPane.summary",
  ChipsDockPanel: "settingsPanel.gallery.components.dockPanel.summary",
  ChipsInspector: "settingsPanel.gallery.components.inspector.summary",
  ChipsPanelHeader: "settingsPanel.gallery.components.panelHeader.summary",
  ChipsCardShell: "settingsPanel.gallery.components.cardShell.summary",
  ChipsToolWindow: "settingsPanel.gallery.components.toolWindow.summary",
  ChipsErrorBoundary: "settingsPanel.gallery.components.errorBoundary.summary",
  ChipsLoadingBoundary: "settingsPanel.gallery.components.loadingBoundary.summary",
  ChipsNotification: "settingsPanel.gallery.components.notification.summary",
  ChipsToast: "settingsPanel.gallery.components.toast.summary",
  ChipsEmptyState: "settingsPanel.gallery.components.emptyState.summary",
  ChipsSkeleton: "settingsPanel.gallery.components.skeleton.summary",
};

const EMPHASIS_BY_NAME: Record<string, ComponentPreviewRegistration["emphasis"]> = {
  ChipsButton: "hero",
  ChipsInput: "wide",
  ChipsCheckbox: "standard",
  ChipsRadioGroup: "wide",
  ChipsSwitch: "standard",
  ChipsSelect: "wide",
  ChipsDialog: "hero",
  ChipsPopover: "standard",
  ChipsTabs: "wide",
  ChipsMenu: "standard",
  ChipsToolbar: "wide",
  ChipsMenuBar: "wide",
  ChipsContextMenu: "standard",
  ChipsShortcut: "standard",
  ChipsTooltip: "standard",
  ChipsForm: "hero",
  ChipsVirtualList: "hero",
  ChipsDataGrid: "hero",
  ChipsTree: "wide",
  ChipsDateTime: "standard",
  ChipsCommandPalette: "hero",
  ChipsNavigationSplitView: "hero",
  ChipsSplitPane: "hero",
  ChipsDockPanel: "hero",
  ChipsInspector: "hero",
  ChipsPanelHeader: "wide",
  ChipsCardShell: "wide",
  ChipsToolWindow: "wide",
  ChipsErrorBoundary: "wide",
  ChipsLoadingBoundary: "standard",
  ChipsNotification: "wide",
  ChipsToast: "standard",
  ChipsEmptyState: "wide",
  ChipsSkeleton: "standard",
};

const PREVIEW_BY_NAME: Record<string, () => React.ReactElement> = {
  ChipsButton: ButtonPreview,
  ChipsInput: InputPreview,
  ChipsCheckbox: CheckboxPreview,
  ChipsRadioGroup: RadioPreview,
  ChipsSwitch: SwitchPreview,
  ChipsSelect: SelectPreview,
  ChipsDialog: DialogPreview,
  ChipsPopover: PopoverPreview,
  ChipsTabs: TabsPreview,
  ChipsMenu: MenuPreview,
  ChipsToolbar: ToolbarPreview,
  ChipsMenuBar: MenuBarPreview,
  ChipsContextMenu: ContextMenuPreview,
  ChipsShortcut: ShortcutPreview,
  ChipsTooltip: TooltipPreview,
  ChipsForm: FormPreview,
  ChipsVirtualList: VirtualListPreview,
  ChipsDataGrid: DataGridPreview,
  ChipsTree: TreePreview,
  ChipsDateTime: DateTimePreview,
  ChipsCommandPalette: CommandPalettePreview,
  ChipsNavigationSplitView: NavigationSplitViewPreview,
  ChipsSplitPane: SplitPanePreview,
  ChipsDockPanel: DockPanelPreview,
  ChipsInspector: InspectorPreview,
  ChipsPanelHeader: PanelHeaderPreview,
  ChipsCardShell: CardShellPreview,
  ChipsToolWindow: ToolWindowPreview,
  ChipsErrorBoundary: ErrorBoundaryPreview,
  ChipsLoadingBoundary: LoadingBoundaryPreview,
  ChipsNotification: NotificationPreview,
  ChipsToast: ToastPreview,
  ChipsEmptyState: EmptyStatePreview,
  ChipsSkeleton: SkeletonPreview,
};

function toRegistrations(items: ComponentCatalogItem[]): ComponentPreviewRegistration[] {
  return items.map((item) => ({
    name: item.name,
    scope: item.scope,
    parts: item.parts,
    summaryKey: SUMMARY_KEY_BY_NAME[item.name],
    emphasis: EMPHASIS_BY_NAME[item.name] ?? "standard",
    preview: PREVIEW_BY_NAME[item.name],
  }));
}

export function getComponentGroups(): ComponentGroup[] {
  return [
    {
      id: "foundation",
      titleKey: "settingsPanel.gallery.groups.foundation",
      descriptionKey: "settingsPanel.gallery.groupDescriptions.foundation",
      items: toRegistrations(P0_BASE_INTERACTIVE_COMPONENTS),
    },
    {
      id: "forms",
      titleKey: "settingsPanel.gallery.groups.forms",
      descriptionKey: "settingsPanel.gallery.groupDescriptions.forms",
      items: toRegistrations(P0_DATA_FORM_COMPONENTS),
    },
    {
      id: "advanced-data",
      titleKey: "settingsPanel.gallery.groups.advancedData",
      descriptionKey: "settingsPanel.gallery.groupDescriptions.advancedData",
      items: toRegistrations(STAGE7_DATA_ADVANCED_COMPONENTS),
    },
    {
      id: "workbench",
      titleKey: "settingsPanel.gallery.groups.workbench",
      descriptionKey: "settingsPanel.gallery.groupDescriptions.workbench",
      items: toRegistrations(STAGE7_WORKBENCH_COMPONENTS),
    },
    {
      id: "system-ux",
      titleKey: "settingsPanel.gallery.groups.systemUx",
      descriptionKey: "settingsPanel.gallery.groupDescriptions.systemUx",
      items: toRegistrations(STAGE8_SYSTEM_UX_COMPONENTS),
    },
  ];
}
