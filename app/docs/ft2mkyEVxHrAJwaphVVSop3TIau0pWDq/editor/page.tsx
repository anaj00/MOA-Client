/**
 * @ Author: BetterInternship
 * @ Description: Main form editor page with context-based state management
 */

"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { useFormsControllerGetLatestFormDocumentAndMetadata } from "@/app/api";
import { SCHEMA_VERSION, type IFormMetadata } from "@betterinternship/core/forms";
import { FormEditorProvider, useFormEditor } from "@/app/contexts/form-editor.context";
import { EditorToolbar } from "@/components/editor/toolbar/EditorToolbar";
import { EditorContent } from "@/components/editor/tabs/EditorContent";

// Blank form metadata for new forms
const BLANK_FORM_METADATA: IFormMetadata = {
  name: "new-form",
  label: "New Form",
  schema_version: SCHEMA_VERSION,
  schema: {
    blocks: [],
  },
  signing_parties: [
    {
      _id: "initiator",
      order: 1,
      signatory_title: "initiator",
    },
  ],
  subscribers: [],
};

function FormEditorLoadingFallback() {
  return (
    <div className="bg-background flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader />
        <p className="text-muted-foreground text-sm">Loading editor...</p>
      </div>
    </div>
  );
}

function FormEditorContent() {
  const searchParams = useSearchParams();
  const formName = searchParams.get("form_name");
  const {
    setFormMetadata,
    setFormDocument,
    setFormVersion,
    setDocumentUrl,
    setDocumentFile,
    setLastLoadedFileName,
  } = useFormEditor();
  const [isLoading, setIsLoading] = useState(true);

  const { data: fetchedData } = useFormsControllerGetLatestFormDocumentAndMetadata({
    name: formName || "",
  });

  useEffect(() => {
    const initForm = () => {
      try {
        setIsLoading(true);

        if (formName && fetchedData?.formMetadata) {
          setFormMetadata(fetchedData.formMetadata);
          setFormDocument(fetchedData.formDocument || null);
          setFormVersion(fetchedData.formVersion || null);
          setDocumentUrl(fetchedData.formUrl || null);

          // Fetch the PDF from the formUrl and set it as documentFile
          if (fetchedData.formUrl) {
            fetch(fetchedData.formUrl)
              .then((res) => {
                if (!res.ok) {
                  throw new Error(`Failed to fetch PDF: ${res.status} ${res.statusText}`);
                }
                return res.blob();
              })
              .then((blob) => {
                const fileName = `${formName}.pdf`;
                const file = new File([blob], fileName, { type: "application/pdf" });
                setDocumentFile(file);
                setLastLoadedFileName(fileName);
                // Loading complete only after PDF is loaded
                setIsLoading(false);
              })
              .catch((err) => {
                console.error("Failed to fetch PDF:", err);
                setIsLoading(false);
              });
          } else {
            // No PDF to load, loading complete
            setIsLoading(false);
          }
        } else {
          setFormMetadata(BLANK_FORM_METADATA);
          setFormDocument(null);
          setFormVersion(null);
          setDocumentUrl(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading form:", error);
        toast.error("Failed to load form", toastPresets.destructive);
        setFormMetadata(BLANK_FORM_METADATA);
        setFormDocument(null);
        setFormVersion(null);
        setDocumentUrl(null);
        setIsLoading(false);
      }
    };

    initForm();
  }, [formName, fetchedData]);

  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader />
          <p className="text-muted-foreground text-sm">Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <EditorToolbar />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <EditorContent />
      </div>
    </div>
  );
}

export default function FormEditorPage() {
  return (
    <Suspense fallback={<FormEditorLoadingFallback />}>
      <FormEditorProvider>
        <FormEditorContent />
      </FormEditorProvider>
    </Suspense>
  );
}
