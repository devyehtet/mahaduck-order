import { jsonError, readDemoStore, withDemoStore } from "../_store";

export const runtime = "nodejs";

export async function GET() {
  const state = await readDemoStore();
  return Response.json(state.settings);
}

export async function PATCH(request) {
  try {
    const patch = await request.json();
    const settings = await withDemoStore((state) => {
      if ("accepting_orders" in patch) state.settings.accepting_orders = Boolean(patch.accepting_orders);
      if ("notice" in patch) state.settings.notice = String(patch.notice || "").trim().slice(0, 160);
      return state.settings;
    });
    return Response.json(settings);
  } catch (error) {
    return jsonError(error);
  }
}
