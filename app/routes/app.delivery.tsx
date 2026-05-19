import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getOrders } from "../lib/analytics.server";
import { Page, Layout, LegacyCard, InlineGrid, BlockStack, Text, DataTable } from "@shopify/polaris";
import type { LoaderFunctionArgs } from "@remix-run/node";

import customStyles from "../styles/custom.css?url";

export const links = () => [
  { rel: "stylesheet", href: customStyles },
];

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function getTableRows(ordersList: any[], shop: string) {
  return ordersList.map((order) => [
    <a
      key={order.orderId}
      href={`https://${shop}/admin/orders/${order.orderId.split('/').pop()}`}
      target="_top"
      style={{ color: "#008060", textDecoration: "underline", fontWeight: "bold" }}
    >
      {order.orderNumber ? `#${order.orderNumber}` : order.orderId}
    </a>,
    dateTimeFormatter.format(new Date(order.createdAt)),
  ]);
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Auth is enforced by the parent `app.tsx` loader.
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? "";
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

    const status = (order.fulfillment_status ?? "").toLowerCase().trim();
    if (status === "fulfilled") {
      delivered++;
      deliveredList.push(mappedOrder);
    } else if (
      status === "partial" ||
      status === "partially_fulfilled" ||
      status === "in_progress" ||
      status === "in progress"
    ) {
      onTheWay++;
      onTheWayList.push(mappedOrder);
    } else {
      pendingOrders++;
      pendingList.push(mappedOrder);
    }
  });

  return json({ pendingOrders, onTheWay, delivered, pendingList, onTheWayList, deliveredList, shop });
}

export default function DeliveryStatus() {
  const { pendingOrders, onTheWay, delivered, pendingList, onTheWayList, deliveredList, shop } = useLoaderData<typeof loader>();

  const pendingRows = getTableRows(pendingList, shop);
  const onTheWayRows = getTableRows(onTheWayList, shop);
  const deliveredRows = getTableRows(deliveredList, shop);

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
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <div className="modern-card">
              <LegacyCard title="Pending Order Details">
                {pendingRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Order#", "Date & Time"]}
                    rows={pendingRows}
                  />
                ) : (
                  <LegacyCard.Section>
                    <Text as="p" tone="subdued">No pending orders.</Text>
                  </LegacyCard.Section>
                )}
              </LegacyCard>
            </div>

            <div className="modern-card">
              <LegacyCard title="On The Way Order Details">
                {onTheWayRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Order#", "Date & Time"]}
                    rows={onTheWayRows}
                  />
                ) : (
                  <LegacyCard.Section>
                    <Text as="p" tone="subdued">No orders on the way.</Text>
                  </LegacyCard.Section>
                )}
              </LegacyCard>
            </div>

            <div className="modern-card">
              <LegacyCard title="Delivered Order Details">
                {deliveredRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text"]}
                    headings={["Order#", "Date & Time"]}
                    rows={deliveredRows}
                  />
                ) : (
                  <LegacyCard.Section>
                    <Text as="p" tone="subdued">No delivered orders.</Text>
                  </LegacyCard.Section>
                )}
              </LegacyCard>
            </div>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
