import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { useEffect, useState } from "react";

import {
  OrdersTable,
  type OrdersTableOrder,
} from "../components/OrdersTable";
import { authenticate } from "../lib/shopify.server";
import { isSupabaseConfigured, supabase } from "../lib/supabase.server";

const PAGE_SIZE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  // Auth is enforced by the parent `app.tsx` loader. See app._index.tsx for context.
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const financialStatus = url.searchParams.get("financial_status") ?? "";
  const fulfillmentStatus = url.searchParams.get("fulfillment_status") ?? "";
  const shop = url.searchParams.get("shop") ?? "";
  const from = (page - 1) * PAGE_SIZE;

  if (!isSupabaseConfigured) {
    return json({
      orders: [],
      page,
      financialStatus,
      fulfillmentStatus,
      totalPages: 1,
      errorMessage: "",
      shop,
      lastUpdated: null,
      totalOrdersCount: 0,
    });
  }

  let query = supabase
    .from("store_orders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (financialStatus) {
    query = query.eq("financial_status", financialStatus);
  }

  if (fulfillmentStatus) {
    query = query.eq("fulfillment_status", fulfillmentStatus);
  }

  const [mainQueryResult, latestOrderResult, dbCountResult] = await Promise.all([
    query,
    supabase
      .from("store_orders")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("store_orders")
      .select("*", { count: "exact", head: true }),
  ]);

  const { data, error, count } = mainQueryResult;
  const lastUpdated = latestOrderResult.data?.[0]?.updated_at ?? null;
  const totalOrdersCount = dbCountResult.count ?? 0;

  if (error) {
    console.error("Failed to load orders table", error);
  }

  const orders: OrdersTableOrder[] = (data ?? []).map((order) => ({
    orderId: order.order_id,
    orderNumber: order.order_number,
    customer: order.customer_name ?? order.customer_email ?? "Guest",
    createdAt: order.created_at,
    totalPrice: order.total_price,
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status,
  }));

  return json({
    orders,
    page,
    financialStatus,
    fulfillmentStatus,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    errorMessage: error ? "Orders could not be loaded." : "",
    shop,
    lastUpdated,
    totalOrdersCount,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const formData = await request.formData();
  const params = new URLSearchParams({ page: "1" });
  const financialStatus = String(formData.get("financial_status") ?? "");
  const fulfillmentStatus = String(formData.get("fulfillment_status") ?? "");

  if (financialStatus) {
    params.set("financial_status", financialStatus);
  }

  if (fulfillmentStatus) {
    params.set("fulfillment_status", fulfillmentStatus);
  }

  return redirect(`/app/orders?${params.toString()}`);
}

export default function OrdersTablePage() {
  const data = useLoaderData<typeof loader>();
  const { lastUpdated, totalOrdersCount } = data;
  const revalidator = useRevalidator();

  // Track database states to detect when an actual change happens
  const [localLastUpdated, setLocalLastUpdated] = useState(lastUpdated);
  const [localTotalCount, setLocalTotalCount] = useState(totalOrdersCount);

  useEffect(() => {
    setLocalLastUpdated(lastUpdated);
    setLocalTotalCount(totalOrdersCount);
  }, [lastUpdated, totalOrdersCount]);

  // Fast smart-polling: check for updates every 3 seconds, only revalidate if something changed
  useEffect(() => {
    let active = true;

    const checkUpdates = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const response = await fetch("/api/last-updated");
        if (!active) return;
        if (!response.ok) return;

        const data = await response.json();
        if (
          data.timestamp !== localLastUpdated ||
          data.count !== localTotalCount
        ) {
          revalidator.revalidate();
        }
      } catch (err) {
        console.error("Failed to check for updates:", err);
      }
    };

    const intervalId = setInterval(checkUpdates, 3000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [localLastUpdated, localTotalCount, revalidator]);

  return (
    <Page title="Orders">
      <OrdersTable {...data} />
    </Page>
  );
}
