import { Injectable, OnModuleInit, Optional } from "@nestjs/common";
import { CallStatus as PrismaCallStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { UsersService } from "../users/users.service";
import { CallStatus } from "./call-status.enum";
import { CallRecord, CreateCallRecordInput } from "./call.types";

@Injectable()
export class CallsService implements OnModuleInit {
  private readonly calls = new Map<string, CallRecord>();

  constructor(
    private readonly usersService: UsersService,
    @Optional() private readonly prismaService?: PrismaService,
  ) {}

  async onModuleInit() {
    if (!this.prismaService?.enabled) {
      return;
    }

    const persisted = await this.prismaService.client.callRecord.findMany({
      orderBy: { startedAt: "desc" },
    });
    const now = new Date();

    for (const item of persisted) {
      const record = {
        ...item,
        status: item.status as CallStatus,
      };

      if (
        record.status === CallStatus.Ringing ||
        record.status === CallStatus.Active
      ) {
        record.status = CallStatus.Failed;
        record.endedAt = now;
        record.endedReason = "server-restarted";
        await this.prismaService.client.callRecord.update({
          where: { id: record.id },
          data: {
            status: PrismaCallStatus.failed,
            endedAt: now,
            endedReason: record.endedReason,
          },
        });
      }

      this.calls.set(record.id, record);
    }
  }

  async start(input: CreateCallRecordInput) {
    const record: CallRecord = {
      ...input,
      status: CallStatus.Ringing,
      answeredAt: null,
      endedAt: null,
      endedReason: null,
      endedById: null,
    };

    if (this.prismaService?.enabled) {
      await this.prismaService.client.callRecord.create({
        data: {
          ...record,
          status: record.status as unknown as PrismaCallStatus,
        },
      });
    }

    this.calls.set(record.id, record);
    return record;
  }

  async accept(callId: string) {
    const record = this.calls.get(callId);
    if (!record || record.status !== CallStatus.Ringing) {
      return;
    }

    record.status = CallStatus.Active;
    record.answeredAt = new Date();
    if (this.prismaService?.enabled) {
      await this.prismaService.client.callRecord.update({
        where: { id: record.id },
        data: {
          status: PrismaCallStatus.active,
          answeredAt: record.answeredAt,
        },
      });
    }
  }

  async finish(callId: string, reason: string, endedById?: string) {
    const record = this.calls.get(callId);
    if (
      !record ||
      ![CallStatus.Ringing, CallStatus.Active].includes(record.status)
    ) {
      return;
    }

    record.status = this.finishedStatus(record.status, reason);
    record.endedAt = new Date();
    record.endedReason = reason;
    record.endedById = endedById ?? null;

    if (this.prismaService?.enabled) {
      await this.prismaService.client.callRecord.update({
        where: { id: record.id },
        data: {
          status: record.status as unknown as PrismaCallStatus,
          endedAt: record.endedAt,
          endedReason: record.endedReason,
          endedById: record.endedById,
        },
      });
    }
  }

  findForUser(userId: string) {
    return Array.from(this.calls.values())
      .filter(
        (record) => record.callerId === userId || record.recipientId === userId,
      )
      .sort(
        (left, right) => right.startedAt.getTime() - left.startedAt.getTime(),
      )
      .slice(0, 100)
      .map((record) => {
        const isOutgoing = record.callerId === userId;
        const peerId = isOutgoing ? record.recipientId : record.callerId;
        const peer = this.usersService.findByIdSync(peerId);
        const durationStart = record.answeredAt?.getTime();
        const durationEnd = record.endedAt?.getTime();

        return {
          id: record.id,
          conversationId: record.conversationId,
          direction: isOutgoing ? ("outgoing" as const) : ("incoming" as const),
          status: record.status,
          startedAt: record.startedAt,
          answeredAt: record.answeredAt,
          endedAt: record.endedAt,
          endedReason: record.endedReason,
          durationSeconds:
            durationStart && durationEnd
              ? Math.max(0, Math.floor((durationEnd - durationStart) / 1000))
              : 0,
          peer: {
            id: peerId,
            username: peer?.username ?? "Deleted user",
            profileImage: peer?.profileImage ?? null,
          },
        };
      });
  }

  getAdminMonitoringRecords() {
    return Array.from(this.calls.values()).map((record) => ({ ...record }));
  }

  async clearAll() {
    const deletedCalls = this.calls.size;
    if (this.prismaService?.enabled) {
      await this.prismaService.client.callRecord.deleteMany();
    }
    this.calls.clear();
    return { deletedCalls };
  }

  private finishedStatus(currentStatus: CallStatus, reason: string) {
    if (currentStatus === CallStatus.Active) {
      return CallStatus.Completed;
    }
    if (reason === "declined" || reason === "busy") {
      return CallStatus.Declined;
    }
    if (reason === "unanswered") {
      return CallStatus.Missed;
    }
    return CallStatus.Failed;
  }
}
