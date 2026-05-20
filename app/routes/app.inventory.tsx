import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Button, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  return json({ shop });
}

export default function InventoryPage() {
  const { shop } = useLoaderData<typeof loader>();

  const inventoryUrl = `https://${shop}/admin/inventory`;

  return (
    <Page title="Inventory">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Manage your inventory directly in Shopify admin. Click the button below to open
            the Shopify inventory management page.
          </Text>
          <div>
            <a
              href={inventoryUrl}
              target="_top"
              style={{ textDecoration: "none" }}
            >
              <Button variant="primary">
                Open Shopify Inventory
              </Button>
            </a>
          </div>
        </BlockStack>
      </Card>
    </Page>
  );
}
