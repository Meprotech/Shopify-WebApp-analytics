import { createClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrderRow = {
  id: string;
  order_id: string;
  order_number: number | null;
  total_price: number | null;
  subtotal_price: number | null;
  customer_email: string | null;
  customer_name: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  items_json: Json | null;
  created_at: string;
  updated_at: string;
};

export type ProductCostRow = {
  id: string;
  product_id: string;
  product_title: string | null;
  cost_price: number | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      store_orders: {
        Row: OrderRow;
        Insert: Omit<OrderRow, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<OrderRow, "id" | "created_at">>;
        Relationships: [];
      };
      product_costs: {
        Row: ProductCostRow;
        Insert: Omit<ProductCostRow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<ProductCostRow, "id" | "created_at">>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseServiceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

export const isSupabaseConfigured =
  !supabaseUrl.includes("example.supabase.co") &&
  supabaseServiceRoleKey !== "local-dev-service-role-key";

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
