import { z } from "zod";

import { RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX } from "@/lib/constants/storage";

// A vendor quote draft is deliberately category-agnostic: every category's
// form has the same header fields plus per-line-item string fields, so the
// draft stores whichever string-valued keys the form registered rather than a
// per-category shape. Stores/Spares/Service/LO then share one route, one RPC
// and one autosave hook — a field added to a category's form is picked up with
// no change here. Unlike the submit schemas, nothing in a draft is required:
// it is an in-progress snapshot, validated for real only on submit.
//
// Stored server-side as { header, items: { [lineItemId]: { fields, photos } } }.
// The form only ever holds ONE page of line items (the BE paginates), so the
// draft is also how the entries on every page the vendor isn't looking at are
// kept: a save sends the header plus the visible page, and the database merges
// it per line item (see 20261030020000_rfq_quote_server_pagination.sql).

export type QuoteDraftPhoto = {
  storagePath: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type QuoteDraftHeader = Record<string, string>;

// One line item's saved entry.
export type QuoteDraftItemEntry = {
  fields: Record<string, string>;
  photos: QuoteDraftPhoto[];
};

// What the page needs on first load besides the line items themselves.
export type QuoteDraftState = {
  header: QuoteDraftHeader;
  savedAt: string;
};

const MAX_FIELD_LENGTH = 2000;
const MAX_FIELDS_PER_RECORD = 40;
const MAX_ITEMS_PER_SAVE = 500;
const MAX_PHOTOS_PER_ITEM = 200;

// Defense-in-depth cap on a serialized save request; one page of line items
// with every field filled is far below this.
export const MAX_QUOTE_DRAFT_BYTES = 2 * 1024 * 1024;

const fieldsSchema = z
  .record(z.string().max(60), z.string().max(MAX_FIELD_LENGTH))
  .refine((record) => Object.keys(record).length <= MAX_FIELDS_PER_RECORD);

const photoSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().max(255),
  contentType: z.string().max(100),
  sizeBytes: z.number().int().nonnegative(),
});

// A stored entry read back from the database. Lenient: anything unreadable is
// treated as "no draft" for that row rather than failing the page.
export const quoteDraftItemEntrySchema = z.object({
  fields: fieldsSchema.optional(),
  photos: z.array(photoSchema).max(MAX_PHOTOS_PER_ITEM).optional(),
});

// The draft is written from, and read back through, an anonymous endpoint, and
// a photo's storagePath is later signed with the service-role client. The path
// must therefore sit under this token's own namespace for this line item — the
// same "don't trust the payload" rule submit_rfq_quotation applies — or a
// vendor could draft an arbitrary path and be handed a signed URL.
export function isOwnPhotoPath(token: string, lineItemId: string, storagePath: string): boolean {
  const expectedPrefix = `${RFQ_QUOTE_ITEM_PHOTO_PATH_PREFIX}/${token}/${lineItemId}/`;
  return storagePath.startsWith(expectedPrefix) && !storagePath.includes("..");
}

// A save request: the whole header, plus the line items being updated. An
// item may carry `fields`, `photos`, or both — whichever it omits is left
// untouched on the server.
export function buildQuoteDraftSaveSchema(token: string) {
  const itemSchema = z
    .object({
      lineItemId: z.string().min(1).max(64),
      fields: fieldsSchema.optional(),
      photos: z.array(photoSchema).max(MAX_PHOTOS_PER_ITEM).optional(),
    })
    .refine((item) => (item.photos ?? []).every((photo) => isOwnPhotoPath(token, item.lineItemId, photo.storagePath)));

  return z.object({
    header: fieldsSchema,
    items: z.array(itemSchema).max(MAX_ITEMS_PER_SAVE),
  });
}

export type QuoteDraftSaveInput = z.infer<ReturnType<typeof buildQuoteDraftSaveSchema>>;

// Overlays a saved draft header onto a form's freshly built default values.
// Only keys the form already has (as strings) are overlaid, so a draft written
// against an older form shape can never inject a stray field.
export function applyDraftHeader<T extends object>(defaults: T, header: QuoteDraftHeader | null): T {
  if (!header) return defaults;
  const next: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(header)) {
    if (key !== "items" && typeof next[key] === "string") next[key] = value;
  }
  return next as T;
}
