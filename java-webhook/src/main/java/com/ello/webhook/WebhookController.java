package com.ello.webhook;

import tools.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class WebhookController {

    private final WebhookForwardingService forwardingService;
    private final byte[] webhookSecret;

    public WebhookController(
            WebhookForwardingService forwardingService,
            @Value("${ello.webhook.secret}") String webhookSecret) {
        this.forwardingService = forwardingService;
        if (webhookSecret.isBlank()) {
            throw new IllegalArgumentException("WEBHOOK_SECRET must not be blank");
        }
        this.webhookSecret = webhookSecret.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/webhook/ticket-created")
    public ResponseEntity<JsonNode> handleTicketCreated(
            @RequestHeader(value = "X-Webhook-Token", required = false) String incomingToken,
            @Valid @RequestBody TicketWebhookRequest webhook) {
        if (!hasValidSecret(incomingToken)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid webhook token");
        }

        JsonNode backendResponse = forwardingService.forwardTicket(webhook);
        return ResponseEntity.status(HttpStatus.CREATED).body(backendResponse);
    }

    private boolean hasValidSecret(String incomingToken) {
        return incomingToken != null
                && MessageDigest.isEqual(
                        webhookSecret,
                        incomingToken.getBytes(StandardCharsets.UTF_8));
    }
}
