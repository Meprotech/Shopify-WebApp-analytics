import type { LoaderFunctionArgs } from "@remix-run/node";

import shopify from "../lib/shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  if (!url.searchParams.get("shop")) {
    url.searchParams.set(
      "shop",
      process.env.SHOPIFY_SHOP_DOMAIN ?? "meprotech-dev.myshopify.com",
    );
    return shopify.login(new Request(url, request));
  }

  return shopify.login(request);
}
