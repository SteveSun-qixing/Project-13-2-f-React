import { PdfRuntimeProvider, PdfViewer, usePdf } from "../apps/pdf";

function DocumentSceneWorkspace() {
  const { openFromDialog } = usePdf();

  return <PdfViewer onOpenFile={openFromDialog} />;
}

function DocumentScene() {
  return (
    <PdfRuntimeProvider>
      <DocumentSceneWorkspace />
    </PdfRuntimeProvider>
  );
}

export { DocumentScene };
