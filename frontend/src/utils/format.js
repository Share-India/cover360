/**
 * Read a money amount that may arrive as text from the AI, e.g.
 * "Rs. 4,52,000", "₹4,52,000.00", "452000" or "Not Found".
 * Returns a number, or null when no amount can be read.
 */
export function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const text = String(value);
  // Start at the first digit so the full stop in "Rs." is not mistaken for a decimal point
  const start = text.search(/\d/);
  if (start === -1) return null;
  const cleaned = text.slice(start).replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "Rs. 4,52,000" style text for an amount that may be text; "N/A" when unreadable. */
export function formatRupees(value) {
  const n = parseAmount(value);
  return n === null ? 'N/A' : `Rs. ${n.toLocaleString('en-IN')}`;
}
