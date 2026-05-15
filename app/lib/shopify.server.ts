import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
  type AdminApiContext,
} from "@shopify/shopify-app-remix/server";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import path from "path";

interface GraphqlError {
  message: string;
}

interface GraphqlEnvelope<TData> {
  data?: TData;
  errors?: GraphqlError[];
}

type GraphqlVariables = Record<string, unknown>;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getRetryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  const parsedRetryAfter = retryAfter ? Number.parseFloat(retryAfter) : NaN;
  if (Number.isFinite(parsedRetryAfter) && parsedRetryAfter > 0) {
    return parsedRetryAfter * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 10_000);
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const record = error as Record<string, unknown>;
  const response = record.response;
  if (typeof response === "object" && response !== null) {
    const status = (response as Record<string, unknown>).status;
    return typeof status === "number" ? status : undefined;
  }
  const status = record.status;
  return typeof status === "number" ? status : undefined;
}

const sessionDb = path.join(process.cwd(), "sessions.sqlite");

export const shopify = shopifyApp({
  apiKey: requireEnv("SHOPIFY_API_KEY"),
  apiSecretKey: requireEnv("SHOPIFY_API_SECRET"),
  apiVersion: ApiVersion.October24,
  appUrl: requireEnv("SHOPIFY_APP_URL"),
  authPathPrefix: "/auth",
  distribution: AppDistribution.AppStore,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
  isEmbeddedApp: true,
  sessionStorage: new SQLiteSessionStorage(sessionDb),
  scopes: ["read_orders", "read_all_orders", "read_products", "write_products", "read_customers"],
});

export const authenticate = shopify.authenticate;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;

export async function adminGraphql<TData>(
  admin: AdminApiContext,
  query: string,
  variables?: GraphqlVariables,
  maxAttempts = 5,
): Promise<TData> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await admin.graphql(query, { variables });

      if (response.status === 429 && attempt < maxAttempts - 1) {
        await delay(getRetryDelay(response, attempt));
        continue;
      }

      const payload = (await response.json()) as GraphqlEnvelope<TData>;

      if (payload.errors && payload.errors.length > 0) {
        throw new Error(
          payload.errors.map((error) => error.message).join("; "),
        );
      }

      if (!payload.data) {
        throw new Error("Shopify GraphQL response did not include data.");
      }

      return payload.data;
    } catch (error) {
      const status = getErrorStatus(error);

      if (status === 429 && attempt < maxAttempts - 1) {
        await delay(Math.min(1000 * 2 ** attempt, 10_000));
        continue;
      }

      throw error;
    }
  }

  throw new Error("Shopify GraphQL request failed after all retry attempts.");
}

export default shopify;
