import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { authenticate, shopify } from "../lib/shopify.server";
import { DashboardHeader } from "../components/DashboardHeader";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  try {
    await shopify.registerWebhooks({ session });
    console.log("Webhooks registered successfully");
  } catch (err) {
    console.error("Failed to register webhooks programmatically:", err);
  }
  
  return json({ shop: session.shop });
}

export default function EmbeddedAppLayout() {
  return (
    <>
      <div style={{
        display: "flex",
        justifyContent: "flex-end",
        padding: "16px 20px 0 20px",
        gap: "12px",
      }}>
        <DashboardHeader />
      </div>
      <Outlet />
    </>
  );
}
