import { DropZone } from "../components/DropZone";
import { isRetryableError, useAppRuntime } from "../app/AppRuntimeProvider";

interface EmptySceneProps {
  onOpenFile?: () => void;
}

export function EmptyScene({ onOpenFile }: EmptySceneProps): React.ReactElement {
  const runtime = useAppRuntime();

  return (
    <DropZone
      error={runtime.error}
      onOpenFile={onOpenFile ?? runtime.openFile}
      onRetry={isRetryableError(runtime.error) ? runtime.openFile : undefined}
      traceId={runtime.traceId}
      ariaLabel={runtime.t("card-viewer.dropzone.ariaLabel")}
      fileMarkLabel={runtime.t("card-viewer.dropzone.fileMark")}
      title={runtime.t("card-viewer.dropzone.title")}
      description={runtime.t("card-viewer.dropzone.description")}
      openLabel={runtime.t("card-viewer.actions.open")}
      reselectLabel={runtime.t("card-viewer.actions.reselectFile")}
      onFilePath={runtime.openFilePath}
    />
  );
}
