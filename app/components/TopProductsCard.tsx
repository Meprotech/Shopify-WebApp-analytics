import { LegacyCard, List } from "@shopify/polaris";

interface TopProduct {
  title: string;
  revenue: number;
}

interface TopProductsCardProps {
  products: TopProduct[];
  formatCurrency: (value: number) => string;
}

export function TopProductsCard({
  products,
  formatCurrency,
}: TopProductsCardProps) {
  return (
    <LegacyCard title="Top Products" sectioned>
      <List type="bullet">
        {products.slice(0, 5).map((product) => (
          <List.Item key={product.title}>
            {product.title}: {formatCurrency(product.revenue)}
          </List.Item>
        ))}
      </List>
    </LegacyCard>
  );
}
