import { redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  return redirect(`https://${shop}/admin/inventory`);
}

export default function InventoryRedirect() {
  return null;
}
