/**
 * 大纲面板组件
 * 展示幻灯片文本内容和结构
 */
import React, { useCallback, useMemo } from "react";
import { Tree, Input, Empty, Spin } from "antd";
import type { DataNode } from "antd/es/tree";
import type { Slide, TextElement } from "../../../engine/pptx-engine/src/index";
import type { OutlineItem } from "../types";

export interface OutlinePanelProps {
  /** 幻灯片列表 */
  slides: Slide[];
  /** 当前幻灯片索引 */
  currentSlideIndex: number;
  /** 跳转到幻灯片回调 */
  onNavigateToSlide?: (index: number) => void;
  /** 是否加载中 */
  isLoading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

/** 派生幻灯片大纲标题：取第一个标题占位符（title/ctrTitle）的文本，无标题时回退为序号 */
function slideOutlineTitle(slide: Slide, slideIndex: number): string {
  for (const element of slide.elements) {
    if (element.type !== "text" && element.type !== "shape") continue;
    const textEl: TextElement = element;
    if (textEl.placeholder !== "title" && textEl.placeholder !== "ctrTitle") continue;
    if (!textEl.text) continue;
    const text = textEl.text.paragraphs
      .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
      .join(" ")
      .trim();
    if (text) {
      return text.length > 50 ? text.substring(0, 50) + "..." : text;
    }
  }
  return `第 ${slideIndex + 1} 张幻灯片`;
}

/** 从文本内容提取大纲项 */
function extractOutlineItems(slides: Slide[]): OutlineItem[] {
  const items: OutlineItem[] = [];

  slides.forEach((slide, slideIndex) => {
    const slideTitle = slideOutlineTitle(slide, slideIndex);
    items.push({
      id: `slide-${slideIndex}`,
      title: slideTitle,
      level: 0,
      slideIndex,
      hasContent: slide.elements.length > 0,
    });

    slide.elements.forEach((element, elementIndex) => {
      if (element.type === "text" || element.type === "shape") {
        const textEl: TextElement = element;
        if (textEl.text) {
          const paragraphs = textEl.text.paragraphs;
          paragraphs.forEach((paragraph, paraIndex) => {
            const textContent = paragraph.runs.map((run) => run.text).join("").trim();
            if (textContent) {
              const level = paragraph.level ?? 0;
              items.push({
                id: `slide-${slideIndex}-element-${elementIndex}-para-${paraIndex}`,
                title: textContent.length > 50 ? textContent.substring(0, 50) + "..." : textContent,
                level: level + 1,
                slideIndex,
                hasContent: true,
              });
            }
          });
        }
      }
    });
  });

  return items;
}

/** 将大纲项转换为树形数据 */
function outlineItemsToTreeData(items: OutlineItem[]): DataNode[] {
  const treeMap = new Map<number, DataNode[]>();
  const rootNodes: DataNode[] = [];

  items.forEach((item) => {
    const node: DataNode = {
      key: item.id,
      title: (
        <span style={{ fontSize: 12 }}>
          {item.level > 0 && (
            <span style={{ color: "#999", marginRight: 8 }}>
              {Array(item.level).fill("·").join("")}
            </span>
          )}
          {item.title}
        </span>
      ),
      isLeaf: item.level === 0,
    };

    if (item.level === 0) {
      rootNodes.push(node);
    } else {
      const parentIndex = item.slideIndex;
      if (!treeMap.has(parentIndex)) {
        treeMap.set(parentIndex, []);
      }
      treeMap.get(parentIndex)!.push(node);
    }
  });

  rootNodes.forEach((root) => {
    const slideIndex = parseInt(String(root.key).replace("slide-", ""), 10);
    const children = treeMap.get(slideIndex);
    if (children && children.length > 0) {
      root.children = children;
    }
  });

  return rootNodes;
}

/** 大纲面板组件 */
export const OutlinePanel = React.memo(function OutlinePanel({
  slides,
  currentSlideIndex,
  onNavigateToSlide,
  isLoading = false,
  disabled = false,
}: OutlinePanelProps) {
  const [searchValue, setSearchValue] = React.useState("");

  const outlineItems = useMemo(() => extractOutlineItems(slides), [slides]);

  const treeData = useMemo(() => {
    if (!searchValue) {
      return outlineItemsToTreeData(outlineItems);
    }

    const filteredItems = outlineItems.filter((item) =>
      item.title.toLowerCase().includes(searchValue.toLowerCase()),
    );
    return outlineItemsToTreeData(filteredItems);
  }, [outlineItems, searchValue]);

  const handleSelect = useCallback(
    (selectedKeys: React.Key[]) => {
      const key = String(selectedKeys[0] ?? "");
      if (!key) return;

      const match = key.match(/^slide-(\d+)(?:-|$)/);
      if (match) {
        const slideIndex = parseInt(match[1], 10);
        onNavigateToSlide?.(slideIndex);
      }
    },
    [onNavigateToSlide],
  );

  const expandedKeys = useMemo(() => {
    return slides.map((_, index) => `slide-${index}`);
  }, [slides]);

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

  if (slides.length === 0) {
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
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
        <Input.Search
          placeholder="搜索大纲..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          size="small"
        />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
        <Tree
          treeData={treeData}
          defaultExpandedKeys={expandedKeys}
          selectedKeys={[`slide-${currentSlideIndex}`]}
          onSelect={handleSelect}
          disabled={disabled}
          showLine={{ showLeafIcon: false }}
          blockNode
        />
      </div>
    </div>
  );
});
