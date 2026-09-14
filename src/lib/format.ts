export function getInitials(fullName: string | null) {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
}

// Strips characters invalid in Windows filenames (the most restrictive common
// denominator — a download commonly lands on a Windows machine regardless of
// server OS) and collapses whitespace runs to a single underscore. No
// existing helper did this anywhere in the repo — the one other filename
// this app builds (`${prNumber}-export.xlsx`) never needed one, since
// prNumber is filename-safe by construction; a vendor's own free-text name
// is not.
export function sanitizeFilenameSegment(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
}
