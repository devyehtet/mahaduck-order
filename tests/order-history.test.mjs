import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { ordersInRange } from "../app/api/demo/_store.js";

const coreScope = { window: {} };
vm.runInNewContext(await readFile(new URL("../dist/js/core.js", import.meta.url), "utf8"), coreScope);
const core = coreScope.window.MahaDuckCore;
const plain = (value) => JSON.parse(JSON.stringify(value));
const now = new Date("2026-11-03T10:00:00Z");

test("history uses Bangkok calendar days at UTC midnight boundaries", () => {
  assert.equal(core.shopDayKey("2026-11-02T16:59:59Z"), "2026-11-02");
  assert.equal(core.shopDayKey("2026-11-02T17:00:00Z"), "2026-11-03");
  assert.deepEqual(plain(core.orderDateRange("yesterday", undefined, now)), {
    startDay: "2026-11-02", endDay: "2026-11-02",
    since: "2026-11-01T17:00:00.000Z", until: "2026-11-02T17:00:00.000Z",
  });
});

test("custom dates and rolling ranges include the complete final day", () => {
  const custom = core.orderDateRange("custom", "2026-10-05", now);
  assert.equal(custom.since, "2026-10-04T17:00:00.000Z");
  assert.equal(custom.until, "2026-10-05T17:00:00.000Z");
  assert.equal(core.orderDateRange("7", undefined, now).startDay, "2026-10-28");
  assert.equal(core.orderDateRange("30", undefined, now).startDay, "2026-10-05");
  assert.equal(core.shiftDayKey("2028-03-01", -1), "2028-02-29");
  assert.equal(core.shiftDayKey("2026-01-01", -1), "2025-12-31");
  for (const day of ["2026-02-30", "not-a-date", "2026-2-1", ""]) assert.equal(core.isDayKey(day), false);
});

test("date filters exclude later days and handle ISO timezone offsets", () => {
  const { since, until } = core.orderDateRange("yesterday", undefined, now);
  const orders = [
    { id: "before", created_at: "2026-11-01T16:59:59Z" },
    { id: "first", created_at: "2026-11-02T00:00:00+07:00" },
    { id: "last", created_at: "2026-11-02T16:59:59Z" },
    { id: "today", created_at: "2026-11-02T17:00:00Z" },
  ];
  assert.deepEqual(ordersInRange(orders, since, until).map((order) => order.id), ["last", "first"]);
  assert.equal(ordersInRange(orders).length, 4);
  assert.throws(() => ordersInRange(orders, "bad", until), /Invalid order date range/);
  assert.throws(() => ordersInRange(orders, until, since), /Invalid order date range/);
});

const apiSource = await readFile(new URL("../dist/js/api.js", import.meta.url), "utf8");
function apiScope(config, saved, fetch) {
  const memory = new Map(Object.entries(saved).map(([key, value]) => [key, JSON.stringify(value)]));
  const scope = {
    window: { MAHA_CONFIG: config }, URLSearchParams,
    location: { hash: "", pathname: "/admin", protocol: config.supabaseUrl ? "https:" : "file:" },
    localStorage: { getItem: (key) => memory.get(key), setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) },
    fetch,
  };
  vm.runInNewContext(apiSource, scope);
  return scope.window.MahaAPI;
}

test("live order history reads all pages beyond 500 with both date bounds", async () => {
  const orders = Array.from({ length: 523 }, (_, index) => ({ id: String(index), created_at: "2026-11-02T12:00:00Z" }));
  const requests = [];
  const api = apiScope({ supabaseUrl: "https://example.invalid", supabaseAnonKey: "test-only" }, {
    "mahaduck-staff-session": { access_token: "test-only", expires_at: Date.now() / 1000 + 3600 },
  }, async (url) => {
    const params = new URL(url).searchParams;
    requests.push(params);
    const start = Number(params.get("offset"));
    return { ok: true, text: async () => JSON.stringify(orders.slice(start, start + 500)) };
  });
  const bounds = core.orderDateRange("yesterday", undefined, now);
  const result = await api.listOrders(bounds.since, bounds.until);
  assert.equal(result.length, 523);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].getAll("created_at"), ["gte." + bounds.since, "lt." + bounds.until]);
  assert.equal(requests[1].get("offset"), "500");
});

test("static preview history applies the same upper and lower bounds", async () => {
  const bounds = core.orderDateRange("yesterday", undefined, now);
  const api = apiScope({}, { "mahaduck-demo-orders": [
    { id: "yesterday", created_at: "2026-11-02T12:00:00Z" },
    { id: "today", created_at: "2026-11-03T00:00:00Z" },
  ] });
  const result = await api.listOrders(bounds.since, bounds.until);
  assert.deepEqual(plain(result).map((order) => order.id), ["yesterday"]);
});
