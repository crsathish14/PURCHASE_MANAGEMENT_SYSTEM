"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormGetValues, UseFormWatch } from "react-hook-form";

import type { RfqQuoteLineItem } from "@/lib/data/rfq-quote";
import type { QuoteDraftSaveInput } from "@/lib/vendor-quote/draft";
import type { VendorPhotoValue } from "./vendor-item-photos-field";

// Quiet period after the last edit before saving — long enough that typing
// down a column of unit prices is one request, short enough that little is
// lost if the tab is closed.
const AUTOSAVE_DEBOUNCE_MS = 2500;

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error";

export type DraftSaveState = {
  status: DraftSaveStatus;
  savedAt: Date | null;
};

// Photos by line item id, for every line item the vendor has been shown so
// far. Photos aren't RHF-registered, and the form only holds one page of line
// items at a time, so this outlives page changes.
export type PhotosById = Record<string, VendorPhotoValue[]>;

// Seeds photo state from a freshly loaded page of line items (their saved
// draft photos). Rows already tracked are left alone: the local copy is at
// least as new as the server's, and may hold an upload that finished after the
// page's data was fetched.
export function mergeLoadedPhotos(prev: PhotosById, lineItems: RfqQuoteLineItem[]): PhotosById {
  let next = prev;
  for (const item of lineItems) {
    if (item.lineItemId in prev) continue;
    next = { ...next, [item.lineItemId]: item.draft?.photos ?? [] };
  }
  return next;
}

// Serializes the form into a draft save: the whole header, plus the line items
// currently on screen (react-hook-form only holds the visible page), plus any
// off-page line item whose photos changed since the last save (an upload that
// finished after the vendor paged away). An on-screen row sends only the
// photos it knows about — never an empty list for a row whose photos haven't
// been tracked yet, which would wipe the server's copy. Nothing is validated:
// a draft is allowed to be incomplete.
export function toQuoteDraftSave(
  values: Record<string, unknown>,
  photosById: PhotosById,
  dirtyPhotoIds: ReadonlySet<string>,
): QuoteDraftSaveInput {
  const header: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (key !== "items" && typeof value === "string") header[key] = value;
  }

  const toPhotos = (id: string) =>
    (photosById[id] ?? []).map(({ storagePath, fileName, contentType, sizeBytes }) => ({
      storagePath,
      fileName,
      contentType,
      sizeBytes,
    }));

  const items: QuoteDraftSaveInput["items"] = [];
  const onScreenIds = new Set<string>();
  const rawItems = Array.isArray(values.items) ? (values.items as Array<Record<string, unknown> | undefined>) : [];
  for (const raw of rawItems) {
    if (!raw || typeof raw.lineItemId !== "string") continue;
    const lineItemId = raw.lineItemId;
    onScreenIds.add(lineItemId);

    // Empty values are left out, but the (possibly empty) fields object is
    // always sent: it replaces the stored one, which is how clearing a field
    // takes effect.
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (key !== "lineItemId" && typeof value === "string" && value !== "") fields[key] = value;
    }
    items.push({ lineItemId, fields, ...(lineItemId in photosById ? { photos: toPhotos(lineItemId) } : {}) });
  }

  for (const lineItemId of dirtyPhotoIds) {
    if (!onScreenIds.has(lineItemId)) items.push({ lineItemId, photos: toPhotos(lineItemId) });
  }

  return { header, items };
}

type Controls = {
  schedule: () => void;
  markPhotosDirty: (lineItemId: string) => void;
  saveNow: (options?: { force?: boolean }) => Promise<boolean>;
  runSilently: (fn: () => void) => void;
};

export type UseQuoteDraftAutosaveOptions<T extends FieldValues> = {
  token: string;
  watch: UseFormWatch<T>;
  getValues: UseFormGetValues<T>;
  photosById: PhotosById;
  initialSavedAt: string | null;
  // False once the quote is submitted — a draft is meaningless after that.
  enabled: boolean;
};

