import { useNavigate, useSubmit } from "@remix-run/react";
import {
  BlockStack,
  ChoiceList,
  DataTable,
  Filters,
  LegacyCard,
  Pagination,
  Text,
} from "@shopify/polaris";

export interface OrdersTableOrder {
  orderId: string;
  orderNumber: number | null;
  customer: string;
  createdAt: string;
  totalPrice: number | null;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
}

interface OrdersTableProps {
  orders: OrdersTableOrder[];
  page: number;
  totalPages: number;
  financialStatus: string;
  fulfillmentStatus: string;
  errorMessage: string;
  shop: string;
}

const financialChoices = ["paid", "pending", "refunded", "voided"].map(
  (value) => ({ label: value, value }),
);
const fulfillmentChoices = ["fulfilled", "partial", "unfulfilled"].map(
  (value) => ({ label: value, value }),
);
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});
const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

function formatCurrency(value: number | null): string {
  return currencyFormatter.format(value ?? 0);
}

function pageUrl(
  page: number,
  financialStatus: string,
  fulfillmentStatus: string,
): string {
  const params = new URLSearchParams({ page: String(page) });
  if (financialStatus) {
    params.set("financial_status", financialStatus);
  }
  if (fulfillmentStatus) {
    params.set("fulfillment_status", fulfillmentStatus);
  }
  return `/app/orders?${params.toString()}`;
}

export function OrdersTable({
  orders,
  page,
  totalPages,
  financialStatus,
  fulfillmentStatus,
  errorMessage,
  shop,
}: OrdersTableProps) {
  const submit = useSubmit();
  const navigate = useNavigate();

  function applyFilters(nextFinancial: string, nextFulfillment: string): void {
    const formData = new FormData();
    formData.set("financial_status", nextFinancial);
    formData.set("fulfillment_status", nextFulfillment);
    submit(formData, { method: "post" });
  }

  const filters = [
    {
      key: "financial_status",
      label: "Financial status",
      filter: (
        <ChoiceList
          title="Financial status"
          titleHidden
          choices={financialChoices}
          selected={financialStatus ? [financialStatus] : []}
          onChange={(selected) => applyFilters(selected[0] ?? "", fulfillmentStatus)}
        />
      ),
    },
    {
      key: "fulfillment_status",
      label: "Fulfillment status",
      filter: (
        <ChoiceList
          title="Fulfillment status"
          titleHidden
          choices={fulfillmentChoices}
          selected={fulfillmentStatus ? [fulfillmentStatus] : []}
          onChange={(selected) => applyFilters(financialStatus, selected[0] ?? "")}
        />
      ),
    },
  ];
  const appliedFilters = [
    financialStatus
      ? {
          key: "financial_status",
          label: `Financial: ${financialStatus}`,
          onRemove: () => applyFilters("", fulfillmentStatus),
        }
      : null,
    fulfillmentStatus
      ? {
          key: "fulfillment_status",
          label: `Fulfillment: ${fulfillmentStatus}`,
          onRemove: () => applyFilters(financialStatus, ""),
        }
      : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);
  const rows = orders.map((order) => [
    <a
      key={order.orderId}
      href={`https://${shop}/admin/orders/${order.orderId.split('/').pop()}`}
      target="_top"
      style={{ color: "#008060", textDecoration: "underline", fontWeight: "bold" }}
    >
      {order.orderNumber ? `#${order.orderNumber}` : order.orderId}
    </a>,
    order.customer,
    dateFormatter.format(new Date(order.createdAt)),
    formatCurrency(order.totalPrice),
    order.financialStatus ?? "Unknown",
    order.fulfillmentStatus ?? "Unknown",
  ]);

  return (
    <BlockStack gap="400">
      {errorMessage ? <Text as="p" tone="critical">{errorMessage}</Text> : null}
      <LegacyCard>
        <Filters
          queryValue=""
          filters={filters}
          appliedFilters={appliedFilters}
          onQueryChange={() => undefined}
          onQueryClear={() => undefined}
          onClearAll={() => applyFilters("", "")}
        />
        <DataTable
          columnContentTypes={["text", "text", "text", "numeric", "text", "text"]}
          headings={["Order#", "Customer", "Date", "Total", "Financial", "Fulfillment"]}
          rows={rows}
        />
      </LegacyCard>
      <Pagination
        hasPrevious={page > 1}
        onPrevious={() => navigate(pageUrl(page - 1, financialStatus, fulfillmentStatus))}
        hasNext={page < totalPages}
        onNext={() => navigate(pageUrl(page + 1, financialStatus, fulfillmentStatus))}
      />
    </BlockStack>
  );
}
