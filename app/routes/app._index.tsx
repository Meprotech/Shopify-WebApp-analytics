import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation, useSearchParams, useSubmit, useFetcher, useRevalidator } from "@remix-run/react";
import { Link } from "@remix-run/react";
import {
  BlockStack,
  Button,
  Layout,
  LegacyCard,
  List,
  Page,
  Spinner,
  ActionList,
  Popover,
  TextField,
  IndexTable,
  Badge,
  Select,
  Text,
  useIndexResourceState,
  Tag,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";

import customStyles from "../styles/custom.css?url";

export const links = () => [
  { rel: "stylesheet", href: customStyles },
];

import { DashboardCards } from "../components/DashboardCards";
import { TopProductsCard } from "../components/TopProductsCard";
import {
  getCustomerLifetimeValue,
  getDashboardKPIs,
  getNetProfitByMonth,
  getOrders,
  updateOrderStatus,
} from "../lib/analytics.server";
import { authenticate } from "../lib/shopify.server";
import { supabase } from "../lib/supabase.server";

export async function action({ request }: ActionFunctionArgs) {
  // Single auth call — the embedded session token (id_token) is single-use,
  // so calling authenticate.admin twice in the same request fails on the second call.
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id") as string;
  const fulfillment_status = formData.get("fulfillment_status") as string | null;
  const financial_status = formData.get("financial_status") as string | null;

  if (id) {
    const updates: any = {};
    if (fulfillment_status) updates.fulfillment_status = fulfillment_status;
    if (financial_status) updates.financial_status = financial_status;

    if (Object.keys(updates).length > 0) {
      await updateOrderStatus(id, updates);
    }
  }

  if (formData.get("sync") === "latest") {
    const response = await admin.graphql(`
      query GetLatestOrders {
        orders(first: 50, sortKey: CREATED_AT, reverse: true) {
          nodes {
            id
            name
            createdAt
            totalPriceSet { shopMoney { amount currencyCode } }
            subtotalPriceSet { shopMoney { amount } }
            email
            displayFinancialStatus
            displayFulfillmentStatus
            customer { firstName lastName }
            tags
            lineItems(first: 20) {
              nodes {
                title
                quantity
                variant { price product { id title } }
              }
            }
          }
        }
      }
    `);
    const data: any = await response.json();
    const orders = data.data?.orders?.nodes || [];
    for (const order of orders) {
      await supabase.from("store_orders").upsert({
        order_id: order.id,
        order_number: parseInt(order.name.replace(/\D/g, "")) || null,
        total_price: parseFloat(order.totalPriceSet?.shopMoney?.amount || "0"),
        subtotal_price: parseFloat(order.subtotalPriceSet?.shopMoney?.amount || "0"),
        customer_email: order.email,
        customer_name: [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(" ") || null,
        financial_status: order.displayFinancialStatus?.toLowerCase() || null,
        fulfillment_status: order.displayFulfillmentStatus?.toLowerCase() || null,
        items_json: order.lineItems.nodes.map((li: any) => ({
          title: li.title,
          quantity: li.quantity,
          variantPrice: parseFloat(li.variant?.price || "0"),
          productId: li.variant?.product?.id || null,
          productTitle: li.variant?.product?.title || li.title,
        })),
        tags: order.tags || [],
        updated_at: new Date().toISOString(),
      }, { onConflict: "order_id" });
    }
  }

  return json({ success: true });
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Auth is enforced by the parent `app.tsx` loader. Re-calling
  // `authenticate.admin` here races with the parent during client-side
  // revalidation because the embedded session token is single-use.
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const shop = url.searchParams.get("shop") ?? "";

  const [kpis, customers, monthlyProfit, orders, latestOrderData, totalOrdersCount] = await Promise.all([
    getDashboardKPIs(startDate || undefined, endDate || undefined),
    getCustomerLifetimeValue(startDate || undefined, endDate || undefined),
    getNetProfitByMonth(startDate || undefined, endDate || undefined),
    getOrders(startDate || undefined, endDate || undefined),
    supabase
      .from("store_orders")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("store_orders")
      .select("*", { count: "exact", head: true }),
  ]);

  const lastUpdated = latestOrderData.data?.[0]?.updated_at ?? null;
  const totalCount = totalOrdersCount.count ?? 0;

  return json({
    kpis,
    customers: customers.slice(0, 5),
    monthlyProfit,
    orders,
    shop,
    lastUpdated,
    totalCount,
  });
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export default function Dashboard() {
  const { kpis, customers, orders, shop, lastUpdated, totalCount } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const syncFetcher = useFetcher();
  const revalidator = useRevalidator();
  const [activePaymentPopover, setActivePaymentPopover] = useState<string | null>(null);
  const [activeFulfillmentPopover, setActiveFulfillmentPopover] = useState<string | null>(null);

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(orders);
  const isLoading = navigation.state !== "idle";
  const [searchParams, setSearchParams] = useSearchParams();

  const [popoverActive, setPopoverActive] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined
  );
  const [activeDateRange, setActiveDateRange] = useState<string>("options");

  const togglePopoverActive = useCallback(() => {
    setPopoverActive((active) => !active);
    if (!popoverActive) setActiveDateRange("options");
  }, [popoverActive]);

  // Auto-refresh dashboard (left side orders/KPIs) after successful sync
  useEffect(() => {
    if (syncFetcher.state === "idle" && syncFetcher.data?.success) {
      revalidator.revalidate();
    }
  }, [syncFetcher.state, syncFetcher.data, revalidator]);

  // Track database states to detect when an actual change happens
  const [localLastUpdated, setLocalLastUpdated] = useState(lastUpdated);
  const [localTotalCount, setLocalTotalCount] = useState(totalCount);

  useEffect(() => {
    setLocalLastUpdated(lastUpdated);
    setLocalTotalCount(totalCount);
  }, [lastUpdated, totalCount]);

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

  const handleRangeSelect = useCallback((range: string) => {
    if (range === "custom") {
      setActiveDateRange("custom");
      return;
    }

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (range === "today") {
      start = today;
    } else if (range === "yesterday") {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
    } else if (range === "last7") {
      start = new Date(today);
      start.setDate(today.getDate() - 6);
    } else if (range === "last30") {
      start = new Date(today);
      start.setDate(today.getDate() - 29);
    } else if (range === "thisMonth") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setStartDate(start);
    setEndDate(end);
    
    const params = new URLSearchParams(searchParams);
    params.set("startDate", start.toISOString().split('T')[0]);
    params.set("endDate", end.toISOString().split('T')[0]);
    setSearchParams(params);
    setPopoverActive(false);
  }, [searchParams, setSearchParams]);

  const applyFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (startDate) {
      params.set("startDate", startDate.toISOString().split('T')[0]);
    } else {
      params.delete("startDate");
    }
    if (endDate) {
      params.set("endDate", endDate.toISOString().split('T')[0]);
    } else {
      params.delete("endDate");
    }
    setSearchParams(params);
    setPopoverActive(false);
  }, [startDate, endDate, searchParams, setSearchParams]);

  const clearFilter = useCallback(() => {
    setStartDate(undefined);
    setEndDate(undefined);
    const params = new URLSearchParams(searchParams);
    params.delete("startDate");
    params.delete("endDate");
    setSearchParams(params);
    setPopoverActive(false);
  }, [searchParams, setSearchParams]);

  return (
    <Page
      title="Analytics Dashboard"
      primaryAction={
        <Popover
          active={popoverActive}
          activator={
            <Button onClick={togglePopoverActive} variant="primary">
              {startDate || endDate ? "Edit Date Filter" : "Filter by Date"}
            </Button>
          }
          onClose={togglePopoverActive}
        >
          <div style={{ minWidth: "250px" }}>
            {activeDateRange === "options" ? (
              <ActionList
                actionRole="menuitem"
                items={[
                  { content: 'Custom', onAction: () => handleRangeSelect('custom') },
                  { content: 'Today', onAction: () => handleRangeSelect('today') },
                  { content: 'Yesterday', onAction: () => handleRangeSelect('yesterday') },
                  { content: 'Last 7 days', onAction: () => handleRangeSelect('last7') },
                  { content: 'Last 30 days', onAction: () => handleRangeSelect('last30') },
                  { content: 'This month', onAction: () => handleRangeSelect('thisMonth') },
                  { content: 'Clear', onAction: clearFilter, destructive: true },
                ]}
              />
            ) : (
              <div style={{ padding: "16px" }}>
                <BlockStack gap="400">
                  <TextField
                    label="Start Date"
                    type="date"
                    autoComplete="off"
                    value={startDate ? startDate.toISOString().split('T')[0] : ""}
                    onChange={(value) => setStartDate(value ? new Date(value) : undefined)}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    autoComplete="off"
                    value={endDate ? endDate.toISOString().split('T')[0] : ""}
                    onChange={(value) => setEndDate(value ? new Date(value) : undefined)}
                  />
                  <BlockStack gap="200">
                    <Button onClick={applyFilter} variant="primary" fullWidth>
                      Apply Filter
                    </Button>
                    <Button onClick={() => setActiveDateRange("options")} fullWidth>
                      Back to Presets
                    </Button>
                    <Button onClick={clearFilter} fullWidth>
                      Clear Filter
                    </Button>
                  </BlockStack>
                </BlockStack>
              </div>
            )}
          </div>
        </Popover>
      }
    >
      <BlockStack gap="400">
        {isLoading ? <Spinner accessibilityLabel="Loading analytics" /> : null}

        <DashboardCards
          totalRevenue={formatCurrency(kpis.totalRevenue)}
          totalOrders={kpis.totalOrders}
          avgOrderValue={formatCurrency(kpis.avgOrderValue)}
          netProfit={formatCurrency(kpis.netProfit)}
        />

        <Layout>
          <Layout.Section>
            <div className="modern-card table-wrapper">
              <LegacyCard title="Order Status">
                <IndexTable
                resourceName={{ singular: 'order', plural: 'orders' }}
                itemCount={orders.length}
                headings={[
                  { title: 'Order' },
                  { title: 'Date' },
                  { title: 'Customer' },
                  { title: 'Channel' },
                  { title: 'Total' },
                  { title: 'Payment status' },
                  { title: 'Fulfillment status' },
                  { title: 'Items' },
                  { title: 'Delivery status' },
                  { title: 'Delivery method' },
                  { title: 'Tags' },
                ]}
                selectable={false}
              >
                {orders.map((order, index) => (
                  <IndexTable.Row id={order.id} key={order.id} position={index}>
                    <IndexTable.Cell>
                      <a
                        href={`https://${shop}/admin/orders/${order.order_id.split('/').pop()}`}
                        target="_top"
                        style={{ color: "#008060", textDecoration: "underline", fontWeight: "bold" }}
                      >
                        #{order.order_number || order.order_id.split('/').pop()}
                      </a>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(order.created_at))} at {new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric' }).format(new Date(order.created_at)).toLowerCase()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{order.customer_name || 'No customer'}</IndexTable.Cell>
                    <IndexTable.Cell></IndexTable.Cell>
                    <IndexTable.Cell>{formatCurrency(order.total_price || 0)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Popover
                        active={activePaymentPopover === order.id}
                        activator={
                          <div onClick={() => setActivePaymentPopover(activePaymentPopover === order.id ? null : order.id)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                            <Badge progress={order.financial_status === 'paid' ? 'complete' : 'partiallyComplete'}>
                              {order.financial_status ? order.financial_status.charAt(0).toUpperCase() + order.financial_status.slice(1) : 'Unpaid'}
                            </Badge>
                          </div>
                        }
                        onClose={() => setActivePaymentPopover(null)}
                      >
                        <ActionList
                          actionRole="menuitem"
                          items={[
                            { content: 'Pending', onAction: () => { submit({ id: order.id, financial_status: 'pending' }, { method: "post" }); setActivePaymentPopover(null); } },
                            { content: 'Paid', onAction: () => { submit({ id: order.id, financial_status: 'paid' }, { method: "post" }); setActivePaymentPopover(null); } },
                            { content: 'Refunded', onAction: () => { submit({ id: order.id, financial_status: 'refunded' }, { method: "post" }); setActivePaymentPopover(null); } },
                          ]}
                        />
                      </Popover>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {(() => {
                        const normFulfillment = (order.fulfillment_status || 'unfulfilled').toLowerCase().trim();
                        const isFulfilled = normFulfillment === 'fulfilled';
                        const isPartial = normFulfillment === 'partial' || normFulfillment === 'partially_fulfilled';
                        const badgeText = isPartial ? 'Partially fulfilled' : (isFulfilled ? 'Fulfilled' : 'Unfulfilled');
                        const badgeTone = isFulfilled ? 'success' : (isPartial ? 'warning' : undefined);
                        const badgeProgress = isFulfilled ? 'complete' : (isPartial ? 'partiallyComplete' : 'incomplete');
                        return (
                          <Popover
                            active={activeFulfillmentPopover === order.id}
                            activator={
                              <div onClick={() => setActiveFulfillmentPopover(activeFulfillmentPopover === order.id ? null : order.id)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                                <Badge tone={badgeTone} progress={badgeProgress}>
                                  {badgeText}
                                </Badge>
                              </div>
                            }
                            onClose={() => setActiveFulfillmentPopover(null)}
                          >
                            <ActionList
                              actionRole="menuitem"
                              items={[
                                { content: 'Unfulfilled', onAction: () => { submit({ id: order.id, fulfillment_status: 'unfulfilled' }, { method: "post" }); setActiveFulfillmentPopover(null); } },
                                { content: 'Fulfilled', onAction: () => { submit({ id: order.id, fulfillment_status: 'fulfilled' }, { method: "post" }); setActiveFulfillmentPopover(null); } },
                                { content: 'Partially fulfilled', onAction: () => { submit({ id: order.id, fulfillment_status: 'partial' }, { method: "post" }); setActiveFulfillmentPopover(null); } },
                                { content: 'Restocked', onAction: () => { submit({ id: order.id, fulfillment_status: 'restocked' }, { method: "post" }); setActiveFulfillmentPopover(null); } },
                              ]}
                            />
                          </Popover>
                        );
                      })()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {(() => {
                        const count = Array.isArray(order.items_json) ? order.items_json.length : 0;
                        return `${count} ${count === 1 ? 'item' : 'items'}`;
                      })()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {(() => {
                        const normFulfillment = (order.fulfillment_status || 'unfulfilled').toLowerCase().trim();
                        if (normFulfillment === 'fulfilled') {
                          return <Badge tone="success">Delivered</Badge>;
                        } else if (
                          normFulfillment === 'partial' ||
                          normFulfillment === 'partially_fulfilled' ||
                          normFulfillment === 'in_progress' ||
                          normFulfillment === 'in progress'
                        ) {
                          return <Badge tone="warning">On the Way</Badge>;
                        } else {
                          return <Badge>Pending</Badge>;
                        }
                      })()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      Shipping
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {(() => {
                        const tags = Array.isArray(order.tags) ? order.tags : [];
                        if (tags.length === 0) return <Text as="span" tone="subdued">-</Text>;
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {tags.map((tag) => (
                              <Tag key={tag}>{tag}</Tag>
                            ))}
                          </div>
                        );
                      })()}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            </LegacyCard>
            </div>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <TopProductsCard
              products={kpis.topProducts}
              formatCurrency={formatCurrency}
            />
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <div className="modern-card">
              <LegacyCard title="Top Customers by CLV" sectioned>
                {customers.length === 0 ? (
                  <LegacyCard.Section>
                    <p style={{ color: "#6d7175" }}>
                      No customer data available for the selected date range.
                    </p>
                  </LegacyCard.Section>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {customers.map((customer, index) => (
                      <div key={customer.email} className="list-item-modern">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            background: '#e3f1df', 
                            borderRadius: '50%', 
                            width: '32px', 
                            height: '32px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            color: '#008060'
                          }}>
                            {customer.name.charAt(0).toUpperCase()}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 500, color: '#202223' }}>{customer.name}</span>
                            <span style={{ fontSize: '12px', color: '#6d7175' }}>{customer.email}</span>
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, color: '#202223' }}>
                          {formatCurrency(customer.totalSpent)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </LegacyCard>
            </div>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
