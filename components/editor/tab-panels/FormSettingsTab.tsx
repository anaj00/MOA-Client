"use client";

import { useState } from "react";
import { useFormEditor } from "@/app/contexts/form-editor.context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FONTS } from "@betterinternship/core/forms";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormMetadataTab } from "@/components/editor/tab-panels/FormMetadataTab";
import { SigningPartiesTab } from "@/components/editor/tab-panels/SigningPartiesTab";
import { SubscribersTab } from "@/components/editor/tab-panels/SubscribersTab";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type SettingsSection = "metadata" | "recipients" | "subscribers" | "settings";

export function FormSettingsTab() {
  const [section, setSection] = useState<SettingsSection>("settings");
  const { setActiveTab } = useFormEditor();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="w-56 border-r bg-slate-50/70 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab("editor")}
          className="mb-2 w-full justify-start gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Button>
        <div className="space-y-1">
          <button
            onClick={() => setSection("settings")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "settings"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Form Settings
          </button>
          <button
            onClick={() => setSection("metadata")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "metadata"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Metadata
          </button>
          <button
            onClick={() => setSection("recipients")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "recipients"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Recipients
          </button>
          <button
            onClick={() => setSection("subscribers")}
            className={cn(
              "w-full rounded-[0.33em] px-3 py-2 text-left text-sm",
              section === "subscribers"
                ? "bg-primary/10 text-primary font-medium"
                : "text-slate-700 hover:bg-slate-100"
            )}
          >
            Subscribers
          </button>
        </div>
      </div>

      <div className="min-w-0 flex-1 overflow-auto">
        {section === "settings" && <FormSettingsContent />}
        {section === "metadata" && <FormMetadataTab />}
        {section === "recipients" && <SigningPartiesTab />}
        {section === "subscribers" && <SubscribersTab />}
      </div>
    </div>
  );
}

function FormSettingsContent() {
  const { formMetadata, updateFormMetadata } = useFormEditor();
  const [overrideFonts, setOverrideFonts] = useState(false);
  const [textFont, setTextFont] = useState<string>("");
  const [signatureFont, setSignatureFont] = useState<string>("");

  if (!formMetadata) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center">
        No form loaded
      </div>
    );
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormMetadata({ name: e.target.value });
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateFormMetadata({ label: e.target.value });
  };

  const handleOverrideChange = (override: boolean) => {
    setOverrideFonts(override);
    if (!override) {
      setTextFont("");
      setSignatureFont("");
    }
  };

  const handleApplyFonts = () => {
    if (textFont && signatureFont) {
      const blocks = formMetadata.schema.blocks.map((block) => {
        if (block.block_type === "form_field") {
          return {
            ...block,
            field_schema: {
              ...block.field_schema,
              font: textFont === "signature" ? signatureFont : textFont,
            },
          };
        }
        return block;
      });

      updateFormMetadata({ schema: { ...formMetadata.schema, blocks } });
      toast.success("Fonts applied to form successfully!", toastPresets.success);
    }
  };

  return (
    <div className="h-full w-full overflow-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold">Form Settings</h3>

          <div>
            <Label htmlFor="form-name" className="text-sm font-medium">
              Form Name
            </Label>
            <Input
              id="form-name"
              value={formMetadata.name}
              onChange={handleNameChange}
              className="mt-2"
              placeholder="e.g., application-form"
            />
            <p className="text-muted-foreground mt-2 text-xs">
              This is the internal identifier for the form
            </p>
          </div>

          <div>
            <Label htmlFor="form-label" className="text-sm font-medium">
              Form Label
            </Label>
            <Input
              id="form-label"
              value={formMetadata.label}
              onChange={handleLabelChange}
              className="mt-2"
              placeholder="e.g., Application Form"
            />
            <p className="text-muted-foreground mt-2 text-xs">This is the display name for users</p>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">Font Configuration</h3>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs text-blue-700">
              <strong>Note:</strong> Font overrides will be applied to all text and signature fields
              in your form.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <label className="block text-sm font-medium">Overwrite Default Font Style</label>
              <p className="mt-1 text-xs text-gray-500">
                Apply custom fonts to text and signature fields
              </p>
            </div>
            <Switch
              checked={overrideFonts}
              onCheckedChange={handleOverrideChange}
              aria-label="Toggle font override"
            />
          </div>

          {overrideFonts && (
            <div className="space-y-4 rounded-lg bg-gray-50 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Text</label>
                <Select value={textFont} onValueChange={setTextFont}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a font..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {FONTS.map((font) => (
                      <SelectItem key={font.name} value={font.name}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Signature</label>
                <Select value={signatureFont} onValueChange={setSignatureFont}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a font..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {FONTS.map((font) => (
                      <SelectItem key={font.name} value={font.name}>
                        {font.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleApplyFonts}
                disabled={!textFont || !signatureFont}
                className="mt-4 w-full"
              >
                Apply Fonts to Form
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
