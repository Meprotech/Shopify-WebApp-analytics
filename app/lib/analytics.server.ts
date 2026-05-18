import {
  calculateOrderProfit,
  monthKey,
  parseLineItems,
  toNumber,
  topProductRevenue,
} from "./analytics-utils.server";
import { isSupabaseConfigured, supabase, type OrderRow } from "./supabase.server";

export interface CustomerLifetimeValue {
  email: string;
  name: string;
  totalSpent: number;
  orderCount: number;
}

export interface BasketCorrelation {
  productA: string;
  productB: string;
  count: number;
}

export interface MonthlyProfit {
  month: string;
  revenue: number;
  profit: number;
}

export interface DashboardKpis {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  netProfit: number;
  topProducts: { title: string; revenue: number }[];
}

async function loadOrders(startDate?: string, endDate?: string): Promise<OrderRow[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  let query = supabase
    .from("store_orders")
    .select("*")
    .order("created_at", { ascending: true });

  if (startDate) {
    query = query.gte("created_at", `${startDate}T00:00:00.000Z`);
  }
  if (endDate) {
    query = query.lte("created_at", `${endDate}T23:59:59.999Z`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load store_orders analytics data", error);
    return [];
  }

  return data;
}

export async function getOrders(startDate?: string, endDate?: string): Promise<OrderRow[]> {
  return loadOrders(startDate, endDate);
}

export async function updateOrderStatus(id: string, fulfillment_status: string) {
  if (!isSupabaseConfigured) return false;
  const { error } = await supabase
    .from("store_orders")
    .update({ fulfillment_status })
    .eq("id", id);
  if (error) {
    console.error("Failed to update order status", error);
    return false;
  }
  return true;
}

async function loadCostMap(): Promise<Map<string, number>> {
  if (!isSupabaseConfigured) {
    return new Map<string, number>();
  }

  const { data, error } = await supabase
    .from("product_costs")
    .select("product_id,cost_price");

  if (error) {
    console.error("Failed to load product_costs analytics data", error);
    return new Map<string, number>();
  }

  return new Map(
    data.map((row) => [row.product_id, toNumber(row.cost_price)] as const),
  );
}

export async function getCustomerLifetimeValue(startDate?: string, endDate?: string): Promise<
  CustomerLifetimeValue[]
> {
  const customers = new Map<string, CustomerLifetimeValue>();

  (await loadOrders(startDate, endDate)).forEach((order) => {
    if (!order.customer_email) {
      return;
    }

    const current = customers.get(order.customer_email) ?? {
      email: order.customer_email,
      name: order.customer_name ?? "Unknown customer",
      totalSpent: 0,
      orderCount: 0,
    };

    current.totalSpent += toNumber(order.total_price);
    current.orderCount += 1;
    customers.set(order.customer_email, current);
  });

  return Array.from(customers.values())
    .sort((left, right) => right.totalSpent - left.totalSpent)
    .slice(0, 20);
}

export async function getMarketBasketCorrelations(startDate?: string, endDate?: string): Promise<
  BasketCorrelation[]
> {
  const pairCounts = new Map<string, BasketCorrelation>();

  (await loadOrders(startDate, endDate)).forEach((order) => {
    const titles = Array.from(
      new Set(parseLineItems(order.items_json).map((item) => item.title)),
    ).sort((left, right) => left.localeCompare(right));

    for (let leftIndex = 0; leftIndex < titles.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < titles.length;
        rightIndex += 1
      ) {
        const productA = titles[leftIndex];
        const productB = titles[rightIndex];
        const key = `${productA}\u0000${productB}`;
        const current = pairCounts.get(key) ?? { productA, productB, count: 0 };
        current.count += 1;
        pairCounts.set(key, current);
      }
    }
  });

  return Array.from(pairCounts.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 10);
}

export async function getNetProfitByMonth(startDate?: string, endDate?: string): Promise<MonthlyProfit[]> {
  const [orders, costsByProductId] = await Promise.all([
    loadOrders(startDate, endDate),
    loadCostMap(),
  ]);
  const months = new Map<string, MonthlyProfit>();

  orders.forEach((order) => {
    const key = monthKey(order.created_at);
    const current = months.get(key) ?? { month: key, revenue: 0, profit: 0 };
    current.revenue += toNumber(order.total_price);
    current.profit += calculateOrderProfit(order, costsByProductId);
    months.set(key, current);
  });

  return Array.from(months.values()).sort((left, right) =>
    left.month.localeCompare(right.month),
  );
}

export async function getDashboardKPIs(startDate?: string, endDate?: string): Promise<DashboardKpis> {
  const [orders, costsByProductId] = await Promise.all([
    loadOrders(startDate, endDate),
    loadCostMap(),
  ]);
  const totalRevenue = orders.reduce(
    (sum, order) => sum + toNumber(order.total_price),
    0,
  );
  const netProfit = orders.reduce(
    (sum, order) => sum + calculateOrderProfit(order, costsByProductId),
    0,
  );
  const totalOrders = orders.length;

  return {
    totalRevenue,
    totalOrders,
    avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    netProfit,
    topProducts: topProductRevenue(orders).slice(0, 5),
  };
}
