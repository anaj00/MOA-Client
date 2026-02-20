"use client";

import { useMemo, useState } from "react";
import { useFormEditorTab } from "@/app/contexts/form-editor-tab.context";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { FormPreviewRenderer } from "@/components/docs/form-editor/form-layout/FormPreviewRenderer";

interface FormViewBlocksPanelProps {
  signingParties: any[];
}

export function FormViewBlocksPanel({ signingParties: _signingParties }: FormViewBlocksPanelProps) {
  const { formMetadata } = useFormEditor();
  const {
    selectedPartyId,
    blocks,
    formViewUnits,
    selectedBlockGroup,
    handleSelectFormViewUnit,
  } = useFormEditorTab();
  const [values, setValues] = useState<Record<string, string>>({});
  const activePartyId = selectedPartyId || formMetadata?.signing_parties?.[0]?._id || "";

  const selectedPartyBlocks = useMemo(
    () =>
      blocks
        .filter((block) => {
          const party = block.signing_party_id || "";
          return party === activePartyId;
        })
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [activePartyId, blocks]
  );

  const selectedFieldId = useMemo(() => {
    if (!selectedBlockGroup) return null;
    if (selectedBlockGroup.fieldName === "header" || selectedBlockGroup.fieldName === "paragraph") {
      return null;
    }
    return selectedBlockGroup.fieldName;
  }, [selectedBlockGroup]);

  const handleFieldClick = (fieldName: string) => {
    const targetUnit = formViewUnits.find((unit) => {
      if (unit.kind !== "field") return false;
      const unitPrimaryBlock = blocks.find((block) => block._id === unit.primaryBlockId);
      const unitField =
        unitPrimaryBlock?.field_schema?.field || unitPrimaryBlock?.phantom_field_schema?.field;
      return unitField === fieldName;
    });
    if (targetUnit) {
      handleSelectFormViewUnit(targetUnit.id);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-3">
        {selectedPartyBlocks.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            No blocks for this recipient yet.
          </div>
        ) : (
          <div className="h-full rounded-[0.33em] border bg-white">
            <FormPreviewRenderer
              formName={formMetadata?.name || "form"}
              formLabel={formMetadata?.label || "Form"}
              blocks={selectedPartyBlocks}
              values={values}
              onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: String(value) }))}
              metadata={formMetadata || undefined}
              selectedFieldId={selectedFieldId}
              onFieldClick={handleFieldClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
