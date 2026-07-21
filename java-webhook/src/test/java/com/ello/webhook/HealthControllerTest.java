package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class HealthControllerTest {

    private final NestChatClient nestChatClient = mock(NestChatClient.class);
    private final HealthController controller = new HealthController(nestChatClient);

    @Test
    void livenessStaysUpWithoutCheckingTheBackend() {
        assertEquals("ok", controller.health().get("status"));
    }

    @Test
    void readinessReportsTheBackendAsUp() {
        when(nestChatClient.isBackendReady()).thenReturn(true);

        var response = controller.readiness();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ready", response.getBody().status());
        assertEquals("up", response.getBody().dependencies().get("chatBackend").status());
    }

    @Test
    void readinessSeparatelyReportsAnUnavailableBackend() {
        when(nestChatClient.isBackendReady()).thenReturn(false);

        var response = controller.readiness();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertEquals("not_ready", response.getBody().status());
        assertEquals("down", response.getBody().dependencies().get("chatBackend").status());
    }
}
