import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { MessageRecord } from "./conversation.types";

const MESSAGE_CREATED_EVENT = "message.created";

@Injectable()
export class RealtimeEventsService {
  private readonly events = new EventEmitter();

  emitMessageCreated(message: MessageRecord) {
    this.events.emit(MESSAGE_CREATED_EVENT, message);
  }

  onMessageCreated(listener: (message: MessageRecord) => void) {
    this.events.on(MESSAGE_CREATED_EVENT, listener);

    return () => {
      this.events.off(MESSAGE_CREATED_EVENT, listener);
    };
  }
}
