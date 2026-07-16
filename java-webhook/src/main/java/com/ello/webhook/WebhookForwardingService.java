package com.ello.webhook;

import tools.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

@Service
public class WebhookForwardingService {

    private final NestChatClient nestChatClient;

    public WebhookForwardingService(NestChatClient nestChatClient) {
        this.nestChatClient = nestChatClient;
    }

    public JsonNode forwardTicket(TicketWebhookRequest webhook) {
        var request = new CreateBotGroupRequest(
                webhook.ownerId(),
                webhook.title().trim(),
                webhook.participantIds(),
                webhook.ticketId().trim(),
                "Ticket " + webhook.ticketId().trim() + " created via webhook");

        return nestChatClient.createGroup(request);
    }
}
