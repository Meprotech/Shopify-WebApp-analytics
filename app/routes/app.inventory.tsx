import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import {
  Page,
  LegacyCard,
  Badge,
  Text,
  IndexTable,
  InlineGrid,
  BlockStack,
  TextField,
  Button,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../lib/shopify.server";

const PRODUCTS_QUERY = `#graphql
  query ProductsWithInventory($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        status
        totalInventory
        variants(first: 10) {
          nodes {
            id
            title
            sku
            inventoryQuantity
            inventoryItem {
              id
              tracked
              inventoryLevels(first: 5) {
                nodes {
                  id
                  available
                  location {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface VariantData {
  id: string;
  title: string;
  sku: string | null;
  inventoryQuantity: number | null;
  tracked: boolean;
}

interface ProductData {
  id: string;
  title: string;
  status: string;
  totalInventory: number;
  variants: VariantData[];
  lowStockCount: number;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  if (!session.accessToken) {
    return json({ products: [], shop, error: "No access token available." });
  }

  const accessToken = session.accessToken;
  const API_VERSION = "2024-10";

  let cursor: string | null = null;
  let hasNextPage = true;
  const products: ProductData[] = [];
  const seenIds = new Set<string>();

  try {
    while (hasNextPage) {
      const response = await fetch(
        `https://${shop}/admin/api/${API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query: PRODUCTS_QUERY,
            variables: { cursor },
          }),
        }
      );

      if (!response.ok) {
        return json({
          products: [],
          shop,
          error: `Shopify API error ${response.status}`,
        });
      }

      const payload: {
        data?: {
          products: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{
              id: string;
              title: string;
              status: string;
              totalInventory: number;
              variants: {
                nodes: Array<{
                  id: string;
                  title: string;
                  sku: string | null;
                  inventoryQuantity: number | null;
                  inventoryItem: {
                    id: string;
                    tracked: boolean;
                    inventoryLevels: {
                      nodes: Array<{
                        id: string;
                        available: number;
                        location: { id: string; name: string };
                      }>;
                    };
                  };
                }>;
              };
            }>;
          };
        };
        errors?: Array<{ message: string }>;
      } = await response.json();

      const data = payload.data;

      if (!data || payload.errors) {
        return json({
          products: [],
          shop,
          error: payload.errors?.[0]?.message || "No data returned",
        });
      }

      for (const product of data.products.nodes) {
        if (seenIds.has(product.id)) continue;
        seenIds.add(product.id);

        const variants: VariantData[] = product.variants.nodes.map((v) => ({
          id: v.id,
          title: v.title,
          sku: v.sku,
          inventoryQuantity: v.inventoryQuantity,
          tracked: v.inventoryItem?.tracked ?? false,
        }));

        const lowStockCount = variants.filter(
          (v) => v.tracked && (v.inventoryQuantity ?? 0) <= 5
        ).length;

        products.push({
          id: product.id,
          title: product.title,
          status: product.status,
          totalInventory: product.totalInventory,
          variants,
          lowStockCount,
        });
      }

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    }

    // Sort by total inventory ascending (low stock first)
    products.sort((a, b) => a.totalInventory - b.totalInventory);

    return json({ products, shop, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ products: [], shop, error: message });
  }
}

export default function InventoryPage() {
  const { products, shop, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  const [searchQuery, setSearchQuery] = useState("");

  const handleRefresh = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  const nonNullProducts: ProductData[] = products.filter(Boolean) as any;

  const filteredProducts = nonNullProducts.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants.some(
        (v) =>
          v.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
      )
  );

  const lowStockCount = nonNullProducts.filter((p) => p.lowStockCount > 0).length;
  const totalVariants = nonNullProducts.reduce(
    (sum, p) => sum + p.variants.length,
    0
  );

  const rowMarkup = filteredProducts.map((product, index) => {
    const hasLowStock = product.lowStockCount > 0;
    const hasVariants = product.variants.length > 0;
    const primaryVariant = product.variants[0];
    const sku = primaryVariant?.sku || "-";
    const stock = product.totalInventory;

    return (
      <IndexTable.Row
        id={product.id}
        key={product.id}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {product.title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{sku}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" numeric>{stock}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{hasVariants ? product.variants.length : 0}</IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" tone="subdued" as="span">
            {product.status === "ACTIVE" ? "Active" : "Draft"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {hasLowStock ? (
            <Badge tone="critical">{`Low Stock (${product.lowStockCount})`}</Badge>
          ) : stock > 50 ? (
            <Badge tone="success">In Stock</Badge>
          ) : stock > 0 ? (
            <Badge tone="warning">Limited</Badge>
          ) : (
            <Badge tone="critical">Out of Stock</Badge>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Inventory">
      <BlockStack gap="400">
        {/* Summary Cards */}
        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
          <LegacyCard sectioned>
            <BlockStack gap="200">
              <Text as="p" tone="subdued" fontWeight="medium">
                Total Products
              </Text>
              <Text as="p" variant="heading3xl">
                {products.length}
              </Text>
            </BlockStack>
          </LegacyCard>
          <LegacyCard sectioned>
            <BlockStack gap="200">
              <Text as="p" tone="subdued" fontWeight="medium">
                Tracked Variants
              </Text>
              <Text as="p" variant="heading3xl">
                {totalVariants}
              </Text>
            </BlockStack>
          </LegacyCard>
          <LegacyCard sectioned>
            <BlockStack gap="200">
              <Text as="p" tone="subdued" fontWeight="medium">
                Low Stock Products
              </Text>
              {lowStockCount > 0 ? (
                <Text as="p" variant="heading3xl" tone="critical">
                  {lowStockCount}
                </Text>
              ) : (
                <Text as="p" variant="heading3xl">
                  {lowStockCount}
                </Text>
              )}
            </BlockStack>
          </LegacyCard>
        </InlineGrid>

        {/* Search + Refresh */}
        <div style={{ display: "flex", gap: "12px", alignItems: "end" }}>
          <div style={{ flex: 1 }}>
            <TextField
              label="Search products or SKU"
              autoComplete="off"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search by product name or SKU..."
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
            />
          </div>
          <Button onClick={handleRefresh}>Refresh</Button>
        </div>

        {/* Error Banner */}
        {error && (
          <LegacyCard sectioned>
            <Text as="p" tone="critical">
              Error loading inventory: {error}
            </Text>
          </LegacyCard>
        )}

        {/* Products Table */}
        <LegacyCard title={`Products (${filteredProducts.length})`}>
          {filteredProducts.length > 0 ? (
            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={filteredProducts.length}
              headings={[
                { title: "Product" },
                { title: "SKU" },
                { title: "Stock" },
                { title: "Variants" },
                { title: "Published" },
                { title: "Stock Status" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          ) : (
            <LegacyCard.Section>
              <Text as="p" tone="subdued">
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : "No inventory data available from Shopify."}
              </Text>
            </LegacyCard.Section>
          )}
        </LegacyCard>
      </BlockStack>
    </Page>
  );
}
