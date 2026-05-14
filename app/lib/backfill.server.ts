import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

import {
  customerName,
  orderItems,
  ORDERS_BACKFILL_QUERY,
  toNumber,
  type OrdersBackfillResponse,
} from "./backfill-order-mapper.server";
import { adminGraphql } from "./shopify.server";
import { supabase } from "./supabase.server";

export interface BackfillResult {
  total: number;
  inserted: number;
  updated: number;
}

async function loadExistingOrderIds(orderIds: string[]): Promise<Set<string>> {
  const existingOrderIds = new Set<string>();

  if (orderIds.length === 0) {
    return existingOrderIds;
  }

  const { data, error } = await supabase
    .from("store_orders")
    .select("order_id")
    .in("order_id", orderIds);

  if (error) {
    console.error("Failed to load existing orders during backfill", error);
    return existingOrderIds;
  }

  data.forEach((row) => existingOrderIds.add(row.order_id));
  return existingOrderIds;
}

export async function runBackfill(
  admin: AdminApiContext,
): Promise<BackfillResult> {
  let cursor: string | null = null;
  let hasNextPage = true;
  let total = 0;
  let processed = 0;
  let inserted = 0;
  let updated = 0;

  while (hasNextPage) {
    const data: OrdersBackfillResponse = await adminGraphql<OrdersBackfillResponse>(
      admin,
      ORDERS_BACKFILL_QUERY,
      { cursor },
    );
    const existingOrderIds = await loadExistingOrderIds(
      data.orders.nodes.map((order) => order.id),
    );

    total = data.ordersCount.count;

    for (const order of data.orders.nodes) {
      const wasExisting = existingOrderIds.has(order.id);
      const { error } = await supabase.from("store_orders").upsert(
        {
          order_id: order.id,
          order_number: order.orderNumber,
          total_price: toNumber(order.totalPriceSet.shopMoney.amount),
          subtotal_price: toNumber(order.subtotalPriceSet.shopMoney.amount),
          customer_email: order.email,
          customer_name: customerName(order),
          financial_status: order.displayFinancialStatus,
          fulfillment_status: order.displayFulfillmentStatus,
          items_json: orderItems(order),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "order_id" },
      );

      if (error) {
        console.error(`Failed to upsert order ${order.id}`, error);
      } else if (wasExisting) {
        updated += 1;
      } else {
        inserted += 1;
      }

      processed += 1;
      console.log(`Backfilled order ${processed} of ${total}`);
    }

    hasNextPage = data.orders.pageInfo.hasNextPage;
    cursor = data.orders.pageInfo.endCursor;
  }

  return { total, inserted, updated };
}
