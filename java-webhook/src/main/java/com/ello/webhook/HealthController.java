package com.ello.webhook;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    private final NestChatClient nestChatClient;

    public HealthController(NestChatClient nestChatClient) {
        this.nestChatClient = nestChatClient;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "service", "ello-java-webhook",
                "timestamp", Instant.now().toString());
    }

    @GetMapping("/ready")
    public ResponseEntity<ReadinessResponse> readiness() {
        boolean backendReady = nestChatClient.isBackendReady();
        ReadinessResponse response = new ReadinessResponse(
                backendReady ? "ready" : "not_ready",
                "ello-java-webhook",
                Map.of("chatBackend", new DependencyStatus(backendReady ? "up" : "down")),
                Instant.now());

        return ResponseEntity
                .status(backendReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                .body(response);
    }

    public record ReadinessResponse(
            String status,
            String service,
            Map<String, DependencyStatus> dependencies,
            Instant timestamp) {
    }

    public record DependencyStatus(String status) {
    }
}
