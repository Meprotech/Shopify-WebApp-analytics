import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { Page } from "@shopify/polaris";
import { useEffect } from "react";

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

  const { data, error, count } = await query;

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
  const revalidator = useRevalidator();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        revalidator.revalidate();
      }
    }, 15000);
    return () => clearInterval(id);
  }, [revalidator]);

  return (
    <Page title="Orders">
      <OrdersTable {...data} />
    </Page>
  );
}
