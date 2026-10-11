// The one place an invoice's money is worked out. The Billing screen, the
// receipts and the parting copy all read it from here, so a receipt can never
// add up differently from the invoice it is for.

/** Fills in tax_cents, total_cents and balance_cents from the stored parts. */
export function invoiceTotals(inv) {
  const taxable = Math.max(0, inv.subtotal_cents - inv.discount_cents);
  inv.tax_cents = Math.round(taxable * (inv.tax_rate / 100));
  inv.total_cents = taxable + inv.tax_cents;
  inv.balance_cents = inv.total_cents - inv.paid_cents;
  return inv;
}

/** "12 345 678 901" for an 11-digit ABN; anything else as typed. */
export function formatAbn(raw) {
  const s = String(raw || '').trim();
  const digits = s.replace(/\s+/g, '');
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}` : s;
}
