import { z } from "zod";

import en from "@/locales/en.json";

const t = en.staff.poRequests.issueRfqDialog.errors;

// expiresAt is a full ISO datetime string (the dialog combines its separate
// date + time inputs into this one value via combineExpiryDateTime before
// it's ever validated) — this is also the exact wire shape the API route
// validates the same way, since it POSTs straight through.
export const issueRfqLinkSchema = z
  .object({
    vendorName: z.string().min(1, { error: t.vendorNameRequired }),
    vendorEmail: z.email({ error: t.vendorEmailInvalid }).min(1, { error: t.vendorEmailRequired }),
    expiresAt: z.string().min(1, { error: t.expiresAtRequired }),
    message: z.string().min(1, { error: t.messageRequired }),
  })
  .superRefine((data, ctx) => {
    // Real instant comparison now (was a plain date-string compare) — a
    // same-day-but-already-past time needs to be caught too, not just a
    // past calendar date.
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      ctx.addIssue({ code: "custom", path: ["expiresAt"], message: t.expiresAtPast });
    }
  });

export type IssueRfqLinkInput = z.infer<typeof issueRfqLinkSchema>;

// Award has no real form behind it (just a confirm dialog), so there's no
// user-facing field error to wire up here — a malformed id only ever means a
// client bug, not something a user typed.
export const awardRequisitionSchema = z.object({
  rfqLinkId: z.uuid(),
});

export type AwardRequisitionInput = z.infer<typeof awardRequisitionSchema>;
