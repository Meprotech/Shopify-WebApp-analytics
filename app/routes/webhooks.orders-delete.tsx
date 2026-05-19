import type { ActionFunctionArgs } from "@remix-run/node";
import { supabase } from "../lib/supabase.server";
import { verifyShopifyWebhook } from "../lib/webhook-orders.server";

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  const rawBody = await verifyShopifyWebhook(request);

  if (!rawBody) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as { id: number | string };
    const shopifyOrderId = `gid://shopify/Order/${payload.id}`;
    
    console.log(`Received orders/delete webhook for order: ${shopifyOrderId}`);
    
    const { error } = await supabase
      .from("store_orders")
      .delete()
      .eq("order_id", shopifyOrderId);
      
    if (error) {
      console.error(`Failed to delete order ${shopifyOrderId} from Supabase:`, error);
    } else {
      console.log(`Successfully deleted order ${shopifyOrderId} from Supabase.`);
    }
  } catch (error) {
    console.error("orders/delete webhook processing failed", error);
  }

  return new Response("OK", { status: 200 });
}
