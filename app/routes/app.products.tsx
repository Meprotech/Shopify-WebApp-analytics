import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { BlockStack, Frame, Page, Text, Toast } from "@shopify/polaris";
import { useEffect, useState } from "react";

import { ProductCostList } from "../components/ProductCostList";
import { authenticate } from "../lib/shopify.server";
import { isSupabaseConfigured, supabase } from "../lib/supabase.server";

interface ActionData {
  status: "success" | "error";
  message: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  if (!isSupabaseConfigured) {
    return json({
      products: [],
      errorMessage: "",
    });
  }

  const { data, error } = await supabase
    .from("product_costs")
    .select("*")
    .order("product_title", { ascending: true });

  if (error) {
    console.error("Failed to load product costs", error);
  }

  return json({
    products: data ?? [],
    errorMessage: error ? "Product costs could not be loaded." : "",
  });
}

export async function action({ request }: ActionFunctionArgs) {
  await authenticate.admin(request);

  const formData = await request.formData();
  const productId = String(formData.get("product_id") ?? "");
  const costPrice = Number.parseFloat(String(formData.get("cost_price") ?? ""));

  if (!productId || !Number.isFinite(costPrice) || costPrice < 0) {
    return json<ActionData>({
      status: "error",
      message: "Enter a valid non-negative cost price.",
    });
  }

  if (!isSupabaseConfigured) {
    return json<ActionData>({
      status: "error",
      message: "Connect Supabase before saving product costs.",
    });
  }

  const { error } = await supabase
    .from("product_costs")
    .update({ cost_price: costPrice })
    .eq("product_id", productId);

  if (error) {
    console.error(`Failed to update cost for product ${productId}`, error);
    return json<ActionData>({
      status: "error",
      message: "Cost price could not be saved.",
    });
  }

  return json<ActionData>({ status: "success", message: "Cost price saved." });
}

export default function ProductsCostManager() {
  const { products, errorMessage } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [costs, setCosts] = useState<Record<string, string>>({});

  useEffect(() => {
    setCosts(
      Object.fromEntries(
        products.map((product) => [
          product.product_id,
          String(product.cost_price ?? 0),
        ]),
      ),
    );
  }, [products]);

  useEffect(() => {
    if (actionData?.message) {
      setToastMessage(actionData.message);
    }
  }, [actionData]);

  return (
    <Frame>
      <Page title="Product Costs">
        <BlockStack gap="400">
          {errorMessage ? <Text as="p" tone="critical">{errorMessage}</Text> : null}
          <ProductCostList
            products={products}
            costs={costs}
            onCostChange={(productId, value) =>
              setCosts((current) => ({ ...current, [productId]: value }))
            }
          />
        </BlockStack>
      </Page>
      {toastMessage ? (
        <Toast content={toastMessage} onDismiss={() => setToastMessage(null)} />
      ) : null}
    </Frame>
  );
}
