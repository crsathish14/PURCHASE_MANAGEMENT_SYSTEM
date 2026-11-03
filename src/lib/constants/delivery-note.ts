// How urgently a requisition in the "Add delivery or service note" picker needs
// its note. Derived server-side (search_delivery_note_candidates) from the PO's
// payment / tax-invoice state — never recomputed on the client.
export const DELIVERY_NOTE_URGENCY = {
  // Tax invoice received, still no delivery note.
  DANGER: "danger",
  // Paid (invoice requested but not yet received included), still no delivery note.
  WARNING: "warning",
  // Proforma received but not paid yet.
  NORMAL: "normal",
} as const;

export type DeliveryNoteUrgency = (typeof DELIVERY_NOTE_URGENCY)[keyof typeof DELIVERY_NOTE_URGENCY];

export const DELIVERY_NOTE_URGENCY_VALUES: readonly DeliveryNoteUrgency[] = Object.values(DELIVERY_NOTE_URGENCY);

export function isDeliveryNoteUrgency(value: string): value is DeliveryNoteUrgency {
  return (DELIVERY_NOTE_URGENCY_VALUES as readonly string[]).includes(value);
}

// DEFAULT keeps the picker's natural order (newest proforma first); URGENCY puts
// danger first, then warning, then the rest, newest proforma first within each.
export const DELIVERY_NOTE_CANDIDATE_SORT = {
  DEFAULT: "default",
  URGENCY: "urgency",
} as const;

export type DeliveryNoteCandidateSort =
  (typeof DELIVERY_NOTE_CANDIDATE_SORT)[keyof typeof DELIVERY_NOTE_CANDIDATE_SORT];
