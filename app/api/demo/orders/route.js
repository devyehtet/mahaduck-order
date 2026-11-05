import { createDemoOrder, jsonError, ordersInRange, readDemoStore } from "../_store";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const state = await readDemoStore();
    return Response.json(ordersInRange(state.orders, params.get("since"), params.get("until")));
  } catch (error) {
    return jsonError(error);
  }
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
