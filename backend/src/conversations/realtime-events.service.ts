import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { ConversationRecord, MessageRecord } from "./conversation.types";
import { ContactInvitationView } from "../contact-invitations/contact-invitation.types";

const REALTIME_EVENT = "conversation.realtime";

export type ConversationRealtimeEvent =
  | { type: "contact.invitation.created"; data: ContactInvitationView }
  | { type: "contact.invitation.updated"; data: ContactInvitationView }
  | {
      type: "ticket.created";
      data: { ticketId: string; requesterId: string; version: number };
    }
  | {
      type: "ticket.updated";
      data: { ticketId: string; requesterId: string; version: number };
    }
  | { type: "conversation.created"; data: ConversationRecord }
  | { type: "conversation.updated"; data: ConversationRecord }
  | { type: "message.created"; data: MessageRecord }
  | { type: "message.updated"; data: MessageRecord }
  | { type: "message.deleted"; data: MessageRecord }
  | {
      type: "message.read";
      data: { conversationId: string; userId: string; readAt: Date };
    }
  | {
      type: "participant.added";
      data: { conversationId: string; userId: string; joinedAt: Date };
    }
  | {
      type: "participant.removed";
      data: {
        conversationId: string;
        userId: string;
        removedAt: Date;
        removedBy: string;
      };
    }
  | {
      type: "participant.left";
      data: { conversationId: string; userId: string; leftAt: Date };
    };

@Injectable()
export class RealtimeEventsService {
  private readonly events = new EventEmitter();

  emit(event: ConversationRealtimeEvent) {
    this.events.emit(REALTIME_EVENT, event);
  }

  onEvent(listener: (event: ConversationRealtimeEvent) => void) {
    this.events.on(REALTIME_EVENT, listener);

    return () => {
      this.events.off(REALTIME_EVENT, listener);
    };
  }
}
