import type { LoaderFunctionArgs } from "@remix-run/node";
import { shopify } from "../lib/shopify.server";
import {
  ORDERS_BACKFILL_QUERY,
  type OrdersBackfillResponse,
  customerName,
  orderNumber,
  orderItems,
  toNumber,
} from "../lib/backfill-order-mapper.server";
import { supabase } from "../lib/supabase.server";

const API_VERSION = "2024-10";

// Standalone backfill API route — does NOT go through Shopify App Bridge
// Protected by SHOPIFY_API_SECRET as a simple shared secret
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret");

    if (secret !== process.env.SHOPIFY_API_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized secret" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const shop = url.searchParams.get("shop") || process.env.SHOPIFY_SHOP_DOMAIN;
    if (!shop) {
      return new Response(
        JSON.stringify({ error: "Missing shop (pass ?shop= or set SHOPIFY_SHOP_DOMAIN env var)" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find all sessions for the shop
    const sessions = await shopify.sessionStorage.findSessionsByShop(shop);
    const session = sessions.find((s) => s.accessToken);

    if (!session?.accessToken) {
      return new Response(
        JSON.stringify({
          error: `No valid access token found for shop ${shop}. Found ${sessions.length} sessions. Open the app in Shopify once to generate a session, then retry.`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const accessToken = session.accessToken;

    // Run backfill using direct Shopify GraphQL calls
    let cursor: string | null = null;
    let hasNextPage = true;
    let total = 0;
    let inserted = 0;
    let updated = 0;

    while (hasNextPage) {
      const gqlResponse = await fetch(
        `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query: ORDERS_BACKFILL_QUERY,
            variables: { cursor },
          }),
        }
      );

      if (!gqlResponse.ok) {
        const text = await gqlResponse.text();
        return new Response(
          JSON.stringify({ error: `Shopify API error ${gqlResponse.status}: ${text}` }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const payload = (await gqlResponse.json()) as { data?: OrdersBackfillResponse; errors?: any[] };
      if (payload.errors?.length) {
        return new Response(
          JSON.stringify({ error: payload.errors.map((e: any) => e.message).join("; ") }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      const data = payload.data!;
      total = data.ordersCount.count;

      // Load existing order IDs to differentiate insert vs update
      const orderIds = data.orders.nodes.map((o) => o.id);
      const { data: existing, error: sbError } = await supabase
        .from("store_orders")
        .select("order_id")
        .in("order_id", orderIds);

      if (sbError) {
        throw new Error(`Supabase select error: ${sbError.message}`);
      }

      const existingSet = new Set((existing ?? []).map((r) => r.order_id));

      for (const order of data.orders.nodes) {
        const wasExisting = existingSet.has(order.id);
        const { error } = await supabase.from("store_orders").upsert(
          {
            order_id: order.id,
            order_number: orderNumber(order),
            total_price: toNumber(order.totalPriceSet.shopMoney.amount),
            subtotal_price: toNumber(order.subtotalPriceSet.shopMoney.amount),
            customer_email: order.email,
            customer_name: customerName(order),
            financial_status: order.displayFinancialStatus?.toLowerCase() ?? null,
            fulfillment_status: order.displayFulfillmentStatus?.toLowerCase() ?? null,
            items_json: orderItems(order),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "order_id" }
        );

        if (error) {
          console.error(`Failed to upsert order ${order.id}`, error);
          throw new Error(`Supabase upsert error: ${error.message}`);
        } else if (wasExisting) {
          updated++;
        } else {
          inserted++;
        }
      }

      hasNextPage = data.orders.pageInfo.hasNextPage;
      cursor = data.orders.pageInfo.endCursor;
    }

    return new Response(
      JSON.stringify({ success: true, total, inserted, updated }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Backfill API error:", error);
    return new Response(
      JSON.stringify({ success: false, error: `API Error: ${message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
