import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { supabase } from "../lib/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Query the latest updated_at timestamp from store_orders
  const { data, error } = await supabase
    .from("store_orders")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Failed to query latest updated_at timestamp:", error);
    return json({ timestamp: null, count: 0 }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      }
    });
  }

  // Query the total count of store_orders
  const { count, error: countError } = await supabase
    .from("store_orders")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Failed to query store_orders count:", countError);
  }

  const timestamp = data?.[0]?.updated_at ?? null;

  return json({
    timestamp,
    count: count ?? 0
  }, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    }
  });
}
