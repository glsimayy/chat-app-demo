package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import tools.jackson.databind.node.JsonNodeFactory;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class WebhookControllerTest {

    private final WebhookForwardingService service = mock(WebhookForwardingService.class);
    private final WebhookController controller = new WebhookController(service, "incoming-secret");

    @Test
    void refusesToStartWithAnEmptyWebhookSecret() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new WebhookController(service, " "));
    }

    @Test
    void rejectsAnInvalidWebhookSecretWithoutForwarding() {
        TicketWebhookRequest request = request();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.handleTicketCreated("wrong-secret", request));

        assertEquals(HttpStatus.UNAUTHORIZED, exception.getStatusCode());
        verifyNoInteractions(service);
    }

    @Test
    void returnsCreatedOnlyAfterTheBackendAcceptsTheGroup() {
        TicketWebhookRequest request = request();
        var backendResponse = JsonNodeFactory.instance.objectNode().put("success", true);
        when(service.forwardTicket(request)).thenReturn(backendResponse);

        var response = controller.handleTicketCreated("incoming-secret", request);

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(backendResponse, response.getBody());
    }

    private TicketWebhookRequest request() {
        return new TicketWebhookRequest(
                "ticket.created",
                "TICKET-42",
                UUID.randomUUID(),
                "Support Room",
                List.of(UUID.randomUUID()));
    }
}
