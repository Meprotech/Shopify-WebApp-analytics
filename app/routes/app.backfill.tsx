import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { Page, Card, Button, Banner, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { runBackfill } from "../lib/backfill.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return json({});
}

const PROTECTED_CUSTOMER_DATA_URL =
  "https://shopify.dev/docs/apps/launch/protected-customer-data";

function isProtectedCustomerDataError(error: string | undefined): boolean {
  return Boolean(
    error?.includes("not approved to access the Order object") ||
      error?.includes("protected-customer-data"),
  );
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { admin } = await authenticate.admin(request);
    const result = await runBackfill(admin);
    return json({ success: true, result, error: null });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("Backfill failed:", message);
    return json({ success: false, result: null, error: message });
  }
}

export default function BackfillPage() {
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state === "submitting";
  const result = fetcher.data;

  return (
    <Page title="Data Backfill">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Click the button below to import all historical orders from Shopify
            into your Supabase database. This will sync orders that were missed
            due to webhook failures.
          </Text>

          {result?.success && (
            <Banner tone="success">
              Backfill complete! Total: {result.result?.total} | Inserted:{" "}
              {result.result?.inserted} | Updated: {result.result?.updated}
            </Banner>
          )}

          {result?.success === false &&
            isProtectedCustomerDataError(result.error ?? undefined) && (
              <Banner tone="critical" title="Shopify order access is not approved">
                <Text as="p" variant="bodyMd">
                  This app already requests the read_orders scope, but Shopify also
                  requires Protected customer data access before an app can read
                  Order records. In your Shopify Partner Dashboard, open this app,
                  go to API access requests, request Protected customer data
                  access, and select the order/customer fields used by the app.
                </Text>
                <br />
                <Text as="p" variant="bodyMd">
                  Shopify docs: {PROTECTED_CUSTOMER_DATA_URL}
                </Text>
              </Banner>
            )}

          {result?.success === false &&
            !isProtectedCustomerDataError(result.error ?? undefined) && (
              <Banner tone="critical" title="Backfill failed">
                <Text as="p" variant="bodyMd">
                  {result.error || "An unknown error occurred."}
                </Text>
              </Banner>
            )}

          <fetcher.Form method="post">
            <Button variant="primary" loading={isLoading} submit>
              {isLoading ? "Importing Orders..." : "Start Backfill"}
            </Button>
          </fetcher.Form>
        </BlockStack>
      </Card>
    </Page>
  );
}
