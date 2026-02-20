"use client";

import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormEditorTabProvider, useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { PdfViewerProvider } from "@/app/contexts/pdf-viewer.context";
import { PdfViewer } from "@/components/docs/form-editor/form-pdf-editor/PdfViewer";
import { BlocksPanel } from "./editor-components/BlocksPanel";
import { RevampedBlockEditor } from "./editor-components/RevampedBlockEditor";
import { FormViewCanvas } from "./editor-components/FormViewCanvas";

function FormEditorTabContent() {
  const { formMetadata } = useFormEditor();
  const { selectedPartyId, setSelectedPartyId, editorViewMode } = useFormEditorTab();

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  return (
    <div className="bg-background flex h-full w-full">
      {/* Left Panel - Responsive */}
      <div className="bg-card flex flex-shrink-0 basis-72 flex-col overflow-hidden border-r lg:basis-[320px] xl:basis-[360px]">
        {editorViewMode === "pdf" ? (
          <BlocksPanel
            blocks={formMetadata.schema.blocks}
            selectedPartyId={selectedPartyId}
            onPartyChange={setSelectedPartyId}
            signingParties={formMetadata.signing_parties || []}
          />
        ) : (
          <FormViewCanvas />
        )}
      </div>

      {/* Center - PDF Viewer */}
      <div className="min-w-0 flex-1 overflow-hidden border-r">
        <PdfViewer />
      </div>

      {/* Right Panel - Responsive */}
      <div className="bg-card hidden flex-shrink-0 basis-60 flex-col overflow-hidden border-l md:flex lg:basis-74 xl:basis-80">
        <RevampedBlockEditor />
      </div>
    </div>
  );
}

export function FormEditorTab() {
  const { documentFile, setDocumentFile, lastLoadedFileName, setLastLoadedFileName } =
    useFormEditor();

  return (
    <PdfViewerProvider
      documentFile={documentFile}
      setDocumentFile={setDocumentFile}
      lastLoadedFileName={lastLoadedFileName}
      setLastLoadedFileName={setLastLoadedFileName}
    >
      <FormEditorTabProvider>
        <FormEditorTabContent />
      </FormEditorTabProvider>
    </PdfViewerProvider>
  );
}
