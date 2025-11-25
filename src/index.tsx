import { MenuBarExtra, Icon, Color, open, Cache } from "@raycast/api";
import { getProgressIcon, useFetch } from "@raycast/utils";
import { useState, useEffect, useMemo } from "react";

const cache = new Cache();

interface HistoryItem {
  timestamp: number;
  percent: number;
}

interface MigrationStatus {
  migration: string;
  users: string;
  files: string;
  dms: string;
  mpdms: string;
}

interface MigrationDetails {
  date_scheduled: number;
  date_finished: number;
  date_started: number;
}

interface MigrationData {
  ok: boolean;
  migration_id: number;
  status: MigrationStatus;
  percent_completed: number;
  migration_details: MigrationDetails;
}

interface ApiResponse {
  migration_data: MigrationData;
  last_updated: string;
}

export default function Command() {
  const { isLoading, data, revalidate } = useFetch<ApiResponse>(
    "https://are-we-there-yet.hackclub.com/api/status",
  );

  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const cached = cache.get("migration_history");
    if (cached) {
      try {
        setHistory(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!data) return;

    const currentPercent = data.migration_data.percent_completed;
    const timestamp = new Date(data.last_updated).getTime();

    setHistory((prev) => {
      const lastItem = prev[prev.length - 1];

      if (lastItem) {
        // If percent drops, it's likely a new migration or reset
        if (currentPercent < lastItem.percent) {
          const newHistory = [{ timestamp, percent: currentPercent }];
          cache.set("migration_history", JSON.stringify(newHistory));
          return newHistory;
        }
        // If same percent, don't add duplicate
        if (lastItem.percent === currentPercent) {
          return prev;
        }
      }

      const newHistory = [...prev, { timestamp, percent: currentPercent }];
      cache.set("migration_history", JSON.stringify(newHistory));
      return newHistory;
    });
  }, [data]);

  const estimate = useMemo(() => {
    if (history.length < 2) return null;

    const first = history[0];
    const last = history[history.length - 1];

    const timeDiff = last.timestamp - first.timestamp;
    const percentDiff = last.percent - first.percent;

    if (percentDiff <= 0 || timeDiff <= 0) return null;

    const msPerPercent = timeDiff / percentDiff;
    const remainingPercent = 100 - last.percent;
    const remainingMs = remainingPercent * msPerPercent;

    return {
      remainingMs,
      completionDate: new Date(last.timestamp + remainingMs),
    };
  }, [history]);

  const percent = data?.migration_data.percent_completed;
  const status = data?.migration_data.status;
  const details = data?.migration_data.migration_details;

  // Format percentage to 2 decimal places if it exists
  const title = percent !== undefined ? `${percent.toFixed(2)}%` : "Loading...";

  // Determine icon color based on status
  let iconColor = Color.SecondaryText;
  if (percent !== undefined) {
    if (percent === 100) {
      iconColor = Color.Green;
    } else if (percent >= 66) {
      iconColor = Color.Yellow;
    } else if (percent >= 33) {
      iconColor = Color.Orange;
    } else {
      iconColor = Color.Red;
    }
  }

  return (
    <MenuBarExtra
      isLoading={isLoading}
      icon={{ source: Icon.Cloud, tintColor: iconColor }}
      title={title}
      tooltip="Slack Migration Status"
    >
      {data && (
        <>
          <MenuBarExtra.Section title="Migration Progress">
            <MenuBarExtra.Item
              title="Percent Completed"
              subtitle={`${percent}%`}
              icon={getProgressIcon(percent! / 100, Color.SecondaryText)}
            />
            <MenuBarExtra.Item
              title="Last Updated"
              subtitle={new Date(data.last_updated).toLocaleString()}
            />
          </MenuBarExtra.Section>

          {estimate && (
            <MenuBarExtra.Section title="Estimates">
              <MenuBarExtra.Item
                title="Estimated Completion"
                subtitle={estimate.completionDate.toLocaleString()}
                icon={Icon.Calendar}
              />
              <MenuBarExtra.Item
                title="Time Remaining"
                subtitle={formatDuration(estimate.remainingMs)}
                icon={Icon.Clock}
              />
            </MenuBarExtra.Section>
          )}

          <MenuBarExtra.Section title="Status Details">
            <MenuBarExtra.Item
              title="Overall Migration"
              subtitle={`- ${formatStatus(status?.migration)}`}
              icon={getStatusIcon(status?.migration)}
            />
            <MenuBarExtra.Item
              title="Users"
              subtitle={`- ${formatStatus(status?.users)}`}
              icon={getStatusIcon(status?.users)}
            />
            <MenuBarExtra.Item
              title="Files"
              subtitle={`- ${formatStatus(status?.files)}`}
              icon={getStatusIcon(status?.files)}
            />
            <MenuBarExtra.Item
              title="DMs"
              subtitle={`- ${formatStatus(status?.dms)}`}
              icon={getStatusIcon(status?.dms)}
            />
            <MenuBarExtra.Item
              title="Group DMs"
              subtitle={`- ${formatStatus(status?.mpdms)}`}
              icon={getStatusIcon(status?.mpdms)}
            />
          </MenuBarExtra.Section>

          <MenuBarExtra.Section title="Timeline">
            <MenuBarExtra.Item
              title="Started"
              subtitle={formatDate(details?.date_started)}
            />
            <MenuBarExtra.Item
              title="Scheduled"
              subtitle={formatDate(details?.date_scheduled)}
            />
            <MenuBarExtra.Item
              title="Finished"
              subtitle={
                details?.date_finished
                  ? formatDate(details.date_finished)
                  : "Not yet"
              }
            />
          </MenuBarExtra.Section>

          <MenuBarExtra.Section>
            <MenuBarExtra.Item
              title="Open Dashboard"
              icon={Icon.Globe}
              onAction={() => open("https://are-we-there-yet.hackclub.com")}
            />
            <MenuBarExtra.Item
              title="Reload"
              icon={Icon.ArrowClockwise}
              onAction={() => revalidate()}
            />
          </MenuBarExtra.Section>
        </>
      )}
    </MenuBarExtra>
  );
}

function getStatusIcon(status?: string) {
  switch (status) {
    case "complete":
    case "completed":
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    case "in_progress":
      return { source: Icon.CircleProgress, tintColor: Color.Blue };
    case "not_started":
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
    case "failed":
      return { source: Icon.XMarkCircle, tintColor: Color.Red };
    default:
      return Icon.Circle;
  }
}

function formatDate(timestamp?: number) {
  if (!timestamp) return "-";
  // API seems to return unix timestamp in seconds based on 1764001800 (year 2025)
  return new Date(timestamp * 1000).toLocaleString();
}

function formatStatus(status?: string) {
  if (!status) return "-";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDuration(ms: number) {
  if (ms < 0) return "Unknown";
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  if (parts.length === 0) return "< 1m";

  return parts.join(" ");
}
