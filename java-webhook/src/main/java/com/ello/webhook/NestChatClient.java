package com.ello.webhook;

import tools.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class NestChatClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(NestChatClient.class);
    private final RestClient restClient;

    public NestChatClient(
            RestClient.Builder restClientBuilder,
            @Value("${ello.chat.base-url}") String baseUrl,
            @Value("${ello.chat.bot-secret}") String botSecret) {
        if (baseUrl.isBlank()) {
            throw new IllegalArgumentException("CHAT_BACKEND_BASE_URL must not be blank");
        }
        if (botSecret.isBlank()) {
            throw new IllegalArgumentException("BOT_WEBHOOK_SECRET must not be blank");
        }
        LOGGER.info("Configuring chat backend client for {}", baseUrl);
        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .defaultHeader("x-bot-secret", botSecret)
                .build();
    }

    public JsonNode createGroup(CreateBotGroupRequest request) {
        try {
            return restClient.post()
                    .uri("/api/bot/create-group")
                    .body(request)
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException exception) {
            LOGGER.warn(
                    "Chat backend rejected group creation with status {}",
                    exception.getStatusCode().value());
            throw new ChatBackendException(
                    "Chat backend rejected group creation with status "
                            + exception.getStatusCode().value(),
                    exception);
        } catch (ResourceAccessException exception) {
            LOGGER.error("Chat backend request failed: {}", exception.getMessage());
            throw new ChatBackendException("Chat backend is unavailable", exception);
        }
    }
}
