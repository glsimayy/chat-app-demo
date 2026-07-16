package com.ello.webhook;

public class ChatBackendException extends RuntimeException {

    public ChatBackendException(String message, Throwable cause) {
        super(message, cause);
    }
}
