package com.ello.webhook;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import tools.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WebhookForwardingServiceTest {

    @Test
    void mapsTheWebhookToTheNestBackendContract() {
        NestChatClient client = mock(NestChatClient.class);
        when(client.createGroup(any())).thenReturn(JsonNodeFactory.instance.objectNode());
        WebhookForwardingService service = new WebhookForwardingService(client);
        UUID ownerId = UUID.randomUUID();
        UUID participantId = UUID.randomUUID();

        service.forwardTicket(new TicketWebhookRequest(
                "ticket.created",
                " TICKET-42 ",
                ownerId,
                " Support Room ",
                List.of(participantId)));

        ArgumentCaptor<CreateBotGroupRequest> requestCaptor =
                ArgumentCaptor.forClass(CreateBotGroupRequest.class);
        verify(client).createGroup(requestCaptor.capture());
        CreateBotGroupRequest request = requestCaptor.getValue();

        org.junit.jupiter.api.Assertions.assertEquals(ownerId, request.ownerId());
        org.junit.jupiter.api.Assertions.assertEquals("Support Room", request.name());
        org.junit.jupiter.api.Assertions.assertEquals(List.of(participantId), request.participantIds());
        org.junit.jupiter.api.Assertions.assertEquals("TICKET-42", request.externalRef());
    }
}
