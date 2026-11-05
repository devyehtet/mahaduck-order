import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import accounting from "../dist/js/order-totals.cjs";
import { normalizeOrder } from "../app/api/demo/_store.js";

const { orderTotals, toSatang } = accounting;
const sample = (extra = {}) => ({
  order_type: "pickup", payment: "promptpay",
  items: [{ name: "Mala Xiang Guo", qty: 1, unit_price: 199, line_total: 199 }],
  subtotal: 199, total: 199, ...extra,
});

test("online VAT is added once and rounded to satang", () => {
  assert.deepEqual(orderTotals(199), { vat_rate: 7, vat_amount: 13.93, total: 212.93 });
  assert.deepEqual(orderTotals(250), { vat_rate: 7, vat_amount: 17.5, total: 267.5 });
  assert.deepEqual(orderTotals(398), { vat_rate: 7, vat_amount: 27.86, total: 425.86 });
  assert.deepEqual(orderTotals(199, { order_type: "delivery", delivery_fee: 40 }), { vat_rate: 7, vat_amount: 13.93, total: 252.93 });
  assert.equal(orderTotals(0.5).vat_amount, 0.04);
  assert.equal(orderTotals(1).total, 1.07);
});

test("table QR and all staff POS orders remain untaxed", () => {
  assert.deepEqual(orderTotals(199, { order_type: "dinein" }), { vat_rate: 0, vat_amount: 0, total: 199 });
  for (const type of ["pickup", "delivery", "dinein"]) {
    assert.deepEqual(orderTotals(199, { source: "pos", order_type: type }), { vat_rate: 0, vat_amount: 0, total: 199 });
  }
});

test("the server derives tax from trusted source and line totals", () => {
  const order = normalizeOrder(sample({ subtotal: 1, total: 1, vat_rate: 0, vat_amount: 0, source: "pos", payment_status: "paid" }));
  assert.equal(order.subtotal, 199);
  assert.equal(order.total, 212.93);
  assert.equal(order.vat_amount, 13.93);
  assert.equal(order.payment_status, "unpaid");
  assert.equal(order.source, "online");
  assert.equal(normalizeOrder(sample({ total: 212.93, vat_amount: 13.93 })).total, 212.93);
  assert.equal(normalizeOrder(sample({ order_type: "dinein", table_no: "8" })).total, 199);
  assert.equal(normalizeOrder(sample(), true).total, 199);
});

test("cash amounts preserve satang and invalid money is rejected", () => {
  assert.equal(toSatang(212.93), 21293);
  assert.equal(normalizeOrder(sample({ cash_received: 212.93 }), true).cash_received, 212.93);
  for (const value of [-1, "not-money", Infinity]) assert.throws(() => toSatang(value), RangeError);
});

test("the browser and server use the same accounting implementation", async () => {
  const scope = { window: {} };
  vm.runInNewContext(await readFile(new URL("../dist/js/order-totals.cjs", import.meta.url), "utf8"), scope);
  for (let amount = 0; amount < 10000; amount += 7) {
    assert.equal(JSON.stringify(scope.window.MahaOrderTotals.orderTotals(amount)), JSON.stringify(orderTotals(amount)));
  }
});

test("PromptPay encodes the saved VAT-inclusive amount with a valid checksum", async () => {
  const scope = { window: {} };
  vm.runInNewContext(await readFile(new URL("../dist/js/promptpay.js", import.meta.url), "utf8"), scope);
  const payload = scope.window.PromptPay.payload("0812345678", orderTotals(199).total);
  const tags = {};
  for (let pos = 0; pos < payload.length;) {
    const id = payload.slice(pos, pos + 2);
    const size = Number(payload.slice(pos + 2, pos + 4));
    tags[id] = payload.slice(pos + 4, pos + 4 + size);
    pos += 4 + size;
  }
  assert.equal(tags["54"], "212.93");
  assert.equal(tags["53"], "764");
  let crc = 0xffff;
  for (const char of payload.slice(0, -4)) {
    crc ^= char.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xffff;
  }
  assert.equal(tags["63"], crc.toString(16).toUpperCase().padStart(4, "0"));
});
