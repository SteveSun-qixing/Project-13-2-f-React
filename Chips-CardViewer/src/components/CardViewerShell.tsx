import React from "react";
import { MotionConfig, motion } from "framer-motion";
import "./CardViewerShell.css";

interface CardViewerShellProps {
  surfaceMode: "immersive" | "document";
  content: React.ReactNode;
  action?: React.ReactNode;
}

const SHELL_ENTER_ANIMATION = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.24, ease: "easeOut" },
} as const;

export function CardViewerShell({
  surfaceMode,
  content,
  action,
}: CardViewerShellProps) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        data-chips-app="card-viewer.shell"
        data-chips-surface-mode={surfaceMode}
        className={[
          "card-viewer-shell",
          surfaceMode === "document" ? "card-viewer-shell--document" : "card-viewer-shell--immersive",
        ].join(" ")}
        {...SHELL_ENTER_ANIMATION}
      >
        <main
          data-chips-app="card-viewer.main"
          className={[
            "card-viewer-shell__main",
            surfaceMode === "document"
              ? "card-viewer-shell__main--document"
              : "card-viewer-shell__main--immersive",
          ].join(" ")}
        >
          {content}
        </main>
        {action}
      </motion.div>
    </MotionConfig>
  );
}
