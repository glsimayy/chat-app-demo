package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.http.HttpMethod.GET;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withBadRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.time.Duration;
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
                        " ",
                        2,
                        Duration.ZERO));
    }

    @Test
    void sendsTheRequiredPathSecretAndPayload() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = client(builder);
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
        NestChatClient client = client(builder);
        CreateBotGroupRequest request = new CreateBotGroupRequest(
                UUID.randomUUID(),
                "Support Room",
                List.of(UUID.randomUUID()),
                "TICKET-42",
                "Ticket created");

        server.expect(times(2), requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(withServerError());

        assertThrows(ChatBackendException.class, () -> client.createGroup(request));
        server.verify();
    }

    @Test
    void doesNotRetryClientErrors() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = client(builder);

        server.expect(once(), requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(withBadRequest());

        assertThrows(ChatBackendException.class, () -> client.createGroup(request()));
        server.verify();
    }

    @Test
    void retriesAConnectionTimeoutOnlyUpToTheConfiguredLimit() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = client(builder);

        server.expect(times(2), requestTo("http://localhost:3000/api/bot/create-group"))
                .andRespond(withException(new SocketTimeoutException("timed out")));

        ChatBackendException exception =
                assertThrows(ChatBackendException.class, () -> client.createGroup(request()));

        assertEquals("Chat backend is unavailable", exception.getMessage());
        server.verify();
    }

    @Test
    void reportsBackendReadinessWithoutThrowing() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = client(builder);

        server.expect(once(), requestTo("http://localhost:3000/api/health"))
                .andExpect(method(GET))
                .andRespond(withSuccess());

        assertTrue(client.isBackendReady());
        server.verify();
    }

    @Test
    void reportsTheBackendAsNotReadyOnFailure() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        NestChatClient client = client(builder);

        server.expect(once(), requestTo("http://localhost:3000/api/health"))
                .andExpect(method(GET))
                .andRespond(withServerError());

        assertFalse(client.isBackendReady());
        server.verify();
    }

    private NestChatClient client(RestClient.Builder builder) {
        return new NestChatClient(
                builder,
                "http://localhost:3000",
                "bot-secret",
                2,
                Duration.ZERO);
    }

    private CreateBotGroupRequest request() {
        return new CreateBotGroupRequest(
                UUID.randomUUID(),
                "Support Room",
                List.of(UUID.randomUUID()),
                "TICKET-42",
                "Ticket created");
    }
}