export type QuoteDraftAutosave = {
  state: DraftSaveState;
  // Call after a photo upload/removal changes a row's photos.
  notifyPhotosChanged: (lineItemId: string) => void;
  // Saves anything pending right now. Resolves false if the save failed, so a
  // caller about to discard the current page (paging, submitting) can refuse.
  // `force` saves even if nothing changed since the last save.
  saveNow: (options?: { force?: boolean }) => Promise<boolean>;
  // Runs `fn` without treating the form changes it causes (swapping in
  // another page of line items) as vendor edits worth saving.
  runSilently: (fn: () => void) => void;
};

// Debounced autosave of the vendor's in-progress quote to the server. Nothing
// is submitted — this only writes the draft the form is restored from on the
// next visit (including from another device). Saves are serialized in a chain:
// an edit made while a request is in flight simply schedules another save that
// runs after it, so requests can't race or reorder.
export function useQuoteDraftAutosave<T extends FieldValues>({
  token,
  watch,
  getValues,
  photosById,
  initialSavedAt,
  enabled,
}: UseQuoteDraftAutosaveOptions<T>): QuoteDraftAutosave {
  const [state, setState] = useState<DraftSaveState>(() => ({
    status: initialSavedAt ? "saved" : "idle",
    savedAt: initialSavedAt ? new Date(initialSavedAt) : null,
  }));

  // The latest photo state, readable from inside the long-lived effect below
  // without re-subscribing to the form on every photo change.
  const photosRef = useRef(photosById);
  useEffect(() => {
    photosRef.current = photosById;
  }, [photosById]);

  const controlsRef = useRef<Controls | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let chain: Promise<boolean> = Promise.resolve(true);
    let dirty = false;
    let silent = false;
    const dirtyPhotoIds = new Set<string>();

    async function doSave(): Promise<boolean> {
      dirty = false;
      setState((prev) => ({ ...prev, status: "saving" }));

      // Only the ids this request carries are cleared on success; one marked
      // dirty while it was in flight stays for the next save.
      const sentPhotoIds = new Set(dirtyPhotoIds);
      try {
        const payload = toQuoteDraftSave(getValues() as Record<string, unknown>, photosRef.current, sentPhotoIds);
        const response = await fetch(`/api/quote/${token}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("draft save failed");
        const body = await response.json();
        sentPhotoIds.forEach((id) => dirtyPhotoIds.delete(id));
        setState({ status: "saved", savedAt: new Date(body.data.savedAt) });
        return true;
      } catch {
        // Still dirty: the next edit, tab-hide or page change retries with
        // everything.
        dirty = true;
        setState((prev) => ({ ...prev, status: "error" }));
        return false;
      }
    }

    function saveNow(options?: { force?: boolean }): Promise<boolean> {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (options?.force) dirty = true;
      // `dirty` is read when the turn comes, not now, so an edit made while an
      // earlier save is in flight is included.
      chain = chain.then(() => (dirty ? doSave() : true));
      return chain;
    }

    function schedule() {
      if (silent) return;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void saveNow(), AUTOSAVE_DEBOUNCE_MS);
    }

    // Saves right away when the tab is hidden or backgrounded, so switching
    // away straight after an edit doesn't wait out the debounce. A plain
    // fetch, not keepalive: keepalive bodies are capped at 64KB.
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && dirty) void saveNow();
    }

    controlsRef.current = {
      schedule,
      saveNow,
      markPhotosDirty: (lineItemId) => {
        dirtyPhotoIds.add(lineItemId);
        schedule();
      },
      runSilently: (fn) => {
        silent = true;
        try {
          fn();
        } finally {
          // react-hook-form emits its watch event synchronously from reset(),
          // but a macrotask of margin costs nothing.
          setTimeout(() => {
            silent = false;
          }, 0);
        }
      },
    };
    const subscription = watch(() => schedule());
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      controlsRef.current = null;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timer) clearTimeout(timer);
    };
  }, [enabled, token, watch, getValues]);

  const notifyPhotosChanged = useCallback((lineItemId: string) => {
    controlsRef.current?.markPhotosDirty(lineItemId);
  }, []);
  const saveNow = useCallback(async (options?: { force?: boolean }) => {
    return controlsRef.current ? controlsRef.current.saveNow(options) : true;
  }, []);
  const runSilently = useCallback((fn: () => void) => {
    if (controlsRef.current) controlsRef.current.runSilently(fn);
    else fn();
  }, []);

  return { state, notifyPhotosChanged, saveNow, runSilently };
}
