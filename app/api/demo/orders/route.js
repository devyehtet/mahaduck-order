import { createDemoOrder, jsonError, readDemoStore } from "../_store";

export const runtime = "nodejs";

export async function GET(request) {
  const since = new URL(request.url).searchParams.get("since");
  const state = await readDemoStore();
  const orders = since ? state.orders.filter((order) => order.created_at >= since) : state.orders;
  return Response.json(orders);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const order = await createDemoOrder(body.order || body, Boolean(body.staff));
    return Response.json(order, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
