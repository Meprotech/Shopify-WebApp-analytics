import type { LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { authenticate, shopify } from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  try {
    await shopify.registerWebhooks({ session });
    console.log("Webhooks registered successfully");
  } catch (err) {
    console.error("Failed to register webhooks programmatically:", err);
  }
  
  return null;
}

export default function EmbeddedAppLayout() {
  return <Outlet />;
}
