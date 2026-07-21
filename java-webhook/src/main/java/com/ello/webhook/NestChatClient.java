package com.ello.webhook;

import tools.jackson.databind.JsonNode;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Component
public class NestChatClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(NestChatClient.class);
    private final RestClient restClient;
    private final int maxAttempts;
    private final Duration retryDelay;

    public NestChatClient(
            RestClient.Builder restClientBuilder,
            @Value("${ello.chat.base-url}") String baseUrl,
            @Value("${ello.chat.bot-secret}") String botSecret,
            @Value("${ello.chat.max-attempts}") int maxAttempts,
            @Value("${ello.chat.retry-delay}") Duration retryDelay) {
        if (baseUrl.isBlank()) {
            throw new IllegalArgumentException("CHAT_BACKEND_BASE_URL must not be blank");
        }
        if (botSecret.isBlank()) {
            throw new IllegalArgumentException("BOT_WEBHOOK_SECRET must not be blank");
        }
        if (maxAttempts < 1 || maxAttempts > 3) {
            throw new IllegalArgumentException("CHAT_BACKEND_MAX_ATTEMPTS must be between 1 and 3");
        }
        if (retryDelay.isNegative() || retryDelay.compareTo(Duration.ofSeconds(2)) > 0) {
            throw new IllegalArgumentException(
                    "CHAT_BACKEND_RETRY_DELAY must be between 0ms and 2s");
        }
        LOGGER.info("Configuring chat backend client for {}", baseUrl);
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .defaultHeader("x-bot-secret", botSecret)
                .build();
        this.maxAttempts = maxAttempts;
        this.retryDelay = retryDelay;
    }

    public JsonNode createGroup(CreateBotGroupRequest request) {
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return restClient.post()
                        .uri("/api/bot/create-group")
                        .body(request)
                        .retrieve()
                        .body(JsonNode.class);
            } catch (RestClientResponseException exception) {
                boolean retryable = exception.getStatusCode().is5xxServerError();

                if (!retryable || attempt == maxAttempts) {
                    LOGGER.warn(
                            "Chat backend rejected group creation with status {}",
                            exception.getStatusCode().value());
                    throw new ChatBackendException(
                            "Chat backend rejected group creation with status "
                                    + exception.getStatusCode().value(),
                            exception);
                }

                logRetry(attempt, "HTTP " + exception.getStatusCode().value());
            } catch (ResourceAccessException exception) {
                if (attempt == maxAttempts) {
                    LOGGER.error("Chat backend request failed after {} attempts", maxAttempts);
                    throw new ChatBackendException("Chat backend is unavailable", exception);
                }

                logRetry(attempt, "connection failure");
            }

            waitBeforeRetry();
        }

        throw new IllegalStateException("Retry loop completed without a result");
    }

    public boolean isBackendReady() {
        try {
            restClient.get()
                    .uri("/api/health")
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientException exception) {
            LOGGER.warn("Chat backend readiness check failed");
            return false;
        }
    }

    private void logRetry(int attempt, String reason) {
        LOGGER.warn(
                "Chat backend attempt {}/{} failed ({}); retrying",
                attempt,
                maxAttempts,
                reason);
    }

    private void waitBeforeRetry() {
        if (retryDelay.isZero()) {
            return;
        }

        try {
            Thread.sleep(retryDelay.toMillis());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ChatBackendException("Chat backend retry was interrupted", exception);
        }
    }
}
