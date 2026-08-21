"use client";

import { useState } from "react";

import en from "@/locales/en.json";
import { Input, type InputProps } from "./input";

// Show/hide toggle wired directly into Input, so every password field in
// the app (login, request-access, invite, change-password) gets the same
// behavior instead of each form re-implementing its own useState + button.
export type PasswordInputProps = Omit<InputProps, "type" | "endAdornment">;

export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <Input
      type={show ? "text" : "password"}
      endAdornment={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="flex items-center gap-1 text-[11.5px] font-bold text-slate-lt hover:text-harbor"
        >
          <EyeIcon className="h-3.25 w-3.25" />
          {show ? en.auth.login.hidePassword : en.auth.login.showPassword}
        </button>
      }
      {...props}
    />
  );
}

function EyeIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
