(function (root) {
  const ONLINE_VAT_RATE = 7;

  function toSatang(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Invalid money amount");
    return Math.round(amount * 100);
  }

  function orderTotals(subtotal, { source = "online", order_type = "pickup", delivery_fee = 0 } = {}) {
    const sub = toSatang(subtotal);
    const fee = toSatang(delivery_fee);
    const vatRate = source === "online" && order_type !== "dinein" ? ONLINE_VAT_RATE : 0;
    // Round VAT once per order, in satang, so the receipt and QR agree exactly.
    const vat = Math.round(sub * vatRate / 100);
    return { vat_rate: vatRate, vat_amount: vat / 100, total: (sub + fee + vat) / 100 };
  }

  const api = { ONLINE_VAT_RATE, toSatang, orderTotals };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MahaOrderTotals = api;
})(typeof window !== "undefined" ? window : globalThis);
