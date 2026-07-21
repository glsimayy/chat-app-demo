package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class ApiExceptionHandlerTest {

    @Test
    void returnsAControlledBadGatewayResponse() {
        ApiExceptionHandler handler = new ApiExceptionHandler();
        ChatBackendException exception =
                new ChatBackendException("Chat backend is unavailable", new RuntimeException());

        var response = handler.handleChatBackendException(exception);

        assertEquals(HttpStatus.BAD_GATEWAY, response.getStatusCode());
        assertEquals(502, response.getBody().statusCode());
        assertEquals("Chat backend is unavailable", response.getBody().message());
    }
}
