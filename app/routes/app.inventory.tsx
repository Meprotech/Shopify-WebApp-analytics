import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../lib/shopify.server";

const INVENTORY_URL =
  "https://admin.shopify.com/store/meprotech-dev/products/inventory?location_id=80971563169";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return redirect(INVENTORY_URL);
}

export default function InventoryRedirect() {
  return null;
}
