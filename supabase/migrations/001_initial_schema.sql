create extension if not exists pgcrypto;

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text unique not null,
  order_number integer,
  total_price numeric(10, 2),
  subtotal_price numeric(10, 2),
  customer_email text,
  customer_name text,
  financial_status text,
  fulfillment_status text,
  items_json jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.product_costs (
  id uuid primary key default gen_random_uuid(),
  product_id text unique not null,
  product_title text,
  cost_price numeric(10, 2) default 0,
  created_at timestamptz default now()
);

create index if not exists store_orders_order_number_idx
  on public.store_orders (order_number);

create index if not exists store_orders_customer_email_idx
  on public.store_orders (customer_email);

create index if not exists store_orders_created_at_idx
  on public.store_orders (created_at desc);

create index if not exists store_orders_financial_status_idx
  on public.store_orders (financial_status);

create index if not exists store_orders_fulfillment_status_idx
  on public.store_orders (fulfillment_status);

create index if not exists store_orders_items_json_gin_idx
  on public.store_orders using gin (items_json);

create index if not exists product_costs_product_title_idx
  on public.product_costs (product_title);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_orders_set_updated_at on public.store_orders;

create trigger store_orders_set_updated_at
before update on public.store_orders
for each row
execute function public.set_updated_at();

alter table public.store_orders enable row level security;
alter table public.product_costs enable row level security;

drop policy if exists "service_role_store_orders_all" on public.store_orders;
drop policy if exists "service_role_product_costs_all" on public.product_costs;

create policy "service_role_store_orders_all"
on public.store_orders
for all
to service_role
using (true)
with check (true);

create policy "service_role_product_costs_all"
on public.product_costs
for all
to service_role
using (true)
with check (true);

revoke all on public.store_orders from anon, authenticated;
revoke all on public.product_costs from anon, authenticated;
grant all on public.store_orders to service_role;
grant all on public.product_costs to service_role;
