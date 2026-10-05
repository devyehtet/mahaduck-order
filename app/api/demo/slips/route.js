import { jsonError, withDemoStore } from "../_store";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { code, image } = await request.json();
    const normalizedCode = String(code || "").trim().toUpperCase();
    const ok = await withDemoStore((state) => {
      const order = state.orders.find((entry) => entry.code === normalizedCode);
      if (!order || order.payment !== "promptpay" || order.payment_status === "paid" || order.status === "cancelled") {
        return false;
      }
      if (typeof image !== "string" || image.length > 700000 || !/^data:image\/(jpeg|png|webp);base64,/.test(image)) {
        throw Object.assign(new Error("Invalid slip image"), { status: 400 });
      }
      state.slips[normalizedCode] = { image, created_at: new Date().toISOString() };
      order.has_slip = true;
      order.payment_status = "claimed";
      order.updated_at = new Date().toISOString();
      return true;
    });
    return Response.json(ok);
  } catch (error) {
    return jsonError(error);
  }
}
