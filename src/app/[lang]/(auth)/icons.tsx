// Small inline icons ported from Design-docs/app/login.html and
// request-access.html's <symbol> defs. No icon library is installed, so
// these stay hand-rolled rather than pulling in a dependency for three uses.

export function AnchorIcon({ className = "" }: { className?: string }) {
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
      <circle cx="12" cy="5" r="2" />
      <line x1="12" y1="7" x2="12" y2="19" />
      <line x1="8" y1="10" x2="16" y2="10" />
      <path d="M5 14a7 7 0 0 0 14 0" />
      <line x1="5" y1="14" x2="5" y2="11" />
      <line x1="19" y1="14" x2="19" y2="11" />
    </svg>
  );
}

export function EyeIcon({ className = "" }: { className?: string }) {
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
