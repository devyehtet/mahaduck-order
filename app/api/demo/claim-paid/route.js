import { jsonError, withDemoStore } from "../_store";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { code } = await request.json();
    const ok = await withDemoStore((state) => {
      const order = state.orders.find((entry) => entry.code === String(code || "").trim().toUpperCase());
      if (!order || order.payment !== "promptpay" || order.payment_status !== "unpaid") return false;
      order.payment_status = "claimed";
      order.updated_at = new Date().toISOString();
      return true;
    });
    return Response.json(ok);
  } catch (error) {
    return jsonError(error);
  }
}
