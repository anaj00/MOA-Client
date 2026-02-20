"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from "react";
import { IFormBlock } from "@betterinternship/core/forms";
import { useFormEditor } from "./form-editor.context";

interface BlockGroup {
  id: string;
  fieldName: string;
  partyId: string;
  blockIds: string[]; // ordered list of block IDs in this group
}

interface FormEditorTabContextType {
  // Selection state
  selectedPartyId: string | null;
  setSelectedPartyId: (partyId: string | null) => void;

  selectedBlockId: string | null;
  setSelectedBlockId: (blockId: string | null) => void;

  selectedFieldId: string | null;
  setSelectedFieldId: (fieldId: string | null) => void;

  // Normalized state for blocks and groups
  blockGroupsOrder: string[]; // ordered list of block group IDs
  blockGroups: Record<string, BlockGroup>;
  blocksMap: Record<string, IFormBlock>;

  // Currently selected group (for UI focus/editing)
  selectedBlockGroup: BlockGroup | null;
  setSelectedBlockGroup: (group: BlockGroup | null) => void;

  // Blocks array for backward compatibility
  blocks: IFormBlock[];

  // UI state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  preferredPlacementPage: number;
  setPreferredPlacementPage: (page: number) => void;

  // Handlers
  handleBlockSelect: (blockId: string) => void;
  handleParentGroupSelect: (blockId: string, group: BlockGroup | null) => void;
  handleBlockUpdate: (updatedBlock: IFormBlock) => void;
  handleBlockCreate: (block: IFormBlock) => void;
  handleFieldSelectFromPdf: (fieldId: string) => void;
  handleParentUpdate: (blockId: string, updates: any) => void;

  // Block management
  handleDuplicateBlock: (block: IFormBlock) => void;
  handleDeleteBlock: (blockId: string) => void;
  handleDeleteGroupBlocks: (fieldName: string, partyId: string) => void;
  handleReorderBlocks: (blocks: IFormBlock[]) => void;
  handleReorderBlock: (blockId: string, direction: "up" | "down") => void;
  handleAddPhantomBlock: (
    type: "header" | "paragraph" | "phantom_field",
    selectedPartyId: string,
    customBlock?: IFormBlock
  ) => void;
}

const FormEditorTabContext = createContext<FormEditorTabContextType | undefined>(undefined);

