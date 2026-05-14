import { Form, useNavigation } from "@remix-run/react";
import {
  BlockStack,
  Button,
  InlineStack,
  ResourceItem,
  ResourceList,
  Text,
  TextField,
} from "@shopify/polaris";

export interface ProductCostListItem {
  product_id: string;
  product_title: string | null;
  cost_price: number | null;
}

interface ProductCostListProps {
  products: ProductCostListItem[];
  costs: Record<string, string>;
  onCostChange: (productId: string, value: string) => void;
}

export function ProductCostList({
  products,
  costs,
  onCostChange,
}: ProductCostListProps) {
  const navigation = useNavigation();

  return (
    <ResourceList
      resourceName={{ singular: "product", plural: "products" }}
      items={products}
      renderItem={(product) => {
        const title = product.product_title ?? product.product_id;

        return (
          <ResourceItem
            id={product.product_id}
            accessibilityLabel={`Edit cost for ${title}`}
            onClick={() => undefined}
          >
            <Form method="post">
              <input type="hidden" name="product_id" value={product.product_id} />
              <InlineStack align="space-between" blockAlign="end" gap="400">
                <BlockStack gap="100">
                  <Text as="h2" variant="headingSm">
                    {title}
                  </Text>
                  <Text as="p" tone="subdued">
                    {product.product_id}
                  </Text>
                </BlockStack>
                <InlineStack gap="300" blockAlign="end">
                  <TextField
                    label="Cost price"
                    name="cost_price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={costs[product.product_id] ?? "0"}
                    onChange={(value) => onCostChange(product.product_id, value)}
                    autoComplete="off"
                  />
                  <Button
                    submit
                    variant="primary"
                    loading={navigation.state === "submitting"}
                  >
                    Save
                  </Button>
                </InlineStack>
              </InlineStack>
            </Form>
          </ResourceItem>
        );
      }}
    />
  );
}
