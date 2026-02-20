"use client";

import { useMemo, useState } from "react";
import { IFormBlock, IFormSigningParty } from "@betterinternship/core/forms";
import { FieldRegistryEntryDetails } from "@/app/api";
import { useFieldTemplateContext } from "@/app/docs/ft2mkyEVxHrAJwaphVVSop3TIau0pWDq/editor/field-template.ctx";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { usePdfViewer } from "@/app/contexts/pdf-viewer.context";
import { getPartyColorByIndex } from "@/lib/party-colors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Plus, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BlocksPanelProps {
  blocks: IFormBlock[];
  selectedPartyId: string | null;
  onPartyChange: (partyId: string | null) => void;
  signingParties: IFormSigningParty[];
}

export function BlocksPanel({
  blocks,
  selectedPartyId,
  onPartyChange,
  signingParties,
}: BlocksPanelProps) {
  const { registry } = useFieldTemplateContext();
  const { handleBlockCreate, searchQuery, setSearchQuery } = useFormEditorTab();
  const { visiblePage } = usePdfViewer();
  const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);

  const selectedParty =
    signingParties.find((party) => party._id === selectedPartyId) || signingParties[0];
  const selectedPartyColor = getPartyColorByIndex(Math.max(0, (selectedParty?.order || 1) - 1));

  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return registry;
    const query = searchQuery.toLowerCase();
    return registry.filter(
      (field) =>
        field.name?.toLowerCase().includes(query) || field.label?.toLowerCase().includes(query)
    );
  }, [registry, searchQuery]);

  const groupedFields = useMemo(() => {
    const tags = Array.from(
      new Set(filteredFields.map((f) => f.tag || "Ungrouped").filter(Boolean))
    );
    return tags
      .sort((a, b) => {
        if (a.toLowerCase() === "preset") return -1;
        if (b.toLowerCase() === "preset") return 1;
        return a.localeCompare(b);
      })
      .map((tag) => ({
        tag,
        fields: filteredFields
          .filter((f) => f.tag === tag)
          .sort((a, b) => (a.label || a.name || "").localeCompare(b.label || b.name || "")),
      }));
  }, [filteredFields]);

  const handleDragStart = (e: React.DragEvent, fieldData: FieldRegistryEntryDetails) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("field", JSON.stringify(fieldData));
  };

  const handleFieldAdd = (field: FieldRegistryEntryDetails) => {
    const partyId = selectedPartyId || signingParties[0]?._id;
    if (!partyId) return;

    const fieldWidth = 100;
    const fieldHeight = 12;
    const page = Math.max(1, visiblePage || 1);
    const pageMaxX = 560;
    const pageMaxY = 760;
    const marginX = 40;
    const marginY = 48;
    const gapX = 16;
    const gapY = 12;
    const rowStep = fieldHeight + gapY;
    const colStep = fieldWidth + gapX;

    const pageFieldBlocks = blocks.filter(
      (block) =>
        block.block_type === "form_field" &&
        block.field_schema?.page === page &&
        typeof block.field_schema?.x === "number" &&
        typeof block.field_schema?.y === "number" &&
        typeof block.field_schema?.w === "number" &&
        typeof block.field_schema?.h === "number"
    );

    const overlapsExisting = (x: number, y: number) =>
      pageFieldBlocks.some((block) => {
        const bx = block.field_schema!.x;
        const by = block.field_schema!.y;
        const bw = block.field_schema!.w;
        const bh = block.field_schema!.h;
        const pad = 6;
        return !(
          x + fieldWidth + pad <= bx ||
          x >= bx + bw + pad ||
          y + fieldHeight + pad <= by ||
          y >= by + bh + pad
        );
      });

    let nextX = marginX;
    let nextY = marginY;
    let foundSpot = false;

    for (let y = marginY; y <= pageMaxY - fieldHeight; y += rowStep) {
      for (let x = marginX; x <= pageMaxX - fieldWidth; x += colStep) {
        if (!overlapsExisting(x, y)) {
          nextX = x;
          nextY = y;
          foundSpot = true;
          break;
        }
      }
      if (foundSpot) break;
    }

    if (!foundSpot && pageFieldBlocks.length > 0) {
      const last = [...pageFieldBlocks].sort(
        (a, b) => a.field_schema!.y - b.field_schema!.y || a.field_schema!.x - b.field_schema!.x
      )[pageFieldBlocks.length - 1];
      nextX = Math.min(pageMaxX - fieldWidth, Math.max(marginX, last.field_schema!.x));
      nextY = Math.min(pageMaxY - fieldHeight, last.field_schema!.y + rowStep);
    }

    const fieldKey = field.name || field.id;
    const existingForField = blocks.find(
      (block) =>
        block.block_type === "form_field" &&
        block.signing_party_id === partyId &&
        block.field_schema?.field === fieldKey
    );

    const baseSchema = existingForField?.field_schema;

    const newBlock: IFormBlock = {
      _id: `block-${field.id}-${Date.now()}`,
      block_type: "form_field",
      signing_party_id: partyId,
      order: blocks.length,
      field_schema: {
        field: fieldKey,
        type: baseSchema?.type || field.type || "text",
        page,
        x: nextX,
        y: nextY,
        w: fieldWidth,
        h: fieldHeight,
        align_h: baseSchema?.align_h || "center",
        align_v: baseSchema?.align_v || "middle",
        label: baseSchema?.label || field.label || field.name || field.id,
        tooltip_label: baseSchema?.tooltip_label || field.tooltip_label || "",
        shared:
          typeof baseSchema?.shared === "boolean" ? baseSchema.shared : (field.shared ?? true),
        source: baseSchema?.source || field.source || "manual",
        prefiller: baseSchema?.prefiller ?? field.prefiller,
        validator: baseSchema?.validator ?? field.validator,
        size: baseSchema?.size,
        wrap: baseSchema?.wrap ?? true,
        font: baseSchema?.font,
      } as any,
    };

    handleBlockCreate(newBlock);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="space-y-3 border-b p-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-600">Recipient</p>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-[0.33em] border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                <span
                  className="max-w-[calc(100%-1.5rem)] truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: selectedPartyColor.hex }}
                >
                  {selectedParty?.signatory_title || "Select recipient"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              {signingParties.map((party) => {
                const color = getPartyColorByIndex(Math.max(0, party.order - 1));
                return (
                  <DropdownMenuItem
                    key={party._id}
                    onClick={() => onPartyChange(party._id)}
                    className="py-1.5"
                  >
                    <span
                      className="max-w-full truncate rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: color.hex }}
                    >
                      {party.signatory_title}
                    </span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-2 left-2 z-99 h-5 w-5 text-slate-500" />
          <Input
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {groupedFields.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground text-sm">No fields found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groupedFields.map(({ tag, fields }) => {
              const tagDisplay = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
              return (
                <Collapsible key={tag} defaultOpen={true} className="space-y-1.5">
                  <CollapsibleTrigger className="group hover:bg-primary/5 flex w-full items-center justify-between rounded-[0.33em] px-2 py-1.5 text-sm font-semibold">
                    <span className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
                      {tagDisplay}
                    </span>
                    <span className="text-muted-foreground ml-2 text-xs font-normal">
                      ({fields.length})
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1.5">
                    {fields.map((field) => (
                      <button
                        key={field.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, field)}
                        onClick={() => handleFieldAdd(field)}
                        className="hover:bg-primary/5 hover:text-primary flex w-full cursor-move items-center rounded-[0.33em] border border-transparent px-2 py-1.5 text-left transition-colors"
                        type="button"
                      >
                        <span className="text-sm text-slate-800">{field.label || field.name}</span>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t bg-white p-3">
        <Button
          onClick={() => setIsCustomFieldModalOpen(true)}
          size="sm"
          variant="outline"
          className="w-full gap-2 border-dashed"
        >
          <Plus className="h-4 w-4" />
          Add custom field
        </Button>
      </div>

      <Dialog open={isCustomFieldModalOpen} onOpenChange={setIsCustomFieldModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add custom field</DialogTitle>
            <DialogDescription>
              Preset selection from database will be added next. This is a placeholder modal for the
              upcoming flow.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[0.33em] border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Coming soon: pick a preset and register a reusable custom field.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomFieldModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
