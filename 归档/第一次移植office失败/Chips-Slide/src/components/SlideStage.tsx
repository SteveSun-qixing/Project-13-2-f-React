/**
 * 幻灯片编辑舞台：左侧缩略图列表（antd）+ 中央 Konva 画布（缩放适配）+
 * 底部状态栏（页码、缩放百分比、未保存标记）。
 */
import React, { useMemo, useRef } from "react";
import { Button, Tooltip } from "antd";
import {
  CopyOutlined,
  DownOutlined,
  FileAddOutlined,
  UpOutlined,
} from "@ant-design/icons";
import type { RenderSlide } from "@genoffice/pptx-render";
import { SlideThumb } from "../slides/render/SlideThumb";
import { SlideCanvasStage } from "./SlideCanvasStage";
import { useDeck } from "../state/deck-store";
import { formatMessage } from "../lib/messages";

export function SlideStage(): React.ReactElement {
  const deck = useDeck();
  const scrollRef = useRef<HTMLDivElement>(null);

  const thumbnails = useMemo(
    () =>
      deck.slides.map((slide: RenderSlide, index: number) => ({
        slide,
        index,
      })),
    [deck.slides],
  );

  return (
    <div className="slide-stage">
      <aside className="slide-stage__sidebar" aria-label={formatMessage("deck.slide.thumbnails")}>
        <div className="slide-stage__sidebar-actions">
          <Tooltip title={formatMessage("deck.slide.add")}>
            <Button
              size="small"
              icon={<FileAddOutlined />}
              onClick={() =>
                deck.apply({ op: "addBlankSlide", target: { slide: deck.currentIndex } })
              }
            />
          </Tooltip>
          <Tooltip title={formatMessage("deck.slide.duplicate")}>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() =>
                deck.apply({ op: "duplicateSlide", target: { slide: deck.currentIndex } })
              }
            />
          </Tooltip>
          <Tooltip title={formatMessage("deck.slide.moveUp")}>
            <Button
              size="small"
              icon={<UpOutlined />}
              onClick={() =>
                deck.apply({
                  op: "moveSlide",
                  target: { slide: deck.currentIndex },
                  to: deck.currentIndex - 1,
                })
              }
            />
          </Tooltip>
          <Tooltip title={formatMessage("deck.slide.moveDown")}>
            <Button
              size="small"
              icon={<DownOutlined />}
              onClick={() =>
                deck.apply({
                  op: "moveSlide",
                  target: { slide: deck.currentIndex },
                  to: deck.currentIndex + 1,
                })
              }
            />
          </Tooltip>
        </div>
        <div className="slide-stage__thumbs" ref={scrollRef}>
          {thumbnails.map(({ slide, index }) => (
            <button
              key={`${slide.widthPx}-${index}`}
              type="button"
              className={`slide-stage__thumb${index === deck.currentIndex ? " slide-stage__thumb--active" : ""}`}
              onClick={() => deck.setCurrentIndex(index)}
            >
              <span className="slide-stage__thumb-number">{index + 1}</span>
              <span className="slide-stage__thumb-body">
                <SlideThumb slide={slide} images={deck.images} width={128} />
              </span>
            </button>
          ))}
        </div>
      </aside>
      <section className="slide-stage__main">
        <div className="slide-stage__canvas-host">
          {deck.currentSlide ? (
            <div className="slide-stage__canvas-frame">
              <SlideCanvasStage
                slide={deck.currentSlide}
                images={deck.images}
                selectedId={deck.selectedId}
                editing={deck.editing}
                onSelect={deck.select}
                onStartEdit={deck.startEdit}
                onCancelEdit={deck.cancelEdit}
                onCommitText={deck.commitEdit}
                apply={deck.apply}
              />
            </div>
          ) : null}
        </div>
        <footer className="slide-stage__status">
          <span>
            {formatMessage("deck.slide.counter", {
              current: deck.currentIndex + 1,
              total: deck.slides.length,
            })}
          </span>
          <span>{formatMessage("deck.slide.zoomPercent", { percent: Math.round(deck.zoom * 100) })}</span>
          {deck.dirty ? (
            <span className="slide-stage__dirty">{formatMessage("deck.slide.dirty")}</span>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
