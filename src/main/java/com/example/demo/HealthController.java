package com.example.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;

@RestController
public class HealthController {

    private final RestClient restClient = RestClient.create();

    // @Value anotasyonu sayesinde ayar dosyasındaki şifreyi otomatik olarak çekiyoruz.
    /* kullanıcı "ollechat-secret-token-123" şifresini application.properties'de değiştirecek
     sonra test.http'yi çalıştıracak tekrardan*/

    @Value("${ollechat.webhook.secret-token:ollechat-secret-token-123}")

    private String sharedSecretToken;

    @GetMapping("/health")
    public String checkHealth() {
        return "Java servisi ayakta ve çalışıyor!";
    }

    @PostMapping("/webhook/ticket-created")
    public ResponseEntity<String> handleTicketCreated(
            @RequestHeader(value = "X-Webhook-Token", required = false) String incomingToken,
            @RequestBody TicketWebHookDto webhookData) {

        // ================= GÜVENLİK KONTROLÜ =================
        // sabit bir metin yerine, yukarıda dışarıdan okuduğumuz 'sharedSecretToken' değişkenini kontrol ediyoruz.
        if (incomingToken == null || !incomingToken.equals(sharedSecretToken)) {
            System.err.println("GÜVENLİK HATASI: Yanlış veya eksik token gönderildi!");
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body("HATA: Geçersiz veya eksik güvenlik token'i!");
        }

        // ================= PAYLOAD VALIDATION =================
        if (webhookData.getEventType() == null || webhookData.getEventType().isEmpty() ||
                webhookData.getTicketId() == null || webhookData.getTicketId().isEmpty() ||
                webhookData.getTitle() == null || webhookData.getTitle().isEmpty() ||
                webhookData.getParticipantIds() == null || webhookData.getParticipantIds().isEmpty()) {

            System.err.println("VALIDASYON HATASI: Gelen mesajda eksik alanlar var!");
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body("HATA: Gelen verilerde eksik veya boŞ alanlar mevcut!");
        }

        // ================= ASIL İŞLEM (BAŞARILI DURUM) =================
        System.out.println("Mesaj güvenli bir şekildde alındı ve doğrulandı!");
        System.out.println("Kullanılan Geçerli Token: " + sharedSecretToken);
        System.out.println("Event Tipi: " + webhookData.getEventType());
        System.out.println("Ticket ID: " + webhookData.getTicketId());
        System.out.println("Grup Başlığı: " + webhookData.getTitle());
        System.out.println("Katılımcı ID'leri: " + webhookData.getParticipantIds());

        CreateGroupRequest nestJsRequest = new CreateGroupRequest(
                webhookData.getTitle(),
                webhookData.getParticipantIds(),
                "Otomatik webhook tetiklemesi ile oluşturuldu",
                webhookData.getTicketId()
        );

        try {
            System.out.println("NestJS sistemine otomatik grup oluşturma isteği gönderiliyor...");
            String nestJsResponse = restClient.post()
                    .uri("http://localhost:3000/bot/create-group")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(nestJsRequest)
                    .retrieve()
                    .body(String.class);

            System.out.println("NestJS'den gelen yanıt: " + nestJsResponse);
        } catch (Exception e) {
            System.err.println("NestJS entegrasyonunda hata oluştu: " + e.getMessage());
        }

        return ResponseEntity.ok("Webhook başarıyla alındı ve NestJS sistemine iletildi.");
    }
}