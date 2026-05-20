import { useState, useCallback, useEffect } from "react";
import { useSearchParams, useFetcher, useRevalidator } from "@remix-run/react";
import {
  ActionList,
  BlockStack,
  Button,
  Popover,
  TextField,
  Banner,
} from "@shopify/polaris";

export function DashboardHeader() {
  const [searchParams, setSearchParams] = useSearchParams();
  const syncFetcher = useFetcher<any>();
  const revalidator = useRevalidator();

  const [popoverActive, setPopoverActive] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(
    searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined
  );
  const [activeDateRange, setActiveDateRange] = useState<string>("options");
  const [showBanner, setShowBanner] = useState(false);

  const togglePopoverActive = useCallback(() => {
    setPopoverActive((active) => !active);
    if (!popoverActive) setActiveDateRange("options");
  }, [popoverActive]);

  // Show banner and auto-refresh page data after successful sync
  useEffect(() => {
    if (syncFetcher.data) {
      setShowBanner(true);
      if (syncFetcher.data.success) {
        revalidator.revalidate();
      }
    }
  }, [syncFetcher.data, revalidator]);

  const handleRangeSelect = useCallback((range: string) => {
    if (range === "custom") {
      setActiveDateRange("custom");
      return;
    }

    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (range === "today") {
      start = today;
    } else if (range === "yesterday") {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
    } else if (range === "last7") {
      start = new Date(today);
      start.setDate(today.getDate() - 6);
    } else if (range === "last30") {
      start = new Date(today);
      start.setDate(today.getDate() - 29);
    } else if (range === "thisMonth") {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    setStartDate(start);
    setEndDate(end);

    const params = new URLSearchParams(searchParams);
    params.set("startDate", start.toISOString().split('T')[0]);
    params.set("endDate", end.toISOString().split('T')[0]);
    setSearchParams(params);
    setPopoverActive(false);
  }, [searchParams, setSearchParams]);

  const applyFilter = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (startDate) {
      params.set("startDate", startDate.toISOString().split('T')[0]);
    } else {
      params.delete("startDate");
    }
    if (endDate) {
      params.set("endDate", endDate.toISOString().split('T')[0]);
    } else {
      params.delete("endDate");
    }
    setSearchParams(params);
    setPopoverActive(false);
  }, [startDate, endDate, searchParams, setSearchParams]);

  const clearFilter = useCallback(() => {
    setStartDate(undefined);
    setEndDate(undefined);
    const params = new URLSearchParams(searchParams);
    params.delete("startDate");
    params.delete("endDate");
    setSearchParams(params);
    setPopoverActive(false);
  }, [searchParams, setSearchParams]);

  const isSyncing = syncFetcher.state !== "idle";

  const handleSync = useCallback(() => {
    setShowBanner(false);
    syncFetcher.submit(null, { method: "POST", action: "/app/backfill" });
  }, [syncFetcher]);

  return (
    <div>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: "12px",
        flexWrap: "wrap",
        width: "100%",
      }}>
        {/* Sync Store Button */}
        <Button
          variant="primary"
          loading={isSyncing}
          onClick={handleSync}
        >
          {isSyncing ? "Syncing..." : "Sync Store"}
        </Button>

        {/* Date Filter Button */}
        <Popover
          active={popoverActive}
          activator={
            <Button onClick={togglePopoverActive} disclosure>
              {startDate || endDate ? "Edit Date Filter" : "Filter by Date"}
            </Button>
          }
          onClose={togglePopoverActive}
        >
          <div style={{ minWidth: "250px" }}>
            {activeDateRange === "options" ? (
              <ActionList
                actionRole="menuitem"
                items={[
                  { content: 'Custom', onAction: () => handleRangeSelect('custom') },
                  { content: 'Today', onAction: () => handleRangeSelect('today') },
                  { content: 'Yesterday', onAction: () => handleRangeSelect('yesterday') },
                  { content: 'Last 7 days', onAction: () => handleRangeSelect('last7') },
                  { content: 'Last 30 days', onAction: () => handleRangeSelect('last30') },
                  { content: 'This month', onAction: () => handleRangeSelect('thisMonth') },
                  { content: 'Clear', onAction: clearFilter, destructive: true },
                ]}
              />
            ) : (
              <div style={{ padding: "16px" }}>
                <BlockStack gap="400">
                  <TextField
                    label="Start Date"
                    type="date"
                    autoComplete="off"
                    value={startDate ? startDate.toISOString().split('T')[0] : ""}
                    onChange={(value) => setStartDate(value ? new Date(value) : undefined)}
                  />
                  <TextField
                    label="End Date"
                    type="date"
                    autoComplete="off"
                    value={endDate ? endDate.toISOString().split('T')[0] : ""}
                    onChange={(value) => setEndDate(value ? new Date(value) : undefined)}
                  />
                  <BlockStack gap="200">
                    <Button onClick={applyFilter} variant="primary" fullWidth>
                      Apply Filter
                    </Button>
                    <Button onClick={() => setActiveDateRange("options")} fullWidth>
                      Back to Presets
                    </Button>
                    <Button onClick={clearFilter} fullWidth>
                      Clear Filter
                    </Button>
                  </BlockStack>
                </BlockStack>
              </div>
            )}
          </div>
        </Popover>
      </div>

      {/* Sync Result Banner */}
      {showBanner && syncFetcher.data?.success && (
        <div style={{ marginTop: "12px" }}>
          <Banner tone="success" onDismiss={() => setShowBanner(false)}>
            Store sync complete! Total orders checked: {syncFetcher.data.total} | Inserted: {syncFetcher.data.inserted} | Updated: {syncFetcher.data.updated}
          </Banner>
        </div>
      )}
      {showBanner && syncFetcher.data?.success === false && (
        <div style={{ marginTop: "12px" }}>
          <Banner tone="critical" title="Sync failed" onDismiss={() => setShowBanner(false)}>
            <p>{syncFetcher.data.error || "An unknown error occurred."}</p>
          </Banner>
        </div>
      )}
    </div>
  );
}