export function FormEditorTabProvider({ children }: { children: ReactNode }) {
  const { formMetadata, updateBlocks } = useFormEditor();

  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(
    formMetadata?.signing_parties?.[0]?._id || null
  );
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [blockGroupsOrder, setBlockGroupsOrder] = useState<string[]>([]);
  const [blockGroups, setBlockGroups] = useState<Record<string, BlockGroup>>({});
  const [selectedBlockGroup, setSelectedBlockGroup] = useState<BlockGroup | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [preferredPlacementPage, setPreferredPlacementPage] = useState(1);

  // Expose blocks as array derived from blocksMap, or directly from formMetadata
  const blocks = useMemo(() => {
    return formMetadata?.schema.blocks || [];
  }, [formMetadata]);

  // Initialize normalized state - create blocksMap
  const _blocksMap = useMemo(() => {
    const map: Record<string, IFormBlock> = {};
    blocks.forEach((block) => {
      map[block._id] = block;
    });
    return map;
  }, [blocks]);

  // Initialize normalized state from blocks
  useMemo(() => {
    const newBlockGroups: Record<string, BlockGroup> = {};
    const newOrder: string[] = [];
    const seenGroupIds = new Set<string>();

    blocks.forEach((block) => {
      const blockType = block.block_type;

      // For headers and paragraphs, use block._id as the group ID
      if (blockType === "header" || blockType === "paragraph") {
        const groupId = block._id;
        if (!seenGroupIds.has(groupId)) {
          newBlockGroups[groupId] = {
            id: groupId,
            fieldName: blockType,
            partyId: block.signing_party_id || "unknown",
            blockIds: [block._id],
          };
          newOrder.push(groupId);
          seenGroupIds.add(groupId);
          console.log("[FormEditorTabContext] Created header/paragraph group:", {
            groupId,
            blockType,
            signingPartyId: block.signing_party_id,
          });
        }
        return;
      }

      // For phantom_field and form_phantom_field, get field from phantom_field_schema
      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      let schema: any = block.field_schema;
      if (!schema && (blockType === "phantom_field" || blockType === "form_phantom_field")) {
        schema = block.phantom_field_schema;
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      if (!schema) return;

      const fieldName: string = (schema.field || "Unnamed") as string;
      const partyId = block.signing_party_id || "unknown";
      // Include blockType in groupId to prevent different block types with the same field name from being grouped together
      const groupId = `${fieldName}-${partyId}-${blockType}`;

      if (!seenGroupIds.has(groupId)) {
        newBlockGroups[groupId] = {
          id: groupId,
          fieldName,
          partyId,
          blockIds: [block._id],
        };
        newOrder.push(groupId);
        seenGroupIds.add(groupId);
      } else {
        // Add block to existing group
        newBlockGroups[groupId].blockIds.push(block._id);
      }
    });

    console.log("[FormEditorTabContext] Final normalized state:", { newOrder, newBlockGroups });
    setBlockGroupsOrder(newOrder);
    setBlockGroups(newBlockGroups);
  }, [blocks]);

  const handleBlockSelect = useCallback(
    (blockId: string) => {
      setSelectedBlockId(blockId || null);
      // Get the group for this block if it exists
      const group = blockGroups[blockId] || null;
      setSelectedBlockGroup(group);
    },
    [blockGroups]
  );

  const handleParentGroupSelect = useCallback((blockId: string, group: BlockGroup | null) => {
    if (group) {
      const groupId = group.id;

      // Add to blockGroups if not exists
      setBlockGroups((prev) => {
        if (prev[groupId]) return prev;
        return {
          ...prev,
          [groupId]: group,
        };
      });

      // Add to blockGroupsOrder if not exists
      setBlockGroupsOrder((prev) => {
        if (prev.includes(groupId)) return prev;
        return [...prev, groupId];
      });

      setSelectedBlockGroup(group);
    }
  }, []);

  const handleBlockUpdate = useCallback(
    (updatedBlock: IFormBlock) => {
      if (!formMetadata) return;
      const updatedBlocks = formMetadata.schema.blocks.map((b) =>
        b._id === updatedBlock._id ? updatedBlock : b
      );
      updateBlocks(updatedBlocks);
    },
    [formMetadata, updateBlocks]
  );

  const handleBlockCreate = useCallback(
    (newBlock: IFormBlock) => {
      if (!formMetadata) return;
      updateBlocks([...formMetadata.schema.blocks, newBlock]);
      setSelectedBlockId(newBlock._id);
      setSelectedBlockGroup(null);
    },
    [formMetadata, updateBlocks]
  );

  const handleFieldSelectFromPdf = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId);
    setSelectedBlockId(fieldId);
    setSelectedBlockGroup(null);
  }, []);

  /* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
  const handleParentUpdate = useCallback(
    (blockId: string, updates: any) => {
      console.log("[handleParentUpdate] Called with:", { blockId, updates, blockGroups });
      if (!formMetadata) {
        console.log("[handleParentUpdate] formMetadata is null, returning");
        return;
      }

      const group = blockGroups[blockId];
      console.log("[handleParentUpdate] Found group:", { blockId, group });
      if (!group) {
        console.log("[handleParentUpdate] No group found for blockId:", blockId);
        return;
      }

      const updatedBlocks = formMetadata.schema.blocks.map((block: any) => {
        // Get schema from either field_schema or phantom_field_schema
        const schema = block.field_schema || block.phantom_field_schema;

        const matches =
          (schema?.field === group.fieldName || block.block_type === group.fieldName) &&
          (block.signing_party_id === group.partyId ||
            (block.signing_party_id === "" && group.partyId === "unknown") ||
            (block.signing_party_id === "unknown" && group.partyId === ""));

        if (matches) {
          console.log("[handleParentUpdate] Matched block:", {
            blockId: block._id,
            fieldName: schema?.field,
            partyId: block.signing_party_id,
            updates,
          });
          const updated: IFormBlock = {
            ...block,
          };

          // Update field_schema if it exists
          if (block.field_schema) {
            updated.field_schema = {
              ...block.field_schema,
              field: updates.fieldName !== undefined ? updates.fieldName : block.field_schema.field,
              label: updates.label !== undefined ? updates.label : block.field_schema.label,
              type: updates.type !== undefined ? updates.type : block.field_schema.type,
              source: updates.source !== undefined ? updates.source : block.field_schema.source,
              tooltip_label:
                updates.tooltip_label !== undefined
                  ? updates.tooltip_label
                  : block.field_schema.tooltip_label,
              shared: updates.shared !== undefined ? updates.shared : block.field_schema.shared,
              prefiller:
                updates.prefiller !== undefined ? updates.prefiller : block.field_schema.prefiller,
              validator:
                updates.validator !== undefined ? updates.validator : block.field_schema.validator,
            };
          }

          // Update phantom_field_schema if it exists
          if (block.phantom_field_schema) {
            updated.phantom_field_schema = {
              ...block.phantom_field_schema,
              field:
                updates.fieldName !== undefined
                  ? updates.fieldName
                  : block.phantom_field_schema.field,
              label: updates.label !== undefined ? updates.label : block.phantom_field_schema.label,
              type: updates.type !== undefined ? updates.type : block.phantom_field_schema.type,
              source:
                updates.source !== undefined ? updates.source : block.phantom_field_schema.source,
              tooltip_label:
                updates.tooltip_label !== undefined
                  ? updates.tooltip_label
                  : block.phantom_field_schema.tooltip_label,
              shared:
                updates.shared !== undefined ? updates.shared : block.phantom_field_schema.shared,
              prefiller:
                updates.prefiller !== undefined
                  ? updates.prefiller
                  : block.phantom_field_schema.prefiller,
              validator:
                updates.validator !== undefined
                  ? updates.validator
                  : block.phantom_field_schema.validator,
            };
          }

          if (updates.block_type !== undefined) {
            updated.block_type = updates.block_type;
          }
          if (updates.signing_party_id !== undefined) {
            updated.signing_party_id = updates.signing_party_id;
          }
          // Handle text_content for phantom/header/paragraph blocks
          if (updates.text_content !== undefined) {
            updated.text_content = updates.text_content;
          }

          return updated;
        }
        return block;
      });

      console.log("[handleParentUpdate] Calling updateBlocks with:", updatedBlocks);
      updateBlocks(updatedBlocks);
      console.log("[handleParentUpdate] updateBlocks called");

      // Update the group mapping if partyId or block_type changed
      const newPartyId =
        updates.signing_party_id !== undefined ? updates.signing_party_id : group.partyId;
      const newBlockType = updates.block_type !== undefined ? updates.block_type : group.fieldName;

      const newGroupId = `${group.fieldName}-${newPartyId}-${newBlockType}`;

      // Update block group if either partyId or block_type changed
      if (updates.signing_party_id !== undefined || updates.block_type !== undefined) {
        setBlockGroups((prev) => {
          const updated = { ...prev };

          // If the group ID changed, create the new group and remove the old one
          if (updates.signing_party_id !== undefined || updates.block_type !== undefined) {
            updated[blockId] = {
              ...group,
              partyId: newPartyId,
            };
          }

          return updated;
        });

        // Update the selected group to reflect changes
        setSelectedBlockGroup((prev) => {
          if (!prev) return prev;

          const matches = prev.fieldName === group.fieldName && prev.partyId === group.partyId;

          if (matches) {
            return {
              ...prev,
              partyId: newPartyId,
            };
          }
          return prev;
        });
      }
    },
    [formMetadata, updateBlocks, blockGroups]
  );

  const handleDuplicateBlock = useCallback(
    (block: IFormBlock) => {
      const newBlock: IFormBlock = {
        ...block,
        _id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      updateBlocks([...blocks, newBlock]);
    },
    [blocks, updateBlocks]
  );

  const handleDeleteBlock = useCallback(
    (blockId: string) => {
      updateBlocks(blocks.filter((b) => b._id !== blockId));
    },
    [blocks, updateBlocks]
  );

  const handleDeleteGroupBlocks = useCallback(
    (fieldName: string, partyId: string) => {
      const remainingBlocks = blocks.filter((b) => {
        // Check both field_schema and phantom_field_schema since different block types store field name in different places
        const fieldSchema = b.field_schema;
        const phantomSchema = b.phantom_field_schema;

        const isMatch =
          b.signing_party_id === partyId &&
          (fieldSchema?.field === fieldName ||
            phantomSchema?.field === fieldName ||
            ((b.block_type === "header" || b.block_type === "paragraph") &&
              fieldName === b.block_type));

        return !isMatch;
      });
      updateBlocks(remainingBlocks);
    },
    [blocks, updateBlocks]
  );

  const handleReorderBlocks = useCallback(
    (reorderedBlocks: IFormBlock[]) => {
      // Ensure all blocks have proper order values
      const blocksWithOrder = reorderedBlocks.map((block, index) => ({
        ...block,
        order: index,
      }));
      updateBlocks(blocksWithOrder);

      // The useMemo hook will automatically rebuild blockGroupsOrder and blockGroups
      // from the new block order, so no need to manually update them here
    },
    [updateBlocks]
  );

  const handleReorderBlock = useCallback(
    (blockId: string, direction: "up" | "down") => {
      const idx = blocks.findIndex((b) => b._id === blockId);
      if (idx === -1) return;

      const newBlocks = [...blocks];
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;

      if (targetIdx < 0 || targetIdx >= newBlocks.length) return;

      [newBlocks[idx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[idx]];
      updateBlocks(newBlocks);
    },
    [blocks, updateBlocks]
  );

  const handleAddPhantomBlock = useCallback(
    (
      type: "header" | "paragraph" | "phantom_field",
      selectedPartyId: string,
      customBlock?: IFormBlock
    ) => {
      let newBlock: IFormBlock;

      if (type === "phantom_field" && customBlock) {
        newBlock = customBlock;
      } else {
        newBlock = {
          _id: `${type}-${Date.now()}`,
        } as IFormBlock;
        newBlock.block_type = type;
        newBlock.signing_party_id = selectedPartyId;
        if (type === "header") {
          newBlock.text_content = "New Header";
        } else if (type === "paragraph") {
          newBlock.text_content = "New Paragraph";
        }
      }

      newBlock.order = blocks.length;
      updateBlocks([...blocks, newBlock]);
    },
    [blocks, updateBlocks]
  );

  const value: FormEditorTabContextType = {
    selectedPartyId,
    setSelectedPartyId,
    selectedBlockId,
    setSelectedBlockId,
    selectedFieldId,
    setSelectedFieldId,
    blockGroupsOrder,
    blockGroups,
    blocksMap: _blocksMap,
    selectedBlockGroup,
    setSelectedBlockGroup,
    blocks,
    searchQuery,
    setSearchQuery,
    preferredPlacementPage,
    setPreferredPlacementPage,
    handleBlockSelect,
    handleParentGroupSelect,
    handleBlockUpdate,
    handleBlockCreate,
    handleFieldSelectFromPdf,
    handleParentUpdate,
    handleDuplicateBlock,
    handleDeleteBlock,
    handleDeleteGroupBlocks,
    handleReorderBlocks,
    handleReorderBlock,
    handleAddPhantomBlock,
  };

  return <FormEditorTabContext.Provider value={value}>{children}</FormEditorTabContext.Provider>;
}

export function useFormEditorTab() {
  const context = useContext(FormEditorTabContext);
  if (!context) {
    throw new Error("useFormEditorTab must be used within FormEditorTabProvider");
  }
  return context;
}
