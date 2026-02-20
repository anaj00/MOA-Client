"use client";

import { useState, useEffect } from "react";
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
  const safeParties = parties || [];
  const orderedParties = [...safeParties].sort((a, b) => a.order - b.order);

  const [editValues, setEditValues] = useState<Record<string, Partial<IFormSigningParty>>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, ValidationErrors>>({});
  const [emailModes, setEmailModes] = useState<Record<string, boolean>>({});
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    index: number;
    position: "before" | "after";
  } | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [partyCounter, setPartyCounter] = useState(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openDropdownId && !target.closest("[data-party-source-dropdown]")) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openDropdownId]);

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

    const initialValues: Record<string, Partial<IFormSigningParty>> = {};
    const initialEmailModes: Record<string, boolean> = {};
    let maxPartyNumber = 0;

    safeParties.forEach((party) => {
      initialValues[party._id] = party;
      initialEmailModes[party._id] = !!party.signatory_account;

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

  const validateForm = (
    partyId: string,
    overrides?: { values?: Partial<IFormSigningParty>; isEmail?: boolean }
  ): boolean => {
    const errors: ValidationErrors = {};
    const values = overrides?.values ?? editValues[partyId];
    const partyIndex = orderedParties.findIndex((p) => p._id === partyId);
    const isEmail = overrides?.isEmail ?? !!emailModes[partyId];

    if (!values?.signatory_title || values.signatory_title.trim() === "") {
      errors.title = "Title is required";
    }

    if (partyIndex > 0) {
      if (isEmail) {
        const email = values?.signatory_account?.email?.trim();
        if (!email) {
          errors.source = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors.source = "Enter a valid email";
        }
      } else if (!values?.signatory_source?._id) {
        errors.source = "Select a source";
      }
    }

    setValidationErrors((prev) => ({ ...prev, [partyId]: errors }));
    return Object.keys(errors).length === 0;
  };

  const autoSaveParty = (
    partyId: string,
    overrides?: { values?: Partial<IFormSigningParty>; isEmail?: boolean }
  ) => {
    if (!validateForm(partyId, overrides)) return;

    const findIndex = orderedParties.findIndex((p) => p._id === partyId);
    if (findIndex === -1) return;

    const values = overrides?.values ?? editValues[partyId];
    const isEmail = overrides?.isEmail ?? emailModes[partyId];

    const updatedParties = orderedParties.map((p) => {
      if (p._id !== partyId) return p;

      const party = { ...p, ...values } as IFormSigningParty;

      if (findIndex === 0) {
        party.signatory_account = undefined;
        party.signatory_source = undefined;
      } else if (isEmail) {
        party.signatory_source = undefined;
      } else {
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
    const partyToDelete = orderedParties.find((p) => p._id === id);
    if (partyToDelete?.order === 1) return;

    onPartiesChange(orderedParties.filter((p) => p._id !== id));

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
    const newCounter = partyCounter + 1;
    const partyId = `party-${newCounter}`;
    const newParty: IFormSigningParty = {
      _id: partyId,
      order: Math.max(...orderedParties.map((p) => p.order), 0) + 1,
      signatory_title: "Party",
      signatory_source: {
        _id: "",
        label: "",
        tooltip_label: "",
      },
    };

    onPartiesChange([...orderedParties, newParty]);
    setEditValues((prev) => ({ ...prev, [partyId]: newParty }));
    setEmailModes((prev) => ({ ...prev, [partyId]: false }));
    setPartyCounter(newCounter);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (index === 0) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", orderedParties[index]._id);
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const isAfter = e.clientY - rect.top > rect.height / 2;
    const position: "before" | "after" = isAfter ? "after" : "before";

    if (index === 0 && position === "before") return;

    if (!dragOverTarget || dragOverTarget.index !== index || dragOverTarget.position !== position) {
      setDragOverTarget({ index, position });
    }
  };

  const handleDrop = () => {
    if (draggedIndex === null || !dragOverTarget) {
      setDraggedIndex(null);
      setDragOverTarget(null);
      return;
    }

    const { index: hoveredIndex, position } = dragOverTarget;
    let targetIndex = hoveredIndex + (position === "after" ? 1 : 0);
    targetIndex = Math.max(1, targetIndex);

    const reordered = [...orderedParties];
    const [draggedParty] = reordered.splice(draggedIndex, 1);
    const insertIndex = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    reordered.splice(insertIndex, 0, draggedParty);

    const updatedParties = reordered.map((party, index) => ({
      ...party,
      order: index + 1,
    }));

    onPartiesChange(updatedParties);
    setDraggedIndex(null);
    setDragOverTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverTarget(null);
  };

  return (
    <div className="w-full">
      <div className="space-y-2">
        {orderedParties.length === 0 ? (
          <Card className="border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm text-slate-500">No parties yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {orderedParties.map((party, index) => {
              const values = editValues[party._id] || party;
              const isEmail = emailModes[party._id] || false;
              const partyErrors = validationErrors[party._id] || {};
              const sourceParty = orderedParties.find(
                (p) => p._id === values.signatory_source?._id
              );

              return (
                <Card
                  key={party._id}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  className={`gap-0 border px-3 py-3 transition-all duration-150 ${
                    draggedIndex === index
                      ? "scale-[0.985] border-blue-300 opacity-70 shadow-sm"
                      : "border-slate-200 bg-white"
                  } ${
                    dragOverTarget?.index === index ? "ring-1 ring-blue-300 ring-offset-1" : ""
                  } ${
                    dragOverTarget?.index === index && dragOverTarget.position === "before"
                      ? "before:absolute before:-top-1 before:right-2 before:left-2 before:h-0.5 before:rounded-full before:bg-blue-500 before:content-['']"
                      : ""
                  } ${
                    dragOverTarget?.index === index && dragOverTarget.position === "after"
                      ? "after:absolute after:right-2 after:-bottom-1 after:left-2 after:h-0.5 after:rounded-full after:bg-blue-500 after:content-['']"
                      : ""
                  } relative`}
                >
                  {index === 0 ? (
                    <div className="flex h-8 items-center text-sm font-semibold text-slate-800">
                      Student
                    </div>
                  ) : (
                    <div className="grid grid-cols-[auto_1fr_1fr_auto] items-start gap-2.5">
                      <button
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        className="mt-5 flex h-8 w-8 cursor-grab items-center justify-center rounded-[0.33em] text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                        title="Drag to reorder"
                        type="button"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>

                      <div className="min-w-0">
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
                            setTimeout(() => autoSaveParty(party._id), 250);
                          }}
                          placeholder="e.g., Partner"
                          required={false}
                        />
                        {partyErrors.title && (
                          <p className="mt-1 text-xs text-red-600">{partyErrors.title}</p>
                        )}
                      </div>

                      <div className="relative min-w-0" data-party-source-dropdown>
                        <label className="mb-1 block text-xs text-slate-600">Source</label>
                        <button
                          onClick={() =>
                            setOpenDropdownId(openDropdownId === party._id ? null : party._id)
                          }
                          className={`flex h-8 w-full items-center justify-between rounded-[0.33em] border bg-white px-2.5 text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                            partyErrors.source
                              ? "border-red-500"
                              : "border-slate-300 hover:border-slate-400"
                          }`}
                          type="button"
                        >
                          <span className="truncate text-slate-700">
                            {isEmail
                              ? values.signatory_account?.email || "Direct email"
                              : sourceParty?.signatory_title || "Select source"}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                        </button>

                        {openDropdownId === party._id && (
                          <div className="absolute right-0 left-0 z-20 mt-1 rounded-[0.33em] border border-slate-300 bg-white p-2 shadow-lg">
                            <div className="max-h-36 space-y-1 overflow-auto pr-0.5">
                              {orderedParties
                                .filter((p) => p._id !== party._id)
                                .map((p) => (
                                  <button
                                    key={p._id}
                                    type="button"
                                    onClick={() => {
                                      const nextValues: Partial<IFormSigningParty> = {
                                        ...values,
                                        signatory_source: {
                                          _id: p._id,
                                          label: `${values?.signatory_title || "Party"} Email Address`,
                                          tooltip_label: "",
                                        },
                                        signatory_account: undefined,
                                      };
                                      setEmailModes({ ...emailModes, [party._id]: false });
                                      setEditValues({
                                        ...editValues,
                                        [party._id]: nextValues,
                                      });
                                      setOpenDropdownId(null);
                                      setValidationErrors((prev) => ({
                                        ...prev,
                                        [party._id]: { ...partyErrors, source: undefined },
                                      }));
                                      setTimeout(
                                        () =>
                                          autoSaveParty(party._id, {
                                            values: nextValues,
                                            isEmail: false,
                                          }),
                                        100
                                      );
                                    }}
                                    className="w-full rounded-[0.33em] px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
                                  >
                                    {p.signatory_title}
                                  </button>
                                ))}
                            </div>

                            <div className="mt-2 border-t border-slate-200 pt-2">
                              <p className="mb-1 text-xs text-slate-600">
                                or enter an email address
                              </p>
                              <input
                                type="email"
                                value={isEmail ? values.signatory_account?.email || "" : ""}
                                onChange={(e) => {
                                  const email = e.target.value;
                                  const nextValues: Partial<IFormSigningParty> = {
                                    ...values,
                                    signatory_source: undefined,
                                    signatory_account: {
                                      name: email.split("@")[0] || "",
                                      email,
                                    },
                                  };
                                  setEmailModes({ ...emailModes, [party._id]: true });
                                  setEditValues({
                                    ...editValues,
                                    [party._id]: nextValues,
                                  });
                                  setValidationErrors((prev) => ({
                                    ...prev,
                                    [party._id]: { ...partyErrors, source: undefined },
                                  }));
                                }}
                                onBlur={(e) =>
                                  autoSaveParty(party._id, {
                                    values: {
                                      ...values,
                                      signatory_source: undefined,
                                      signatory_account: {
                                        name: e.target.value.split("@")[0] || "",
                                        email: e.target.value,
                                      },
                                    },
                                    isEmail: true,
                                  })
                                }
                                placeholder="email@example.com"
                                className="h-8 w-full rounded-[0.33em] border border-slate-300 px-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {partyErrors.source && (
                          <p className="mt-1 text-xs text-red-600">{partyErrors.source}</p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteParty(party._id)}
                        className="mt-5 h-8 w-8 p-0 text-red-500 transition-colors hover:bg-red-100 hover:text-red-700"
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

        <Button
          onClick={handleAddParty}
          size="sm"
          className="w-full gap-2 border border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Add recipient
        </Button>
      </div>
    </div>
  );
};
