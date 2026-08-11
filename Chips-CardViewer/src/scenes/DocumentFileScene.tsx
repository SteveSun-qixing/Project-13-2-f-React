import { AnimatePresence, motion } from "framer-motion";
import { CardWindow } from "../components/CardWindow";
import { ViewerCoverSurface } from "../components/ViewerCoverSurface";
import { useAppRuntime, type OpenedTarget } from "../app/AppRuntimeProvider";

interface DocumentFileSceneProps {
  target: Extract<OpenedTarget, { kind: "file" }>;
}

const DOCUMENT_SCENE_TRANSITION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: "easeIn" } },
} as const;

export function DocumentFileScene({ target }: DocumentFileSceneProps): React.ReactElement {
  const runtime = useAppRuntime();
  const activeCover = runtime.activeCover;
  const showsCover = runtime.viewerMode === "cover" && activeCover !== null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={runtime.viewerMode}
        className="card-viewer-scene"
        variants={DOCUMENT_SCENE_TRANSITION_VARIANTS}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {showsCover ? (
          <ViewerCoverSurface
            client={runtime.client}
            cover={activeCover}
            title={runtime.activeTitle ?? activeCover.title ?? runtime.t("card-viewer.viewer.documentTitle")}
            closeLabel={runtime.t("card-viewer.actions.viewContent")}
            unavailableLabel={runtime.t("card-viewer.viewer.coverUnavailable")}
            onClose={runtime.showContent}
          />
        ) : (
          <CardWindow
            client={runtime.client}
            filePath={target.filePath}
            traceId={runtime.traceId}
            locale={runtime.locale}
            loadingLabel={runtime.t("card-viewer.viewer.documentLoading")}
            containerErrorLabel={runtime.t("card-viewer.viewer.documentContainerError")}
            fatalErrorFallback={runtime.t("card-viewer.viewer.documentFatalError")}
            renderErrorFallback={runtime.t("card-viewer.viewer.documentRenderError")}
            resourceOpenErrorTitle={runtime.t("card-viewer.errors.resourceOpenFailedTitle")}
            resourceOpenErrorFallback={runtime.t("card-viewer.errors.resourceOpenFailed")}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
