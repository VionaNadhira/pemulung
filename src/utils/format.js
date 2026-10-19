/**
 * Format angka saldo: hapus trailing zero, tampilkan apa adanya.
 * 0.000000 → "0"
 * 2.100000 → "2.1"
 * 1234.5   → "1234.5"
 */
function formatAmount(raw) {
  const n = parseFloat(raw);
  if (isNaN(n) || n === 0) return "0";
  if (n < 0.000001) return n.toFixed(18).replace(/\.?0+$/, "");
  return parseFloat(n.toPrecision(10)).toString();
}

module.exports = { formatAmount };
