import { AdminOverview } from "../../../api/adminMonitoring";
import { getAdminOverviewLiveDelta } from "./overviewLive";

const createOverview = (
  counters: Partial<AdminOverview["runtime"]["counters"]> = {},
  activeSockets = 0,
): AdminOverview =>
  ({
    runtime: {
      counters: {
        httpRequestsTotal: 0,
        httpErrorsTotal: 0,
        socketConnectionsTotal: 0,
        socketDisconnectsTotal: 0,
        socketEventsTotal: 0,
        socketErrorsTotal: 0,
        messagesCreatedTotal: 0,
        ...counters,
      },
      gauges: {
        activeSockets,
        averageHttpDurationMs: 0,
      },
    },
  }) as AdminOverview;

describe("getAdminOverviewLiveDelta", () => {
  it("returns interval changes and the current active socket count", () => {
    const previous = createOverview(
      {
        httpRequestsTotal: 40,
        socketEventsTotal: 10,
        messagesCreatedTotal: 4,
      },
      2,
    );
    const current = createOverview(
      {
        httpRequestsTotal: 47,
        socketEventsTotal: 13,
        messagesCreatedTotal: 6,
      },
      5,
    );

    expect(getAdminOverviewLiveDelta(current, previous)).toEqual({
      httpRequests: 7,
      socketEvents: 3,
      messagesCreated: 2,
      activeSockets: 5,
    });
  });

  it("waits for a previous sample before calculating counter changes", () => {
    expect(
      getAdminOverviewLiveDelta(
        createOverview({ httpRequestsTotal: 12 }, 3),
        null,
      ),
    ).toEqual({
      httpRequests: null,
      socketEvents: null,
      messagesCreated: null,
      activeSockets: 3,
    });
  });

  it("treats restarted counters as a zero interval change", () => {
    const previous = createOverview({ httpRequestsTotal: 20 });
    const current = createOverview({ httpRequestsTotal: 2 });

    expect(getAdminOverviewLiveDelta(current, previous).httpRequests).toBe(0);
  });
});
