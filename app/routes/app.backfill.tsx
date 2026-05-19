import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useSubmit, useNavigation } from "@remix-run/react";
import { Page, Card, Button, Banner, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { supabase } from "../lib/supabase.server";
import {
  customerName,
  orderNumber,
  orderItems,
  ORDERS_BACKFILL_QUERY,
  toNumber,
  type OrdersBackfillResponse,
} from "../lib/backfill-order-mapper.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  
  let cursor: string | null = null;
  let hasNextPage = true;
  let total = 0;
  let inserted = 0;
  let updated = 0;
  const activeOrderIds: string[] = [];

  try {
    while (hasNextPage) {
      const response = await admin.graphql(ORDERS_BACKFILL_QUERY, {
        variables: { cursor },
      });
      
      const payload = await response.json() as { data?: OrdersBackfillResponse; errors?: any[] };
      
      if (payload.errors?.length) {
        return json({
          success: false,
          error: payload.errors.map((e: any) => e.message).join("; "),
        });
      }

      const data = payload.data;
      if (!data) {
        return json({
          success: false,
          error: "No data returned from Shopify API.",
        });
      }

      total = data.ordersCount.count;

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
        activeOrderIds.push(order.id);
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
            tags: order.tags || [],
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

    // Prune deleted orders from the database
    if (activeOrderIds.length > 0) {
      const { data: dbOrders, error: fetchError } = await supabase
        .from("store_orders")
        .select("order_id");

      if (fetchError) {
        console.error("Failed to fetch db orders for pruning:", fetchError);
      } else if (dbOrders) {
        const dbOrderIds = dbOrders.map((o) => o.order_id);
        const toDelete = dbOrderIds.filter((id) => !activeOrderIds.includes(id));

        if (toDelete.length > 0) {
          console.log(`Pruning deleted orders from DB:`, toDelete);
          const { error: pruneError } = await supabase
            .from("store_orders")
            .delete()
            .in("order_id", toDelete);

          if (pruneError) {
            console.error("Failed to prune deleted orders:", pruneError);
          } else {
            console.log(`Successfully pruned ${toDelete.length} deleted orders.`);
          }
        }
      }
    } else {
      const { error: pruneError } = await supabase
        .from("store_orders")
        .delete();
      if (pruneError) {
        console.error("Failed to clear database orders:", pruneError);
      }
    }

    return json({ success: true, total, inserted, updated });
  } catch (error) {
    // Extract meaningful info from Response objects instead of showing "[object Response]"
    if (error instanceof Response) {
      const body = await error.text().catch(() => "(could not read body)");
      const message = `Request failed (${error.status}): ${body}`;
      return json({ success: false, error: message });
    }
    const message = error instanceof Error ? error.message : JSON.stringify(error);
    return json({ success: false, error: message });
  }
}

export default function BackfillPage() {
  const submit = useSubmit();
  const navigation = useNavigation();
  const result = useActionData<typeof action>();
  const isLoading = navigation.state === "submitting";

  function handleBackfill() {
    submit(null, { method: "POST" });
  }

  return (
    <Page title="">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Click the button below to import all historical orders from Shopify
            into your Supabase database. This will sync any orders missed due
            to webhook failures (e.g., recently added orders not appearing in
            the dashboard).
          </Text>

          {result?.success && (
            <Banner tone="success">
              ✅ Backfill complete! Total: {result.total} | Inserted: {result.inserted} | Updated: {result.updated}
            </Banner>
          )}

          {result?.success === false && (
            <Banner tone="critical" title="Backfill failed">
              <Text as="p" variant="bodyMd">
                {result.error || "An unknown error occurred."}
              </Text>
            </Banner>
          )}

          <div>
            <Button
              variant="primary"
              loading={isLoading}
              onClick={handleBackfill}
            >
              {isLoading ? "Importing Orders..." : "Start Backfill"}
            </Button>
          </div>
        </BlockStack>
      </Card>
    </Page>
  );
}
