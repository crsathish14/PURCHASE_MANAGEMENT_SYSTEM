// Shared by every read-only vendor-quote field across all 3 categories —
// extracted from stores-quote-form.tsx's own local helper of the same name
// (pure move, no behavior change) so the new shared sections and the new
// Spares/Service forms don't each redeclare it.
export function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}
