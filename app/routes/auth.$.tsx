import type { LoaderFunctionArgs } from "@remix-run/node";

import { authenticate } from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  return null;
}
