package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TicketWebhookRequestValidationTest {

    @Test
    void rejectsMissingRequiredWebhookFields() {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            var violations = validatorFactory.getValidator().validate(
                    new TicketWebhookRequest("", "", null, "", List.of()));

            assertFalse(violations.isEmpty());
        }
    }

    @Test
    void acceptsACompleteWebhookPayload() {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            var violations = validatorFactory.getValidator().validate(
                    new TicketWebhookRequest(
                            "ticket.created",
                            "TICKET-42",
                            UUID.randomUUID(),
                            "Support Room",
                            List.of(UUID.randomUUID())));

            assertTrue(violations.isEmpty());
        }
    }

    @Test
    void rejectsAnUnrelatedEventType() {
        try (var validatorFactory = Validation.buildDefaultValidatorFactory()) {
            var violations = validatorFactory.getValidator().validate(
                    new TicketWebhookRequest(
                            "ticket.updated",
                            "TICKET-42",
                            UUID.randomUUID(),
                            "Support Room",
                            List.of(UUID.randomUUID())));

            assertFalse(violations.isEmpty());
        }
    }
}
