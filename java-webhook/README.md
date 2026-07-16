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
