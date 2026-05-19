import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getOrders } from "../lib/analytics.server";
import { Page, Layout, LegacyCard, InlineGrid, BlockStack, Text, DataTable } from "@shopify/polaris";
import type { LoaderFunctionArgs } from "@remix-run/node";

import customStyles from "../styles/custom.css?url";

export const links = () => [
  { rel: "stylesheet", href: customStyles },
];

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function formatCurrency(value: number | null): string {
  return currencyFormatter.format(value ?? 0);
}

function getTableRows(ordersList: any[]) {
  return ordersList.map((order) => [
    order.orderNumber ? `#${order.orderNumber}` : order.orderId,
    order.customer,
    dateFormatter.format(new Date(order.createdAt)),
    formatCurrency(order.totalPrice),
    order.financialStatus ?? "Unknown",
  ]);
}

export async function loader(_: LoaderFunctionArgs) {
  // Auth is enforced by the parent `app.tsx` loader.
  const orders = await getOrders();
  
  let pendingOrders = 0;
  let onTheWay = 0;
  let delivered = 0;

  const pendingList: any[] = [];
  const onTheWayList: any[] = [];
  const deliveredList: any[] = [];

  orders.forEach(order => {
    const mappedOrder = {
      orderNumber: order.order_number,
      orderId: order.order_id,
      customer: order.customer_name ?? order.customer_email ?? "Guest",
      totalPrice: order.total_price,
      financialStatus: order.financial_status,
      createdAt: order.created_at,
    };

    if (order.fulfillment_status === 'fulfilled') {
      delivered++;
      deliveredList.push(mappedOrder);
    } else if (order.fulfillment_status === 'partial') {
      onTheWay++;
      onTheWayList.push(mappedOrder);
    } else {
      pendingOrders++;
      pendingList.push(mappedOrder);
    }
  });

  return json({ pendingOrders, onTheWay, delivered, pendingList, onTheWayList, deliveredList });
}

export default function DeliveryStatus() {
  const { pendingOrders, onTheWay, delivered, pendingList, onTheWayList, deliveredList } = useLoaderData<typeof loader>();

  const pendingRows = getTableRows(pendingList);
  const onTheWayRows = getTableRows(onTheWayList);
  const deliveredRows = getTableRows(deliveredList);

  return (
    <Page title="Delivery Status">
      <Layout>
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <div className="modern-card">
              <LegacyCard sectioned>
                <BlockStack gap="200">
                  <Text as="p" tone="subdued" fontWeight="medium">
                    Pending Orders
                  </Text>
                  <div className="kpi-value">
                    <Text as="p" variant="heading3xl">
                      {pendingOrders}
                    </Text>
                  </div>
                </BlockStack>
              </LegacyCard>
            </div>
            
            <div className="modern-card">
              <LegacyCard sectioned>
                <BlockStack gap="200">
                  <Text as="p" tone="subdued" fontWeight="medium">
                    On The Way
                  </Text>
                  <div className="kpi-value" style={{ background: 'linear-gradient(135deg, #E6A23C 0%, #D38E2C 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    <Text as="p" variant="heading3xl">
                      {onTheWay}
                    </Text>
                  </div>
                </BlockStack>
              </LegacyCard>
            </div>

            <div className="modern-card">
              <LegacyCard sectioned>
                <BlockStack gap="200">
                  <Text as="p" tone="subdued" fontWeight="medium">
                    Delivered
                  </Text>
                  <div className="kpi-value">
                    <Text as="p" variant="heading3xl">
                      {delivered}
                    </Text>
                  </div>
                </BlockStack>
              </LegacyCard>
            </div>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <LegacyCard title="Pending Order Details">
            {pendingRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text"]}
                headings={["Order#", "Customer", "Date", "Total", "Financial Status"]}
                rows={pendingRows}
              />
            ) : (
              <LegacyCard.Section>
                <Text as="p" tone="subdued">No pending orders.</Text>
              </LegacyCard.Section>
            )}
          </LegacyCard>
        </Layout.Section>

        <Layout.Section>
          <LegacyCard title="On The Way Order Details">
            {onTheWayRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text"]}
                headings={["Order#", "Customer", "Date", "Total", "Financial Status"]}
                rows={onTheWayRows}
              />
            ) : (
              <LegacyCard.Section>
                <Text as="p" tone="subdued">No orders on the way.</Text>
              </LegacyCard.Section>
            )}
          </LegacyCard>
        </Layout.Section>

        <Layout.Section>
          <LegacyCard title="Delivered Order Details">
            {deliveredRows.length > 0 ? (
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text"]}
                headings={["Order#", "Customer", "Date", "Total", "Financial Status"]}
                rows={deliveredRows}
              />
            ) : (
              <LegacyCard.Section>
                <Text as="p" tone="subdued">No delivered orders.</Text>
              </LegacyCard.Section>
            )}
          </LegacyCard>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
