import { BlockStack, InlineGrid, LegacyCard, Text } from "@shopify/polaris";

interface DashboardCardsProps {
  totalRevenue: string;
  totalOrders: number;
  avgOrderValue: string;
  netProfit: string;
}

interface KpiCardProps {
  label: string;
  value: string;
}

function KpiCard({ label, value }: KpiCardProps) {
  return (
    <LegacyCard sectioned>
      <BlockStack gap="200">
        <Text as="p" tone="subdued">
          {label}
        </Text>
        <Text as="p" variant="heading2xl">
          {value}
        </Text>
      </BlockStack>
    </LegacyCard>
  );
}

export function DashboardCards({
  totalRevenue,
  totalOrders,
  avgOrderValue,
  netProfit,
}: DashboardCardsProps) {
  return (
    <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
      <KpiCard label="Total Revenue" value={totalRevenue} />
      <KpiCard label="Total Orders" value={String(totalOrders)} />
      <KpiCard label="Avg Order Value" value={avgOrderValue} />
      <KpiCard label="Net Profit" value={netProfit} />
    </InlineGrid>
  );
}
