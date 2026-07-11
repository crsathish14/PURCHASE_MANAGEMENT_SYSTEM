import type { TextareaHTMLAttributes } from "react";

// Ref: Design-docs/design-spec.html §05 — Form controls (`.field textarea`).
export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};

export function Textarea({ error, className = "", ...props }: TextareaProps) {
  return (
    <div>
      <textarea
        aria-invalid={!!error}
        className={[
          "min-h-[60px] w-full resize-y rounded-md border bg-paper px-2.5 py-2 text-[13.5px] text-ink",
          "focus:border-harbor focus:outline-none",
          error ? "border-rust" : "border-line",
          className,
        ].join(" ")}
        {...props}
      />
      {error ? <p className="mt-1 text-[11px] text-rust">{error}</p> : null}
    </div>
  );
}
