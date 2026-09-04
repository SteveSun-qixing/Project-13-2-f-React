/**
 * Slide 播放视图组件
 * 幻灯片演示模式，支持全屏播放和演讲者模式
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Tooltip, Space, message } from "antd";
import {
  FullscreenOutlined,
  FullscreenExitOutlined,
  LeftOutlined,
  RightOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  ExpandOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import { SlideStage } from "./components/Stage";
import type { SlidePlayState, PptxParseOptions, ZoomState } from "./types";
import type { Slide, SlideSize } from "../../engine/pptx-engine/src/index";
import type { RenderSlide } from "../../engine/pptx-render/src/index";
import { buildRenderSlide } from "../../engine/pptx-render/src/index";

export interface SlideViewerProps {
  /** 幻灯片列表 */
  slides: Slide[];
  /** 幻灯片尺寸（EMU，即 SlideDeck.size）；缺省按 16:9 标准（12192000×6858000） */
  size?: SlideSize;
  /** 初始播放索引 */
  initialIndex?: number;
  /** 是否全屏模式 */
  fullscreen?: boolean;
  /** 是否演讲者模式 */
  speakerMode?: boolean;
  /** 播放状态改变回调 */
  onPlayStateChange?: (state: SlidePlayState) => void;
  /** 幻灯片切换回调 */
  onSlideChange?: (index: number) => void;
  /** 退出回调 */
  onExit?: () => void;
}

/** 初始播放状态 */
const initialPlayState: SlidePlayState = {
  isPlaying: false,
  currentSlideIndex: 0,
  isFullscreen: false,
  isSpeakerMode: false,
  animationStep: 0,
};

/** 默认解析选项 */
const DEFAULT_PARSE_OPTIONS: PptxParseOptions = {
  fitWidthPx: 1920,
};

/** 默认幻灯片尺寸：16:9 标准（13.333″ × 7.5″，EMU） */
const DEFAULT_SLIDE_SIZE: SlideSize = { cx: 12192000, cy: 6858000 };

