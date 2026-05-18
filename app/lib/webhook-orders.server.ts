import { createHmac, timingSafeEqual } from "node:crypto";

import { supabase, type Json } from "./supabase.server";

interface ShopifyWebhookCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface ShopifyWebhookLineItem {
  title?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  product_id?: number | string | null;
  admin_graphql_api_id?: string | null;
}

export interface ShopifyOrderWebhookPayload {
  id: number | string;
  admin_graphql_api_id?: string | null;
  order_number?: number | null;
  total_price?: number | string | null;
  subtotal_price?: number | string | null;
  email?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  customer?: ShopifyWebhookCustomer | null;
  line_items?: ShopifyWebhookLineItem[];
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function productGid(productId: number | string | null | undefined): string | null {
  if (productId === null || productId === undefined || productId === "") {
    return null;
  }

  const id = String(productId);
  return id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`;
}

function customerName(customer: ShopifyWebhookCustomer | null | undefined): string | null {
  const parts = [
    customer?.first_name ?? "",
    customer?.last_name ?? "",
  ].filter((part) => part.trim().length > 0);

  return parts.length > 0 ? parts.join(" ") : null;
}

function mapLineItems(payload: ShopifyOrderWebhookPayload): Json {
  return (payload.line_items ?? []).map((lineItem) => ({
    title: lineItem.title ?? "Unknown product",
    quantity: Math.max(1, toNumber(lineItem.quantity)),
    variantPrice: toNumber(lineItem.price),
    productId: productGid(lineItem.product_id),
    productTitle: lineItem.title ?? "Unknown product",
    lineItemId: lineItem.admin_graphql_api_id ?? null,
  })) as Json;
}

export async function verifyShopifyWebhook(request: Request): Promise<string | null> {
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!hmacHeader) {
    return null;
  }

  const rawBody = await request.text();
  const digest = createHmac("sha256", requireEnv("SHOPIFY_API_SECRET"))
    .update(rawBody, "utf8")
    .digest("base64");

  const received = Buffer.from(hmacHeader, "base64");
  const generated = Buffer.from(digest, "base64");

  if (
    received.length !== generated.length ||
    !timingSafeEqual(received, generated)
  ) {
    return null;
  }

  return rawBody;
}

export async function upsertWebhookOrder(
  payload: ShopifyOrderWebhookPayload,
): Promise<void> {
  const now = new Date().toISOString();
  const orderId = payload.admin_graphql_api_id ?? String(payload.id);
  const email = payload.email ?? payload.customer?.email ?? null;

  const { error } = await supabase.from("store_orders").upsert(
    {
      order_id: orderId,
      order_number: payload.order_number ?? null,
      total_price: toNumber(payload.total_price),
      subtotal_price: toNumber(payload.subtotal_price),
      customer_email: email,
      customer_name: customerName(payload.customer),
      financial_status: payload.financial_status ?? null,
      fulfillment_status: payload.fulfillment_status ?? null,
      items_json: mapLineItems(payload),
      updated_at: now,
    },
    { onConflict: "order_id" },
  );

  if (error) {
    console.error(`Failed to upsert webhook order ${orderId}`, error);
  }
}
