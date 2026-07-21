# ellO Java Webhook

Bu servis dis ticket webhook'unu dogrular ve NestJS backend'deki
`POST /api/bot/create-group` endpoint'ine iletir.

## Gereksinimler

- Java 17 veya daha yeni bir JDK
- Calisan ellO NestJS backend

## Calistirma

PowerShell:

```powershell
$env:WEBHOOK_SECRET = "local-webhook-secret"
$env:BOT_WEBHOOK_SECRET = "NestJS ile ayni bot secret"
$env:CHAT_BACKEND_BASE_URL = "http://localhost:3000"
.\mvnw.cmd spring-boot:run
```

Java servis health endpoint'i `http://localhost:8080/health` adresindedir.
Secret degerleri kaynak koda veya repoya yazilmaz.

- `GET /health`: Yalnizca Java servisinin ayakta oldugunu bildirir.
- `GET /ready`: NestJS backend bagimliligini ayrica kontrol eder. Backend kapaliysa
  Java servisi calismaya devam eder, fakat bu endpoint `503` doner.

Backend istemcisi varsayilan olarak 1 saniye connection timeout, 3 saniye read
timeout ve toplam 2 deneme kullanir. Degerler `CHAT_BACKEND_CONNECT_TIMEOUT`,
`CHAT_BACKEND_READ_TIMEOUT`, `CHAT_BACKEND_MAX_ATTEMPTS` ve
`CHAT_BACKEND_RETRY_DELAY` ortam degiskenleriyle ayarlanabilir. Maksimum deneme
sayisi 3 ile sinirlidir.

## Production Image

```powershell
docker build -t ello-java-webhook:0.1 ./java-webhook
docker run --rm -p 8080:8080 `
  -e WEBHOOK_SECRET="local-webhook-secret" `
  -e BOT_WEBHOOK_SECRET="NestJS ile ayni bot secret" `
  -e CHAT_BACKEND_BASE_URL="http://host.docker.internal:3000" `
  ello-java-webhook:0.1
```

Production image non-root kullanici ile calisir; build araclari, kaynak kod ve
secret degerleri runtime katmanina kopyalanmaz.

## Webhook Sozlesmesi

```http
POST /webhook/ticket-created
X-Webhook-Token: <WEBHOOK_SECRET>
Content-Type: application/json
```

```json
{
  "eventType": "ticket.created",
  "ticketId": "TICKET-42",
  "ownerId": "00000000-0000-4000-8000-000000000001",
  "title": "Support Room",
  "participantIds": ["00000000-0000-4000-8000-000000000002"]
}
```

NestJS istegi basarisiz olursa servis `502 Bad Gateway` doner; webhook'u
basarili gibi isaretlemez.
