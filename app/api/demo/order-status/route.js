import { publicOrderStatus, readDemoStore } from "../_store";

export const runtime = "nodejs";

export async function GET(request) {
  const code = (new URL(request.url).searchParams.get("code") || "").trim().toUpperCase();
  const state = await readDemoStore();
  return Response.json(publicOrderStatus(state.orders.find((order) => order.code === code)));
}
