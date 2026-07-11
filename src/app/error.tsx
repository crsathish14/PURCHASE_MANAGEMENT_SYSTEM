"use client";

import { useEffect } from "react";

import { Button } from "@/components/atoms";
import en from "@/locales/en.json";

// Next 16 renamed the retry prop to `unstable_retry` (the old `reset` still
// exists but the docs now recommend `unstable_retry`). See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-mist px-6 text-center">
      <p className="font-display text-2xl font-semibold text-ink">
        {en.error.title}
      </p>
      <p className="text-sm text-slate">{en.error.description}</p>
      <Button variant="primary" size="sm" onClick={() => unstable_retry()}>
        {en.error.action}
      </Button>
    </div>
  );
}
