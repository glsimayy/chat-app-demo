package com.ello.webhook;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.UUID;

public record TicketWebhookRequest(
        @NotBlank @Pattern(regexp = "ticket\\.created") String eventType,
        @NotBlank String ticketId,
        @NotNull UUID ownerId,
        @NotBlank String title,
        @NotEmpty List<@Valid @NotNull UUID> participantIds) {
}
