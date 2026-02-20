/**
 * @ Author: BetterInternship [Jana]
 * @ Create Time: 2025-12-16 16:03:54
 * @ Modified by: Your name
 * @ Modified time: 2025-12-26 01:41:33
 * @ Description: PDF editor component - pure rendering via contexts
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { Loader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import { ZoomIn, ZoomOut, FileUp } from "lucide-react";
import { FieldBox, type FormField } from "./FieldBox";
import { FieldRegistryEntryDetails, FieldRegistryEntry } from "@/app/api";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { usePdfViewer } from "@/app/contexts/pdf-viewer.context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { IFormBlock, IFormMetadata } from "@betterinternship/core/forms";
import { FormViewBlocksPanel } from "@/components/editor/tab-panels/editor-components/FormViewBlocksPanel";

export type PointerLocation = {
  page: number;
  pdfX: number;
  pdfY: number;
  displayX: number;
  displayY: number;
  viewportWidth: number;
  viewportHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * PdfViewer - Context-driven PDF editor component
 * Uses PdfViewerContext for PDF state and FormEditorContext for form data
 * Pure presentation component - all logic is in contexts
 */
export function PdfViewer() {
  const {
    blocks,
    selectedFieldId,
    selectedPartyId,
    handleFieldSelectFromPdf,
    handleBlockCreate,
    handleBlockUpdate,
    setPreferredPlacementPage,
    editorViewMode,
    setEditorViewMode,
  } = useFormEditorTab();

  const { formMetadata } = useFormEditor();

  const {
    pdfDoc,
    pageCount,
    visiblePage,
    setVisiblePage,
    scale,
    setScale,
    isLoadingDoc,
    error,
    isDragging,
    setIsDragging,
    handleFileUpload,
    registry,
  } = usePdfViewer();

  // Setup PDF worker
  useEffect(() => {
    if (typeof window === "undefined") return;
    const workerFile = pdfjsVersion.startsWith("4") ? "pdf.worker.min.mjs" : "pdf.worker.min.js";
    GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/${workerFile}`;
  }, []);

  // File upload handler
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleZoom = (direction: "in" | "out") => {
    const delta = direction === "in" ? 0.1 : -0.1;
    const newScale = clamp(parseFloat((scale + delta).toFixed(2)), 0.5, 3);
    setScale(newScale);
  };

  const pagesArray = useMemo(
    () => Array.from({ length: pageCount }, (_, idx) => idx + 1),
    [pageCount]
  );

  useEffect(() => {
    setPreferredPlacementPage(visiblePage);
  }, [visiblePage, setPreferredPlacementPage]);
  const pageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const registerPageRef = useCallback((page: number, node: HTMLDivElement | null) => {
    pageRefs.current.set(page, node);
  }, []);

  useEffect(() => {
    if (!selectedFieldId) return;
    const container = pdfContainerRef.current;
    if (!container) return;

    const scrollToField = () => {
      const fieldNode = container.querySelector(
        `[data-field-id="${selectedFieldId}"]`
      ) as HTMLElement | null;
      fieldNode?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    };

    const frameId = window.requestAnimationFrame(scrollToField);
    return () => window.cancelAnimationFrame(frameId);
  }, [selectedFieldId]);

  const handlePdfScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const containerRect = e.currentTarget.getBoundingClientRect();
      const anchorY = containerRect.top + 24;
      let closestPage = visiblePage;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const page of pagesArray) {
        const node = pageRefs.current.get(page);
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const distance = Math.abs(rect.top - anchorY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPage = page;
        }
      }

      if (closestPage !== visiblePage) {
        setVisiblePage(closestPage);
      }
    },
    [pagesArray, setVisiblePage, visiblePage]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    },
    [setIsDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    },
    [setIsDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const fieldData = e.dataTransfer.getData("field");
      if (fieldData) {
        try {
          const draggedField = JSON.parse(fieldData) as FieldRegistryEntryDetails;

          console.log("Dragged field data:", draggedField);
          console.log("Prefiller value:", draggedField.prefiller);

          const rect = e.currentTarget.getBoundingClientRect();
          const displayX = e.clientX - rect.left;
          const displayY = e.clientY - rect.top;

          const uniqueId = Math.random().toString(36).substr(2, 9);
          const fieldKey = draggedField.preset
            ? `${draggedField.name}:${draggedField.preset}`
            : draggedField.name || "field";
          const existingForField = blocks.find(
            (block) =>
              block.block_type === "form_field" &&
              block.signing_party_id === (selectedPartyId || "") &&
              block.field_schema?.field === fieldKey
          );
          const baseSchema = existingForField?.field_schema;
          const newBlock: IFormBlock = {
            _id: uniqueId,
            block_type: "form_field",
            signing_party_id: selectedPartyId || "",
            order: 0,
            field_schema: {
              field: fieldKey,
              label: baseSchema?.label || draggedField.label || "New Field",
              tooltip_label: baseSchema?.tooltip_label || draggedField.tooltip_label || "",
              type: baseSchema?.type || draggedField.type,
              page: visiblePage,
              x: Math.max(0, (displayX - 50) / scale),
              y: Math.max(0, (displayY - 6) / scale),
              w: 100,
              h: 12,
              align_h: baseSchema?.align_h || "center",
              align_v: baseSchema?.align_v || "middle",
              shared:
                typeof baseSchema?.shared === "boolean"
                  ? baseSchema.shared
                  : (draggedField.shared ?? true),
              source: baseSchema?.source || draggedField.source || "manual",
              ...(baseSchema?.prefiller
                ? { prefiller: baseSchema.prefiller }
                : draggedField.prefiller
                  ? { prefiller: draggedField.prefiller }
                  : {}),
              ...(baseSchema?.validator
                ? { validator: baseSchema.validator }
                : draggedField.validator
                  ? { validator: draggedField.validator }
                  : {}),
              ...(baseSchema?.size ? { size: baseSchema.size } : {}),
              ...(typeof baseSchema?.wrap === "boolean"
                ? { wrap: baseSchema.wrap }
                : { wrap: true }),
              ...(baseSchema?.font ? { font: baseSchema.font } : {}),
            },
          };

          console.log("Created block field_schema:", newBlock.field_schema);
          handleBlockCreate(newBlock);
        } catch (err) {
          console.error("Error parsing field data:", err);
        }
        return;
      }

      const files = e.dataTransfer.files;
      const file = Array.from(files).find((f) => f.type === "application/pdf") || files[0];
      if (file) handleFileUpload(file);
    },
    [scale, visiblePage, selectedPartyId, handleBlockCreate, setIsDragging, handleFileUpload]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Form View</span>
            <Switch
              checked={editorViewMode === "form"}
              onCheckedChange={(checked) => setEditorViewMode(checked ? "form" : "pdf")}
              aria-label="Toggle Form View"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleZoom("out")}
              disabled={scale <= 0.5}
              className="rounded p-2 text-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-muted-foreground min-w-12 text-center text-xs">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => handleZoom("in")}
              disabled={scale >= 3}
              className="rounded p-2 text-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
          {editorViewMode === "pdf" ? (
            <label className="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1.5 text-sm transition-colors hover:bg-slate-100">
              <FileUp className="h-4 w-4" />
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="w-[34px]" />
          )}
        </div>
      </div>

      {/* PDF Canvas / Form View */}
      <div ref={pdfContainerRef} className="relative flex-1 overflow-hidden bg-white">
        {editorViewMode === "form" ? (
          <FormViewBlocksPanel signingParties={formMetadata?.signing_parties || []} />
        ) : (
          <>
        {isLoadingDoc && (
          <div className="bg-background/70 absolute inset-0 z-10 flex items-center justify-center">
            <Loader>Loading PDF…</Loader>
          </div>
        )}

        {error && (
          <div className="text-destructive flex h-full items-center justify-center text-sm">
            {error}
          </div>
        )}

        {!error && !pdfDoc && !isLoadingDoc && (
          <div className="flex h-full flex-col items-center justify-center gap-8">
            <div className="text-center">
              <p className="text-base font-medium text-slate-900">Drop your PDF here</p>
              <p className="mt-1 text-sm text-slate-500">or click the button below to browse</p>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "flex h-80 w-120 cursor-pointer flex-col items-center justify-center rounded-[0.33em] border-2 border-dashed transition-colors",
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 bg-slate-50 hover:border-slate-400"
              )}
            >
              <FileUp className="h-16 w-16 text-slate-400" />
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button asChild>
                <span>
                  <FileUp className="h-5 w-5" />
                  Upload PDF
                </span>
              </Button>
            </label>
          </div>
        )}

        {pdfDoc && (
          <div
            className="h-full overflow-auto p-4"
            aria-live="polite"
            onScroll={handlePdfScroll}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex w-full flex-col items-center gap-4">
              {pagesArray.map((page) => (
                <PdfPageCanvas
                  key={page}
                  pdf={pdfDoc}
                  pageNumber={page}
                  scale={scale}
                  isSelected={page === visiblePage}
                  _isVisible={page === visiblePage}
                  onVisible={setVisiblePage}
                  registerPageRef={registerPageRef}
                  blocks={blocks}
                  selectedFieldId={selectedFieldId}
                  onFieldSelect={handleFieldSelectFromPdf}
                  onBlockUpdate={handleBlockUpdate}
                  selectedPartyId={selectedPartyId}
                  _registry={registry}
                  formMetadata={formMetadata}
                />
              ))}
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

type PdfPageCanvasProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  isSelected: boolean;
  _isVisible: boolean;
  onVisible: (page: number) => void;
  registerPageRef: (page: number, node: HTMLDivElement | null) => void;
  blocks: IFormBlock[];
  selectedFieldId: string | null | undefined;
  onFieldSelect: (fieldId: string) => void;
  onBlockUpdate: (block: IFormBlock) => void;
  selectedPartyId: string | null;
  _registry: FieldRegistryEntry[];
  formMetadata: IFormMetadata | null;
};

const PdfPageCanvas = memo(
  ({
    pdf,
    pageNumber,
    scale,
    isSelected,
    _isVisible,
    onVisible,
    registerPageRef,
    blocks,
    selectedFieldId,
    onFieldSelect,
    onBlockUpdate,
    selectedPartyId,
    _registry,
    formMetadata,
  }: PdfPageCanvasProps) => {
    const { handleBlockCreate, handleDeleteBlock, handleDuplicateBlock } = useFormEditorTab();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const viewportRef = useRef<PageViewport | null>(null);
    const [rendering, setRendering] = useState<boolean>(false);
    const [localHover, setLocalHover] = useState<PointerLocation | null>(null);
    const [containerResizeVersion, setContainerResizeVersion] = useState<number>(0);

    useEffect(
      () => registerPageRef(pageNumber, containerRef.current),
      [pageNumber, registerPageRef]
    );

    // Detect when the PDF container changes size (panel resize) and trigger position recalculation
    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const resizeObserver = new ResizeObserver(() => {
        setContainerResizeVersion((prev) => prev + 1);
      });

      resizeObserver.observe(element);
      return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
      const element = containerRef.current;
      if (!element) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) onVisible(pageNumber);
          });
        },
        { threshold: 0.6 }
      );

      observer.observe(element);
      return () => observer.disconnect();
    }, [onVisible, pageNumber]);

    useEffect(() => {
      let renderTask: RenderTask | null = null;
      let cancelled = false;
      setRendering(true);

      pdf
        .getPage(pageNumber)
        .then((page: PDFPageProxy) => {
          if (cancelled) return;
          const viewport = page.getViewport({ scale });
          viewportRef.current = viewport;

          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!canvas || !context) return;

          const outputScale = window.devicePixelRatio || 1;
          canvas.width = viewport.width * outputScale;
          canvas.height = viewport.height * outputScale;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          const renderContext = {
            canvasContext: context,
            viewport,
            transform: [outputScale, 0, 0, outputScale, 0, 0],
          } as {
            canvasContext: CanvasRenderingContext2D;
            viewport: PageViewport;
            transform: number[];
          };

          renderTask = page.render(renderContext);
          return renderTask.promise;
        })
        .catch((err: any) => {
          const errorObj = err as { name?: string };
          if (errorObj?.name === "RenderingCancelledException") return;
          console.error("Failed to render page", err);
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });

      return () => {
        cancelled = true;
        renderTask?.cancel();
      };
    }, [pdf, pageNumber, scale]);

    const extractLocation = (
      event: React.MouseEvent<HTMLCanvasElement, MouseEvent> | React.DragEvent<HTMLCanvasElement>
    ): PointerLocation | null => {
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return null;

      const rect = canvas.getBoundingClientRect();
      const containerRect = canvas.parentElement?.getBoundingClientRect();
      if (!containerRect) return null;

      // Coordinates relative to canvas
      const cssX = event.clientX - rect.left;

      const cssY = event.clientY - rect.top;

      // Display coordinates relative to container
      const displayX = event.clientX - containerRect.left;
      const displayY = event.clientY - containerRect.top;

      // Convert CSS pixels to viewport space (viewport is already scaled by scale factor)
      const viewportX = (cssX / rect.width) * viewport.width;
      const viewportY = (cssY / rect.height) * viewport.height;

      const [pdfX, pdfYBottom] = viewport.convertToPdfPoint(viewportX, viewportY) as [
        number,
        number,
      ];

      // Convert from PDF bottom-left origin to top-left origin
      const actualPdfHeight = viewport.height / scale;
      const pdfY = actualPdfHeight - pdfYBottom;

      return {
        page: pageNumber,
        pdfX,
        pdfY,
        displayX,
        displayY,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      };
    };

    // Inverse of extractLocation: convert PDF coords to display position
    const pdfToDisplay = (pdfX: number, pdfY: number) => {
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return null;

      const rect = canvas.getBoundingClientRect();
      const containerRect = canvas.parentElement?.getBoundingClientRect();
      if (!containerRect) return null;

      // Work with the actual CSS pixel dimensions from getBoundingClientRect
      const actualPdfHeight = viewport.height / scale;
      const pdfYBottom = actualPdfHeight - pdfY;

      const viewportPoint = viewport.convertToViewportPoint(pdfX, pdfYBottom);
      if (!viewportPoint) return null;
      const [viewportX, viewportY] = viewportPoint as [number, number];

      // Convert viewport coordinates to CSS pixels on screen
      // rect.width and rect.height are already in CSS pixels (including any zoom effects)
      const cssX = (viewportX / viewport.width) * rect.width;
      const cssY = (viewportY / viewport.height) * rect.height;

      return {
        displayX: rect.left - containerRect.left + cssX,
        displayY: rect.top - containerRect.top + cssY,
      };
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      const location = extractLocation(event);
      setLocalHover(location);
    };

    const handleMouseLeave = () => {
      setLocalHover(null);
    };

    const handleClick = (event: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
      const location = extractLocation(event);
      if (!location) return;
      // Click handled through field box interactions
    };

    const handleDragOver = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const fieldData = e.dataTransfer.getData("field");
      if (!fieldData) return;

      try {
        const draggedField = JSON.parse(fieldData) as FieldRegistryEntryDetails;

        console.log("Canvas: Dragged field data:", draggedField);
        console.log("Canvas: Prefiller value:", draggedField.prefiller);

        const location = extractLocation(e);
        if (!location) return;

        const fieldWidth = 100;
        const fieldHeight = 12;
        const uniqueId = Math.random().toString(36).substr(2, 9);
        const fieldKey = draggedField.preset
          ? `${draggedField.name}:${draggedField.preset}`
          : draggedField.name || "field";
        const existingForField = blocks.find(
          (block) =>
            block.block_type === "form_field" &&
            block.signing_party_id === (selectedPartyId || "") &&
            block.field_schema?.field === fieldKey
        );
        const baseSchema = existingForField?.field_schema;

        const newBlock: IFormBlock = {
          _id: uniqueId,
          block_type: "form_field",
          signing_party_id: selectedPartyId || "",
          order: 0,
          field_schema: {
            field: fieldKey,
            label: baseSchema?.label || draggedField.label || "New Field",
            tooltip_label: baseSchema?.tooltip_label || draggedField.tooltip_label || "",
            type: baseSchema?.type || draggedField.type,
            page: pageNumber,
            x: location.pdfX - fieldWidth / 2,
            y: location.pdfY - fieldHeight / 2,
            w: fieldWidth,
            h: fieldHeight,
            align_h: baseSchema?.align_h || "center",
            align_v: baseSchema?.align_v || "middle",
            shared:
              typeof baseSchema?.shared === "boolean"
                ? baseSchema.shared
                : (draggedField.shared ?? true),
            source: baseSchema?.source || draggedField.source || "manual",
            ...(baseSchema?.prefiller
              ? { prefiller: baseSchema.prefiller }
              : draggedField.prefiller
                ? { prefiller: draggedField.prefiller }
                : {}),
            ...(baseSchema?.validator
              ? { validator: baseSchema.validator }
              : draggedField.validator
                ? { validator: draggedField.validator }
                : {}),
            ...(baseSchema?.size ? { size: baseSchema.size } : {}),
            ...(typeof baseSchema?.wrap === "boolean" ? { wrap: baseSchema.wrap } : { wrap: true }),
            ...(baseSchema?.font ? { font: baseSchema.font } : {}),
          },
        };

        console.log("Canvas: Created block field_schema:", newBlock.field_schema);
        handleBlockCreate(newBlock);
      } catch (err) {
        console.error("Error dropping field:", err);
      }
    };

    // Convert display pixel deltas to PDF coordinate deltas
    const displayDeltaToPdfDelta = (displayDeltaX: number, displayDeltaY: number) => {
      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return { pdfDeltaX: 0, pdfDeltaY: 0 };

      const rect = canvas.getBoundingClientRect();

      // Convert CSS pixel deltas to viewport space deltas
      const viewportDeltaX = (displayDeltaX / rect.width) * viewport.width;
      const viewportDeltaY = (displayDeltaY / rect.height) * viewport.height;

      // Convert viewport deltas to PDF space
      const pdfDeltaX = viewportDeltaX / scale;
      const pdfDeltaY = viewportDeltaY / scale;

      return { pdfDeltaX, pdfDeltaY };
    };

    const handleFieldDrag = (fieldId: string, displayDeltaX: number, displayDeltaY: number) => {
      const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
      // Find block by _id
      const block = blocks.find((b) => b._id === fieldId);
      if (!block || !block.field_schema) {
        console.warn("handleFieldDrag: block or field_schema not found", {
          fieldId,
          availableFields: blocks.map((b) => ({ id: b._id, label: b.field_schema?.label })),
        });
        return;
      }

      const newX = Math.max(0, block.field_schema.x + pdfDeltaX);
      const newY = Math.max(0, block.field_schema.y + pdfDeltaY);

      // Update via onBlockUpdate
      const updatedBlock: IFormBlock = {
        ...block,
        field_schema: {
          ...block.field_schema,
          x: newX,
          y: newY,
        },
      };
      onBlockUpdate(updatedBlock);
    };

    const handleFieldResize = (
      fieldId: string,
      handle: "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se",
      displayDeltaX: number,
      displayDeltaY: number
    ) => {
      const { pdfDeltaX, pdfDeltaY } = displayDeltaToPdfDelta(displayDeltaX, displayDeltaY);
      const block = blocks.find((b) => b._id === fieldId);
      if (!block || !block.field_schema) return;

      const minSize = 10; // Minimum width/height in PDF units
      const fieldSchema = block.field_schema;

      let newX = fieldSchema.x;
      let newY = fieldSchema.y;
      let newW = fieldSchema.w;
      let newH = fieldSchema.h;

      if (handle === "n") {
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "e") {
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
      } else if (handle === "s") {
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      } else if (handle === "w") {
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
      } else if (handle === "nw") {
        // Top-left: move position and shrink size
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "ne") {
        // Top-right: move top, grow/shrink width and height
        newY = Math.max(0, fieldSchema.y + pdfDeltaY);
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h - pdfDeltaY);
      } else if (handle === "sw") {
        // Bottom-left: move left, grow/shrink width and height
        newX = Math.max(0, fieldSchema.x + pdfDeltaX);
        newW = Math.max(minSize, fieldSchema.w - pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      } else if (handle === "se") {
        // Bottom-right: grow/shrink both dimensions
        newW = Math.max(minSize, fieldSchema.w + pdfDeltaX);
        newH = Math.max(minSize, fieldSchema.h + pdfDeltaY);
      }

      const updatedBlock: IFormBlock = {
        ...block,
        field_schema: {
          ...fieldSchema,
          x: newX,
          y: newY,
          w: newW,
          h: newH,
        },
      };
      onBlockUpdate(updatedBlock);
    };

    const handleFieldRecipientChange = (fieldId: string, partyId: string) => {
      const block = blocks.find((b) => b._id === fieldId);
      if (!block) return;
      onBlockUpdate({ ...block, signing_party_id: partyId });
    };

    const findSameFieldIds = (fieldId: string): string[] => {
      const target = blocks.find((b) => b._id === fieldId);
      const fieldName = target?.field_schema?.field;
      if (!fieldName) return [fieldId];
      return blocks
        .filter((b) => b.block_type === "form_field" && b.field_schema?.field === fieldName)
        .sort((a, b) => {
          const aPage = a.field_schema?.page || 0;
          const bPage = b.field_schema?.page || 0;
          if (aPage !== bPage) return aPage - bPage;
          return (a.order || 0) - (b.order || 0);
        })
        .map((b) => b._id);
    };

    const selectSameFieldAtIndex = (ids: string[], index: number) => {
      const targetId = ids[index];
      if (!targetId) return;
      const targetBlock = blocks.find((b) => b._id === targetId);
      const targetPage = targetBlock?.field_schema?.page;
      if (typeof targetPage === "number" && targetPage > 0) {
        onVisible(targetPage);
      }
      onFieldSelect(targetId);
    };

    const handleSelectNextSameField = (fieldId: string) => {
      const ids = findSameFieldIds(fieldId);
      if (ids.length <= 1) return;
      const idx = ids.indexOf(fieldId);
      const nextIndex = (idx + 1 + ids.length) % ids.length;
      selectSameFieldAtIndex(ids, nextIndex);
    };

    const handleSelectPrevSameField = (fieldId: string) => {
      const ids = findSameFieldIds(fieldId);
      if (ids.length <= 1) return;
      const idx = ids.indexOf(fieldId);
      const prevIndex = (idx - 1 + ids.length) % ids.length;
      selectSameFieldAtIndex(ids, prevIndex);
    };

    return (
      <div
        ref={containerRef}
        data-page={pageNumber}
        className={cn(
          "relative w-fit max-w-none overflow-hidden rounded-[0.33em] border bg-white shadow-sm transition-colors",
          isSelected ? "border-primary/80 ring-primary/50 ring-1" : "border-border"
        )}
      >
        <div className="text-muted-foreground flex items-center justify-between border-b px-3 py-2 text-xs">
          <span>Page {pageNumber}</span>
        </div>
        <div className="relative flex justify-center bg-slate-50">
          <canvas
            ref={canvasRef}
            className="block"
            style={{ cursor: "pointer" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
          {rendering && (
            <div className="text-muted-foreground absolute inset-0 flex items-center justify-center bg-white/70 text-xs">
              Rendering…
            </div>
          )}

          {/* Render form fields */}
          <div className="pointer-events-none absolute inset-0 z-10" key={containerResizeVersion}>
            {blocks.map((block) => {
              const schema = block.field_schema;
              if (!schema || schema.page !== pageNumber || block.block_type !== "form_field")
                return null;

              const fieldId = block._id;
              const pos = pdfToDisplay(schema.x, schema.y);
              if (!pos) return null;

              // Convert block to FormField for FieldBox
              const field: FormField = {
                id: fieldId,
                field: schema.field,
                label: schema.label,
                tooltip_label: schema.tooltip_label || "",
                type: schema.type,
                page: schema.page,
                x: schema.x,
                y: schema.y,
                w: schema.w,
                h: schema.h,
                signing_party_id: block.signing_party_id,
                signing_party_order:
                  formMetadata?.signing_parties?.find((p) => p._id === block.signing_party_id)
                    ?.order ?? 0,
              };

              const sameFieldIds = findSameFieldIds(fieldId);
              const sameFieldIndex = Math.max(0, sameFieldIds.indexOf(fieldId)) + 1;

              return (
                <div
                  key={fieldId}
                  data-field-id={fieldId}
                  className="pointer-events-auto relative z-20"
                  style={{
                    position: "absolute",
                    left: `${pos.displayX}px`,
                    top: `${pos.displayY}px`,
                    width: `${schema.w * scale}px`,
                    height: `${schema.h * scale}px`,
                  }}
                >
                  <FieldBox
                    field={field}
                    isSelected={selectedFieldId === fieldId}
                    onSelect={() => {
                      onFieldSelect?.(fieldId);
                    }}
                    onDrag={(deltaX, deltaY) => handleFieldDrag(fieldId, deltaX, deltaY)}
                    onDragEnd={() => {}}
                    onResize={(handle, deltaX, deltaY) =>
                      handleFieldResize(fieldId, handle, deltaX, deltaY)
                    }
                    onResizeEnd={() => {}}
                    signingPartyOptions={(formMetadata?.signing_parties || []).map((party) => ({
                      id: party._id,
                      name: party.signatory_title || party._id,
                    }))}
                    onSigningPartyChange={(partyId) => handleFieldRecipientChange(fieldId, partyId)}
                    onDelete={() => handleDeleteBlock(fieldId)}
                    onDuplicate={() => {
                      const block = blocks.find((b) => b._id === fieldId);
                      if (block) handleDuplicateBlock(block);
                    }}
                    sameFieldIndex={sameFieldIndex}
                    sameFieldCount={sameFieldIds.length}
                    onPrevSameField={() => handleSelectPrevSameField(fieldId)}
                    onNextSameField={() => handleSelectNextSameField(fieldId)}
                  />
                </div>
              );
            })}
          </div>

          {/* Crosshair overlay on hover */}
          {localHover && (
            <div className="pointer-events-none absolute inset-0">
              <div
                className="bg-primary/50 absolute h-full w-px"
                style={{ left: `${localHover.displayX}px` }}
              />
              <div
                className="border-primary/50 absolute w-full border-t"
                style={{ top: `${localHover.displayY}px` }}
              />
            </div>
          )}
        </div>
        {localHover && (
          <div className="bg-muted/30 text-muted-foreground border-t px-3 py-2 text-[11px]">
            Page {pageNumber}: x={localHover.pdfX.toFixed(2)}, y={localHover.pdfY.toFixed(2)}
          </div>
        )}
      </div>
    );
  }
);
PdfPageCanvas.displayName = "PdfPageCanvas";
