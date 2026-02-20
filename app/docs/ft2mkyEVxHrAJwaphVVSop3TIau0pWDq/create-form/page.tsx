"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import { FormInput } from "@/components/docs/forms/EditForm";
import { PartiesPanel } from "@/components/docs/form-editor/form-layout/PartiesPanel";
import { IFormSigningParty, IFormMetadata, SCHEMA_VERSION } from "@betterinternship/core/forms";
import { formsControllerRegisterForm } from "@/app/api";
import { Card } from "@/components/ui/card";
import { HeaderIcon, HeaderText } from "@/components/ui/text";

const CreateFormPage = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [signingParties, setSigningParties] = useState<IFormSigningParty[]>([
    {
      _id: "initiator",
      order: 1,
      signatory_title: "initiator",
      signatory_source: "initiator",
    },
  ]);

  // Derive form name from label (no spaces, lowercase)
  const formName = useMemo(() => {
    return formLabel
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
  }, [formLabel]);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setPdfFile(file);
    toast.success("PDF uploaded successfully");
  };

  const handleCreateForm = async () => {
    if (!pdfFile) {
      toast.error("Please upload a PDF file");
      return;
    }
    if (!formLabel.trim()) {
      toast.error("Please enter a form label");
      return;
    }
    if (signingParties.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }

    setIsLoading(true);

    try {
      // Create the form metadata object
      const formMetadata: IFormMetadata = {
        name: formName,
        label: formLabel,
        schema_version: SCHEMA_VERSION,
        schema: { blocks: [] },
        signing_parties: signingParties,
        subscribers: [],
      };

      // Use the pre-configured formsControllerRegisterForm function
      await formsControllerRegisterForm({
        ...formMetadata,
        base_document: pdfFile,
      });

      toast.success("Form created successfully");

      // Wait a moment for the backend to process and then redirect to editor
      // This ensures the API can fetch the newly created form
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to editor with the form name
      router.push(`./editor?form_name=${encodeURIComponent(formName)}`);
    } catch (error) {
      console.error("Error creating form:", error);
      toast.error(
        `Failed to create form: ${error instanceof Error ? error.message : String(error)}`
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50/40 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="flex items-center gap-3">
          <HeaderIcon icon={Upload} />
          <HeaderText> Create new form</HeaderText>
        </div>

        <Card className="gap-2 border-slate-200 px-5 py-3.5">
          <p className="text-sm font-semibold">Display Name</p>
          <FormInput
            placeholder="Student MOA"
            value={formLabel}
            setter={setFormLabel}
            required={true}
          />
          {formLabel && (
            <p className="text-xs text-slate-500">
              Form name: <span className="font-mono font-semibold text-slate-700">{formName}</span>
            </p>
          )}
        </Card>

        <Card className="gap-2 border-slate-200 px-5 py-3.5">
          <p className="text-sm font-semibold text-slate-900">PDF Document</p>
          <div className="rounded-[0.33em] border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center transition-colors hover:border-slate-400 hover:bg-slate-100">
            <label className="flex cursor-pointer flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {pdfFile ? "PDF uploaded" : "Click to upload PDF"}
                </p>
                {pdfFile ? (
                  <p className="mt-1 text-xs text-slate-600">{pdfFile.name}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">Drag and drop or click to select</p>
                )}
              </div>
              <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" />
            </label>
          </div>
        </Card>

        <Card className="gap-2 border-slate-200 px-5 py-3.5">
          <p className="text-sm font-semibold text-slate-900">Add a recipient</p>
          <div className="rounded-b-[0.33em] bg-slate-50">
            <PartiesPanel parties={signingParties} onPartiesChange={setSigningParties} />
          </div>
        </Card>

        <div className="flex justify-end border-t border-slate-200 pt-4">
          <Button
            onClick={handleCreateForm}
            disabled={isLoading}
            size="md"
            className="items-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="h-3 w-3" />
                Next
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateFormPage;
