import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
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
} from "@shopify/polaris";
import { useState, useCallback } from "react";

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

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);
  const formData = await request.formData();
  const id = formData.get("id") as string;
  const fulfillment_status = formData.get("fulfillment_status") as string;
  
  if (id && fulfillment_status) {
    await updateOrderStatus(id, fulfillment_status);
  }
  return json({ success: true });
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  const [kpis, customers, monthlyProfit, orders] = await Promise.all([
    getDashboardKPIs(startDate || undefined, endDate || undefined),
    getCustomerLifetimeValue(startDate || undefined, endDate || undefined),
    getNetProfitByMonth(startDate || undefined, endDate || undefined),
    getOrders(startDate || undefined, endDate || undefined),
  ]);

  return json({
    kpis,
    customers: customers.slice(0, 5),
    monthlyProfit,
    orders,
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
  const { kpis, customers, orders } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const submit = useSubmit();
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
                  { title: 'Total' },
                  { title: 'Payment Status' },
                  { title: 'Fulfillment Status' },
                ]}
                selectable={false}
              >
                {orders.map((order, index) => (
                  <IndexTable.Row id={order.id} key={order.id} position={index}>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" fontWeight="bold" as="span">
                        #{order.order_number || order.order_id.split('/').pop()}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {new Date(order.created_at).toLocaleDateString()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{order.customer_name || 'Unknown'}</IndexTable.Cell>
                    <IndexTable.Cell>{formatCurrency(order.total_price || 0)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={order.financial_status === 'paid' ? 'success' : 'attention'}>
                        {order.financial_status || 'unpaid'}
                      </Badge>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      <Select
                        label="Fulfillment status"
                        labelHidden
                        options={[
                          { label: 'Unfulfilled', value: 'unfulfilled' },
                          { label: 'Fulfilled', value: 'fulfilled' },
                          { label: 'Partial', value: 'partial' },
                          { label: 'Restocked', value: 'restocked' },
                        ]}
                        value={order.fulfillment_status || 'unfulfilled'}
                        onChange={(value) => {
                          submit(
                            { id: order.id, fulfillment_status: value },
                            { method: "post" }
                          );
                        }}
                      />
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
