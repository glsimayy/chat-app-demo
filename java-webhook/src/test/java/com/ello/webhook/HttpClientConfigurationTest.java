package com.ello.webhook;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.time.Duration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.ResourceAccessException;

class HttpClientConfigurationTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void rejectsNonPositiveTimeouts() {
        HttpClientConfiguration configuration = new HttpClientConfiguration();

        assertThrows(
                IllegalArgumentException.class,
                () -> configuration.restClientBuilder(Duration.ZERO, Duration.ofSeconds(1)));
        assertThrows(
                IllegalArgumentException.class,
                () -> configuration.restClientBuilder(Duration.ofSeconds(1), Duration.ZERO));
    }

    @Test
    void abortsARequestThatExceedsTheReadTimeout() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/slow", exchange -> {
            try {
                Thread.sleep(500);
                exchange.sendResponseHeaders(200, 0);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();

        var client = new HttpClientConfiguration()
                .restClientBuilder(Duration.ofSeconds(1), Duration.ofMillis(50))
                .baseUrl("http://127.0.0.1:" + server.getAddress().getPort())
                .build();

        assertTimeoutPreemptively(
                Duration.ofSeconds(2),
                () -> assertThrows(
                        ResourceAccessException.class,
                        () -> client.get().uri("/slow").retrieve().toBodilessEntity()));
    }
}
