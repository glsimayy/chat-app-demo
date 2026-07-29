import { AdminOverview } from "../../../api/adminMonitoring";

export interface AdminOverviewLiveDelta {
  httpRequests: number | null;
  socketEvents: number | null;
  messagesCreated: number | null;
  activeSockets: number;
}

const counterDelta = (current: number, previous?: number) =>
  previous === undefined ? null : Math.max(0, current - previous);

export const getAdminOverviewLiveDelta = (
  current: AdminOverview,
  previous: AdminOverview | null,
): AdminOverviewLiveDelta => ({
  httpRequests: counterDelta(
    current.runtime.counters.httpRequestsTotal,
    previous?.runtime.counters.httpRequestsTotal,
  ),
  socketEvents: counterDelta(
    current.runtime.counters.socketEventsTotal,
    previous?.runtime.counters.socketEventsTotal,
  ),
  messagesCreated: counterDelta(
    current.runtime.counters.messagesCreatedTotal,
    previous?.runtime.counters.messagesCreatedTotal,
  ),
  activeSockets: current.runtime.gauges.activeSockets,
});
