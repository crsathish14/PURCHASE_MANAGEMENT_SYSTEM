"use client";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";
import { toast } from "@/store/toast-store";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.success(en.toastDemo.successMessage)}
      >
        {en.toastDemo.success}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.error(en.toastDemo.errorMessage)}
      >
        {en.toastDemo.error}
      </Button>
    </div>
  );
}
