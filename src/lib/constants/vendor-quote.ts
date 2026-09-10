// The vendor RFQ quote form's locked currency — display-only. The actual
// enforcement is that submit_rfq_quotation() never accepts a currency
// parameter at all and always inserts 'USD' server-side, so there is no code
// path through which a vendor could influence it.
export const VENDOR_QUOTE_CURRENCY = "USD" as const;
