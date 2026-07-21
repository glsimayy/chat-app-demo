package com.ello.webhook;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration(proxyBeanMethods = false)
public class HttpClientConfiguration {

    @Bean
    RestClient.Builder restClientBuilder(
            @Value("${ello.chat.connect-timeout}") Duration connectTimeout,
            @Value("${ello.chat.read-timeout}") Duration readTimeout) {
        requirePositive(connectTimeout, "CHAT_BACKEND_CONNECT_TIMEOUT");
        requirePositive(readTimeout, "CHAT_BACKEND_READ_TIMEOUT");

        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(connectTimeout)
                .version(HttpClient.Version.HTTP_1_1)
                .build();
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(readTimeout);

        return RestClient.builder().requestFactory(requestFactory);
    }

    private void requirePositive(Duration value, String settingName) {
        if (value.isZero() || value.isNegative()) {
            throw new IllegalArgumentException(settingName + " must be greater than zero");
        }
    }
}
