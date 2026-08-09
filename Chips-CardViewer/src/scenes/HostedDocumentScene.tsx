import { AnimatePresence, motion } from "framer-motion";
import { HostedDocumentWindow } from "../components/HostedDocumentWindow";
import { ViewerCoverSurface } from "../components/ViewerCoverSurface";
import { useAppRuntime, type OpenedTarget } from "../app/AppRuntimeProvider";

interface HostedDocumentSceneProps {
  target: Extract<OpenedTarget, { kind: "document" }>;
}

const DOCUMENT_SCENE_TRANSITION_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.24, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.16, ease: "easeIn" } },
} as const;

export function HostedDocumentScene({ target }: HostedDocumentSceneProps): React.ReactElement {
  const runtime = useAppRuntime();
  const activeCover = runtime.activeCover;
  const showsCover = runtime.viewerMode === "cover" && activeCover !== null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={runtime.viewerMode}
        variants={DOCUMENT_SCENE_TRANSITION_VARIANTS}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {showsCover ? (
          <ViewerCoverSurface
            client={runtime.client}
            cover={activeCover}
            title={runtime.activeTitle ?? activeCover.title ?? runtime.t("card-viewer.viewer.hostedDocumentTitle")}
            closeLabel={runtime.t("card-viewer.actions.viewContent")}
            unavailableLabel={runtime.t("card-viewer.viewer.coverUnavailable")}
            onClose={runtime.showContent}
          />
        ) : (
          <HostedDocumentWindow
            client={runtime.client}
            documentUrl={target.documentUrl}
            traceId={runtime.traceId}
            iframeTitle={runtime.t("card-viewer.viewer.hostedDocumentFrameTitle")}
            loadingLabel={runtime.t("card-viewer.viewer.documentLoading")}
            containerErrorLabel={runtime.t("card-viewer.viewer.documentContainerError")}
            resourceOpenErrorTitle={runtime.t("card-viewer.errors.resourceOpenFailedTitle")}
            resourceOpenErrorFallback={runtime.t("card-viewer.errors.resourceOpenFailed")}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
