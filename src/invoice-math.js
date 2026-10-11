// The one place an invoice's money is worked out. The Billing screen, the
// receipts and the parting copy all read it from here, so a receipt can never
// add up differently from the invoice it is for.

/**
 * Fills in tax_cents, total_cents and balance_cents from the stored parts.
 *
 * A price in Australia already includes GST — the client who booked a $150
 * colour pays $150, and the tax invoice says $13.64 of it was GST. An invoice
 * marked tax_inclusive works that way. One made before that (or by a salon
 * that has turned "prices include GST" off) adds the tax on top, and keeps
 * adding up exactly as it did the day it was paid.
 */
export function invoiceTotals(inv) {
  const taxable = Math.max(0, inv.subtotal_cents - inv.discount_cents);
  const rate = Number(inv.tax_rate) || 0;
  if (inv.tax_inclusive) {
    inv.tax_cents = Math.round(taxable * rate / (100 + rate));
    inv.total_cents = taxable;
  } else {
    inv.tax_cents = Math.round(taxable * (rate / 100));
    inv.total_cents = taxable + inv.tax_cents;
  }
  inv.balance_cents = inv.total_cents - inv.paid_cents;
  return inv;
}

/** "12 345 678 901" for an 11-digit ABN; anything else as typed. */
export function formatAbn(raw) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\s+/g, '');
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` : s;
}
