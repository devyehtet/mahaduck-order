import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";

const STORE_PATH = process.env.MAHA_DEMO_STORE || join(tmpdir(), "maha-duck-demo-store.json");
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const STATUSES = new Set(["new", "preparing", "ready", "out_for_delivery", "completed", "cancelled"]);
const ORDER_TYPES = new Set(["delivery", "pickup", "dinein"]);
const PAYMENTS = new Set(["cash", "promptpay"]);
const PAYMENT_STATUSES = new Set(["unpaid", "claimed", "paid"]);

const defaults = () => ({
  orders: [],
  settings: { accepting_orders: true, notice: "" },
  slips: {},
});

let chain = Promise.resolve();

function text(value, max = 300) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback;
}

function makeCode() {
  const bytes = randomBytes(5);
  let code = "";
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return "MD-" + code;
}

export function safeMapLink(value) {
  const raw = text(value, 300);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const ok =
      url.protocol === "https:" &&
      (host === "maps.app.goo.gl" ||
        host === "maps.google.com" ||
        host === "www.google.com" ||
        host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "goo.gl");
    if (!ok) return null;
    if (host === "goo.gl" && !url.pathname.startsWith("/maps/")) return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

async function readStore() {
  try {
    const parsed = JSON.parse(await readFile(/* turbopackIgnore: true */ STORE_PATH, "utf8"));
    return { ...defaults(), ...parsed, settings: { ...defaults().settings, ...(parsed.settings || {}) } };
  } catch {
    return defaults();
  }
}

async function writeStore(state) {
  await mkdir(dirname(STORE_PATH), { recursive: true });
  await writeFile(/* turbopackIgnore: true */ STORE_PATH, JSON.stringify(state), "utf8");
}

export async function readDemoStore() {
  return readStore();
}

export function withDemoStore(fn) {
  chain = chain.then(async () => {
    const state = await readStore();
    const result = await fn(state);
    await writeStore(state);
    return result;
  });
  return chain;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length || items.length > 60) {
    throw Object.assign(new Error("Order must include 1 to 60 items"), { status: 400 });
  }
  return items.map((item) => {
    const qty = Math.max(1, Math.min(99, int(item.qty, 1)));
    const unitPrice = int(item.unit_price, 0);
    const details = Array.isArray(item.details) ? item.details.map((entry) => text(entry, 160)).filter(Boolean) : [];
    return {
      name: text(item.name, 120) || "Item",
      th: text(item.th, 120) || "",
      qty,
      unit_price: unitPrice,
      line_total: unitPrice * qty,
      details,
    };
  });
}

export function normalizeOrder(input, staff = false) {
  const type = ORDER_TYPES.has(input.order_type) ? input.order_type : "pickup";
  const payment = PAYMENTS.has(input.payment) ? input.payment : "cash";
  const items = normalizeItems(input.items);
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const deliveryFee = type === "delivery" && input.delivery_fee != null ? int(input.delivery_fee, 0) : null;
  const total = subtotal + (deliveryFee || 0);
  const paymentStatus = staff && PAYMENT_STATUSES.has(input.payment_status) ? input.payment_status : "unpaid";
  const status = staff && STATUSES.has(input.status) ? input.status : staff ? "preparing" : "new";
  const cashReceived = input.cash_received == null ? null : int(input.cash_received, 0);

  if (cashReceived != null && paymentStatus === "paid" && cashReceived < total) {
    throw Object.assign(new Error("Cash received is lower than order total"), { status: 400 });
  }

  return {
    order_type: type,
    table_no: type === "dinein" ? text(input.table_no, 8) : null,
    customer_name: text(input.customer_name, 60) || (staff ? "Walk-in" : "Guest"),
    phone: text(input.phone, 20),
    address: type === "delivery" ? text(input.address, 300) : null,
    map_link: type === "delivery" ? safeMapLink(input.map_link) : null,
    pickup_time: type === "pickup" ? text(input.pickup_time, 40) : null,
    payment,
    note: text(input.note, 300),
    items,
    subtotal,
    delivery_fee: deliveryFee,
    total,
    lang: text(input.lang, 8) || "en",
    status,
    source: staff ? "pos" : "online",
    payment_status: paymentStatus,
    cash_received: cashReceived,
    has_slip: false,
    delivery_provider: null,
    delivery_started_at: null,
  };
}

export function createDemoOrder(input, staff = false) {
  return withDemoStore((state) => {
    if (!staff && !state.settings.accepting_orders) {
      throw Object.assign(new Error("Shop is not accepting online orders right now"), { status: 409 });
    }
    let code = makeCode();
    while (state.orders.some((order) => order.code === code)) code = makeCode();
    const now = new Date().toISOString();
    const order = {
      id: randomUUID(),
      code,
      created_at: now,
      updated_at: now,
      ...normalizeOrder(input, staff),
    };
    state.orders.unshift(order);
    state.orders = state.orders.slice(0, 500);
    return order;
  });
}

export function updateDemoOrder(id, patch) {
  return withDemoStore((state) => {
    const order = state.orders.find((entry) => entry.id === id);
    if (!order) throw Object.assign(new Error("Order not found"), { status: 404 });
    if (patch.status != null && STATUSES.has(patch.status)) order.status = patch.status;
    if (patch.payment_status != null && PAYMENT_STATUSES.has(patch.payment_status)) order.payment_status = patch.payment_status;
    if ("delivery_provider" in patch) order.delivery_provider = text(patch.delivery_provider, 80);
    if ("delivery_started_at" in patch) order.delivery_started_at = text(patch.delivery_started_at, 40);
    order.updated_at = new Date().toISOString();
    return order;
  });
}

export function publicOrderStatus(order) {
  if (!order) return null;
  return {
    status: order.status,
    total: order.total,
    created_at: order.created_at,
    payment_status: order.payment_status || "unpaid",
    order_type: order.order_type,
    delivery_provider: order.delivery_provider || null,
    delivery_started_at: order.delivery_started_at || null,
  };
}

export function jsonError(error) {
  return Response.json({ message: error.message || "Request failed" }, { status: error.status || 500 });
}
