"use client";

import { useState, useEffect, useRef } from "react";
import { type IFormSigningParty } from "@betterinternship/core/forms";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/docs/forms/EditForm";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";

interface PartiesPanelProps {
  parties: IFormSigningParty[];
  onPartiesChange: (parties: IFormSigningParty[]) => void;
}

interface ValidationErrors {
  title?: string;
  source?: string;
}

export const PartiesPanel = ({ parties, onPartiesChange }: PartiesPanelProps) => {
  // Safeguard against undefined parties
  const safeParties = parties || [];

  const [editValues, setEditValues] = useState<Record<string, Partial<IFormSigningParty>>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, ValidationErrors>>({});
  const [emailModes, setEmailModes] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [partyCounter, setPartyCounter] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdownId &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpenDropdownId(null);
      }
    };

    if (openDropdownId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openDropdownId]);

  // Ensure at least one initiator party (order=1) always exists
  useEffect(() => {
    const hasInitiator = safeParties.some((p) => p.order === 1);
    if (!hasInitiator) {
      const newParty: IFormSigningParty = {
        _id: "initiator",
        order: 1,
        signatory_title: "Student",
        signatory_source: "initiator",
      };
      onPartiesChange([newParty, ...safeParties]);
    }

    // Initialize editValues from parties
    const initialValues: Record<string, Partial<IFormSigningParty>> = {};
    const initialEmailModes: Record<string, boolean> = {};
    let maxPartyNumber = 0;

    safeParties.forEach((party) => {
      initialValues[party._id] = party;
      initialEmailModes[party._id] = !!party.signatory_account;

      // Extract number from party IDs like "party-1", "party-2", etc
      if (party._id.startsWith("party-")) {
        const num = parseInt(party._id.replace("party-", ""), 10);
        if (!isNaN(num)) {
          maxPartyNumber = Math.max(maxPartyNumber, num);
        }
      }
    });

    setEditValues(initialValues);
    setEmailModes(initialEmailModes);
    setPartyCounter(maxPartyNumber);
  }, []);

  const validateForm = (partyId: string): boolean => {
    const errors: ValidationErrors = {};
    const values = editValues[partyId];

    // Validate title
    if (!values?.signatory_title || values.signatory_title.trim() === "") {
      errors.title = "Title is required";
    }

    setValidationErrors((prev) => ({ ...prev, [partyId]: errors }));
    return Object.keys(errors).length === 0;
  };

  const autoSaveParty = (partyId: string) => {
    if (!validateForm(partyId)) {
      return;
    }

    const findIndex = safeParties.findIndex((p) => p._id === partyId);
    if (findIndex === -1) return;

    const values = editValues[partyId];
    const isEmail = emailModes[partyId];

    const updatedParties = safeParties.map((p) => {
      if (p._id !== partyId) return p;

      const party = { ...p, ...values } as IFormSigningParty;
      // Note: DO NOT change party._id - it should remain fixed

      // Clear signatory fields for initiator
      if (findIndex === 0) {
        party.signatory_account = undefined;
        party.signatory_source = undefined;
      } else if (isEmail) {
        // Email mode: clear source, keep account
        party.signatory_source = undefined;
      } else {
        // Source mode: set the field label from title, clear account
        if (party.signatory_source) {
          party.signatory_source.label = `${values?.signatory_title || "Party"} Email Address`;
        }
        party.signatory_account = undefined;
      }

      const { signed: _signed, ...partyWithoutSigned } = party;
      return partyWithoutSigned as IFormSigningParty;
    });

    onPartiesChange(updatedParties);
  };

  const handleDeleteParty = (id: string) => {
    // Prevent deletion of the Initiator party (order=1)
    const partyToDelete = safeParties.find((p) => p._id === id);
    if (partyToDelete?.order === 1) {
      return;
    }
    const updatedParties = safeParties.filter((p) => p._id !== id);
    onPartiesChange(updatedParties);

    // Clean up state for deleted party
    setEditValues((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setEmailModes((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setValidationErrors((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleAddParty = () => {
    const newTitle = "Party";
    const newCounter = partyCounter + 1;
    const partyId = `party-${newCounter}`;
    const newParty: IFormSigningParty = {
      _id: partyId,
      order: Math.max(...safeParties.map((p) => p.order), 0) + 1,
      signatory_title: newTitle,
      signatory_source: {
        _id: "",
        label: "",
        tooltip_label: "",
      },
    };
    onPartiesChange([...safeParties, newParty]);
    setEditValues((prev) => ({ ...prev, [partyId]: newParty }));
    setEmailModes((prev) => ({ ...prev, [partyId]: false }));
    setPartyCounter(newCounter);
  };

  const handleDragStart = (index: number) => {
    // Prevent dragging initiator
    if (index === 0) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    // Prevent moving initiator (index 0) or moving to position 0
    if (draggedIndex === 0 || targetIndex === 0) {
      setDraggedIndex(null);
      return;
    }

    const reorderedParties = [...safeParties];
    const [draggedParty] = reorderedParties.splice(draggedIndex, 1);
    reorderedParties.splice(targetIndex, 0, draggedParty);

    // Update order values based on new positions
    const updatedParties = reorderedParties.map((party, index) => ({
      ...party,
      order: index + 1,
    }));

    onPartiesChange(updatedParties);
    setDraggedIndex(null);
  };

  return (
    <div className="w-full">
      <div className="space-y-2">
        {safeParties.length === 0 ? (
          <Card className="border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm text-slate-500">No parties yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {safeParties
              .sort((a, b) => a.order - b.order)
              .map((party, index) => {
                const values = editValues[party._id] || party;
                const isEmail = emailModes[party._id] || false;
                const partyErrors = validationErrors[party._id] || {};

                return (
                  <Card
                    key={party._id}
                    draggable={index !== 0}
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(index)}
                    className={`border transition-all duration-200 ${
                      draggedIndex === index
                        ? "scale-95 border-blue-300 bg-blue-50 shadow-md"
                        : "border-slate-200 hover:border-blue-200 hover:shadow-sm"
                    } p-4 ${
                      index !== 0
                        ? "cursor-grab active:scale-[0.98] active:cursor-grabbing"
                        : "cursor-not-allowed"
                    }`}
                  >
                    {index === 0 ? (
                      <div className="flex h-9 items-center text-base font-semibold text-slate-800">
                        Student
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {/* Grip handle */}
                        <GripVertical className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors hover:text-slate-600" />

                        {/* Title Input */}
                        <div className="flex-1">
                          <FormInput
                            label="Title"
                            type="text"
                            value={values.signatory_title || ""}
                            setter={(value) => {
                              setEditValues({
                                ...editValues,
                                [party._id]: { ...values, signatory_title: value },
                              });
                              setValidationErrors((prev) => ({
                                ...prev,
                                [party._id]: { ...partyErrors, title: undefined },
                              }));
                              // Auto-save after a delay
                              setTimeout(() => autoSaveParty(party._id), 300);
                            }}
                            placeholder="e.g., Entity"
                            required={false}
                          />
                          {partyErrors.title && (
                            <p className="text-xs text-red-600">{partyErrors.title}</p>
                          )}
                        </div>

                        {/* Source Dropdown */}
                        <div ref={dropdownRef} className="relative flex-1">
                          <label className="mb-1 block text-xs font-medium text-slate-600">
                            Source
                          </label>
                          <button
                            onClick={() =>
                              setOpenDropdownId(openDropdownId === party._id ? null : party._id)
                            }
                            className={`flex h-8 w-full items-center justify-between rounded-[0.33em] border bg-white px-3 text-xs transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                              partyErrors.source
                                ? "border-red-500"
                                : "border-slate-300 hover:border-blue-400"
                            }`}
                          >
                            <span className="truncate text-slate-700">
                              {isEmail
                                ? values.signatory_account?.email || "Email Address"
                                : values.signatory_source?._id || "Select..."}
                            </span>
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
                          </button>

                          {/* Custom Dropdown Menu */}
                          {openDropdownId === party._id && (
                            <div className="absolute right-0 left-0 z-10 mt-1 rounded-[0.33em] border border-slate-300 bg-white shadow-lg">
                              {/* Source Options */}
                              {safeParties
                                .filter((p) => p._id !== party._id)
                                .map((p) => (
                                  <button
                                    key={p._id}
                                    onClick={() => {
                                      setEmailModes({ ...emailModes, [party._id]: false });
                                      setEditValues({
                                        ...editValues,
                                        [party._id]: {
                                          ...values,
                                          signatory_source: {
                                            _id: p._id,
                                            label: "",
                                            tooltip_label: "",
                                          },
                                          signatory_account: undefined,
                                        },
                                      });
                                      setOpenDropdownId(null);
                                      // Auto-save
                                      setTimeout(() => autoSaveParty(party._id), 100);
                                    }}
                                    className="w-full border-b border-slate-200 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-slate-100"
                                  >
                                    {p.signatory_title}
                                  </button>
                                ))}

                              {/* Email Address Option with Input */}
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="border-t border-slate-200 px-3 py-2.5"
                              >
                                <label className="mb-1 block text-xs font-medium text-slate-600">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={isEmail ? values.signatory_account?.email || "" : ""}
                                  onChange={(e) => {
                                    setEmailModes({
                                      ...emailModes,
                                      [party._id]: true,
                                    });
                                    setEditValues({
                                      ...editValues,
                                      [party._id]: {
                                        ...values,
                                        signatory_source: undefined,
                                        signatory_account: {
                                          name: e.target.value.split("@")[0] || "",
                                          email: e.target.value,
                                        },
                                      },
                                    });
                                  }}
                                  onBlur={() => {
                                    autoSaveParty(party._id);
                                  }}
                                  onFocus={() => {
                                    setEmailModes({
                                      ...emailModes,
                                      [party._id]: true,
                                    });
                                  }}
                                  placeholder="email@example.com"
                                  className="h-7 w-full border border-slate-300 px-2 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                />
                              </div>
                            </div>
                          )}

                          {partyErrors.source && (
                            <p className="mt-1 text-xs text-red-600">{partyErrors.source}</p>
                          )}
                        </div>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteParty(party._id)}
                          className="h-8 w-8 flex-shrink-0 p-0 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
                          title="Delete party"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        )}

        {/* Add Party Button at the bottom */}
        <Button
          onClick={handleAddParty}
          size="sm"
          className="w-full gap-2 border border-dashed border-blue-300 bg-blue-50 text-blue-700 transition-colors hover:border-blue-400 hover:bg-blue-100"
        >
          <Plus className="h-4 w-4" />
          Add another recipient
        </Button>
      </div>
    </div>
  );
};
