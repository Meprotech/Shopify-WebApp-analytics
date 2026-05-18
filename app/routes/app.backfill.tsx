import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { Page, Card, Button, Banner, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../lib/shopify.server";
import { runBackfill } from "../lib/backfill.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  // Read result from URL params set after action redirect
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const total = url.searchParams.get("total");
  const inserted = url.searchParams.get("inserted");
  const updated = url.searchParams.get("updated");
  const error = url.searchParams.get("error");

  return json({ status, total, inserted, updated, error });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  try {
    const result = await runBackfill(admin);
    return redirect(
      `/app/backfill?status=success&total=${result.total}&inserted=${result.inserted}&updated=${result.updated}`
    );
  } catch (error) {
    if (error instanceof Response) throw error;
    const message = encodeURIComponent(
      error instanceof Error ? error.message : String(error)
    );
    return redirect(`/app/backfill?status=error&error=${message}`);
  }
}

export default function BackfillPage() {
  const { status, total, inserted, updated, error } = useLoaderData<typeof loader>();

  return (
    <Page title="Data Backfill">
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd">
            Click the button below to import all historical orders from Shopify
            into your Supabase database. This will sync any orders that were
            missed due to webhook failures.
          </Text>

          {status === "success" && (
            <Banner tone="success">
              ✅ Backfill complete! Total: {total} | Inserted: {inserted} | Updated: {updated}
            </Banner>
          )}

          {status === "error" && (
            <Banner tone="critical" title="Backfill failed">
              <Text as="p" variant="bodyMd">
                {error
                  ? decodeURIComponent(error)
                  : "An unknown error occurred."}
              </Text>
              {error?.includes("not approved") && (
                <>
                  <br />
                  <Text as="p" variant="bodyMd">
                    Go to your Shopify Partner Dashboard → this app → API access
                    requests → request Protected customer data access, then
                    reinstall the app.
                  </Text>
                </>
              )}
            </Banner>
          )}

          <Form method="post">
            <Button variant="primary" submit>
              Start Backfill
            </Button>
          </Form>
        </BlockStack>
      </Card>
    </Page>
  );
}
