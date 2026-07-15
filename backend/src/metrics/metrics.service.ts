import { Injectable } from "@nestjs/common";

@Injectable()
export class MetricsService {
  private httpRequestsTotal = 0;
  private httpErrorsTotal = 0;
  private httpDurationMsTotal = 0;
  private socketConnectionsTotal = 0;
  private socketDisconnectsTotal = 0;
  private socketEventsTotal = 0;
  private socketErrorsTotal = 0;
  private messagesCreatedTotal = 0;
  private activeSockets = 0;
  private readonly socketEventsByName = new Map<string, number>();

  recordHttpRequest(statusCode: number, durationMs: number) {
    this.httpRequestsTotal += 1;
    this.httpDurationMsTotal += durationMs;

    if (statusCode >= 400) {
      this.httpErrorsTotal += 1;
    }
  }

  recordSocketConnection() {
    this.socketConnectionsTotal += 1;
    this.activeSockets += 1;
  }

  recordSocketDisconnect() {
    this.socketDisconnectsTotal += 1;
    this.activeSockets = Math.max(0, this.activeSockets - 1);
  }

  recordSocketEvent(eventName: string) {
    this.socketEventsTotal += 1;
    this.socketEventsByName.set(
      eventName,
      (this.socketEventsByName.get(eventName) ?? 0) + 1,
    );
  }

  recordSocketError() {
    this.socketErrorsTotal += 1;
  }

  recordMessageCreated() {
    this.messagesCreatedTotal += 1;
  }

  getSnapshot() {
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      counters: {
        httpRequestsTotal: this.httpRequestsTotal,
        httpErrorsTotal: this.httpErrorsTotal,
        httpDurationMsTotal: this.httpDurationMsTotal,
        socketConnectionsTotal: this.socketConnectionsTotal,
        socketDisconnectsTotal: this.socketDisconnectsTotal,
        socketEventsTotal: this.socketEventsTotal,
        socketErrorsTotal: this.socketErrorsTotal,
        messagesCreatedTotal: this.messagesCreatedTotal,
      },
      gauges: {
        activeSockets: this.activeSockets,
        averageHttpDurationMs:
          this.httpRequestsTotal === 0
            ? 0
            : Number(
                (this.httpDurationMsTotal / this.httpRequestsTotal).toFixed(2),
              ),
      },
      socketEventsByName: Object.fromEntries(this.socketEventsByName),
      collectedAt: new Date(),
    };
  }
}
