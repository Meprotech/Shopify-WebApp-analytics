import type { Json, OrderRow } from "./supabase.server";

export interface ParsedLineItem {
  productId: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface ProductRevenue {
  title: string;
  revenue: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function monthKey(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

export function parseLineItems(itemsJson: Json | null): ParsedLineItem[] {
  if (!Array.isArray(itemsJson)) {
    return [];
  }

  return itemsJson.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const title =
      toStringOrNull(item.title) ??
      toStringOrNull(item.productTitle) ??
      toStringOrNull(item.name) ??
      "Unknown product";
    const productId =
      toStringOrNull(item.productId) ??
      toStringOrNull(item.product_id) ??
      toStringOrNull(item.admin_graphql_api_id);
    const unitPrice =
      toNumber(item.variantPrice) ||
      toNumber(item.price) ||
      toNumber(item.unit_price);

    return [
      {
        productId,
        title,
        quantity: Math.max(1, toNumber(item.quantity)),
        unitPrice,
      },
    ];
  });
}

export function calculateOrderProfit(
  order: OrderRow,
  costsByProductId: Map<string, number>,
): number {
  return parseLineItems(order.items_json).reduce((profit, item) => {
    const unitCost = item.productId
      ? costsByProductId.get(item.productId) ?? 0
      : 0;

    return profit + (item.unitPrice - unitCost) * item.quantity;
  }, 0);
}

export function topProductRevenue(orders: OrderRow[]): ProductRevenue[] {
  const productRevenue = new Map<string, number>();

  orders.forEach((order) => {
    parseLineItems(order.items_json).forEach((item) => {
      productRevenue.set(
        item.title,
        (productRevenue.get(item.title) ?? 0) + item.unitPrice * item.quantity,
      );
    });
  });

  return Array.from(productRevenue.entries())
    .map(([title, revenue]) => ({ title, revenue }))
    .sort((left, right) => right.revenue - left.revenue);
}
