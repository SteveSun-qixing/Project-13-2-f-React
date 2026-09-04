/**
 * 动画时间轴面板组件
 * 展示和管理幻灯片动画效果
 */
import React, { useCallback, useMemo } from "react";
import { Timeline, Button, Tag, Empty, Spin, Space, Dropdown, Tooltip } from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  HolderOutlined,
  EditOutlined,
  CopyOutlined,
  DownOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import type { Slide, SlideAnimation } from "../../../engine/pptx-engine/src/index";
import { getSlideAnimations, animClassOf } from "../../../engine/pptx-engine/src/index";
import type { AnimationItem } from "../types";
import { formatMessage } from "../../../lib/messages";

export interface AnimationPanelProps {
  /** 幻灯片列表 */
  slides: Slide[];
  /** 当前幻灯片索引 */
  currentSlideIndex: number;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只读模式 */
  readOnly?: boolean;
  /** 播放状态 */
  isPlaying?: boolean;
  /** 当前动画步骤 */
  currentAnimationStep?: number;
  /** 选中动画回调 */
  onSelectAnimation?: (animationId: string) => void;
  /** 删除动画回调 */
  onDeleteAnimation?: (animationId: string) => void;
  /** 复制动画回调 */
  onDuplicateAnimation?: (animationId: string) => void;
  /** 播放/暂停回调 */
  onPlayPause?: () => void;
  /** 跳转到步骤回调 */
  onGoToStep?: (step: number) => void;
}

/** 动画类型映射 */
const ANIMATION_TYPE_MAP: Record<string, { label: string; color: string }> = {
  entrance: { label: "进入", color: "green" },
  exit: { label: "退出", color: "red" },
  emphasis: { label: "强调", color: "orange" },
  path: { label: "动作路径", color: "blue" },
  default: { label: "动画", color: "default" },
};

/** 动画触发类型映射 */
const TRIGGER_TYPE_MAP: Record<string, string> = {
  onClick: "单击时",
  withPrevious: "与上一动画同时",
  afterPrevious: "上一动画之后",
  onMedia: "媒体播放时",
};

/** 从幻灯片提取动画项 */
function extractAnimationItems(slide: Slide): AnimationItem[] {
  const items: AnimationItem[] = [];

  // 使用 getSlideAnimations 从 bodySuffix XML 中解析动画
  const animations = getSlideAnimations(slide);

  if (!animations || animations.length === 0) {
    return items;
  }

  animations.forEach((animation, animIndex) => {
    items.push({
      id: `anim-${animIndex}`,
      elementId: String(animation.spid),
      elementName: `元素 ${animation.spid}`,
      animation,
      trigger: TRIGGER_TYPE_MAP[animation.trigger ?? "onClick"] ?? "单击时",
      delay: animation.delayMs,
      duration: animation.durationMs,
    });
  });

  return items;
}

/** 动画面板组件 */
export const AnimationPanel = React.memo(function AnimationPanel({
  slides,
  currentSlideIndex,
  isLoading = false,
  disabled = false,
  readOnly = false,
  isPlaying = false,
  currentAnimationStep = 0,
  onSelectAnimation,
  onDeleteAnimation,
  onDuplicateAnimation,
  onPlayPause,
  onGoToStep,
}: AnimationPanelProps) {
  const currentSlide = slides[currentSlideIndex];

  const animationItems = useMemo(() => {
    if (!currentSlide) return [];
    return extractAnimationItems(currentSlide);
  }, [currentSlide]);

  const handleAnimationClick = useCallback(
    (animationId: string) => {
      onSelectAnimation?.(animationId);
    },
    [onSelectAnimation],
  );

  const handleDelete = useCallback(
    (animationId: string) => {
      if (!readOnly) {
        onDeleteAnimation?.(animationId);
      }
    },
    [readOnly, onDeleteAnimation],
  );

  const handleDuplicate = useCallback(
    (animationId: string) => {
      if (!readOnly) {
        onDuplicateAnimation?.(animationId);
      }
    },
    [readOnly, onDuplicateAnimation],
  );

  const getAnimationMenu = useCallback(
    (animationId: string): MenuProps["items"] => [
      {
        key: "duplicate",
        icon: <CopyOutlined />,
        label: formatMessage("slide.animation.duplicate"),
        onClick: () => handleDuplicate(animationId),
        disabled: readOnly,
      },
      {
        key: "delete",
        icon: <DeleteOutlined />,
        label: formatMessage("slide.animation.delete"),
        danger: true,
        onClick: () => handleDelete(animationId),
        disabled: readOnly,
      },
    ],
    [readOnly, handleDuplicate, handleDelete],
  );

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}毫秒`;
    return `${(ms / 1000).toFixed(1)}秒`;
  };

  const formatDelay = (ms: number): string => {
    if (ms === 0) return "无延迟";
    return `延迟 ${formatDuration(ms)}`;
  };

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <Spin size="small" />
      </div>
    );
  }

  if (!currentSlide) {
    return (
      <div style={{ padding: 16 }}>
        <Empty description="暂无幻灯片" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#fff",
      }}
    >
      {/* 头部工具栏 */}
      <div
        style={{
          padding: "8px 12px",
          borderBottom: "1px solid #f0f0f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Space>
          <Button
            type={isPlaying ? "primary" : "default"}
            icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={onPlayPause}
            disabled={animationItems.length === 0 || disabled}
            size="small"
          >
            {isPlaying ? "暂停" : "预览"}
          </Button>
        </Space>

        <Tag icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
          {animationItems.length} 个动画
        </Tag>
      </div>

      {/* 动画时间轴 */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 12px" }}>
        {animationItems.length === 0 ? (
          <Empty
            description="当前幻灯片暂无动画"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Timeline
            items={animationItems.map((item, index) => {
              const animClass = animClassOf(item.animation.effect);
              const animType = ANIMATION_TYPE_MAP[animClass] ?? ANIMATION_TYPE_MAP.default;

              return {
                key: item.id,
                color: index < currentAnimationStep ? "green" : "blue",
                children: (
                  <div
                    onClick={() => handleAnimationClick(item.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 4,
                      background: index === currentAnimationStep ? "#e6f7ff" : "#fafafa",
                      border: "1px solid #e8e8e8",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <Space size={4}>
                        <Tag color={animType.color} style={{ margin: 0 }}>
                          {animType.label}
                        </Tag>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{item.elementName}</span>
                      </Space>
                      {!readOnly && (
                        <Dropdown
                          menu={{ items: getAnimationMenu(item.id) }}
                          trigger={["click"]}
                        >
                          <Button type="text" size="small" icon={<DownOutlined />} />
                        </Dropdown>
                      )}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 12,
                        color: "#666",
                      }}
                    >
                      <span>{item.trigger}</span>
                      <span>·</span>
                      <span>{formatDelay(item.delay)}</span>
                      <span>·</span>
                      <span>时长 {formatDuration(item.duration)}</span>
                    </div>
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </div>
  );
});
