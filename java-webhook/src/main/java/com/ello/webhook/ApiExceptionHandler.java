package com.ello.webhook;

import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ChatBackendException.class)
    public ResponseEntity<ApiError> handleChatBackendException(ChatBackendException exception) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new ApiError(
                        HttpStatus.BAD_GATEWAY.value(),
                        exception.getMessage(),
                        Instant.now()));
    }

    public record ApiError(int statusCode, String message, Instant timestamp) {
    }
}
