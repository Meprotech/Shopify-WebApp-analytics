# 📊 Shopify Analytics & Order Sync Dashboard

A production-grade, high-performance Shopify embedded analytics application built with **Remix**, **React**, **Shopify Polaris**, **Supabase (PostgreSQL)**, and hosted on **Vercel**. 

This application provides real-time financial reporting, order tracking, customer lifetime value (LTV) calculations, and automated background data synchronization between Shopify and a high-performance Supabase PostgreSQL database.

---

## 🌟 Key Features & Recent Architectural Upgrades

### 1. 🔄 Automated & Manual Order Synchronization
- **Background GraphQL Sync**: Integrated a dedicated **"Sync Latest Orders"** secondary action directly into the main Analytics Dashboard (`app/routes/app._index.tsx`). Bypassing App Bridge restrictions, it utilizes Remix's `useFetcher` to seamlessly query the 50 most recent orders via Shopify's Admin GraphQL API and upsert them into Supabase in the background.
- **Dynamic UI Feedback**: The sync button dynamically updates its label to `"Syncing..."` while active.
- **Clean Auto-Refresh (`useRevalidator`)**: Wrapped Remix's `revalidator.revalidate()` inside a React `useEffect` hook to automatically refresh left-side orders and dashboard KPIs immediately upon successful sync completion, eliminating full page reloads and React render-time warnings.
- **Standalone API Backfill Route**: Created `/api/backfill` (`app/routes/api.backfill.tsx`) to support secure, server-to-server historical data ingestion using offline Shopify access tokens stored in PostgreSQL.

### 2. 🗄️ Database Connection Pooling & Session Mode Optimization
- **Supavisor Session Mode (`:5432`)**: Resolved Vercel serverless cold-start timeouts (`EAUTHTIMEOUT` / `pg-pool` hangs) by reconfiguring `DATABASE_URL` to point to Supabase Supavisor's **Session Mode** port (`5432`). This maintains 100% direct PostgreSQL compatibility, allowing `@shopify/shopify-app-session-storage-postgresql` to perform initial schema checks and table creations without pooler lockups.
- **Enforced SSL**: Configured `?sslmode=require` across local `.env` and Vercel production environments for encrypted, reliable AWS connection pooling.

### 3. 🖥️ Streamlined Navigation & Polaris UI
- **Consolidated Navigation**: Removed redundant external backfill links from `app/root.tsx` to maintain a pristine, focused top navigation bar (`Dashboard` & `Delivery Status`).
- **Hydration Mismatch Fixes**: Adjusted Polaris `<Page>` titles across routes to eliminate server-vs-client HTML mismatch errors (`#418` / `#425`).

### 4. 📈 Advanced Analytics & KPI Calculations
- **Net Profit & Revenue Tracking**: Computes monthly gross revenue, discounts, refunds, shipping costs, and estimated net profit.
- **Customer Lifetime Value (LTV)**: Ranks top customers by total spend and order frequency.
- **Order Fulfillment & Payment Status**: Interactive popover badges to update order statuses on the fly.

---

## 🏗️ Project Structure & Key Files

```text
x:\Dashboard Analytics\shopify-analytics-app\
├── app/
│   ├── components/
│   │   ├── DashboardCards.tsx       # KPI metric cards (Revenue, Orders, LTV, AOV)
│   │   └── TopProductsCard.tsx      # Best-selling products & inventory tracking
│   ├── lib/
│   │   ├── analytics.server.ts      # Core Supabase SQL aggregations & KPI logic
│   │   ├── shopify.server.ts        # Shopify App configuration & PostgreSQL session storage
│   │   ├── supabase.server.ts       # Supabase client initialization
│   │   └── webhook-orders.server.ts # Webhook processing & HMAC verification
│   ├── routes/
│   │   ├── app._index.tsx           # Main Analytics Dashboard & Sync Action
│   │   ├── app.backfill.tsx         # Standalone backfill UI view
│   │   └── api.backfill.tsx         # Direct GraphQL sync API endpoint
│   ├── styles/
│   │   └── custom.css               # Vanilla CSS styling & overrides
│   └── root.tsx                     # Global App layout & NavMenu
├── shopify.app.toml                 # Shopify CLI configuration & Webhook subscriptions
├── package.json                     # Project dependencies & deployment scripts
└── .env                             # Environment configuration (Keys, DB URLs)
```

---

## 🚀 Deployment & CLI Management

The project is configured for automated deployments to **Vercel** with integrated npm helper scripts.

### Deploying to Production
To push your latest commits to GitHub and deploy to Vercel simultaneously:
```bash
npm run push-deploy
```
*Note: If running Vercel CLI commands directly in PowerShell on Windows, use `npx vercel` to ensure the local binary in `node_modules/.bin` is correctly executed.*

### Checking Live Vercel Logs
To inspect real-time serverless function logs and debug 500 errors:
```bash
npx vercel logs --no-branch --status-code 500 --limit 50 --expand
```

### Pulling Vercel Environment Variables
To keep your local `.env` file fully synchronized with production:
```bash
npx vercel env pull .env.production --environment production --yes
```

---

## 🛠️ Environment Configuration (`.env`)

Ensure the following variables are present in your local `.env` and Vercel project settings:

```env
SHOPIFY_API_KEY="your_shopify_api_key"
SHOPIFY_API_SECRET="your_shopify_api_secret"
SHOPIFY_APP_URL="https://dashboard-analytics-mu.vercel.app"
SCOPES="read_orders,write_orders,read_products"
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require"
SUPABASE_URL="https://[project-ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"
SESSION_SECRET="your_secure_session_secret"
SHOPIFY_SHOP_DOMAIN="your-store.myshopify.com"
```

---

## 🤝 Contributing & Maintenance
- **Adding New Webhooks**: Update `shopify.app.toml` under `[[webhooks.subscriptions]]` and run `npm run deploy` to update the Shopify app configuration.
- **Modifying KPIs**: Edit `app/lib/analytics.server.ts` to introduce new SQL queries or filtering dimensions.
