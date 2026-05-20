import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { Page, Layout, LegacyCard, Text, DataTable, Banner, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { useEffect, useState } from "react";

interface CityStateData {
  city: string;
  province: string;
  totalRevenue: number;
  orderCount: number;
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const ORDERS_WITH_ADDRESSES_QUERY = `#graphql
  query OrdersWithAddresses($cursor: String) {
    orders(first: 250, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        totalPriceSet { shopMoney { amount } }
        shippingAddress {
          city
          province
          provinceCode
          country
        }
        createdAt
      }
    }
  }
`;

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!session.accessToken) {
    return json({
      data: [] as CityStateData[],
      shop,
      error: "No access token available.",
    });
  }

  const accessToken = session.accessToken;
  const API_VERSION = "2024-10";

  // We'll fetch up to 500 recent orders to get a good sample of city/state data
  let cursor: string | null = null;
  let hasNextPage = true;
  let totalOrdersFetched = 0;
  const maxOrders = 500;

  const cityStateMap = new Map<string, { city: string; province: string; totalRevenue: number; orderCount: number }>();

  try {
    while (hasNextPage && totalOrdersFetched < maxOrders) {
      const gqlResponse: Response = await fetch(
        `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query: ORDERS_WITH_ADDRESSES_QUERY,
            variables: { cursor },
          }),
        }
      );

      if (!gqlResponse.ok) {
        return json({
          data: [] as CityStateData[],
          shop,
          error: `Shopify API error ${gqlResponse.status}`,
        });
      }

      const payload: { data?: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Array<{ id: string; name: string; totalPriceSet: { shopMoney: { amount: string } }; shippingAddress: { city: string; province: string; provinceCode: string; country: string } | null; createdAt: string }> } }; errors?: Array<{ message: string }> } = await gqlResponse.json();
      const data = payload.data;

      if (!data || payload.errors) {
        return json({
          data: [] as CityStateData[],
          shop,
          error: payload.errors?.[0]?.message || "No data returned",
        });
      }

      for (const order of data.orders.nodes) {
        const address = order.shippingAddress;
        if (address?.city && address?.province) {
          const key = `${address.city}|${address.province}`;
          const existing = cityStateMap.get(key) || {
            city: address.city,
            province: address.province,
            totalRevenue: 0,
            orderCount: 0,
          };
          existing.totalRevenue += parseFloat(order.totalPriceSet?.shopMoney?.amount || "0");
          existing.orderCount += 1;
          cityStateMap.set(key, existing);
        }
      }

      totalOrdersFetched += data.orders.nodes.length;
      hasNextPage = data.orders.pageInfo.hasNextPage;
      cursor = data.orders.pageInfo.endCursor;
    }

    const data = Array.from(cityStateMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return json({ data, shop, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ data: [] as CityStateData[], shop, error: message });
  }
}

export default function ReligionPage() {
  const { data, shop, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchLastUpdated = async () => {
      try {
        const response = await fetch("/api/last-updated");
        if (response.ok) {
          const dt = await response.json();
          setLastUpdated(dt.timestamp);
        }
      } catch (err) {
        console.error("Failed to fetch last-updated timestamp:", err);
      }
    };
    fetchLastUpdated();
  }, []);

  // Smart polling
  useEffect(() => {
    let active = true;
    let localLast = lastUpdated;

    const checkUpdates = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/last-updated");
        if (!active || !response.ok) return;
        const dt = await response.json();
        if (dt.timestamp !== localLast) {
          localLast = dt.timestamp;
          revalidator.revalidate();
        }
      } catch (err) {
        console.error("Failed to check for updates:", err);
      }
    };

    const intervalId = setInterval(checkUpdates, 5000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [lastUpdated, revalidator]);

  const totalRevenue = data.reduce((sum, d) => sum + d.totalRevenue, 0);

  const tableRows = data.map((item) => [
    item.city,
    item.province,
    item.orderCount,
    currencyFormatter.format(item.totalRevenue),
    `${((item.totalRevenue / (totalRevenue || 1)) * 100).toFixed(1)}%`,
  ]);

  return (
    <Page title="Geography & Religion">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error && (
              <Banner tone="critical" title="Error loading data">
                <Text as="p">{error}</Text>
              </Banner>
            )}

            <LegacyCard title="Purchase Distribution by City and State">
              {data.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric", "numeric"]}
                  headings={["City", "State", "Orders", "Revenue", "% of Total"]}
                  rows={tableRows}
                  totals={["", "", data.reduce((s, d) => s + d.orderCount, 0), currencyFormatter.format(totalRevenue), "100%"]}
                />
              ) : (
                <LegacyCard.Section>
                  <Text as="p" tone="subdued">
                    No city/state data available yet. New orders with shipping addresses
                    will populate this data when they arrive.
                  </Text>
                </LegacyCard.Section>
              )}
            </LegacyCard>

            {/* Summary Cards */}
            <Layout>
              <Layout.Section variant="oneThird">
                <LegacyCard sectioned>
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued" fontWeight="medium">Total Cities</Text>
                    <Text as="p" variant="heading3xl">
                      {new Set(data.map((d) => d.city)).size}
                    </Text>
                  </BlockStack>
                </LegacyCard>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <LegacyCard sectioned>
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued" fontWeight="medium">Total States</Text>
                    <Text as="p" variant="heading3xl">
                      {new Set(data.map((d) => d.province)).size}
                    </Text>
                  </BlockStack>
                </LegacyCard>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <LegacyCard sectioned>
                  <BlockStack gap="200">
                    <Text as="p" tone="subdued" fontWeight="medium">Total Orders</Text>
                    <Text as="p" variant="heading3xl">
                      {data.reduce((s, d) => s + d.orderCount, 0)}
                    </Text>
                  </BlockStack>
                </LegacyCard>
              </Layout.Section>
            </Layout>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