/** 幻灯片播放视图组件 */
export const SlideViewer: React.FC<SlideViewerProps> = ({
  slides,
  size,
  initialIndex = 0,
  fullscreen = false,
  speakerMode = false,
  onPlayStateChange,
  onSlideChange,
  onExit,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [playState, setPlayState] = useState<SlidePlayState>({
    ...initialPlayState,
    currentSlideIndex: initialIndex,
    isFullscreen: fullscreen,
    isSpeakerMode: speakerMode,
  });
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const parseOptions = useMemo<PptxParseOptions>(() => DEFAULT_PARSE_OPTIONS, []);
  const slideSize = useMemo<SlideSize>(() => size ?? DEFAULT_SLIDE_SIZE, [size]);

  // 获取当前幻灯片渲染数据
  const currentRenderSlide = useMemo<RenderSlide | null>(() => {
    const slide = slides[playState.currentSlideIndex];
    if (!slide) return null;
    try {
      return buildRenderSlide(slide, slideSize, {
        ...parseOptions,
        slideNo: playState.currentSlideIndex + 1,
      });
    } catch {
      return null;
    }
  }, [slides, playState.currentSlideIndex, parseOptions, slideSize]);

  // 获取下一张幻灯片渲染数据（演讲者模式）
  const nextRenderSlide = useMemo<RenderSlide | null>(() => {
    const slide = slides[playState.currentSlideIndex + 1];
    if (!slide) return null;
    try {
      return buildRenderSlide(slide, slideSize, {
        ...parseOptions,
        slideNo: playState.currentSlideIndex + 2,
      });
    } catch {
      return null;
    }
  }, [slides, playState.currentSlideIndex, parseOptions, slideSize]);

  // 更新播放状态
  const updatePlayState = useCallback((updates: Partial<SlidePlayState>) => {
    setPlayState((prev) => {
      const next = { ...prev, ...updates };
      onPlayStateChange?.(next);
      return next;
    });
  }, [onPlayStateChange]);

  // 切换到指定幻灯片
  const goToSlide = useCallback((index: number) => {
    if (index >= 0 && index < slides.length) {
      updatePlayState({ currentSlideIndex: index, animationStep: 0 });
      onSlideChange?.(index);
    }
  }, [slides.length, updatePlayState, onSlideChange]);

  // 上一张幻灯片
  const previousSlide = useCallback(() => {
    goToSlide(playState.currentSlideIndex - 1);
  }, [goToSlide, playState.currentSlideIndex]);

  // 下一张幻灯片
  const nextSlide = useCallback(() => {
    goToSlide(playState.currentSlideIndex + 1);
  }, [goToSlide, playState.currentSlideIndex]);

  // 切换全屏
  const toggleFullscreen = useCallback(() => {
    const newFullscreen = !playState.isFullscreen;
    updatePlayState({ isFullscreen: newFullscreen });

    if (newFullscreen) {
      if (viewerRef.current?.requestFullscreen) {
        viewerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, [playState.isFullscreen, updatePlayState]);

  // 切换播放/暂停
  const togglePlay = useCallback(() => {
    updatePlayState({ isPlaying: !playState.isPlaying });
  }, [playState.isPlaying, updatePlayState]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          nextSlide();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          previousSlide();
          break;
        case "Home":
          e.preventDefault();
          goToSlide(0);
          break;
        case "End":
          e.preventDefault();
          goToSlide(slides.length - 1);
          break;
        case "Escape":
          e.preventDefault();
          if (playState.isFullscreen) {
            toggleFullscreen();
          } else {
            onExit?.();
          }
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "b":
        case "B":
          e.preventDefault();
          togglePlay();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, previousSlide, goToSlide, slides.length, playState.isFullscreen, toggleFullscreen, togglePlay, onExit]);

  // 全屏变化监听
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && playState.isFullscreen) {
        updatePlayState({ isFullscreen: false });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [playState.isFullscreen, updatePlayState]);

  // 鼠标移动显示/隐藏控制栏
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (!playState.isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [playState.isPlaying]);

  // 自动播放
  useEffect(() => {
    if (!playState.isPlaying) return;

    const interval = setInterval(() => {
      if (playState.currentSlideIndex < slides.length - 1) {
        nextSlide();
      } else {
        updatePlayState({ isPlaying: false });
        message.info("演示已结束");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playState.isPlaying, playState.currentSlideIndex, slides.length, nextSlide, updatePlayState]);

  const currentSlide = slides[playState.currentSlideIndex];
  const zoomState: ZoomState = { scale: 1, offsetX: 0, offsetY: 0, fitMode: "fit" };

  return (
    <div
      ref={viewerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#000",
        overflow: "hidden",
        cursor: showControls ? "default" : "none",
      }}
    >
      {/* 主幻灯片区域 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: playState.isSpeakerMode ? 200 : 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {currentRenderSlide && (
          <SlideStage
            renderSlide={currentRenderSlide}
            zoomState={zoomState}
            containerWidth={window.innerWidth}
            containerHeight={window.innerHeight}
            readOnly
          />
        )}
      </div>

      {/* 演讲者模式下一张预览 */}
      {playState.isSpeakerMode && nextRenderSlide && (
        <div
          style={{
            position: "absolute",
            right: 20,
            bottom: 220,
            width: 300,
            height: 169,
            background: "#1a1a1a",
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "4px 8px", color: "#999", fontSize: 11 }}>
            下一张 ({playState.currentSlideIndex + 2}/{slides.length})
          </div>
          <SlideStage
            renderSlide={nextRenderSlide}
            zoomState={zoomState}
            containerWidth={300}
            containerHeight={140}
            readOnly
          />
        </div>
      )}

      {/* 控制栏 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: playState.isSpeakerMode ? 200 : 60,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: playState.isSpeakerMode ? "row" : "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {/* 左侧信息 */}
        <div style={{ color: "#fff", fontSize: 14 }}>
          <span style={{ fontWeight: 500 }}>{playState.currentSlideIndex + 1}</span>
          <span style={{ color: "#999", margin: "0 8px" }}>/</span>
          <span>{slides.length}</span>
        </div>

        {/* 中间控制按钮 */}
        <Space size="middle">
          <Tooltip title="上一张 (←)">
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={previousSlide}
              disabled={playState.currentSlideIndex === 0}
              style={{ color: "#fff" }}
            />
          </Tooltip>

          <Tooltip title={playState.isPlaying ? "暂停" : "播放"}>
            <Button
              type="primary"
              shape="circle"
              icon={playState.isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlay}
              size="large"
            />
          </Tooltip>

          <Tooltip title="下一张 (→)">
            <Button
              type="text"
              icon={<RightOutlined />}
              onClick={nextSlide}
              disabled={playState.currentSlideIndex === slides.length - 1}
              style={{ color: "#fff" }}
            />
          </Tooltip>
        </Space>

        {/* 右侧操作按钮 */}
        <Space size="middle">
          <Tooltip title={isMuted ? "取消静音" : "静音"}>
            <Button
              type="text"
              icon={<SoundOutlined style={{ color: isMuted ? "#666" : "#fff" }} />}
              onClick={() => setIsMuted(!isMuted)}
              style={{ color: "#fff" }}
            />
          </Tooltip>

          <Tooltip title={playState.isSpeakerMode ? "关闭演讲者视图" : "演讲者视图"}>
            <Button
              type="text"
              icon={playState.isSpeakerMode ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={() => updatePlayState({ isSpeakerMode: !playState.isSpeakerMode })}
              style={{ color: "#fff" }}
            />
          </Tooltip>

          <Tooltip title={playState.isFullscreen ? "退出全屏" : "全屏 (F)"}>
            <Button
              type="text"
              icon={playState.isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              style={{ color: "#fff" }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* 幻灯片缩略图（演讲者模式） */}
      {playState.isSpeakerMode && (
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 200,
            top: 0,
            width: 150,
            background: "rgba(0,0,0,0.9)",
            overflow: "auto",
            padding: 8,
          }}
        >
          {slides.map((slide, index) => (
            <div
              key={index}
              onClick={() => goToSlide(index)}
              style={{
                width: "100%",
                paddingBottom: "56.25%",
                marginBottom: 4,
                background: index === playState.currentSlideIndex ? "#1890ff" : "#333",
                borderRadius: 2,
                cursor: "pointer",
                position: "relative",
                border: index === playState.currentSlideIndex ? "2px solid #1890ff" : "1px solid #555",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  left: 4,
                  color: "#fff",
                  fontSize: 11,
                }}
              >
                {index + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 进度条 */}
      <div
        style={{
          position: "absolute",
          bottom: playState.isSpeakerMode ? 200 : 60,
          left: 150,
          right: playState.isSpeakerMode ? 320 : 0,
          height: 4,
          background: "rgba(255,255,255,0.2)",
        }}
      >
        <div
          style={{
            height: "100%",
            background: "#1890ff",
            width: `${((playState.currentSlideIndex + 1) / slides.length) * 100}%`,
            transition: "width 0.3s ease",
          }}
        />
        <input
          type="range"
          min={0}
          max={slides.length - 1}
          value={playState.currentSlideIndex}
          onChange={(e) => goToSlide(parseInt(e.target.value))}
          style={{
            position: "absolute",
            top: -8,
            left: 0,
            width: "100%",
            height: 20,
            opacity: 0,
            cursor: "pointer",
          }}
        />
      </div>
    </div>
  );
};
