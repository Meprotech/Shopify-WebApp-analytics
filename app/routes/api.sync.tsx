import type { LoaderFunctionArgs } from "@remix-run/node";

import {
  customerName,
  orderItems,
  orderNumber,
  toNumber,
  type BackfillOrderNode,
} from "../lib/backfill-order-mapper.server";
import { shopify } from "../lib/shopify.server";
import { supabase } from "../lib/supabase.server";

const API_VERSION = "2024-10";

const RECENT_ORDERS_QUERY = `#graphql
  query RecentOrders {
    orders(first: 50, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        id
        name
        totalPriceSet { shopMoney { amount } }
        subtotalPriceSet { shopMoney { amount } }
        email
        displayFulfillmentStatus
        displayFinancialStatus
        customer { firstName lastName }
        lineItems(first: 50) {
          nodes {
            title
            quantity
            variant {
              price
              product { id title }
            }
          }
        }
      }
    }
  }
`;

interface RecentOrdersResponse {
  orders: { nodes: BackfillOrderNode[] };
}

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret && querySecret === process.env.SHOPIFY_API_SECRET) {
    return true;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get("authorization");
    if (header === `Bearer ${cronSecret}`) {
      return true;
    }
  }

  return false;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!isAuthorized(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? process.env.SHOPIFY_SHOP_DOMAIN;

  if (!shop) {
    return new Response(
      JSON.stringify({
        error: "Missing shop (pass ?shop= or set SHOPIFY_SHOP_DOMAIN)",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const sessions = await shopify.sessionStorage.findSessionsByShop(shop);
  const session =
    sessions.find((s) => s.accessToken && !s.isOnline) ??
    sessions.find((s) => s.accessToken);

  if (!session?.accessToken) {
    return new Response(
      JSON.stringify({
        error: `No valid access token for ${shop}. Open the app in Shopify admin once to seed a session.`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const gqlResponse = await fetch(
      `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({ query: RECENT_ORDERS_QUERY }),
      },
    );

    if (!gqlResponse.ok) {
      const text = await gqlResponse.text();
      return new Response(
        JSON.stringify({
          error: `Shopify API ${gqlResponse.status}: ${text}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const payload = (await gqlResponse.json()) as {
      data?: RecentOrdersResponse;
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length) {
      return new Response(
        JSON.stringify({
          error: payload.errors.map((e) => e.message).join("; "),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const nodes = payload.data?.orders.nodes ?? [];
    let upserted = 0;
    const now = new Date().toISOString();

    for (const order of nodes) {
      const { error } = await supabase.from("store_orders").upsert(
        {
          order_id: order.id,
          order_number: orderNumber(order),
          total_price: toNumber(order.totalPriceSet.shopMoney.amount),
          subtotal_price: toNumber(order.subtotalPriceSet.shopMoney.amount),
          customer_email: order.email,
          customer_name: customerName(order),
          financial_status: order.displayFinancialStatus?.toLowerCase() ?? null,
          fulfillment_status:
            order.displayFulfillmentStatus?.toLowerCase() ?? null,
          items_json: orderItems(order),
          updated_at: now,
        },
        { onConflict: "order_id" },
      );

      if (error) {
        console.error(`sync: failed to upsert ${order.id}`, error);
        continue;
      }

      upserted += 1;
    }

    return new Response(
      JSON.stringify({ success: true, fetched: nodes.length, upserted }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync route error", error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
