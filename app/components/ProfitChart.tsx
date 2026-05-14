import { BlockStack, LegacyCard, Text } from "@shopify/polaris";

interface ProfitPoint {
  month: string;
  revenue: number;
  profit: number;
}

interface ProfitChartProps {
  points: ProfitPoint[];
  formatCurrency: (value: number) => string;
}

export function ProfitChart({ points, formatCurrency }: ProfitChartProps) {
  const chartPoints = points.slice(-12);
  const maxValue = Math.max(
    1,
    ...chartPoints.map((point) => Math.max(point.revenue, point.profit)),
  );

  return (
    <LegacyCard title="Monthly Profit" sectioned>
      <BlockStack gap="300">
        <svg
          role="img"
          aria-label="Monthly revenue and profit chart"
          viewBox="0 0 720 240"
          width="100%"
          height="240"
        >
          {chartPoints.map((point, index) => {
            const groupWidth = 720 / Math.max(1, chartPoints.length);
            const revenueHeight = (point.revenue / maxValue) * 180;
            const profitHeight = (point.profit / maxValue) * 180;
            const x = index * groupWidth + groupWidth * 0.25;

            return (
              <g key={point.month}>
                <rect
                  x={x}
                  y={200 - revenueHeight}
                  width={groupWidth * 0.2}
                  height={revenueHeight}
                  fill="#0A6C74"
                  rx="2"
                />
                <rect
                  x={x + groupWidth * 0.24}
                  y={200 - profitHeight}
                  width={groupWidth * 0.2}
                  height={profitHeight}
                  fill="#8A6116"
                  rx="2"
                />
                <text x={x} y="226" fontSize="12" fill="#616161">
                  {point.month.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
        <Text as="p" tone="subdued">
          Latest profit:{" "}
          {formatCurrency(chartPoints.at(-1)?.profit ?? 0)}
        </Text>
      </BlockStack>
    </LegacyCard>
  );
}
