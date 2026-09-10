"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button, Dialog, Input, Label } from "@/components/atoms";
import en from "@/locales/en.json";
import { askLabelSchema, type AskLabelInput } from "@/lib/validation/purchase-requisition";

const t = en.staff.poRequests.askLabelDialog;

// Reused by both create-requisition-dialog.tsx's "Add more" (custom field)
// and line-items-field.tsx's "add column" — both are literally "ask for a
// label, then hand it back to the caller," so one component covers both.
export type AskLabelDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (label: string) => void;
};

export function AskLabelDialog({ open, onClose, title, onSubmit }: AskLabelDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AskLabelInput>({
    resolver: zodResolver(askLabelSchema),
    mode: "onBlur",
    defaultValues: { label: "" },
  });

  function close() {
    onClose();
    reset({ label: "" });
  }

  function submit(data: AskLabelInput) {
    onSubmit(data.label);
    close();
  }

  return (
    <Dialog open={open} onClose={close} title={title}>
      {/* This dialog renders via a createPortal into document.body (see the
          Dialog atom), but React's synthetic event system bubbles through
          the *React* component tree, not the DOM tree — since this form is a
          React descendant of CreateRequisitionDialog's own <form> (through
          LineItemsField or directly), its submit event would otherwise also
          reach and fire the outer form's onSubmit. stopPropagation() keeps
          it contained to this dialog's own handleSubmit. */}
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          handleSubmit(submit)(event);
        }}
        noValidate
      >
        <div className="mb-5">
          <Label htmlFor="ask-label-input" error={!!errors.label}>
            {t.label}
          </Label>
          <Input
            id="ask-label-input"
            type="text"
            placeholder={t.labelPlaceholder}
            error={errors.label?.message}
            {...register("label")}
          />
        </div>
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={close}>
            {t.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {t.add}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
