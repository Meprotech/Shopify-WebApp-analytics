import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Button, Banner, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { useState } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  // Pass the API secret to the client so we can call /api/backfill
  return json({ apiSecret: process.env.SHOPIFY_API_SECRET });
}

export default function BackfillPage() {
  const { apiSecret } = useLoaderData<typeof loader>();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<null | { success: boolean; total?: number; inserted?: number; updated?: number; error?: string }>(null);

  async function handleBackfill() {
    setIsLoading(true);
    setResult(null);
    try {
      // Call our standalone API endpoint that bypasses App Bridge
      const response = await fetch(`/api/backfill?secret=${encodeURIComponent(apiSecret || "")}`, {
        method: "GET",
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Page title="Data Backfill">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Click the button below to import all historical orders from Shopify
            into your Supabase database. This will sync any orders missed due
            to webhook failures (e.g., recently added orders not appearing in
            the dashboard).
          </Text>

          {result?.success && (
            <Banner tone="success">
              ✅ Backfill complete! Total: {result.total} | Inserted: {result.inserted} | Updated: {result.updated}
            </Banner>
          )}

          {result?.success === false && (
            <Banner tone="critical" title="Backfill failed">
              <Text as="p" variant="bodyMd">
                {result.error || "An unknown error occurred."}
              </Text>
              {result.error?.includes("offline") && (
                <>
                  <br />
                  <Text as="p" variant="bodyMd">
                    Tip: Make sure you have opened this app from the Shopify Admin
                    at least once to generate an offline access token.
                  </Text>
                </>
              )}
            </Banner>
          )}

          <div>
            <Button
              variant="primary"
              loading={isLoading}
              onClick={handleBackfill}
            >
              {isLoading ? "Importing Orders..." : "Start Backfill"}
            </Button>
          </div>
        </BlockStack>
      </Card>
    </Page>
  );
}
