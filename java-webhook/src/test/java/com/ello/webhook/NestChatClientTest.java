package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class NestChatClientTest {

    @Test
    void refusesToStartWithAnEmptyBotSecret() {
        assertThrows(
                IllegalArgumentException.class,
                () -> new NestChatClient(
                        RestClient.builder(),
                        "http://localhost:3000",
                        " "));
    }

    @Test
    void sendsTheRequiredPathSecretAndPayload() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "bot-secret");
        UUID ownerId = UUID.randomUUID();
        UUID participantId = UUID.randomUUID();
        CreateBotGroupRequest request = new CreateBotGroupRequest(
                ownerId,
                "Support Room",
                List.of(participantId),
                "TICKET-42",
                "Ticket created");

        server.expect(once(), requestTo("http://localhost:3000/api/bot/create-group"))
                .andExpect(method(POST))
                .andExpect(header("x-bot-secret", "bot-secret"))
                .andExpect(content().json("""
                        {
                          "ownerId": "%s",
                          "name": "Support Room",
                          "participantIds": ["%s"],
                          "externalRef": "TICKET-42",
                          "initialSystemMessage": "Ticket created"
                        }
                        """.formatted(ownerId, participantId)))
                .andRespond(withSuccess("{\"success\":true}", MediaType.APPLICATION_JSON));

        assertEquals(true, client.createGroup(request).get("success").asBoolean());
        server.verify();
    }

    @Test
    void propagatesBackendFailureInsteadOfReportingSuccess() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "bot-secret");
        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(),
                "Support Room",
                List.of(UUID.randomUUID()),
                "TICKET-42",
                "Ticket created");

        server.expect(requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(withServerError());

        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }
    // 1. NEGATİF SENARYO: NestJS 4xx Hata Döndüğünde (400 Bad Request-401 Unauthorized)
    @Test
    void propagatesClientErrorStatusWhenBackendReturns4xx() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "wrong-secret");

        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(), "Support Room", List.of(UUID.randomUUID()), "TICKET-42", "Ticket created");

        // NestJS 401 Unauthorized döndüğünü simüle ediyoruz
        server.expect(requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest());

        // NestJS 4xx verdiğinde de ChatBackendException fırlatılmalı
        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }

    // 2. NEGATİF SENARYO: NestJS Sunucusu Tamamen Kapalıysa / Bağlantı Sağlanamıyorsa
    @Test
    void throwsChatBackendExceptionWhenServerIsUnreachable() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "bot-secret");

        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(), "Support Room", List.of(UUID.randomUUID()), "TICKET-42", "Ticket created");

        // Sunucuya hiç ulaşılamadığını (Connection Refused / ResourceAccessException) simüle ediyoruz
        server.expect(requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(request1 -> {
                    throw new java.net.ConnectException("Connection refused to NestJS backend");
                });

        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }

    // 3. NEGATİF SENARYO: NestJS Yanıt Vermekte Geciktiğinde (Timeout)
    @Test
    void throwsChatBackendExceptionOnTimeout() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "bot-secret");

        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(), "Support Room", List.of(UUID.randomUUID()), "TICKET-42", "Ticket created");

        // Zaman aşımı (SocketTimeoutException) durumunu simüle ediyoruz
        server.expect(requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(request1 -> {
                    throw new java.net.SocketTimeoutException("Read timed out");
                });

        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }

    // 4. NEGATİF SENARYO: NestJS Bozuk / Geçersiz JSON Döndüğünde
    @Test
    void throwsChatBackendExceptionWhenResponseBodyIsMalformed() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = new NestChatClient(builder, "http://localhost:3000", "bot-secret");

        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(), "Support Room", List.of(UUID.randomUUID()), "TICKET-42", "Ticket created");

        // NestJS 200 OK dönse bile JSON yerine bozuk veri dönerse
        server.expect(requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(withSuccess("NOT_A_VALID_JSON", MediaType.APPLICATION_JSON));

        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }
}
