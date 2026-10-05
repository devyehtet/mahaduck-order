import { readDemoStore } from "../../_store";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { code } = await params;
  const state = await readDemoStore();
  return Response.json((state.slips[String(code || "").trim().toUpperCase()] || {}).image || null);
}
