import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { Page, Card, Button, Banner, Text } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { runBackfill } from "../lib/backfill.server";

const PROTECTED_CUSTOMER_DATA_URL =
  "https://shopify.dev/docs/apps/launch/protected-customer-data";

function isProtectedCustomerDataError(error: string | undefined): boolean {
  return Boolean(
    error?.includes("not approved to access the Order object") ||
      error?.includes("protected-customer-data"),
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await runBackfill(admin);
    return json({ success: true, result });
  } catch (error) {
    return json({ success: false, error: String(error) });
  }
}

export default function BackfillPage() {
  const fetcher = useFetcher<typeof action>();
  const isLoading = fetcher.state === "submitting";
  const result = fetcher.data;

  return (
    <Page title="Data Backfill">
      <Card>
        <Text as="p" variant="bodyMd">
          Click the button below to import all historical orders from Shopify
          into your Supabase database.
        </Text>
        <br />

        {result?.success && (
          <Banner tone="success">
            Backfill complete! Total: {result.result.total} | Inserted:{" "}
            {result.result.inserted} | Updated: {result.result.updated}
          </Banner>
        )}

        {result?.success === false &&
          isProtectedCustomerDataError(result.error) && (
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
                For development-store testing, Shopify allows access after you
                select the required data and fields in the Partner Dashboard.
                Then reinstall the app so the updated permission grant is used.
              </Text>
              <br />
              <Text as="p" variant="bodyMd">
                Shopify docs: {PROTECTED_CUSTOMER_DATA_URL}
              </Text>
            </Banner>
          )}

        {result?.success === false &&
          !isProtectedCustomerDataError(result.error) && (
            <Banner tone="critical">Error: {result.error}</Banner>
          )}

        <br />
        <fetcher.Form method="post">
          <Button variant="primary" loading={isLoading} submit>
            {isLoading ? "Importing Orders..." : "Start Backfill"}
          </Button>
        </fetcher.Form>
      </Card>
    </Page>
  );
}
