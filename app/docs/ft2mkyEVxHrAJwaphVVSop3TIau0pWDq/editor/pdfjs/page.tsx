/**
 * @ Author: BetterInternship [Jana]
 * @ Create Time: 2025-12-16 15:37:57
 * @ Modified time: 2025-12-29 18:33:21
 * @ Modified time: 2025-12-30 11:48:47
 *                Orchestrates form editor state with block-centric metadata management
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Suspense } from "react";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { useModal } from "@/app/providers/modal-provider";
import { useSearchParams } from "next/navigation";
import { toastPresets } from "@/components/sonner-toaster";
import { PdfViewer } from "../../../../../components/docs/form-editor/form-pdf-editor/PdfViewer";
import { EditorSidebar } from "../../../../../components/docs/form-editor/EditorSidebar";
import { FormLayoutEditor } from "../../../../../components/docs/form-editor/form-layout/FormLayoutEditor";
import { FieldRegistrationModalContent } from "@/components/docs/form-editor/FieldRegistrationModalContent";
import { useFieldOperations } from "../../../../../hooks/use-field-operations";
import { useFieldRegistration } from "../../../../../hooks/use-field-registration";
import {
  useFormsControllerGetFieldRegistry,
  formsControllerRegisterForm,
  formsControllerGetFieldFromRegistry,
  useFormsControllerGetLatestFormDocumentAndMetadata,
} from "@/app/api";
import { getFieldLabelByName } from "@/app/docs/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq/editor/field-template.ctx";
import {
  FormMetadata,
  SCHEMA_VERSION,
  type IFormBlock,
  type IFormField,
  type IFormMetadata,
} from "@betterinternship/core/forms";
import type { FormField } from "../../../../../components/docs/form-editor/form-pdf-editor/FieldBox";
import { Button } from "@/components/ui/button";
import { Edit2, Check, X, Layout } from "lucide-react";

// Utility to generate unique IDs for blocks
const generateBlockId = () => `block-${Math.random().toString(36).substr(2, 9)}`;

// Blank form metadata for new forms
const BLANK_FORM_METADATA: IFormMetadata = {
  name: "new-form",
  label: "New Form",
  schema_version: SCHEMA_VERSION,
  schema: {
    blocks: [],
  },
  signing_parties: [],
  subscribers: [],
};

const PdfJsEditorPage = () => {
  const searchParams = useSearchParams();
  const formName = searchParams.get("name");
  const isNewForm = searchParams.get("isNew") === "true" || !formName;

  const { data: formData, refetch: refetchFormData } =
    useFormsControllerGetLatestFormDocumentAndMetadata({
      name: formName || "",
    });
  const { data: fieldRegistryData } = useFormsControllerGetFieldRegistry();
  const registry = fieldRegistryData?.fields ?? [];

  // Load form creation data from sessionStorage if available
  const [creationData, setCreationData] = useState<any>(null);
  const [creationPdfUrl, setCreationPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    const formCreationData = sessionStorage.getItem("formCreationData");
    const pdfData = sessionStorage.getItem("formCreationPdfData");

    if (formCreationData) {
      try {
        const parsed = JSON.parse(formCreationData);
        setCreationData(parsed);

        // Clear from storage after retrieval
        sessionStorage.removeItem("formCreationData");

        if (pdfData) {
          const blob = new Blob([pdfData], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setCreationPdfUrl(url);
          sessionStorage.removeItem("formCreationPdfData");
        }
      } catch (error) {
        console.error("Failed to parse form creation data:", error);
      }
    }
  }, []);

  // Create initial metadata with creation data
  const initialMetadata = useMemo(() => {
    if (creationData) {
      return {
        name: creationData.formName,
        label: creationData.formLabel,
        schema_version: SCHEMA_VERSION,
        schema: {
          blocks: [],
        },
        signing_parties: creationData.signatories || [],
        subscribers: [],
      };
    }
    return null;
  }, [creationData]);

  // Initialize FormMetadata with loaded data or blank data for new forms
  const formMetadata = useMemo(() => {
    const data =
      initialMetadata ||
      (((formData?.formMetadata as any) || BLANK_FORM_METADATA) as IFormMetadata);
    return new FormMetadata<[]>(data);
  }, [formData, isNewForm, initialMetadata]);

  // Get all blocks from FormMetadata (includes headers, paragraphs, form fields, etc.)
  // Use raw block structure for form editing
  const ALL_BLOCKS_RAW = useMemo(() => {
    const metadataData = formData?.formMetadata || BLANK_FORM_METADATA;
    return metadataData.schema?.blocks || [];
  }, [formData, isNewForm]);

  // Extract only form field blocks (non-phantom) for the PDF preview
  const INITIAL_FIELDS: FormField[] = useMemo(() => {
    return ALL_BLOCKS_RAW.filter(
      (block: any) => block.block_type === "form_field" && block.field_schema
    ).map((block: any, idx) => {
      const field = block.field_schema as IFormField;
      return {
        id: "", // Will be populated from registry
        _id: block._id || `field-${idx}-${Math.random().toString(36).substr(2, 9)}`, // Use block._id or generate
        field: field.field,
        label: field.label,
        page: field.page,
        x: field.x,
        y: field.y,
        w: field.w,
        h: field.h,
        align_h: (field.align_h ?? "left") as "left" | "center" | "right",
        align_v: (field.align_v ?? "top") as "top" | "middle" | "bottom",
        size: field.size ?? 11,
        wrap: field.wrap ?? true,
      };
    });
  }, [ALL_BLOCKS_RAW]);

  const { openModal, closeModal } = useModal();

  const [selectedFieldId, setSelectedFieldId] = useState<string>("");
  const [fields, setFields] = useState<FormField[]>(INITIAL_FIELDS);
  const [isPlacingField, setIsPlacingField] = useState<boolean>(false);
  const [placementFieldType, setPlacementFieldType] = useState<string>("text");
  const [placementAlign_h, setPlacementAlign_h] = useState<"left" | "center" | "right">("left");
  const [placementAlign_v, setPlacementAlign_v] = useState<"top" | "middle" | "bottom">("top");
  const [placementSize, setPlacementSize] = useState<number>(11);
  const [placementWrap, setPlacementWrap] = useState<boolean>(true);
  const [formLabel, setFormLabel] = useState<string>(formMetadata.getLabel());
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [editingNameValue, setEditingNameValue] = useState<string>(formLabel);
  const [activeView, setActiveView] = useState<"pdf" | "layout">("pdf");
  const [metadata, setMetadata] = useState<IFormMetadata>(
    (formData?.formMetadata || BLANK_FORM_METADATA) as IFormMetadata
  );
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [debugSchemaInput, setDebugSchemaInput] = useState<string>("");
  const [isDebugModalOpen, setIsDebugModalOpen] = useState<boolean>(false);

  // Refs for scroll-to-field functionality
  const pdfViewerContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const lastMetadataUpdateSourceRef = useRef<"formData" | "localEdit">("formData");

  // Get document URL from form metadata (only for existing forms) or from uploaded PDF or from creation wizard
  const documentUrl =
    creationPdfUrl || uploadedPdfUrl || (isNewForm ? undefined : formData?.formUrl || undefined);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (uploadedPdfUrl) {
        URL.revokeObjectURL(uploadedPdfUrl);
      }
      if (creationPdfUrl) {
        URL.revokeObjectURL(creationPdfUrl);
      }
    };
  }, [uploadedPdfUrl, creationPdfUrl]);

  // Update metadata when registry data loads
  useEffect(() => {
    if (formData?.formMetadata) {
      const metadataData = formData.formMetadata as any as IFormMetadata;
      // Ensure all signing parties have signatory_title
      const partiesWithTitle = (metadataData.signing_parties || []).map((party: any) => ({
        ...party,
        signatory_title: party.signatory_title || party._id,
      }));
      const metadataWithParties = {
        ...metadataData,
        signing_parties: partiesWithTitle,
      };
      setMetadata(metadataWithParties);
      const newFormMetadata = new FormMetadata(metadataWithParties);
      setFormLabel(newFormMetadata.getLabel());
      setEditingNameValue(newFormMetadata.getLabel());

      // Update fields from loaded metadata - MUST include _id from blocks
      const blocksData = metadataWithParties.schema.blocks;
      const fieldsFromMetadata: FormField[] = blocksData
        .filter((block: any) => block.block_type === "form_field" && block.field_schema)
        .map((block: any) => {
          const field = block.field_schema as IFormField;
          return {
            id: "",
            _id: block._id, // CRITICAL: Get _id from block to maintain consistency
            field: field.field,
            label: field.label,
            page: field.page,
            x: field.x,
            y: field.y,
            w: field.w,
            h: field.h,
            align_h: (field.align_h ?? "left") as "left" | "center" | "right",
            align_v: (field.align_v ?? "top") as "top" | "middle" | "bottom",
            size: field.size ?? 11,
            wrap: field.wrap ?? true,
          };
        });
      setFields(fieldsFromMetadata);
    }
  }, [formData]);

  // Update alignment controls when a field is selected
  useEffect(() => {
    if (selectedFieldId) {
      const selectedField = fields.find(
        (f) => (f._id || `${f.field}:${f.page}`) === selectedFieldId
      );
      if (selectedField) {
        setPlacementAlign_h(selectedField.align_h ?? "left");
        setPlacementAlign_v(selectedField.align_v ?? "top");
        setPlacementSize(selectedField.size ?? 11);
        setPlacementWrap(selectedField.wrap ?? true);
      }
    }
  }, [selectedFieldId, fields]);

  // Get blocks from metadata
  // Get blocks from metadata
  const blocks = metadata.schema.blocks;

  // Track previous field count to detect additions/deletions
  const prevFieldCountRef = useRef<number>(fields.length);
  const blocksMapRef = useRef<Map<string, IFormBlock>>(new Map());

  // Update block map whenever blocks change
  useEffect(() => {
    blocksMapRef.current.clear();
    blocks.forEach((block) => {
      blocksMapRef.current.set(block._id, block);
    });
  }, [blocks]);

  /**
   * Auto-sync metadata whenever fields change (with 100ms debounce)
   * Handles: field additions, deletions, and coordinate updates
   * Single effect consolidates ALL field-to-metadata synchronization
   */
  useEffect(() => {
    const syncTimer = setTimeout(() => {
      // Skip syncing if metadata was just updated from a local FormLayoutEditor edit
      if (lastMetadataUpdateSourceRef.current === "localEdit") {
        lastMetadataUpdateSourceRef.current = "formData"; // Reset for next time
        return;
      }

      const currentFieldCount = fields.length;
      const prevFieldCount = prevFieldCountRef.current;
      let newBlocks = [...blocks];
      let hasChanges = false;

      // Handle field additions
      if (currentFieldCount > prevFieldCount) {
        const existingBlockIds = new Set(blocks.map((b) => b._id).filter(Boolean));
        const fieldsNeedingBlocks = fields.filter((f) => f._id && !existingBlockIds.has(f._id));

        if (fieldsNeedingBlocks.length > 0) {
          fieldsNeedingBlocks.forEach((field) => {
            const originalBlock = blocks.find(
              (b) =>
                b.block_type === "form_field" &&
                b.field_schema &&
                (b.field_schema as any).field === field.field &&
                (b.field_schema as any).page === field.page
            );

            const originalFieldSchema = originalBlock?.field_schema;
            const storedMetadata = fieldMetadataRef.current.get(field._id!);
            // New fields are unassigned by default
            const signingPartyId = "";

            const newBlock: IFormBlock = {
              block_type: "form_field",
              _id: field._id!,
              order: newBlocks.length,
              signing_party_id: signingPartyId,
              field_schema: {
                field: field.field,
                type: (storedMetadata?.type || originalFieldSchema?.type || "text") as const,
                x: field.x,
                y: field.y,
                w: field.w,
                h: field.h,
                page: field.page,
                align_h: field.align_h ?? ("left" as const),
                align_v: field.align_v ?? ("top" as const),
                label: field.label,
                tooltip_label:
                  (storedMetadata?.label || originalFieldSchema?.tooltip_label) ?? field.label,
                shared: originalFieldSchema?.shared ?? true,
                signing_party_id: signingPartyId,
                source: (storedMetadata?.source ||
                  originalFieldSchema?.source ||
                  "manual") as const,
                validator: (storedMetadata?.validator || originalFieldSchema?.validator) ?? "",
                prefiller: (storedMetadata?.prefiller || originalFieldSchema?.prefiller) ?? "",
                size: field.size ?? 11,
                wrap: field.wrap ?? true,
              } as IFormField,
            };
            newBlocks = [...newBlocks, newBlock];
            fieldMetadataRef.current.delete(field._id!);
          });
          hasChanges = true;
        }
      }

      // Handle field deletions
      if (currentFieldCount < prevFieldCount) {
        const fieldIds = new Set(fields.map((f) => f._id));
        newBlocks = newBlocks.filter((b) => {
          if (b.block_type !== "form_field") return true;
          return fieldIds.has(b._id);
        });
        if (newBlocks.length < blocks.length) hasChanges = true;
      }

      // Sync coordinates for all fields
      const fieldMap = new Map(fields.map((f) => [f._id, f]));
      newBlocks = newBlocks.map((block) => {
        if (block.block_type === "form_field" && block.field_schema && block._id) {
          const updatedField = fieldMap.get(block._id);
          if (updatedField) {
            const fieldSchema = block.field_schema;
            return {
              ...block,
              field_schema: {
                ...fieldSchema,
                x: updatedField.x,
                y: updatedField.y,
                w: updatedField.w,
                h: updatedField.h,
                align_h: updatedField.align_h ?? fieldSchema.align_h,
                align_v: updatedField.align_v ?? fieldSchema.align_v,
                label: updatedField.label ?? fieldSchema.label,
                size: updatedField.size ?? fieldSchema.size ?? 11,
                wrap: updatedField.wrap ?? fieldSchema.wrap ?? true,
              } as IFormField,
            } as IFormBlock;
          }
        }
        return block;
      });

      // Only update if there were actual changes
      if (hasChanges || JSON.stringify(newBlocks) !== JSON.stringify(blocks)) {
        setMetadata({
          ...metadata,
          schema: {
            ...metadata.schema,
            blocks: newBlocks,
          },
        });
      }

      prevFieldCountRef.current = currentFieldCount;
    }, 100); // Debounce updates

    return () => clearTimeout(syncTimer);
  }, [fields, blocks, metadata]);

  // Field operations
  const fieldOps = useFieldOperations(fields, setFields, setSelectedFieldId, selectedFieldId);

  // Field registration
  const { registerFields } = useFieldRegistration(metadata.name, formLabel);

  /**
   * Handle PDF file upload - preserve URL for view switching
   */
  const handlePdfFileSelect = useCallback((file: File) => {
    setDocumentFile(file);
    // Create and store object URL so PDF persists across view changes
    const objectUrl = URL.createObjectURL(file);
    setUploadedPdfUrl(objectUrl);
  }, []);

  /**
   * Single callback for all field changes (drag, resize, edit)
   * Metadata syncs automatically via useEffect above with 100ms debounce
   */
  const handleFieldsChange = useCallback((fieldId: string, updates: Partial<FormField>) => {
    setFields((prevFields) =>
      prevFields.map((f) => {
        const currentId = f._id || `${f.field}:${f.page}`;
        return currentId === fieldId ? { ...f, ...updates } : f;
      })
    );
  }, []);

  /**
   * Handle field creation with auto-selection
   */
  // Store field metadata temporarily for the block creation useEffect to use
  const fieldMetadataRef = useRef<Map<string, any>>(new Map());

  const handleFieldCreate = useCallback(
    async (newField: FormField) => {
      // Fetch full field details from registry including validator and prefiller
      let fullFieldData: any = null;
      let fieldPreset = "";

      try {
        const registryEntry = registry.find((f) => f.id === newField.id);
        fieldPreset = registryEntry?.preset || "";
        const { field } = await formsControllerGetFieldFromRegistry({ id: newField.id });
        fullFieldData = field;
      } catch (error) {
        console.error("Failed to fetch field details:", error);
      }

      // Generate stable _id for this field if not present
      const fieldId = newField._id || generateBlockId();

      // Look up the label from registry using field name
      const fieldWithLabel: FormField = {
        ...newField,
        _id: fieldId,
        // Format field name as <name>:<preset>
        field: fieldPreset ? `${newField.field}:${fieldPreset}` : newField.field,
        label: getFieldLabelByName(newField.field, registry),
        source: fullFieldData?.source || "manual",
        align_h: placementAlign_h,
        align_v: placementAlign_v,
      };

      // Store metadata for this field so the useEffect can use it when creating the block
      fieldMetadataRef.current.set(fieldId, {
        type: newField.type || "text",
        validator: fullFieldData?.validator || "",
        prefiller: fullFieldData?.prefiller || "",
        label: fieldWithLabel.label,
        source: fullFieldData?.source,
      });

      // Only create the field - let the useEffect create the block
      fieldOps.create(fieldWithLabel);
      setIsPlacingField(false);
    },
    [fieldOps, registry, placementAlign_h, placementAlign_v]
  );

  /**
   * Handle coordinate input changes from sidebar
   */
  const handleCoordinatesChange = useCallback(
    (coords: { x: number; y: number; w: number; h: number }) => {
      if (selectedFieldId) {
        handleFieldsChange(selectedFieldId, coords);
      }
    },
    [selectedFieldId, handleFieldsChange]
  );

  /**
   * Handle field click from sidebar - scroll to field in PDF viewer
   */
  const handleFieldClickInSidebar = useCallback(
    (fieldId: string) => {
      const field = fields.find((f) => (f._id || `${f.field}:${f.page}`) === fieldId);
      if (field && pdfViewerContainerRef.current) {
        // Scroll the PDF viewer to the page containing this field
        const pageElement = pdfViewerContainerRef.current.querySelector(
          `[data-page="${field.page}"]`
        );
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    [fields]
  );

  /**
   * Handle field click from PDF - scroll to field in sidebar
   */
  const handleFieldClickInPdf = useCallback((fieldId: string) => {
    if (sidebarRef.current) {
      // Find the field element in the sidebar and scroll it into view
      const fieldElement = sidebarRef.current.querySelector(`[data-field-id="${fieldId}"]`);
      if (fieldElement) {
        fieldElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, []);

  /**
   * Handle form name edit
   */
  const handleSaveFormName = useCallback(() => {
    if (editingNameValue.trim()) {
      setFormLabel(editingNameValue.trim());
      setIsEditingName(false);
    }
  }, [editingNameValue]);

  const handleCancelNameEdit = useCallback(() => {
    setEditingNameValue(formLabel);
    setIsEditingName(false);
  }, [formLabel]);

  const handleStartEditName = useCallback(() => {
    setEditingNameValue(formLabel);
    setIsEditingName(true);
  }, [formLabel]);

  /**
   * Handle schema injection for debugging
   */
  const handleInjectSchema = useCallback(() => {
    try {
      const parsed = JSON.parse(debugSchemaInput);

      if (!parsed.schema || !parsed.schema.blocks) {
        alert("Invalid schema structure. Must have schema.blocks");
        return;
      }

      // Extract fields from blocks - handle both field_schema (single) and fields (array) formats
      const injectedFields: FormField[] = [];
      parsed.schema.blocks.forEach((block: any, blockIdx: number) => {
        if (block.field_schema) {
          // Single field_schema format
          const fieldSchema = block.field_schema;
          injectedFields.push({
            field: fieldSchema.field,
            id: fieldSchema.field,
            _id: block._id || `field-${blockIdx}-${Math.random().toString(36).substr(2, 9)}`,
            label: fieldSchema.label || fieldSchema.field,
            page: fieldSchema.page || 1,
            x: fieldSchema.x || 0,
            y: fieldSchema.y || 0,
            w: fieldSchema.w || 100,
            h: fieldSchema.h || 40,
          });
        } else if (block.fields && Array.isArray(block.fields)) {
          // Array of fields format
          block.fields.forEach((field: any, fieldIdx: number) => {
            injectedFields.push({
              field: field.field,
              id: field.id || field.field,
              _id:
                field._id ||
                `field-${blockIdx}-${fieldIdx}-${Math.random().toString(36).substr(2, 9)}`,
              label: field.label || field.field,
              page: field.page || 1,
              x: field.x || 0,
              y: field.y || 0,
              w: field.w || 100,
              h: field.h || 40,
            });
          });
        }
      });

      // Normalize metadata: ensure signing_parties and subscribers exist
      const normalizedMetadata: IFormMetadata = {
        name: parsed.name || "untitled",
        label: parsed.label || "Untitled Form",
        schema_version: SCHEMA_VERSION,
        schema: parsed.schema,
        signing_parties: parsed.signing_parties || parsed.signatories || [],
        subscribers: parsed.subscribers || [],
      };

      setMetadata(normalizedMetadata);
      setFields(injectedFields);
      setIsDebugModalOpen(false);
      setDebugSchemaInput("");
      alert(`Schema injected successfully! (${injectedFields.length} fields loaded)`);
    } catch (error: unknown) {
      alert(`Error parsing schema: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, [debugSchemaInput]);

  /**
   * Handle field registration - molds fields to metadata and opens global modal
   */
  const handleRegisterForm = useCallback(() => {
    // Use uploaded file if available, otherwise use the current document URL (no file needed for update)
    const fileToSubmit = documentFile || null;

    const result = registerFields(fields);

    // Compute final order for all blocks based on their current position
    const blocksWithFinalOrder = metadata.schema.blocks.map((block, index) => ({
      ...block,
      order: index,
    }));

    // Merge result metadata with current metadata to preserve all blocks, signing_parties, and subscribers
    const baseMetadata: IFormMetadata & { base_document?: File } =
      result.metadata && result.isValid
        ? {
            ...result.metadata,
            schema: {
              ...result.metadata.schema,
              blocks: blocksWithFinalOrder,
            },
            signing_parties: metadata.signing_parties,
            subscribers: metadata.subscribers,
            ...(fileToSubmit && { base_document: fileToSubmit }),
          }
        : {
            ...metadata,
            schema: {
              ...metadata.schema,
              blocks: blocksWithFinalOrder,
            },
            ...(fileToSubmit && { base_document: fileToSubmit }),
          };

    openModal(
      "field-registration-modal",
      <FieldRegistrationModalContent
        metadata={baseMetadata}
        errors={result.errors}
        onClose={() => closeModal("field-registration-modal")}
        onConfirm={(editedMetadata) => {
          // Ensure all blocks have _id and set order values based on array position
          const blocksWithIdsAndOrder = (editedMetadata.schema.blocks as any[]).map(
            (block: any, index: number) => ({
              ...block,
              _id: block._id || generateBlockId(),
              order: index, // Array position becomes the order
            })
          );

          const metadataWithDocument = {
            ...editedMetadata,
            schema: {
              ...editedMetadata.schema,
              blocks: blocksWithIdsAndOrder,
            },
            signing_parties: (Array.isArray(editedMetadata.signing_parties)
              ? editedMetadata.signing_parties
              : [editedMetadata.signing_parties]
            ).map((party: any) => ({
              ...party,
              signatory_title: party.signatory_title || party._id,
            })),
            ...(fileToSubmit && { base_document: fileToSubmit }),
          };

          // Register the form and handle success/error
          formsControllerRegisterForm(metadataWithDocument)
            .then(() => {
              // Show success toast
              toast.success(`Form registered successfully!`, {
                ...toastPresets.success,
              });

              // Refetch the form data to get the latest version
              refetchFormData();
            })
            .catch((error) => {
              toast.error("Failed to register form", {
                description: error instanceof Error ? error.message : "An error occurred",
              });
            });

          closeModal("field-registration-modal");
        }}
        onFieldsUpdate={(updatedFields) => {
          // Update fields in real-time as JSON is edited
          const fieldsWithLabels = updatedFields.map((field) => ({
            ...field,
            id: field.id || "",
            label: getFieldLabelByName(field.field, registry),
          })) as FormField[];
          setFields(fieldsWithLabels);
        }}
      />,
      {
        title: "Field Registration",
        allowBackdropClick: true,
        hasClose: true,
        closeOnEsc: true,
        panelClassName: "!w-5xl",
      }
    );
  }, [
    fields,
    blocks,
    formLabel,
    registerFields,
    openModal,
    closeModal,
    registry,
    metadata,
    documentFile,
    refetchFormData,
  ]);

  // Show loading state while form metadata is being fetched
  if (!formData && !isNewForm && formName) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <Loader>Loading form...</Loader>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3">
        {isEditingName ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editingNameValue}
              onChange={(e) => setEditingNameValue(e.target.value)}
              onBlur={handleSaveFormName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveFormName();
                if (e.key === "Escape") handleCancelNameEdit();
              }}
              autoFocus
              className="w-80 rounded border border-blue-500 px-2 py-1 text-lg font-semibold focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
            />
            <button
              onClick={handleSaveFormName}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-green-100 hover:text-green-600"
              title="Save (Enter)"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancelNameEdit}
              className="rounded p-1 text-slate-400 transition-colors hover:bg-red-100 hover:text-red-600"
              title="Cancel (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg leading-tight font-semibold">{formLabel}</h1>
              <button
                onClick={handleStartEditName}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                title="Edit form name"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
            {/* @ts-expect-error - TODO:formDocument not be typed */}
            {formData?.formDocument?.time_generated && (
              <p className="text-xs text-slate-500">
                {/* @ts-expect-error - TODO: formDocument  not be typed */}
                Last Registered: {new Date(formData.formDocument.time_generated).toLocaleString()}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveView(activeView === "pdf" ? "layout" : "pdf")}
            className="flex items-center gap-2"
          >
            {activeView === "pdf" ? (
              <>
                <Layout className="h-4 w-4" />
                Switch to Form Editor
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                Switch to PDF Editor
              </>
            )}
          </Button>
          <button
            onClick={() => setIsDebugModalOpen(true)}
            className="rounded bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            title="Inject debug schema"
          >
            📝 Inject Schema
          </button>
          <Button onClick={handleRegisterForm}>Register Form</Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeView === "pdf" ? (
          // PDF Editor View
          <div className="flex h-full gap-0">
            {/* PDF Viewer (left, main) */}
            <div ref={pdfViewerContainerRef} className="flex-1 overflow-y-auto">
              <Suspense fallback={<Loader>Loading PDF…</Loader>}>
                <PdfViewer
                  initialUrl={documentUrl}
                  fields={fields}
                  selectedFieldId={selectedFieldId}
                  onFieldSelect={setSelectedFieldId}
                  onFieldChange={handleFieldsChange}
                  onFieldCreate={handleFieldCreate}
                  isPlacingField={isPlacingField}
                  placementFieldType={placementFieldType}
                  onPlacementFieldTypeChange={setPlacementFieldType}
                  onStartPlacing={() => setIsPlacingField(true)}
                  onCancelPlacing={() => setIsPlacingField(false)}
                  onFileSelect={handlePdfFileSelect}
                  registry={registry}
                  onFieldClickInPdf={handleFieldClickInPdf}
                />
              </Suspense>
            </div>

            {/* Sidebar (right) */}
            <div ref={sidebarRef} className="w-72 flex-shrink-0 overflow-y-auto border-l bg-white">
              <EditorSidebar
                fields={fields}
                selectedFieldId={selectedFieldId}
                onFieldSelect={setSelectedFieldId}
                onFieldDelete={fieldOps.delete}
                onFieldDuplicate={fieldOps.duplicate}
                isPlacing={isPlacingField}
                placementFieldType={placementFieldType}
                onFieldTypeChange={setPlacementFieldType}
                onStartPlacing={() => setIsPlacingField(true)}
                onCancelPlacing={() => setIsPlacingField(false)}
                onCoordinatesChange={handleCoordinatesChange}
                placementAlign_h={placementAlign_h}
                placementAlign_v={placementAlign_v}
                size={placementSize}
                wrap={placementWrap}
                onAlignmentChange={(alignment) => {
                  setPlacementAlign_h(alignment.align_h);
                  setPlacementAlign_v(alignment.align_v);

                  // If a field is selected, update its alignment in the fields state
                  if (selectedFieldId) {
                    handleFieldsChange(selectedFieldId, {
                      align_h: alignment.align_h,
                      align_v: alignment.align_v,
                    });
                  }
                }}
                onSizeChange={(newSize) => {
                  setPlacementSize(newSize);
                  // If a field is selected, update its size
                  if (selectedFieldId) {
                    handleFieldsChange(selectedFieldId, {
                      size: newSize,
                    });
                  }
                }}
                onWrapChange={(newWrap) => {
                  setPlacementWrap(newWrap);
                  // If a field is selected, update its wrap
                  if (selectedFieldId) {
                    handleFieldsChange(selectedFieldId, {
                      wrap: newWrap,
                    });
                  }
                }}
                registry={registry}
                onFieldClickInSidebar={handleFieldClickInSidebar}
              />
            </div>
          </div>
        ) : (
          // Form Layout Editor View
          <FormLayoutEditor
            formLabel={formLabel}
            metadata={metadata}
            documentUrl={documentUrl}
            onMetadataChange={(updatedMetadata: IFormMetadata) => {
              lastMetadataUpdateSourceRef.current = "localEdit";
              setMetadata(updatedMetadata);

              // Also sync fields array with the new block data to keep them in sync
              const updatedFields = updatedMetadata.schema.blocks
                .filter((block: any) => block.block_type === "form_field" && block.field_schema)
                .map((block: any) => {
                  const field = block.field_schema as IFormField;
                  return {
                    id: "",
                    _id: block._id,
                    field: field.field,
                    label: field.label,
                    page: field.page,
                    x: field.x,
                    y: field.y,
                    w: field.w,
                    h: field.h,
                    align_h: (field.align_h ?? "left") as "left" | "center" | "right",
                    align_v: (field.align_v ?? "top") as "top" | "middle" | "bottom",
                    size: field.size ?? 11,
                    wrap: field.wrap ?? true,
                  };
                }) as FormField[];
              setFields(updatedFields);
            }}
          />
        )}
      </div>

      {/* Debug Schema Injector Modal */}
      {isDebugModalOpen && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="max-h-[80vh] w-[600px] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold">Inject Debug Schema</h2>
            <textarea
              value={debugSchemaInput}
              onChange={(e) => setDebugSchemaInput(e.target.value)}
              placeholder="Paste your schema JSON here..."
              className="h-64 w-full rounded border border-slate-300 p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsDebugModalOpen(false);
                  setDebugSchemaInput("");
                }}
                className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleInjectSchema}
                className="rounded bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-600"
              >
                Inject Schema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function PdfJsEditorPageWrapper() {
  return (
    <Suspense fallback={<Loader>Loading editor…</Loader>}>
      <PdfJsEditorPage />
    </Suspense>
  );
}

export default PdfJsEditorPageWrapper;
