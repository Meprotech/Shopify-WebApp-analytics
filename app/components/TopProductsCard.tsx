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
    <div className="modern-card">
      <LegacyCard title="Top Products" sectioned>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {products.slice(0, 5).map((product, index) => (
            <div key={product.title} className="list-item-modern">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ 
                  background: '#f1f2f4', 
                  borderRadius: '50%', 
                  width: '28px', 
                  height: '28px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  color: '#202223'
                }}>
                  {index + 1}
                </span>
                <span style={{ fontWeight: 500, color: '#202223' }}>{product.title}</span>
              </div>
              <span style={{ fontWeight: 600, color: '#008060' }}>
                {formatCurrency(product.revenue)}
              </span>
            </div>
          ))}
        </div>
      </LegacyCard>
    </div>
  );
}
