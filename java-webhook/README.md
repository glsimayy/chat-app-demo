# ellO Java Webhook

Bu Spring Boot servisi dış bir ticket sisteminden gelen webhook isteğini
doğrular, ellO BOT API formatına dönüştürür ve NestJS backend'deki
`POST /api/bot/create-group` endpointine iletir.

Tam sistemi ilk kez kuruyorsan repo kökündeki [README.md](../README.md)
içindeki Docker Compose adımlarını kullan. Docker kurulumunda Java veya
Maven'i host makineye ayrıca kurmak gerekmez.

## Gereksinimler

Docker kullanmadan geliştirme için:

- Java 17 veya daha yeni JDK
- Çalışan ellO NestJS backend

Repo Maven Wrapper içerir; ayrı Maven kurulumu zorunlu değildir.

## Docker ile Çalıştırma

Repo kökünde:

```powershell
Copy-Item .env.compose.example .env
docker compose up -d --build
```

Java webhook container'ı otomatik başlar:

- Liveness: `http://localhost:8080/health`
- Readiness: `http://localhost:8080/ready`
- Ticket webhook: `POST http://localhost:8080/webhook/ticket-created`

## Yerel Çalıştırma

PowerShell:

```powershell
$env:WEBHOOK_SECRET = "<dis sistem ile paylasilan secret>"
$env:BOT_WEBHOOK_SECRET = "<NestJS ile ayni bot secret>"
$env:CHAT_BACKEND_BASE_URL = "http://localhost:3000"
.\mvnw.cmd spring-boot:run
```

Secret değerleri kaynak koda veya repoya yazılmaz.

## Health ve Readiness

- `GET /health`: Yalnızca Java servisinin çalıştığını bildirir.
- `GET /ready`: NestJS backend bağımlılığını ayrıca kontrol eder.

Backend kapalıysa Java prosesi çalışmaya devam eder, `/health` başarılı olur
ancak `/ready` `503 Service Unavailable` döner.

## Ortam Değişkenleri

| Değişken | Zorunlu | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `WEBHOOK_SECRET` | Evet | Yok | Dış sistemin `X-Webhook-Token` değeri |
| `BOT_WEBHOOK_SECRET` | Evet | Yok | NestJS `x-bot-secret` değeri |
| `CHAT_BACKEND_BASE_URL` | Hayır | `http://localhost:3000` | NestJS taban adresi |
| `JAVA_WEBHOOK_PORT` | Hayır | `8080` | Java servis portu |
| `CHAT_BACKEND_CONNECT_TIMEOUT` | Hayır | `1s` | Bağlantı timeout |
| `CHAT_BACKEND_READ_TIMEOUT` | Hayır | `3s` | Response okuma timeout |
| `CHAT_BACKEND_MAX_ATTEMPTS` | Hayır | `2` | Toplam deneme; en fazla 3 |
| `CHAT_BACKEND_RETRY_DELAY` | Hayır | `100ms` | Denemeler arası bekleme |

## Webhook Sözleşmesi

```http
POST /webhook/ticket-created
X-Webhook-Token: <WEBHOOK_SECRET>
Content-Type: application/json
```

```json
{
  "eventType": "ticket.created",
  "ticketId": "TICKET-42",
  "ownerId": "1",
  "title": "Support Room",
  "participantIds": ["2", "4"]
}
```

`ticketId`, NestJS tarafına `externalRef` olarak gönderilir. Aynı ticket
yeniden iletilirse backend aynı otomasyon grubunu döndürür; duplicate grup
oluşturmaz.

Java -> NestJS çağrısı:

```http
POST /api/bot/create-group
x-bot-secret: <BOT_WEBHOOK_SECRET>
Content-Type: application/json
```

NestJS isteği timeout olur veya başarısız dönerse Java servis kontrollü retry
uygular. Son deneme de başarısızsa dış sisteme `502 Bad Gateway` döner;
webhook başarılı gibi işaretlenmez.

## Production Image

```powershell
docker build -t ello-java-webhook:0.1 ./java-webhook
docker run --rm -p 8080:8080 `
  -e WEBHOOK_SECRET="<webhook-secret>" `
  -e BOT_WEBHOOK_SECRET="<backend-bot-secret>" `
  -e CHAT_BACKEND_BASE_URL="http://host.docker.internal:3000" `
  ello-java-webhook:0.1
```

Production image non-root kullanıcı ile çalışır; build araçları, kaynak kod ve
secret değerleri runtime katmanına kopyalanmaz.

## Test

Windows:

```powershell
.\mvnw.cmd test
```

macOS veya Linux:

```bash
./mvnw test
```

Timeout, retry, readiness, secret doğrulama ve backend hata çevirme davranışları
test kapsamındadır.

## Ayrıntılı Referans

- [API ve Java webhook teknik referansı](../docs/api-java-webhook-reference.md)
- [API ve Java webhook PDF](../output/pdf/ello-api-java-webhook-dokumani.pdf)
- [BOT API örnekleri](../docs/bot-api-examples.md)
