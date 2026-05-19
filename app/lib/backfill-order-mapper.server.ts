import type { Json } from "./supabase.server";

interface MoneySet {
  shopMoney: {
    amount: string;
  };
}

export interface BackfillOrderNode {
  id: string;
  name: string;
  totalPriceSet: MoneySet;
  subtotalPriceSet: MoneySet;
  email: string | null;
  displayFulfillmentStatus: string;
  displayFinancialStatus: string;
  customer: {
    firstName: string | null;
    lastName: string | null;
  } | null;
  tags: string[];
  lineItems: {
    nodes: Array<{
      title: string;
      quantity: number;
      variant: {
        price: string;
        product: {
          id: string;
          title: string;
        } | null;
      } | null;
    }>;
  };
}

export interface OrdersBackfillResponse {
  ordersCount: {
    count: number;
  };
  orders: {
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string | null;
    };
    nodes: BackfillOrderNode[];
  };
}

export const ORDERS_BACKFILL_QUERY = `#graphql
  query OrdersBackfill($cursor: String) {
    ordersCount {
      count
    }
    orders(first: 100, after: $cursor, sortKey: CREATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        totalPriceSet { shopMoney { amount } }
        subtotalPriceSet { shopMoney { amount } }
        email
        displayFulfillmentStatus
        displayFinancialStatus
        customer {
          firstName
          lastName
        }
        tags
        lineItems(first: 50) {
          nodes {
            title
            quantity
            variant {
              price
              product {
                id
                title
              }
            }
          }
        }
      }
    }
  }
`;

export function toNumber(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function customerName(order: BackfillOrderNode): string | null {
  const parts = [
    order.customer?.firstName ?? "",
    order.customer?.lastName ?? "",
  ].filter((part) => part.trim().length > 0);

  return parts.length > 0 ? parts.join(" ") : null;
}

export function orderNumber(order: BackfillOrderNode): number | null {
  const digits = order.name.replace(/\D/g, "");
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function orderItems(order: BackfillOrderNode): Json {
  return order.lineItems.nodes.map((lineItem) => ({
    title: lineItem.title,
    quantity: lineItem.quantity,
    variantPrice: toNumber(lineItem.variant?.price),
    productId: lineItem.variant?.product?.id ?? null,
    productTitle: lineItem.variant?.product?.title ?? lineItem.title,
  })) as Json;
}
