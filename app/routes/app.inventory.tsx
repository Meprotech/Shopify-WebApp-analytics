import { type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect } from "react";
import { authenticate } from "../lib/shopify.server";

const INVENTORY_URL =
  "https://admin.shopify.com/store/meprotech-dev/products/inventory?location_id=80971563169";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return { url: INVENTORY_URL };
}

export default function InventoryRedirect() {
  const { url } = useLoaderData<typeof loader>();

  useEffect(() => {
    if (window.top) {
      window.top.location.href = url;
    } else {
      window.location.href = url;
    }
  }, [url]);

  return (
    <p style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
      Redirecting to Shopify Inventory...
    </p>
  );
}
