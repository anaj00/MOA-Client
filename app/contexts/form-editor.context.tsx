"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { formsControllerRegisterForm } from "@/app/api";
import { normalizeBlocksForSave } from "@/lib/form-schema-normalizer";
import {
  IFormMetadata,
  IFormBlock,
  IFormSigningParty,
  IFormSubscriber,
  SCHEMA_VERSION,
} from "@betterinternship/core/forms";

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

export type EditorTab = "editor" | "preview" | "metadata" | "parties" | "subscribers" | "settings";

interface FormDocumentType {
  name: string;
  label: string;
  version: number;
  base_document_id: string;
  time_generated: string;
}

interface FormEditorContextType {
  // Metadata
  formMetadata: IFormMetadata | null;
  setFormMetadata: (metadata: IFormMetadata) => void;

  // Fetched Data
  formDocument: FormDocumentType | null;
  setFormDocument: (document: FormDocumentType | null) => void;
  formVersion: number | null;
  setFormVersion: (version: number | null) => void;
  documentUrl: string | null;
  setDocumentUrl: (url: string | null) => void;
  documentFile: File | null;
  setDocumentFile: (file: File | null) => void;
  lastLoadedFileName: string | null;
  setLastLoadedFileName: (name: string | null) => void;

  // UI State
  activeTab: EditorTab;
  setActiveTab: (tab: EditorTab) => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
  isSaving: boolean;

  // Form operations
  updateFormMetadata: (updates: Partial<IFormMetadata>) => void;
  updateBlocks: (blocks: IFormBlock[]) => void;
  updateSigningParties: (parties: IFormSigningParty[]) => void;
  updateSubscribers: (subscribers: IFormSubscriber[]) => void;
  saveForm: () => Promise<void>;
}

const FormEditorContext = createContext<FormEditorContextType | undefined>(undefined);

export function FormEditorProvider({
  children,
  initialMetadata = BLANK_FORM_METADATA,
}: {
  children: ReactNode;
  initialMetadata?: IFormMetadata;
}) {
  const [formMetadata, setFormMetadata] = useState<IFormMetadata>(initialMetadata);
  const [formDocument, setFormDocument] = useState<FormDocumentType | null>(null);
  const [formVersion, setFormVersion] = useState<number | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [lastLoadedFileName, setLastLoadedFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("editor");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateFormMetadata = useCallback((updates: Partial<IFormMetadata>) => {
    setFormMetadata((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const updateBlocks = useCallback((blocks: IFormBlock[]) => {
    const normalizedBlocks = normalizeBlocksForSave(blocks);
    setFormMetadata((prev) => {
      const newMetadata = {
        ...prev,
        schema: {
          ...prev.schema,
          blocks: normalizedBlocks,
        },
      };
      return newMetadata;
    });
  }, []);

  const updateSigningParties = useCallback((parties: IFormSigningParty[]) => {
    setFormMetadata((prev) => ({
      ...prev,
      signing_parties: parties,
    }));
  }, []);

  const updateSubscribers = useCallback((subscribers: IFormSubscriber[]) => {
    setFormMetadata((prev) => ({
      ...prev,
      subscribers,
    }));
  }, []);

  const queryClient = useQueryClient();

  const saveForm = useCallback(async () => {
    if (!formMetadata) return;
    setIsSaving(true);
    try {
      const normalizedMetadata: IFormMetadata = {
        ...formMetadata,
        schema_version: SCHEMA_VERSION,
        schema: {
          ...formMetadata.schema,
          blocks: normalizeBlocksForSave(formMetadata.schema.blocks),
        },
      };

      await formsControllerRegisterForm(normalizedMetadata);
      queryClient.invalidateQueries({ queryKey: ["docs-forms-names"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/forms/form-latest", { name: formMetadata.name }],
      });
      toast.success("Form saved successfully!", toastPresets.success);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save form", toastPresets.destructive);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [formMetadata, queryClient]);

  const value: FormEditorContextType = useMemo(() => {
    return {
      formMetadata,
      setFormMetadata,
      formDocument,
      setFormDocument,
      formVersion,
      setFormVersion,
      documentUrl,
      setDocumentUrl,
      documentFile,
      setDocumentFile,
      lastLoadedFileName,
      setLastLoadedFileName,
      activeTab,
      setActiveTab,
      isEditing,
      setIsEditing,
      isSaving,
      updateFormMetadata,
      updateBlocks,
      updateSigningParties,
      updateSubscribers,
      saveForm,
    };
  }, [
    formMetadata,
    formDocument,
    formVersion,
    documentUrl,
    documentFile,
    lastLoadedFileName,
    activeTab,
    isEditing,
    isSaving,
    updateFormMetadata,
    updateBlocks,
    updateSigningParties,
    updateSubscribers,
    saveForm,
  ]);

  return <FormEditorContext.Provider value={value}>{children}</FormEditorContext.Provider>;
}

export function useFormEditor() {
  const context = useContext(FormEditorContext);
  if (!context) {
    throw new Error("useFormEditor must be used within FormEditorProvider");
  }
  return context;
}
