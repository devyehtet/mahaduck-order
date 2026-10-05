import { jsonError, updateDemoOrder } from "../../_store";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const order = await updateDemoOrder(id, await request.json());
    return Response.json(order);
  } catch (error) {
    return jsonError(error);
  }
}
