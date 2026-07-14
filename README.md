# OlleChat - Java Webhook Bot Servisi

Bu servis, harici sistemlerden gelen müşteri destek taleplerini (Webhook) karşılayan ve otomatik sohbet grubu açılması için NestJS ana backend servisini tetikleyen bağımsız bir Spring Boot mikro servisidir.

## Teknik Özellikler
- **Framework:** Spring Boot 3.x
- **Port:** 8080
- **Güvenlik:** Shared Secret Token (Header-based)

---

## Çalıştırma Komutları

Projeyi lokal bilgisayarınızda çalıştırmak için ana dizinde terminali açıp şu komutu uygulayabilirsiniz:

```bash
./mvnw spring-boot:run