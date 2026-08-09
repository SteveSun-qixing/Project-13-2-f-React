import { PictureOutlined } from "@ant-design/icons";
import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import "./Filmstrip.css";

export interface FilmstripItem {
  sourceId: string;
  fileName: string;
  thumbSrc?: string;
}

interface FilmstripProps {
  items: FilmstripItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  visible: boolean;
}

export function Filmstrip(props: FilmstripProps): ReactElement {
  const { items, currentIndex, onSelect, visible } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement | null>>(new Map());

  useEffect(() => {
    const container = containerRef.current;
    const currentItem = itemRefs.current.get(currentIndex);
    if (!container || !currentItem) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const targetScrollLeft = currentItem.offsetLeft + currentItem.offsetWidth / 2 - container.clientWidth / 2;
    container.scrollTo({ left: targetScrollLeft, behavior: reduceMotion ? "auto" : "smooth" });
  }, [currentIndex, items.length]);

  return (
    <div className={`pv-filmstrip${visible ? "" : " pv-filmstrip--hidden"}`} ref={containerRef}>
      {items.map((item, index) => {
        const isCurrent = index === currentIndex;
        return (
          <button
            key={item.sourceId}
            ref={(element) => {
              itemRefs.current.set(index, element);
            }}
            type="button"
            className={`pv-filmstrip__item${isCurrent ? " pv-filmstrip__item--current" : ""}`}
            onClick={() => onSelect(index)}
            aria-label={item.fileName}
            aria-current={isCurrent ? "true" : undefined}
          >
            {item.thumbSrc ? (
              <img
                className="pv-filmstrip__thumb"
                src={item.thumbSrc}
                alt=""
                decoding="async"
                draggable={false}
              />
            ) : (
              <span className="pv-filmstrip__placeholder" aria-hidden="true">
                <PictureOutlined />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
