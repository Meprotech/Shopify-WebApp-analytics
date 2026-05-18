import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getOrders } from "../lib/analytics.server";
import { Page, Layout, LegacyCard, InlineGrid, BlockStack, Text } from "@shopify/polaris";
import type { LoaderFunctionArgs } from "@remix-run/node";

import customStyles from "../styles/custom.css?url";

export const links = () => [
  { rel: "stylesheet", href: customStyles },
];

export async function loader(_: LoaderFunctionArgs) {
  // Auth is enforced by the parent `app.tsx` loader.
  const orders = await getOrders();
  
  let pendingOrders = 0;
  let onTheWay = 0;
  let delivered = 0;

  orders.forEach(order => {
    if (order.fulfillment_status === 'fulfilled') {
      delivered++;
    } else if (order.fulfillment_status === 'partial') {
      onTheWay++;
    } else {
      pendingOrders++;
    }
  });

  return json({ pendingOrders, onTheWay, delivered });
}

export default function DeliveryStatus() {
  const { pendingOrders, onTheWay, delivered } = useLoaderData<typeof loader>();

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
      </Layout>
    </Page>
  );
}
