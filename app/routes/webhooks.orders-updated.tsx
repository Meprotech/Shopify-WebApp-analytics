import type { ActionFunctionArgs } from "@remix-run/node";

import {
  type ShopifyOrderWebhookPayload,
  upsertWebhookOrder,
  verifyShopifyWebhook,
} from "../lib/webhook-orders.server";

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const rawBody = await verifyShopifyWebhook(request);

  if (!rawBody) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as ShopifyOrderWebhookPayload;
    await upsertWebhookOrder(payload);
  } catch (error) {
    console.error("orders/updated webhook processing failed", error);
  }

  return new Response("OK", { status: 200 });
}
