import React, { useEffect, useRef, useState } from "react";
import { resolveMobilePagerTargetPage } from "../../utils/layout";

function isMobilePagerDragIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  return target.closest("button, input, textarea, select, label, a, [role='button'], [data-mobile-pager-drag='ignore']") !== null;
}

export interface MobilePagerProps {
  isMobilePagerLayout: boolean;
  viewportWidth: number;
  children: React.ReactNode;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function MobilePager(props: MobilePagerProps): React.ReactElement {
  const { isMobilePagerLayout, viewportWidth, children, t } = props;
  const [mobilePageIndex, setMobilePageIndex] = useState(0);
  const [isMousePagerDragging, setIsMousePagerDragging] = useState(false);
  const mobilePagerRef = useRef<HTMLDivElement | null>(null);
  const mobilePageIndexRef = useRef(0);
  const mobilePagerViewportRef = useRef({
    isMobilePagerLayout: false,
    viewportWidth: 0,
  });
  const mobilePagerDragStateRef = useRef({
    isPointerDown: false,
    isDragging: false,
    startX: 0,
    currentX: 0,
    startScrollLeft: 0,
    startPageIndex: 0,
  });
  const mobilePagerDraggingStateRef = useRef(false);

  function setMousePagerDraggingState(nextValue: boolean): void {
    if (mobilePagerDraggingStateRef.current === nextValue) {
      return;
    }

    mobilePagerDraggingStateRef.current = nextValue;
    setIsMousePagerDragging(nextValue);
  }

  function scrollToMobilePage(pageIndex: number, behavior: ScrollBehavior = "smooth"): void {
    const pager = mobilePagerRef.current;
    const clampedPageIndex = Math.max(0, Math.min(1, pageIndex));

    setMobilePageIndex(clampedPageIndex);

    if (!pager) {
      return;
    }

    pager.scrollTo({
      left: pager.clientWidth * clampedPageIndex,
      behavior,
    });
  }

  function handleMobilePagerScroll(event: React.UIEvent<HTMLDivElement>): void {
    if (!isMobilePagerLayout) {
      return;
    }

    const pagerWidth = event.currentTarget.clientWidth;
    if (pagerWidth <= 0) {
      return;
    }

    const nextPageIndex = Math.max(0, Math.min(1, Math.round(event.currentTarget.scrollLeft / pagerWidth)));
    if (nextPageIndex !== mobilePageIndex) {
      setMobilePageIndex(nextPageIndex);
    }
  }

  function handleMobilePagerMouseDown(event: React.MouseEvent<HTMLDivElement>): void {
    if (!isMobilePagerLayout || event.button !== 0 || isMobilePagerDragIgnoredTarget(event.target)) {
      return;
    }

    const pager = mobilePagerRef.current;
    if (!pager) {
      return;
    }

    mobilePagerDragStateRef.current = {
      isPointerDown: true,
      isDragging: false,
      startX: event.clientX,
      currentX: event.clientX,
      startScrollLeft: pager.scrollLeft,
      startPageIndex: mobilePageIndexRef.current,
    };
    setMousePagerDraggingState(false);
    event.preventDefault();
  }

  useEffect(() => {
    mobilePageIndexRef.current = mobilePageIndex;
  }, [mobilePageIndex]);

  useEffect(() => {
    const pager = mobilePagerRef.current;
    const didLayoutModeChange = mobilePagerViewportRef.current.isMobilePagerLayout !== isMobilePagerLayout;
    const didViewportWidthChange = mobilePagerViewportRef.current.viewportWidth !== viewportWidth;

    mobilePagerViewportRef.current = {
      isMobilePagerLayout,
      viewportWidth,
    };

    if (!isMobilePagerLayout || !pager || (!didLayoutModeChange && !didViewportWidthChange)) {
      return;
    }

    pager.scrollTo({
      left: pager.clientWidth * mobilePageIndex,
      behavior: "auto",
    });
  }, [isMobilePagerLayout, mobilePageIndex, viewportWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const finishMousePagerDrag = (clientX: number | null) => {
      const pager = mobilePagerRef.current;
      const dragState = mobilePagerDragStateRef.current;

      if (!dragState.isPointerDown) {
        return;
      }

      if (typeof clientX === "number") {
        dragState.currentX = clientX;
      }

      if (pager && dragState.isDragging) {
        const nextPageIndex = resolveMobilePagerTargetPage(
          dragState.startPageIndex,
          dragState.currentX - dragState.startX,
          pager.clientWidth,
        );
        setMobilePageIndex(nextPageIndex);
        pager.scrollTo({
          left: pager.clientWidth * nextPageIndex,
          behavior: "smooth",
        });
      }

      mobilePagerDragStateRef.current = {
        isPointerDown: false,
        isDragging: false,
        startX: 0,
        currentX: 0,
        startScrollLeft: 0,
        startPageIndex: mobilePageIndexRef.current,
      };
      setMousePagerDraggingState(false);
    };

    const handleWindowMouseMove = (event: MouseEvent) => {
      if (!isMobilePagerLayout) {
        return;
      }

      const pager = mobilePagerRef.current;
      const dragState = mobilePagerDragStateRef.current;
      if (!pager || !dragState.isPointerDown) {
        return;
      }

      dragState.currentX = event.clientX;
      const deltaX = dragState.currentX - dragState.startX;
      if (!dragState.isDragging && Math.abs(deltaX) < 6) {
        return;
      }

      dragState.isDragging = true;
      pager.scrollLeft = dragState.startScrollLeft - deltaX;
      setMousePagerDraggingState(true);
      event.preventDefault();
    };

    const handleWindowMouseUp = (event: MouseEvent) => {
      finishMousePagerDrag(event.clientX);
    };

    const handleWindowBlur = () => {
      finishMousePagerDrag(null);
    };

    window.addEventListener("mousemove", handleWindowMouseMove, { passive: false });
    window.addEventListener("mouseup", handleWindowMouseUp);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
      window.removeEventListener("blur", handleWindowBlur);
      finishMousePagerDrag(null);
    };
  }, [isMobilePagerLayout]);

  return (
    <>
      {isMobilePagerLayout ? (
        <div className="music-player-mobile-pagination" aria-label={t("music-player.section.mobilePages")}>
          <button
            type="button"
            className={`music-player-mobile-dot${mobilePageIndex === 0 ? " music-player-mobile-dot--active" : ""}`}
            aria-label={t("music-player.actions.showPlayerPage")}
            aria-current={mobilePageIndex === 0 ? "page" : undefined}
            onClick={() => {
              scrollToMobilePage(0);
            }}
          />
          <button
            type="button"
            className={`music-player-mobile-dot${mobilePageIndex === 1 ? " music-player-mobile-dot--active" : ""}`}
            aria-label={t("music-player.actions.showLyricsPage")}
            aria-current={mobilePageIndex === 1 ? "page" : undefined}
            onClick={() => {
              scrollToMobilePage(1);
            }}
          />
        </div>
      ) : null}
      <div
        className={`main${isMobilePagerLayout ? " main--mobile-pager" : ""}${isMousePagerDragging ? " main--mobile-pager--dragging" : ""}`}
        ref={mobilePagerRef}
        onScroll={handleMobilePagerScroll}
        onMouseDown={handleMobilePagerMouseDown}
      >
        {children}
      </div>
    </>
  );
}
