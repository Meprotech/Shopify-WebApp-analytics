import type { ActionFunctionArgs } from "@remix-run/node";

import { authenticate } from "../lib/shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`Compliance webhook received: ${topic} from ${shop}`);
  return new Response("OK", { status: 200 });
}
