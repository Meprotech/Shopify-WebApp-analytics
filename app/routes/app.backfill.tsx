import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { Page, Card, Button, Banner, Text } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { runBackfill } from "../lib/backfill.server";

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
            ✅ Backfill complete! Total: {result.result.total} | Inserted:{" "}
            {result.result.inserted} | Updated: {result.result.updated}
          </Banner>
        )}

        {result?.success === false && (
          <Banner tone="critical">❌ Error: {result.error}</Banner>
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
