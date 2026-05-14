import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { Link } from "@remix-run/react";
import {
  BlockStack,
  Button,
  Layout,
  LegacyCard,
  List,
  Page,
  Spinner,
} from "@shopify/polaris";

import { DashboardCards } from "../components/DashboardCards";
import { ProfitChart } from "../components/ProfitChart";
import { TopProductsCard } from "../components/TopProductsCard";
import {
  getCustomerLifetimeValue,
  getDashboardKPIs,
  getNetProfitByMonth,
} from "../lib/analytics.server";
import { authenticate } from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  const [kpis, customers, monthlyProfit] = await Promise.all([
    getDashboardKPIs(),
    getCustomerLifetimeValue(),
    getNetProfitByMonth(),
  ]);

  return json({
    kpis,
    customers: customers.slice(0, 5),
    monthlyProfit,
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
  const { kpis, customers, monthlyProfit } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  return (
    <Page
      title="Analytics Dashboard"
      primaryAction={
        <Link to="/app/backfill">
          <Button variant="primary">Import Historical Orders</Button>
        </Link>
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
          <Layout.Section variant="oneHalf">
            <TopProductsCard
              products={kpis.topProducts}
              formatCurrency={formatCurrency}
            />
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <LegacyCard title="Top Customers by CLV" sectioned>
              {customers.length === 0 ? (
                <LegacyCard.Section>
                  <BlockStack gap="200">
                    <p style={{ color: "#6d7175" }}>
                      No customer data yet. Click{" "}
                      <strong>Import Historical Orders</strong> to load your
                      data.
                    </p>
                    <Link to="/app/backfill">
                      <Button size="slim">Go to Backfill</Button>
                    </Link>
                  </BlockStack>
                </LegacyCard.Section>
              ) : (
                <List type="bullet">
                  {customers.map((customer) => (
                    <List.Item key={customer.email}>
                      {customer.name} ({customer.email}):{" "}
                      {formatCurrency(customer.totalSpent)}
                    </List.Item>
                  ))}
                </List>
              )}
            </LegacyCard>
          </Layout.Section>

          <Layout.Section>
            <ProfitChart
              points={monthlyProfit}
              formatCurrency={formatCurrency}
            />
          </Layout.Section>
        </Layout>

        {/* Quick Links Footer */}
        <LegacyCard title="Quick Links" sectioned>
          <BlockStack gap="200">
            <Link to="/app/backfill">
              <Button fullWidth>Import Historical Orders (Backfill)</Button>
            </Link>
            <Link to="/app/orders">
              <Button fullWidth>View All Orders</Button>
            </Link>
            <Link to="/app/products">
              <Button fullWidth>Manage Product Costs</Button>
            </Link>
          </BlockStack>
        </LegacyCard>
      </BlockStack>
    </Page>
  );
}
