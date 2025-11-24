import { MenuBarExtra, Icon, Color, open } from "@raycast/api";
import { useFetch } from "@raycast/utils";

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

  const percent = data?.migration_data.percent_completed;
  const status = data?.migration_data.status;
  const details = data?.migration_data.migration_details;

  // Format percentage to 2 decimal places if it exists
  const title = percent !== undefined ? `${percent.toFixed(2)}%` : "Loading...";

  // Determine icon color based on status
  const iconColor = percent === 100 ? Color.Green : Color.Orange;

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
              icon={Icon.CircleProgress}
            />
            <MenuBarExtra.Item
              title="Last Updated"
              subtitle={new Date(data.last_updated).toLocaleString()}
            />
          </MenuBarExtra.Section>

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
              title="MPDMs"
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
