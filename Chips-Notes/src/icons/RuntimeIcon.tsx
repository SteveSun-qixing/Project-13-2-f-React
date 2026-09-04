import React from "react";
import {
    AppstoreOutlined,
    AudioOutlined,
    BarsOutlined,
    BgColorsOutlined,
    BookOutlined,
    CheckOutlined,
    CloseOutlined,
    CodeOutlined,
    CopyOutlined,
    CreditCardOutlined,
    DashboardOutlined,
    DeleteOutlined,
    DownOutlined,
    DownloadOutlined,
    EditOutlined,
    EyeOutlined,
    FileOutlined,
    FilePdfOutlined,
    FileTextOutlined,
    FileZipOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    GlobalOutlined,
    HighlightOutlined,
    HistoryOutlined,
    Html5Outlined,
    InboxOutlined,
    InfoCircleOutlined,
    KeyOutlined,
    LeftOutlined,
    LinkOutlined,
    LoadingOutlined,
    LockOutlined,
    MinusOutlined,
    MoonOutlined,
    PictureOutlined,
    PlayCircleOutlined,
    PlusOutlined,
    RedoOutlined,
    ReloadOutlined,
    RightOutlined,
    SearchOutlined,
    SettingOutlined,
    SnippetsOutlined,
    StarOutlined,
    SunOutlined,
    SyncOutlined,
    UndoOutlined,
    UnlockOutlined,
    UpOutlined,
    UploadOutlined,
    WarningOutlined,
    ScissorOutlined,
} from "@ant-design/icons";
import type { IconDescriptor } from "chips-sdk";

export interface RuntimeIconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  icon?: IconDescriptor | null;
  fallbackIcon?: IconDescriptor;
}

type IconComponent = React.ComponentType<React.ComponentProps<typeof SettingOutlined>>;

const ICON_COMPONENTS: Record<string, IconComponent> = {
  add: PlusOutlined,
  apps: AppstoreOutlined,
  inventory_2: InboxOutlined,
  all_inclusive: AppstoreOutlined,
  style: CreditCardOutlined,
  check: CheckOutlined,
  keyboard_arrow_down: DownOutlined,
  keyboard_arrow_left: LeftOutlined,
  keyboard_arrow_right: RightOutlined,
  keyboard_arrow_up: UpOutlined,
  close: CloseOutlined,
  code: CodeOutlined,
  content_copy: CopyOutlined,
  content_cut: ScissorOutlined,
  delete: DeleteOutlined,
  draft: FileTextOutlined,
  download: DownloadOutlined,
  edit: EditOutlined,
  inbox: InboxOutlined,
  folder: FolderOutlined,
  folder_open: FolderOpenOutlined,
  auto_fix_high: HighlightOutlined,
  history: HistoryOutlined,
  html: Html5Outlined,
  image: PictureOutlined,
  info: InfoCircleOutlined,
  keyboard: KeyOutlined,
  dashboard_customize: DashboardOutlined,
  link: LinkOutlined,
  progress_activity: LoadingOutlined,
  lock: LockOutlined,
  lock_open: UnlockOutlined,
  dark_mode: MoonOutlined,
  content_paste: SnippetsOutlined,
  picture_as_pdf: FilePdfOutlined,
  palette: BgColorsOutlined,
  visibility: EyeOutlined,
  refresh: ReloadOutlined,
  redo: RedoOutlined,
  remove: MinusOutlined,
  restart_alt: SyncOutlined,
  search: SearchOutlined,
  settings: SettingOutlined,
  keyboard_command_key: BarsOutlined,
  light_mode: SunOutlined,
  theme: BgColorsOutlined,
  undo: UndoOutlined,
  upload_file: UploadOutlined,
  warning: WarningOutlined,
  workbench: DashboardOutlined,
  folder_zip: FileZipOutlined,
  article: FileTextOutlined,
  language: GlobalOutlined,
  play_circle: PlayCircleOutlined,
  music_note: AudioOutlined,
  menu_book: BookOutlined,
  star: StarOutlined,
};

export function RuntimeIcon({
  icon,
  fallbackIcon,
  ...rest
}: RuntimeIconProps): React.ReactElement | null {
  const resolved = icon ?? fallbackIcon;
  if (!resolved) {
    return null;
  }

  const IconComponent = ICON_COMPONENTS[resolved.name] ?? FileOutlined;

  return (
    <span {...rest} aria-hidden={rest["aria-hidden"] ?? resolved.decorative ?? true}>
      <IconComponent />
    </span>
  );
}
