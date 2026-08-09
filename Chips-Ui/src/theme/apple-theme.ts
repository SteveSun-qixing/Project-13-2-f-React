import type { ThemeConfig } from "antd";
import { theme } from "antd";

/**
 * 薯片生态统一苹果风格主题（antd v6）。
 * 全生态唯一事实源：任何插件禁止私改 token，禁止引入第二套强调色。
 *
 * 设计基准（macOS/iOS Human Interface Guidelines 简化版）：
 * - 系统蓝 #0a84ff（唯一强调色），语义色用 iOS 官方绿/橙/红
 * - 分层灰阶：#f5f5f7 窗口底 / #ffffff 浮层底 / 细边框 rgba(0,0,0,0.08)
 * - 大圆角体系：控件 8 / 默认 10 / 弹层 12 / 弹窗 14
 * - 悬浮毛玻璃（backdrop-filter）用于工具栏/侧边栏/弹窗
 * - 克制动效：150~250ms ease，无夸张动画
 */
export const appleTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // ---- 颜色 ----
    colorPrimary: "#0a84ff",
    colorInfo: "#0a84ff",
    colorLink: "#0a84ff",
    colorPrimaryHover: "#3395ff",
    colorPrimaryActive: "#0060df",
    colorPrimaryBg: "rgba(10,132,255,0.08)",
    colorPrimaryBgHover: "rgba(10,132,255,0.12)",
    colorPrimaryBorder: "rgba(10,132,255,0.35)",
    colorSuccess: "#34c759",
    colorSuccessBg: "rgba(52,199,89,0.10)",
    colorWarning: "#ff9f0a",
    colorWarningBg: "rgba(255,159,10,0.10)",
    colorError: "#ff3b30",
    colorErrorBg: "rgba(255,59,48,0.10)",
    colorTextBase: "#1d1d1f",
    colorTextSecondary: "#6e6e73",
    colorTextTertiary: "#86868b",
    colorTextQuaternary: "#c7c7cc",
    colorBgBase: "#f5f5f7",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f5f5f7",
    colorBgSpotlight: "#3a3a3c",
    colorBorder: "rgba(0,0,0,0.10)",
    colorBorderSecondary: "rgba(0,0,0,0.06)",
    colorSplit: "rgba(0,0,0,0.06)",
    colorFillSecondary: "rgba(0,0,0,0.05)",
    colorFillTertiary: "rgba(0,0,0,0.03)",
    colorFillQuaternary: "rgba(0,0,0,0.02)",
    // iOS 系统灰阶（浅色模式）：系统灰 #8e8e93 / 系统灰5 #e5e5ea / 系统灰6 #f2f2f7
    colorTextPlaceholder: "#8e8e93",
    colorTextDisabled: "#c7c7cc",
    colorBgMask: "rgba(0,0,0,0.25)",

    // ---- 字体 ----
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
    fontFamilyCode:
      '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", "PingFang SC", monospace',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 34,
    fontSizeHeading2: 28,
    fontSizeHeading3: 22,
    fontSizeHeading4: 20,
    fontSizeHeading5: 17,
    lineHeight: 1.5,
    fontWeightStrong: 600,

    // ---- 圆角 ----
    borderRadius: 10,
    borderRadiusLG: 12,
    borderRadiusSM: 8,
    borderRadiusXS: 6,

    // ---- 尺寸 ----
    controlHeight: 36,
    controlHeightSM: 28,
    controlHeightLG: 44,
    controlOutline: "rgba(10,132,255,0.35)",
    controlOutlineWidth: 2,

    // ---- 阴影（分层柔和阴影）----
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)",
    boxShadowSecondary:
      "0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.10)",
    boxShadowTertiary:
      "0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.05)",

    // ---- 动效 ----
    motionDurationFast: "0.15s",
    motionDurationMid: "0.25s",
    motionDurationSlow: "0.4s",
    motionEaseInOut: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    motionEaseOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  components: {
    // ---- 按钮：白底灰边，主按钮蓝 ----
    Button: {
      borderRadius: 8,
      borderRadiusSM: 7,
      borderRadiusLG: 10,
      contentFontSize: 14,
      primaryShadow: "none",
      defaultShadow: "none",
      dangerShadow: "none",
      defaultBorderColor: "rgba(0,0,0,0.12)",
      defaultBg: "#ffffff",
      defaultColor: "#1d1d1f",
      defaultHoverBg: "#f5f5f7",
      defaultActiveBg: "#ebebed",
      textHoverBg: "rgba(0,0,0,0.05)",
      primaryColor: "#ffffff",
      paddingInline: 16,
      paddingInlineLG: 20,
      paddingInlineSM: 12,
      onlyIconSize: 18,
    },

    // ---- 输入：浅灰底圆角，聚焦白底蓝环 ----
    Input: {
      colorBgContainer: "#f2f2f7",
      colorBorder: "transparent",
      hoverBorderColor: "rgba(0,0,0,0.15)",
      activeBorderColor: "#0a84ff",
      activeShadow: "0 0 0 3px rgba(10,132,255,0.25)",
      hoverBg: "#e5e5ea",
      activeBg: "#ffffff",
      borderRadius: 10,
      borderRadiusLG: 10,
      paddingInline: 12,
    },

    // ---- 选择器：浅灰底，弹层白底圆角 ----
    Select: {
      selectorBg: "#f2f2f7",
      hoverBorderColor: "rgba(0,0,0,0.15)",
      activeBorderColor: "#0a84ff",
      optionSelectedBg: "rgba(10,132,255,0.10)",
      optionActiveBg: "rgba(0,0,0,0.05)",
      optionSelectedFontWeight: 600,
      borderRadius: 8,
      borderRadiusLG: 10,
    },

    // ---- 弹窗：无边框白底大圆角 ----
    Modal: {
      borderRadiusLG: 14,
      titleFontSize: 17,
      titleColor: "#1d1d1f",
      contentBg: "#ffffff",
      headerBg: "transparent",
      footerBg: "transparent",
    },

    // ---- 卡片：无边框圆角浅阴影 ----
    Card: {
      borderRadiusLG: 12,
      headerFontSize: 15,
      headerBg: "transparent",
      bodyPadding: 20,
      headerPadding: 16,
    },

    // ---- 表格：去边框、行 hover 浅灰 ----
    Table: {
      headerBg: "transparent",
      headerColor: "#6e6e73",
      headerSplitColor: "transparent",
      borderColor: "rgba(0,0,0,0.06)",
      rowHoverBg: "rgba(0,0,0,0.03)",
      rowSelectedBg: "rgba(10,132,255,0.10)",
      rowSelectedHoverBg: "rgba(10,132,255,0.14)",
      cellPaddingBlock: 14,
      cellFontSize: 13,
      headerBorderRadius: 8,
    },

    // ---- 菜单：弹层白底圆角，选中浅蓝 ----
    Menu: {
      itemBorderRadius: 8,
      itemColor: "#1d1d1f",
      itemHoverBg: "rgba(0,0,0,0.05)",
      itemSelectedBg: "rgba(10,132,255,0.10)",
      itemSelectedColor: "#0a84ff",
      subMenuItemBg: "transparent",
      itemMarginInline: 4,
      itemHeight: 34,
      popupBg: "rgba(255,255,255,0.96)",
    },

    // ---- 分段控件：iOS 轨道灰 + 白色浮块 ----
    Segmented: {
      trackBg: "#f2f2f7",
      trackPadding: 2,
      itemColor: "#6e6e73",
      itemHoverColor: "#1d1d1f",
      itemSelectedColor: "#1d1d1f",
      itemSelectedBg: "#ffffff",
      itemHoverBg: "rgba(255,255,255,0.5)",
      itemActiveBg: "rgba(0,0,0,0.03)",
      borderRadius: 9,
      borderRadiusLG: 9,
      borderRadiusSM: 9,
    },

    // ---- 开关：iOS 圆角矩形 ----
    Switch: {
      colorPrimary: "#34c759",
      colorPrimaryHover: "#34c759",
      handleBg: "#ffffff",
      trackHeight: 30,
      handleSize: 26,
      trackPadding: 2,
    },

    // ---- 滑块：iOS 圆形手柄 ----
    Slider: {
      trackBg: "#0a84ff",
      trackHoverBg: "#3395ff",
      handleColor: "#ffffff",
      handleActiveColor: "#ffffff",
      handleSize: 22,
      handleLineWidth: 3,
      handleActiveOutlineColor: "rgba(10,132,255,0.25)",
      railBg: "rgba(0,0,0,0.12)",
      railHoverBg: "rgba(0,0,0,0.15)",
      dotBorderColor: "rgba(0,0,0,0.15)",
      dotActiveBorderColor: "#0a84ff",
    },

    // ---- 勾选 ----
    Checkbox: {
      colorPrimary: "#0a84ff",
      borderRadius: 5,
    },
    Radio: {
      colorPrimary: "#0a84ff",
      buttonBg: "transparent",
      radioSize: 18,
    },

    // ---- 标签页：细下划线 ----
    Tabs: {
      itemColor: "#6e6e73",
      itemHoverColor: "#1d1d1f",
      itemSelectedColor: "#1d1d1f",
      inkBarColor: "#0a84ff",
      titleFontSize: 14,
      horizontalItemPadding: "12px 0",
      horizontalItemGutter: 24,
      cardBg: "transparent",
    },

    // ---- 评分/进度 ----
    Rate: {
      starColor: "#ff9f0a",
      starBg: "rgba(0,0,0,0.10)",
      starSize: 22,
    },
    Progress: {
      defaultColor: "#0a84ff",
      remainingColor: "rgba(0,0,0,0.08)",
      lineBorderRadius: 4,
    },

    // ---- 徽标/标签：胶囊 ----
    Tag: {
      defaultBg: "rgba(0,0,0,0.05)",
      defaultColor: "#6e6e73",
      fontSize: 12,
    },
    Badge: {
      indicatorHeight: 18,
      textFontWeight: 600,
    },

    // ---- 列表 ----
    List: {
      itemPadding: "12px 16px",
      headerBg: "transparent",
      footerBg: "transparent",
    },

    // ---- 空态/结果 ----
    Result: {
      titleFontSize: 20,
      subtitleFontSize: 14,
    },

    // ---- 通知/消息 ----
    Message: {
      contentBg: "rgba(255,255,255,0.96)",
    },

    // ---- 骨架屏 ----
    Skeleton: {
      gradientFromColor: "rgba(0,0,0,0.04)",
      gradientToColor: "rgba(0,0,0,0.09)",
    },

    // ---- 分页 ----
    Pagination: {
      itemBg: "transparent",
      itemActiveBg: "rgba(10,132,255,0.10)",
      itemActiveColor: "#0a84ff",
    },
  },
};
