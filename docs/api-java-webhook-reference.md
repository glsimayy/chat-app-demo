# ellO API ve Java Webhook Teknik Referansı

Sürüm: v0.1  
Güncelleme tarihi: 27.07.2026  
Kaynaklar: çalışan Swagger sözleşmesi, NestJS controller/DTO/service kodları,
Socket.IO gateway'i ve Spring Boot Java webhook implementation'ı.

> Bu belge secret, JWT, parola veya gerçek production bağlantı bilgisi içermez.
> Örneklerdeki bütün hassas değerler yer tutucudur.

<!-- PDF_BODY -->

## 1. Belgenin Amacı ve Kapsamı

Bu doküman ellO mesajlaşma uygulamasının dışarıya açılan teknik sözleşmesini
tek yerde toplar. Hedef kitle backend ve frontend geliştiricileri, entegrasyon
ekipleri, test uzmanları ve servisi çalıştıracak operasyon ekibidir.

Kapsanan parçalar:

- NestJS REST API ve ortak response/error zarfı.
- JWT, global admin, bot secret ve development secret yetki sınırları.
- Direkt sohbet, grup, yönetim sohbeti, mesaj, reply, attachment ve okundu
  durumları.
- Mesaj ve sohbet bookmark/arşiv tercihleri.
- Contact invitation, destek ticket ve çağrı geçmişi endpointleri.
- Dış otomasyonlar için BOT API.
- `/chat` Socket.IO namespace'i, presence, typing, mesaj ve WebRTC signaling
  olayları.
- Spring Boot Java ticket webhook adaptörü.
- Timeout, retry, idempotency, liveness/readiness ve hata çevirme davranışı.
- Docker, ortam değişkenleri, test ve troubleshooting adımları.

Bu belge oluşturulurken çalışan Swagger çıktısı
`docs/openapi.snapshot.json` dosyasına alınmıştır. Endpoint kataloğu ve şema
sözlüğü bu snapshot'tan otomatik üretilir. İş davranışının asıl kaynağı
controller, DTO, service ve gateway kodudur.

### 1.1. Sözleşme Özeti

| Alan | Güncel kapsam |
| --- | --- |
| REST taban adresi | `http://localhost:3000/api` |
| Swagger UI | `http://localhost:3000/api/docs` |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` |
| Socket.IO | `http://localhost:3000/chat` |
| Java webhook | `http://localhost:8080` |
| OpenAPI path / operasyon | 47 path / 61 operasyon |
| OpenAPI component şeması | 57 |
| Client -> server socket olayı | 20 |
| Kalıcı veritabanı | PostgreSQL 16 + Prisma |

### 1.2. Kaynak Dosya Haritası

| Sorumluluk | Kaynak |
| --- | --- |
| Uygulama başlangıcı | `backend/src/main.ts` |
| Global validation/CORS/Swagger | `backend/src/config/configure-application.ts` |
| Ortak REST response | `backend/src/common/interceptors/response.interceptor.ts` |
| Ortak REST error | `backend/src/common/filters/http-exception.filter.ts` |
| REST controller'ları | `backend/src/**/**.controller.ts` |
| Request DTO doğrulamaları | `backend/src/**/dto/*.ts` |
| Socket.IO gateway | `backend/src/chat/chat.gateway.ts` |
| Socket validation/error | `backend/src/chat/dto` ve `backend/src/chat/socket-exception.filter.ts` |
| Java webhook | `java-webhook/src/main/java/com/ello/webhook` |
| Java yapılandırması | `java-webhook/src/main/resources/application.properties` |
| Docker topolojisi | `docker-compose.yml` |

<!-- pagebreak -->

## 2. Sistem Mimarisi ve İstek Akışları

### 2.1. Bileşenler

| Bileşen | Teknoloji | Görev |
| --- | --- | --- |
| Frontend | React + TypeScript | Kullanıcı arayüzü, REST istemcisi, Socket.IO ve WebRTC |
| Main Backend | NestJS + TypeScript | Auth, yetki, iş kuralları, REST ve realtime |
| Veritabanı | PostgreSQL + Prisma | Kullanıcı, sohbet, mesaj, ticket, çağrı ve attachment kalıcılığı |
| Java Webhook | Spring Boot + Java 17 | Dış ticket olayını doğrulayıp BOT API'ye dönüştürme |
| Reverse proxy | Frontend Nginx container | Aynı origin `/api` ve `/chat` yönlendirmesi |

### 2.2. Normal Kullanıcı İsteği

```text
React istemcisi
    |
    | Authorization: Bearer <jwt>
    v
NestJS controller -> ValidationPipe -> guard/service -> Prisma -> PostgreSQL
    |
    +-> standart REST response
    |
    +-> RealtimeEventsService -> Socket.IO user/conversation odaları
```

REST ile yapılan mesaj, grup veya katılımcı değişikliği yalnızca HTTP cevabı
üretmez. Service başarılı transaction sonrasında realtime event yayınlar.
Böylece aynı kullanıcıya ait başka sekmeler ve karşı taraflar F5 gerektirmeden
güncellenir.

### 2.3. Dış Ticket Webhook Akışı

```text
Dış ticket sistemi
    |
    | POST /webhook/ticket-created
    | X-Webhook-Token: <WEBHOOK_SECRET>
    v
Java Webhook
    | validation + token kontrolü + mapping
    |
    | POST /api/bot/create-group
    | x-bot-secret: <BOT_WEBHOOK_SECRET>
    v
NestJS BOT API -> PostgreSQL
    |
    +-> conversation:created
    +-> message:new
    v
Bağlı ellO istemcileri
```

Bu akış iki ayrı güven sınırı kullanır:

1. Dış sistemin Java servisine sunduğu `WEBHOOK_SECRET`.
2. Java servisinin NestJS BOT API'ye sunduğu `BOT_WEBHOOK_SECRET`.

İki secret aynı amaçla kullanılmaz ve production'da farklı, rastgele değerler
olmalıdır.

### 2.4. Realtime ve WebRTC Ayrımı

Socket.IO mesaj, presence, typing ve çağrı sinyalleşmesini taşır. Ses verisi
NestJS veya Java servisinden geçmez. `offer`, `answer` ve ICE candidate
mesajları Socket.IO ile aktarılır; gerçek ses akışı tarayıcılar arasında WebRTC
üzerinden kurulur.

<!-- pagebreak -->

## 3. Adresler, Protokoller ve Ortamlar

### 3.1. Docker Ortamı

| Servis | Host adresi | Container içi adres | Dış erişim |
| --- | --- | --- | --- |
| Frontend | `http://localhost:5173` | `frontend:8080` | LAN'a açık |
| Backend | `http://127.0.0.1:3000` | `backend:3000` | Yalnızca host |
| Java webhook | `http://127.0.0.1:8080` | `java-webhook:8080` | Yalnızca host |
| PostgreSQL | `127.0.0.1:5432` | `postgres:5432` | Yalnızca host |

Frontend container aynı origin çağrıları için `/api` ve `/chat` kullanır.
Tarayıcı açısından backend portunu doğrudan bilmek zorunlu değildir.

### 3.2. Development Ortamı

```powershell
npm.cmd install
npm.cmd run dev
```

Bu komut backend'i `3000`, frontend'i `5173` portunda çalıştırır. Java webhook
ayrı çalıştırılır:

```powershell
cd java-webhook
.\mvnw.cmd spring-boot:run
```

### 3.3. Content Type Kullanımı

| İşlem | Content-Type |
| --- | --- |
| Normal REST body | `application/json` |
| Mesaj eki yükleme | `multipart/form-data` |
| Attachment indirme | Dosyanın gerçek MIME türü |
| Socket.IO | Socket.IO event payload |
| Java ticket webhook | `application/json` |

<!-- pagebreak -->

## 4. Ortak REST Sözleşmesi

### 4.1. Başarılı Response Zarfı

Stream olarak dönen attachment endpointi hariç bütün NestJS controller
cevapları global interceptor tarafından sarılır:

```json
{
  "success": true,
  "data": {
    "id": "resource-uuid"
  }
}
```

Liste veya pagination cevabı da `data` alanının içindedir:

```json
{
  "success": true,
  "data": {
    "items": [],
    "pageInfo": {
      "limit": 50,
      "offset": 0,
      "total": 0,
      "hasMore": false
    }
  }
}
```

### 4.2. Hata Zarfı

NestJS global exception filter:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-27T10:00:00.000Z"
}
```

`message` tek string veya validation hatalarında string listesi olabilir.
Beklenmeyen exception ayrıntısı istemciye sızdırılmaz ve `500 Internal server
error` döner.

### 4.3. Temel HTTP Durumları

| Kod | Kullanım |
| --- | --- |
| 200 | Başarılı GET/PATCH/DELETE veya açıkça 200'e çekilmiş POST |
| 201 | Yeni kullanıcı, sohbet, mesaj, bookmark, invitation veya bot işlemi |
| 400 | DTO validation, iş kuralı veya geçersiz payload |
| 401 | JWT/bot secret eksik veya geçersiz |
| 403 | Kullanıcı doğrulanmış fakat işlem yetkisi yok |
| 404 | Kaynak yok veya gizlilik amacıyla erişim saklanıyor |
| 409 | Idempotency çakışması, duplicate veya optimistic concurrency |
| 429 | HTTP rate limit aşıldı |
| 500 | Beklenmeyen backend hatası |
| 502 | Java webhook backend'e kontrollü biçimde ulaşamadı |
| 503 | Java servisi ayakta fakat NestJS dependency hazır değil |

### 4.4. Validation Davranışı

Global `ValidationPipe` ayarları:

- `whitelist: true`: DTO'da olmayan alanlar tutulmaz.
- `forbidNonWhitelisted: true`: bilinmeyen alan gönderilirse istek reddedilir.
- `transform: true`: query sayıları gibi alanlar DTO tipine çevrilir.
- UUID, email, enum, uzunluk ve dizi kuralları controller'a girmeden uygulanır.

Bu nedenle forward compatibility için rastgele ek alan göndermek güvenli
değildir. İstemci yalnızca sözleşmede tanımlı alanları göndermelidir.

### 4.5. HTTP Rate Limit

Varsayılan global limit `60 saniyede 120 istek`tir.

| Endpoint | Özel limit |
| --- | --- |
| `POST /api/auth/register` | 60 saniyede 10 |
| `POST /api/auth/login` | 60 saniyede 5 |
| `POST /api/bot/groups` | 60 saniyede 30 |
| `POST /api/bot/create-group` | 60 saniyede 30 |
| Bot participant/update işlemleri | 60 saniyede 60 |
| Bot mesaj gönderme | 60 saniyede 120 |
| `GET /api/health` | Rate limit dışında |

Limit aşıldığında `429` ve istemcinin beklemesi için `Retry-After` header'i
dönebilir. CORS ayarı bu header'i tarayıcıya expose eder.

### 4.6. Güvenlik Middleware'leri

- Helmet güvenlik header'larını ekler.
- Compression uygun response'ları sıkıştırır.
- CORS yalnızca yapılandırılmış origin'lere credential ile izin verir.
- Production'da wildcard CORS reddedilir.
- JSON ve urlencoded body limiti varsayılan `1mb` değeridir.
- Request logger hassas header/body değerlerini loglamadan süre ve durum
  metriklerini kaydeder.

<!-- pagebreak -->

## 5. Kimlik Doğrulama ve Yetki Modeli

### 5.1. Dört Yetki Sınırı

| Sınır | Kimlik bilgisi | Kullanıldığı yer |
| --- | --- | --- |
| Public | Yok | Health, register, login |
| Kullanıcı JWT | `Authorization: Bearer <jwt>` | Kullanıcı, sohbet, mesaj, ticket |
| BOT API | `x-bot-secret` | Dış otomasyon endpointleri |
| Development reset | `x-dev-secret` | Yalnızca dev reset |

BOT endpointleri JWT kabul etmek zorunda değildir; kullanıcı endpointleri de
`x-bot-secret` ile açılamaz. Bu sınırlar birbirinin yerine geçmez.

### 5.2. JWT İçeriği ve Ömrü

Token kullanıcı `id`, `email` ve global `role` bilgisini taşır. Varsayılan
geçerlilik `JWT_EXPIRES_IN=1d` değeridir. REST endpointlerinde Passport JWT
guard, Socket.IO bağlantısında gateway içindeki `JwtService.verifyAsync`
kullanılır.

Parola değiştirildiğinde mevcut tokenlar v0.1'de topluca revoke edilmez.
Production sürümünde token version veya refresh-token rotation düşünülmelidir.

### 5.3. Global Rol ve Grup Rolü Ayrımı

| Rol | Kapsam |
| --- | --- |
| `admin` | Bütün uygulamada global yönetici |
| `user` | Normal uygulama kullanıcısı |
| `owner` | Yalnızca belirli manuel grubun sahibi |
| `manager` | Yalnızca belirli grubun yöneticisi |
| `member` | Belirli grubun normal üyesi |

BOT gruplarında insan owner bulunmaz. Global admin ve manager'lar grup
politikalarına göre yönetim yapar. Manuel gruplarda oluşturan global admin
owner olur.

### 5.4. Register

`POST /api/auth/register`

```json
{
  "username": "new_user",
  "email": "new_user@example.com",
  "password": "123456"
}
```

Kurallar:

- Username en az 3 karakterdir.
- Yalnızca harf, rakam ve alt çizgi kabul edilir.
- Email formatı geçerli ve tekil olmalıdır.
- Parola en az 6 karakterdir.
- Parola veritabanına düz metin değil bcrypt hash olarak yazılır.

### 5.5. Login

`POST /api/auth/login`

```json
{
  "email": "emiradmin@ello.com",
  "password": "123456"
}
```

Başarılı cevap `accessToken` ve public user view içerir. Hatalı email ve hatalı
parola aynı `Invalid email or password` mesajını üretir; böylece hesap varlığı
ayrıştırılmaz.

### 5.6. Profil ve Parola

- `GET /api/auth/me`: JWT sahibini döndürür.
- `GET /api/users/me`: profil endpointi üzerinden aynı kullanıcı görünümü.
- `PATCH /api/users/me`: username/about/location/profileImage günceller.
- `PATCH /api/auth/password`: currentPassword kontrolüyle yeni hash yazar.

`profileImage` yalnızca PNG, JPEG veya WebP data URL olabilir ve DTO düzeyinde
700.000 karakterle sınırlıdır.

<!-- pagebreak -->

## 6. Kullanıcı, Health ve Metrics API

### 6.1. Health

`GET /api/health` public ve throttle dışıdır:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "chat-app-backend",
    "uptime": 123.45,
    "timestamp": "2026-07-27T10:00:00.000Z"
  }
}
```

Bu endpoint process liveness gösterir. Docker healthcheck tarafından
kullanılır.

### 6.2. Metrics

`GET /api/metrics` yalnızca JWT sahibi global admin içindir.

İçerik:

- HTTP toplam istek/hata/süre sayaçları.
- Aktif socket sayısı.
- Socket connect/disconnect/event/error sayaçları.
- Event adına göre socket sayımları.
- Oluşturulan mesaj sayısı.
- Process uptime ve ölçüm zamanı.

Bu metrikler process memory'sindedir; Prometheus formatında kalıcı metrik
değildir ve process restartında sıfırlanır.

### 6.3. Kullanıcı Arama ve Profil

- `GET /api/users?search=emir`: kayıtlı kullanıcıları filtreler.
- `GET /api/users/{userId}`: public profil görünümünü döndürür.
- `GET /api/users/me`: mevcut kullanıcı profilini döndürür.
- `PATCH /api/users/me`: profile ait izinli alanları günceller.

Response içindeki `isBot` automation hesabının normal kullanıcı login'i için
kullanılmaması gerektiğini gösterir. `automationId` yalnızca built-in demo
hesaplarını BOT API'de kısa referansla kullanmak içindir.

<!-- pagebreak -->

## 7. Conversation ve Grup API

### 7.1. Direkt Sohbet

`POST /api/conversations/direct`

```json
{
  "participantId": "user-uuid"
}
```

Davranış:

- JWT sahibi ile hedef kullanıcı arasında aktif direkt sohbet arar.
- Varsa mevcut sohbeti döndürür.
- Kullanıcı daha önce kendi görünümünden sohbeti sildiyse görünür hale getirir.
- Yoksa iki katılımcılı yeni direkt sohbet oluşturur.
- Kişinin kendisiyle sohbet açmasına izin verilmez.

### 7.2. Manuel Grup Oluşturma

`POST /api/conversations/groups` yalnızca global admin içindir.

```json
{
  "name": "Staj Proje Ekibi",
  "description": "Release koordinasyonu",
  "participantIds": ["user-uuid-1", "user-uuid-2"],
  "managerIds": ["user-uuid-1"],
  "memberCanSendMessages": false,
  "membersCanLeave": true
}
```

Kurallar:

- Grup adı 3-80 karakterdir.
- Açıklama en fazla 300 karakterdir.
- participantIds boş olamaz, UUID v4 ve tekil olmalıdır.
- Oluşturan admin `owner` olur.
- managerIds içindekiler gruba eklenir ve `manager` rolü alır.
- Normal üyelerin mesaj izni varsayılan `false` değeridir.
- Üyelerin ayrılma izni varsayılan `true` değeridir.
- Grup oluşturma ve ilk sistem mesajı realtime yayınlanır.

### 7.3. Listeleme ve Pagination

`GET /api/conversations`

Query:

| Alan | Kural |
| --- | --- |
| `type` | `direct`, `group` veya `management` |
| `search` | Ad, externalRef, participant username/email |
| `limit` | 1-100, varsayılan 50 |
| `offset` | 0 veya üzeri, varsayılan 0 |

Her item `participantCount`, `lastMessage`, `unreadCount`, `isBookmarked` ve
`isArchived` özetlerini içerir. Yönetim sohbetleri yetkisiz kullanıcıların
normal listesine girmez.

### 7.4. Kullanıcıya Özel Sohbet Tercihleri

- `PATCH /api/conversations/{id}/bookmark`: pinned/bookmarked durumunu toggle
  eder.
- `PATCH /api/conversations/{id}/archive`: arşiv durumunu toggle eder.
- `DELETE /api/conversations/{id}`: sohbeti yalnızca mevcut kullanıcının
  listesinden gizler.

Bu işlemler conversation'ı veya diğer kullanıcının görünümünü fiziksel olarak
silmez. Tercihler PostgreSQL'de `conversation_preferences` tablosunda tutulur.

### 7.5. Grup Güncelleme

`PATCH /api/conversations/{id}`

```json
{
  "name": "Yeni Grup Adı",
  "description": "Yeni açıklama",
  "memberCanSendMessages": true,
  "membersCanLeave": false,
  "status": "active"
}
```

- Manager ad ve açıklamayı değiştirebilir.
- Owner veya global admin mesaj/ayrılma/durum politikasını değiştirebilir.
- `closed` veya `archived` gruplar yeni kullanıcı mesajı kabul etmez.
- Değişiklik `conversation:updated` olarak realtime yayınlanır.

### 7.6. Owner Devri

`PATCH /api/conversations/{id}/owner`

```json
{
  "userId": "active-participant-uuid"
}
```

Yalnızca manuel gruplarda geçerlidir. BOT grubunun insan owner'ı olmadığı için
bu endpoint BOT grubu için reddedilir. Hedef kullanıcının aktif katılımcı
olması gerekir.

### 7.7. Katılımcı Yönetimi

| Endpoint | İşlem |
| --- | --- |
| `GET /{id}/participants` | Aktif/pasif katılımcı görünümü |
| `POST /{id}/participants` | Kullanıcı ekleme veya yeniden aktifleştirme |
| `DELETE /{id}/participants/{userId}` | Kullanıcı çıkarma |
| `PATCH /{id}/participants/{userId}/role` | manager/member rolü |
| `POST /{id}/leave` | Mevcut kullanıcının ayrılması |

Manager yalnızca normal member çıkarabilir. Owner çıkarılamaz; önce ownership
devredilmelidir. Automation bot manager yapılamaz.

Katılımcı değişiklikleri `participant:added`, `participant:removed`,
`participant:left` ve çıkarılan kullanıcı için `conversation:left` olaylarını
üretir.

### 7.8. Gizli Yönetim Sohbeti

`GET /api/conversations/{groupId}/management`

Yalnızca grubun owner, manager ve gruba katılmış global admin kullanıcıları
erişebilir. Normal member için bilgi sızdırmamak amacıyla erişim bulunamadı
gibi davranabilir. Yönetim sohbeti ana grubun `parentConversationId`
ilişkisiyle tekilleştirilir.

<!-- pagebreak -->

## 8. Mesaj, Reply, Attachment ve Okunma API

### 8.1. Mesaj Gönderme

`POST /api/conversations/{conversationId}/messages`

```json
{
  "content": "Selam ekip",
  "clientMessageId": "3f0fe459-3816-4b83-b60a-5d195797f030",
  "replyToMessageId": "message-uuid",
  "isForwarded": false
}
```

Kurallar:

- Content 1-2000 karakterdir.
- Gönderen aktif katılımcı olmalıdır.
- Direkt sohbet ve izinli grup politikası gerekir.
- System message kullanıcı tarafından düzenlenemez veya silinemez.
- Reply hedefi aynı conversation içinde bulunmalı ve silinmemiş olmalıdır.
- Başarı sonrasında `message:new` realtime olayı yayınlanır.

### 8.2. Mesaj İdempotency

`clientMessageId` istemcinin ürettiği UUID v4 retry anahtarıdır.

- Aynı sender + clientMessageId + conversation + content tekrarında mevcut
  mesaj döner.
- Aynı id farklı conversation veya content ile kullanılırsa `409 Conflict`
  döner.
- Database'de `(senderId, clientMessageId)` unique kuralı vardır.

Bu mekanizma Socket ACK kaybolması veya REST fallback nedeniyle oluşabilecek
çift mesajları engeller.

### 8.3. Reply

Message response:

```json
{
  "replyToMessageId": "original-message-uuid",
  "replyTo": {
    "id": "original-message-uuid",
    "content": "Yanıtlanan mesaj",
    "senderId": "sender-uuid",
    "attachments": []
  }
}
```

`replyTo` snapshot görünümü UI'ın alıntı kutusunu çizmesini sağlar.
Yanıtlanan mesaj daha sonra fiziksel olarak kaybolursa self-reference
`SetNull` davranışıyla reply mesajı korunur.

### 8.4. Attachment Yükleme

`POST /api/conversations/{id}/messages/attachments`

Form alanları:

| Alan | Kural |
| --- | --- |
| `files` | Zorunlu, en fazla 5 dosya |
| `content` | Opsiyonel, en fazla 2000 karakter |
| `clientMessageId` | Opsiyonel UUID v4 |
| `replyToMessageId` | Opsiyonel UUID v4 |
| `isForwarded` | Opsiyonel boolean |

Her dosya en fazla 5 MB'dir. Desteklenen MIME aileleri:

- JPEG, PNG, GIF, WebP.
- PDF ve plain text.
- MP3, WAV, OGG, WebM audio ve MP4 audio.

Backend yalnızca tarayıcının söylediği MIME değerine güvenmez; magic bytes /
dosya imzasını kontrol eder. Binary veri PostgreSQL `Bytes` alanında tutulur.

### 8.5. Attachment İndirme

`GET /api/conversations/{conversationId}/attachments/{attachmentId}`

- JWT zorunludur.
- Aktif conversation katılımcılığı doğrulanır.
- Response standart JSON zarfına alınmaz.
- Görseller `inline`, diğer dosyalar `attachment` disposition ile döner.
- UTF-8 dosya adı `filename*` ile encode edilir.

### 8.6. Mesaj Geçmişi ve Arama

`GET /api/conversations/{id}/messages`

- `limit`: 1-100, varsayılan 50.
- `before`: ISO-8601 cursor.
- `nextBefore`: sonraki sayfanın cursor değeri.

`GET /api/conversations/{id}/messages/search`

- `q`: boş olmayan metin.
- `limit`: 1-50, varsayılan 20.
- Soft delete mesajlar sonuçlara girmez.

### 8.7. Düzenleme ve Silme

- `PATCH /{id}/messages/{messageId}`: yalnızca gönderen, 1-2000 karakter.
- `DELETE /{id}/messages/{messageId}`: yalnızca gönderen.

Silme soft delete'tir:

- `content` temizlenir.
- `deletedAt` yazılır.
- Attachment binary kayıtları temizlenir.
- Mesaj sıralama/pagination içinde silinmiş kayıt olarak kalabilir.
- `message:deleted` realtime olayı yayınlanır.

### 8.8. Okundu ve Okunmadı

- `PATCH /api/conversations/{id}/read`: `lastReadAt` değerini şimdi yapar.
- `PATCH /api/conversations/{id}/messages/{messageId}/unread`: seçili mesaja
  göre conversation'ı okunmadı konumuna çeker.
- Socket eşleniği `message:read` olayıdır.

<!-- pagebreak -->

## 9. Bookmark, Contact Invitation, Ticket ve Call API

### 9.1. Mesaj Bookmark

| Endpoint | İşlem |
| --- | --- |
| `GET /api/bookmarks` | Kullanıcının kayıtlı mesajları |
| `POST /api/bookmarks` | Mesajı kaydet |
| `PATCH /api/bookmarks/{messageId}` | Opsiyonel başlığı güncelle |
| `DELETE /api/bookmarks/{messageId}` | Bookmark bağını kaldır |

```json
{
  "messageId": "message-uuid",
  "title": "Takip edilecek mesaj"
}
```

Bookmark kullanıcıya özeldir; asıl mesaj veya karşı taraf etkilenmez. Aynı
mesajı tekrar bookmark etmek duplicate oluşturmaz.

### 9.2. Contact Invitation

`POST /api/contact-invitations`

```json
{
  "email": "user@example.com",
  "message": "ellO üzerinden bağlantı kuralım."
}
```

Kurallar:

- Kişi kendisine davet gönderemez.
- Automation bot davet alamaz.
- Zaten direct conversation varsa kullanıcılar contact kabul edilir ve yeni
  davet reddedilir.
- Aynı çift için bekleyen davet tekilleştirilir.

`GET /api/contact-invitations` yalnızca mevcut kullanıcının bekleyen gelen
davetlerini döndürür.

`PATCH /api/contact-invitations/{id}`

```json
{
  "status": "accepted"
}
```

Yalnızca `accepted` veya `declined` kabul edilir. Kabul edilince direkt
conversation oluşturulur veya mevcut conversation döndürülür. Sonuç
`contact:invitation:updated` olayıyla iki kullanıcıya yayınlanır.

### 9.3. Support Ticket

Ticket endpointlerinin tamamı JWT ister.

| İşlem | Normal user | Global admin |
| --- | --- | --- |
| Ticket oluşturma | Evet | Evet |
| Listeleme | Yalnızca kendi ticketları | Tümü |
| Detay | Yalnızca kendi ticketı | Tümü |
| Claim | Hayır | Evet |
| Atama/devretme | Hayır | Evet |
| İçerik/durum güncelleme | Hayır | Atanmış admin |

Create:

```json
{
  "subject": "Release grubuna katılamıyorum",
  "message": "Grup açılıyor fakat katılma işlemi hata veriyor.",
  "priority": "high"
}
```

Query filtreleri:

- `assignment`: `all`, `mine`, `unassigned`.
- `status`: `open`, `in_progress`, `resolved`, `closed`.
- `priority`: `low`, `medium`, `high`.
- `search`, `limit` ve `offset`.

### 9.4. Ticket Optimistic Concurrency

Claim, assignee ve update istekleri `expectedVersion` taşır:

```json
{
  "expectedVersion": 3,
  "status": "resolved",
  "adminNote": "Sorun giderildi."
}
```

Gönderilen version güncel kayıtla eşleşmezse `409 Conflict` döner. İstemci
ticket'ı yeniden okuyup kullanıcının değişikliklerini güncel sürüme uygulamalı,
sonra tekrar denemelidir.

Her create, assign, unassign, transfer, status, priority ve note değişikliği
`support_ticket_activities` tablosuna actor ve zaman bilgisiyle yazılır.

### 9.5. Çağrı Geçmişi REST Endpointi

`GET /api/calls`

Mevcut kullanıcının en son birebir sesli aramalarını döndürür:

- incoming/outgoing yönü.
- ringing/active/completed/missed/declined/failed durumu.
- başlangıç, cevap ve bitiş zamanı.
- süre, bitiş nedeni ve karşı taraf profili.

Çağrı başlatma REST ile değil Socket.IO üzerinden yapılır.

<!-- pagebreak -->

## 10. BOT Otomasyon API

### 10.1. Kimlik Doğrulama

Bütün BOT endpointleri:

```http
x-bot-secret: <BOT_WEBHOOK_SECRET>
Content-Type: application/json
```

Header eksik veya yanlışsa `401 Invalid bot secret` döner. Secret loglanmamalı,
frontend bundle'ına konmamalı ve dış kullanıcıya verilmemelidir.

### 10.2. Otomasyon Grubu Oluşturma

Canonical endpoint:

`POST /api/bot/groups`

Java uyumluluk alias'ı:

`POST /api/bot/create-group`

```json
{
  "name": "Destek Talebi #4821",
  "description": "Müşteri destek koordinasyonu",
  "participantIds": ["2", "4"],
  "managerIds": ["1"],
  "memberCanSendMessages": false,
  "membersCanLeave": false,
  "sourceName": "Support System",
  "externalRef": "ticket-4821",
  "initialBotMessage": "Destek talebi alındı."
}
```

Alan kuralları:

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `name` | Evet | 3-80 karakter |
| `participantIds` | Evet | Boş olmayan tekil string listesi |
| `managerIds` | Hayır | Tekil string listesi |
| `ownerId` | Hayır | Deprecated; manager olarak yorumlanır |
| `description` | Hayır | En fazla 300 |
| `memberCanSendMessages` | Hayır | Varsayılan false |
| `membersCanLeave` | Hayır | Varsayılan false |
| `sourceName` | Hayır | En fazla 80 |
| `externalRef` | Hayır | En fazla 120, idempotency anahtarı |
| `initialSystemMessage` | Hayır | Legacy, en fazla 500 |
| `initialBotMessage` | Hayır | Tercih edilen alan, en fazla 2000 |

Participant ve manager referansları:

- Normal hesaplar UUID ile gönderilir.
- Built-in demo hesapları `1` ile `6` arasındaki automationId ile
  gönderilebilir.
- Manager listesinde olup participant listesinde olmayan kişi otomatik
  katılımcı olur.
- ellO Automation Bot gruba otomatik eklenir.

### 10.3. externalRef İdempotency

`externalRef` aynı dış olayın güvenli retry edilmesini sağlar.

İlk istek:

```json
{
  "created": true,
  "reused": false
}
```

Aynı externalRef ile tekrar:

```json
{
  "created": false,
  "reused": true
}
```

Tekrar isteğinin farklı name/policy alanları mevcut gruba uygulanmaz. Ayar
değişikliği için PATCH endpointi kullanılır. Farklı externalRef değerleriyle
birden fazla bot grubu aynı anda oluşturulabilir.

### 10.4. Katılımcı Ekleme

`POST /api/bot/groups/{conversationId}/participants`

```json
{
  "participantIds": ["2", "4"],
  "managerIds": ["1"]
}
```

Her liste en fazla 50 referans kabul eder. Mevcut katılımcı duplicate olmaz;
daha önce ayrılmış kullanıcı yeniden aktifleştirilebilir.

### 10.5. Bot Mesajı

`POST /api/bot/groups/{conversationId}/messages`

```json
{
  "content": "Ticket önceliği high olarak değiştirildi.",
  "clientMessageId": "3f0fe459-3816-4b83-b60a-5d195797f030"
}
```

Mesaj PostgreSQL'e Automation Bot senderId ile yazılır ve `message:new`
olayıyla bağlı istemcilere iletilir. clientMessageId dış servisin retry
tekilleştirme anahtarıdır.

### 10.6. Grup ve Rol Güncelleme

- `PATCH /api/bot/groups/{conversationId}`: ad, açıklama, policy ve status.
- `PATCH /api/bot/groups/{conversationId}/participants/{userId}/role`:
  manager/member.

Bu endpointler yalnızca `isBotManaged=true` conversation kabul eder.

<!-- pagebreak -->

## 11. Socket.IO Sözleşmesi

### 11.1. Bağlantı

Namespace:

```text
/chat
```

Önerilen bağlantı:

```javascript
const socket = io("http://localhost:3000/chat", {
  auth: { token: accessToken }
});
```

Alternatif olarak handshake `Authorization: Bearer <jwt>` header'i kabul
edilir. Token geçersizse server `exception` olayı gönderir ve bağlantıyı
kapatır.

### 11.2. ACK Zarfı

Client callback verirse:

```javascript
socket.emit("message:send", payload, (response) => {
  if (!response.success) {
    console.error(response.code, response.message);
  }
});
```

Başarı:

```json
{
  "success": true,
  "data": {}
}
```

Hata:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid socket payload",
  "errors": [],
  "timestamp": "2026-07-27T10:00:00.000Z"
}
```

ACK callback yoksa hata `exception` push olayı olarak gönderilir.

### 11.3. Socket Rate Limit

Varsayılan olarak socket başına 10 saniyede 60 event kabul edilir. Bütün event
adları aynı bucket'ı paylaşır. Limit aşılırsa:

```json
{
  "success": false,
  "code": "RATE_LIMITED",
  "message": "Too many socket events",
  "event": "message:send",
  "retryAfterMs": 4200
}
```

### 11.4. Session ve Reconnect

Bağlantı sonrası `session:ready`:

```json
{
  "userId": "user-uuid",
  "conversationIds": ["conversation-uuid"],
  "connectedAt": "2026-07-27T10:00:00.000Z"
}
```

Reconnect sonrası client:

```javascript
socket.emit("conversation:sync", {
  conversationIds: visibleConversationIds
});
```

Liste en fazla 100 tekil UUID içerir. Server her conversation için üyeliği
doğrular, room'a katılır ve `conversation:synced` gönderir.

### 11.5. Presence

- Bir kullanıcının birden fazla browser tab/socket bağlantısı olabilir.
- Kullanıcı son socket'i kapanana kadar online kabul edilir.
- `presence:sync` contact snapshot ister.
- `presence:contacts` direkt/grup sohbetlerindeki erişilebilir peer'ları
  döndürür.
- `presence:snapshot` conversation room katılımcılarını döndürür.
- `presence:online` ve `presence:offline` değişimleri yayınlanır.

### 11.6. Mesaj ve Conversation Eventleri

| Client event | Server push | Açıklama |
| --- | --- | --- |
| `conversation:join` | `conversation:joined`, `presence:snapshot` | Room'a katıl |
| `conversation:sync` | `conversation:synced` | Reconnect room restore |
| `conversation:unsubscribe` | Yok, ACK | Room dinlemeyi bırak |
| `conversation:leave` | `participant:left`, `conversation:left` | Gruptan ayrıl |
| `conversation:update` | `conversation:updated` | Grup adını güncelle |
| `conversation:transfer-owner` | `conversation:updated` | Owner devri |
| `message:send` | `message:new` | Kalıcı mesaj |
| `message:update` | `message:updated` | Gönderenin mesaj düzenlemesi |
| `message:delete` | `message:deleted` | Soft delete |
| `message:read` | `message:read` | Okuma durumu |
| `typing:start` | `typing:started` | Geçici typing durumu |
| `typing:stop` | `typing:stopped` | Typing bitti |

REST üzerinden yapılan değişiklikler de aynı server push olaylarını üretir.
Room'a henüz join olmamış fakat aktif participant olan kullanıcının `user:{id}`
odası da hedeflenir.

### 11.7. Contact ve Participant Push Olayları

- `contact:invitation:new`
- `contact:invitation:updated`
- `conversation:created`
- `conversation:updated`
- `participant:added`
- `participant:removed`
- `participant:left`
- `conversation:left`

Çıkarılan kullanıcının bütün aktif socketleri conversation room'undan
çıkarılır; sonraki mesaj eventlerini almaya devam etmez.

<!-- pagebreak -->

## 12. WebRTC Çağrı Sinyalleşmesi

### 12.1. Çağrı Kısıtları

- Yalnızca direct conversation.
- Hedef aktif participant ve farklı kullanıcı olmalıdır.
- Automation bot aranamaz.
- Alıcı online olmalıdır.
- Taraflardan biri başka bir çağrıdaysa `USER_BUSY`.
- Ring timeout 30 saniyedir.
- Socket kopmasında 15 saniyelik reconnect grace uygulanır.

### 12.2. Çağrı Başlatma

```javascript
socket.emit("call:start", {
  conversationId: "conversation-uuid",
  targetUserId: "recipient-uuid"
}, ack);
```

Alıcıya `call:incoming`, arayana ACK döner. CallRecord PostgreSQL'e `ringing`
olarak yazılır.

### 12.3. Kabul ve Red

```javascript
socket.emit("call:accept", { callId }, ack);
socket.emit("call:reject", { callId, reason: "declined" }, ack);
```

Kabulde arayana `call:accepted`, alıcının diğer sekmelerine
`call:answered-elsewhere` gider. Red nedenleri `declined` veya `busy` olabilir.

### 12.4. SDP ve ICE Sinyalleri

```json
{
  "callId": "call-uuid",
  "signalType": "offer",
  "sdp": "..."
}
```

```json
{
  "callId": "call-uuid",
  "signalType": "ice-candidate",
  "candidate": "...",
  "sdpMid": "0",
  "sdpMLineIndex": 0,
  "usernameFragment": "..."
}
```

- Offer yalnızca caller tarafından gönderilir.
- Answer yalnızca recipient tarafından gönderilir.
- ICE candidate her iki tarafça gönderilebilir.
- Sinyalleşme yalnızca active çağrıda yapılır.
- SDP en fazla 20.000, candidate en fazla 4096 karakterdir.

### 12.5. Sync, Recover ve End

- `call:sync`: reconnect sonrası kullanıcının aktif çağrısını döndürür.
- `call:recover`: recipient yeniden bağlandığında caller'dan offer yenilemesini
  `call:recovery-needed` ile ister.
- `call:end`: çağrıyı bitirir.
- `call:ended`: iki tarafa neden ve endedBy gönderir.
- `call:history-updated`: Calls sekmesinin REST geçmişini yenilemesini sağlar.

### 12.6. Çağrı Hata Kodları

| Kod | Anlam |
| --- | --- |
| `DIRECT_CALLS_ONLY` | Grup/yönetim sohbetinde çağrı |
| `INVALID_CALL_RECIPIENT` | Hedef aktif katılımcı değil |
| `CALL_USER_NOT_FOUND` | Kullanıcı kaydı yok |
| `BOT_CALLS_NOT_SUPPORTED` | Bot çağrıya katılamaz |
| `RECIPIENT_OFFLINE` | Alıcı online değil |
| `USER_BUSY` | Taraflardan biri başka çağrıda |
| `CALL_CANNOT_BE_ACCEPTED` | Ringing çağrı artık kabul edilemez |
| `CALLER_OFFLINE` | Arayan erişilebilir değil |
| `CALL_NOT_ACTIVE` | Aktif olmayan çağrıda signaling |
| `INVALID_CALL_SIGNAL` | Rol veya payload yanlış |
| `CALL_NOT_FOUND` | Çağrı yok ya da kullanıcı taraf değil |
| `CALL_CANNOT_BE_RECOVERED` | Recovery koşulları sağlanmıyor |

<!-- pagebreak -->

## 13. Java Webhook Servisi

### 13.1. Amaç

Java servisi dış ticket sistemini ellO BOT API'ye bağlayan doğrulamalı bir
adaptördür. Veritabanına doğrudan erişmez, Socket.IO bağlantısı kurmaz ve
mesajlaşma iş kurallarını kopyalamaz.

Tek sorumluluğu:

1. Dış webhook token'ını doğrulamak.
2. Ticket payload'ını validate etmek.
3. BOT grup request'ine map etmek.
4. NestJS'e sınırlı timeout/retry ile iletmek.
5. Backend başarısızsa dış sisteme kontrollü hata döndürmek.

### 13.2. Teknoloji ve Runtime

| Alan | Değer |
| --- | --- |
| Dil | Java 17 |
| Framework | Spring Boot 4.1 / Spring Web MVC |
| HTTP client | Spring RestClient + JDK HttpClient |
| Validation | Jakarta Bean Validation |
| Build | Maven Wrapper |
| Artifact | Executable JAR |
| Container user | Non-root `ello` |
| Varsayılan port | 8080 |

### 13.3. Liveness

`GET /health`

```json
{
  "status": "ok",
  "service": "ello-java-webhook",
  "timestamp": "2026-07-27T10:47:47.814Z"
}
```

Bu endpoint NestJS'e istek atmaz. Java process cevap verebiliyorsa 200 döner.
Docker healthcheck bunu kullanır.

### 13.4. Readiness

`GET /ready`

Hazır:

```json
{
  "status": "ready",
  "service": "ello-java-webhook",
  "dependencies": {
    "chatBackend": {
      "status": "up"
    }
  },
  "timestamp": "2026-07-27T10:47:47.827Z"
}
```

NestJS health çağrısı başarısız:

```json
{
  "status": "not_ready",
  "service": "ello-java-webhook",
  "dependencies": {
    "chatBackend": {
      "status": "down"
    }
  },
  "timestamp": "2026-07-27T10:47:47.827Z"
}
```

İkinci durumda HTTP 503 döner fakat Java process çalışmaya devam eder.

### 13.5. Ticket Webhook Endpointi

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
  "participantIds": [
    "00000000-0000-4000-8000-000000000002"
  ]
}
```

Validation:

| Alan | Kural |
| --- | --- |
| `eventType` | Zorunlu ve tam olarak `ticket.created` |
| `ticketId` | Boş olmayan string |
| `ownerId` | Zorunlu UUID |
| `title` | Boş olmayan string |
| `participantIds` | Boş olmayan UUID listesi, null eleman yok |

Token karşılaştırması `MessageDigest.isEqual` ile yapılır. Eksik veya geçersiz
token için 401 döner ve NestJS çağrılmaz.

### 13.6. Java -> NestJS Mapping

| Java webhook alanı | BOT API alanı |
| --- | --- |
| `ownerId` | Deprecated `ownerId`, manager olarak yorumlanır |
| `title.trim()` | `name` |
| `participantIds` | `participantIds` |
| `ticketId.trim()` | `externalRef` |
| Otomatik metin | `initialSystemMessage` |

Java'nın ürettiği başlangıç mesajı:

```text
Ticket <ticketId> created via webhook
```

Java servisi NestJS'e:

```http
POST /api/bot/create-group
x-bot-secret: <BOT_WEBHOOK_SECRET>
```

çağrısını yapar. NestJS response body Java tarafından değiştirilmeden dış
sisteme döndürülür ve başarılı webhook statusu 201 olur.

### 13.7. Timeout

| Ayar | Varsayılan |
| --- | --- |
| Connection timeout | 1 saniye |
| Read timeout | 3 saniye |
| Maksimum deneme | 2 |
| Denemeler arası bekleme | 100 ms |

Connection ve read timeout değerleri sıfırdan büyük olmalıdır.

### 13.8. Retry Politikası

Retry yapılır:

- Connection failure.
- Connection/read timeout.
- NestJS `5xx` response.

Retry yapılmaz:

- NestJS `4xx` response.
- Java validation hatası.
- Geçersiz incoming webhook token.

`CHAT_BACKEND_MAX_ATTEMPTS` 1-3 arasında, retry delay 0ms-2s arasında olmak
zorundadır. Böylece yanlış yapılandırma servisi uzun süre bloklayamaz.

### 13.9. Hata Çevirme

NestJS son denemede kabul etmez veya erişilemezse:

```json
{
  "statusCode": 502,
  "message": "Chat backend is unavailable",
  "timestamp": "2026-07-27T10:00:00Z"
}
```

Java webhook bu durumda başarılı sayılmaz. Dış sistem retry politikasını kendi
event id'si/ticketId değeriyle uygulayabilir. NestJS externalRef idempotency
aynı ticket'ın ikinci grup oluşturmasını engeller.

### 13.10. Java Ortam Değişkenleri

| Değişken | Zorunlu | Varsayılan | Açıklama |
| --- | --- | --- | --- |
| `JAVA_WEBHOOK_PORT` | Hayır | 8080 | HTTP portu |
| `WEBHOOK_SECRET` | Evet | Yok | Dış sistem token'ı |
| `BOT_WEBHOOK_SECRET` | Evet | Yok | NestJS BOT secret |
| `CHAT_BACKEND_BASE_URL` | Hayır | `http://localhost:3000` | NestJS taban adresi |
| `CHAT_BACKEND_CONNECT_TIMEOUT` | Hayır | `1s` | Bağlantı timeout |
| `CHAT_BACKEND_READ_TIMEOUT` | Hayır | `3s` | Response timeout |
| `CHAT_BACKEND_MAX_ATTEMPTS` | Hayır | `2` | Toplam deneme, 1-3 |
| `CHAT_BACKEND_RETRY_DELAY` | Hayır | `100ms` | Retry bekleme, 0-2s |

<!-- pagebreak -->

### 13.11. Java Docker Image

Multi-stage Dockerfile:

1. Maven/Temurin build katmanı dependency indirir ve test/package çalıştırır.
2. Runtime yalnızca Temurin 17 JRE ve JAR içerir.
3. Kaynak kod, Maven cache ve build araçları runtime'a taşınmaz.
4. Process non-root `ello` kullanıcısıyla çalışır; JVM
   `MaxRAMPercentage=75.0` ayarıyla container belleğini sınırlar.

## 14. Uçtan Uca İstek Örnekleri

### 14.1. Login ve JWT Kullanımı

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"emiradmin@ello.com","password":"123456"}'

$token = $login.data.accessToken
$headers = @{ Authorization = "Bearer $token" }

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:3000/api/auth/me" `
  -Headers $headers
```

Token ekrana veya loga yazdırılmamalıdır.

### 14.2. Direkt Sohbet ve Mesaj

```powershell
$conversation = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/conversations/direct" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"participantId":"<USER_UUID>"}'

$conversationId = $conversation.data.id
$clientMessageId = [guid]::NewGuid().ToString()

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/api/conversations/$conversationId/messages" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    content = "API üzerinden merhaba"
    clientMessageId = $clientMessageId
  } | ConvertTo-Json)
```

### 14.3. Swagger ile BOT Grubu

1. `http://localhost:3000/api/docs` açılır.
2. `bot` başlığı genişletilir.
3. `POST /api/bot/groups` için Try it out seçilir.
4. `x-bot-secret` alanına root `.env` içindeki değer yerel olarak girilir.
5. Farklı her senaryo için farklı `externalRef` kullanılır.

```json
{
  "name": "Swagger Bot Test",
  "participantIds": ["2", "4"],
  "managerIds": ["1"],
  "memberCanSendMessages": false,
  "membersCanLeave": false,
  "sourceName": "Swagger",
  "externalRef": "swagger-demo-001",
  "initialBotMessage": "Grup dış API tarafından oluşturuldu."
}
```

### 14.4. Java Webhook Çağrısı

```powershell
$headers = @{
  "X-Webhook-Token" = "<WEBHOOK_SECRET>"
}

$body = @{
  eventType = "ticket.created"
  ticketId = "TICKET-9001"
  ownerId = "<ADMIN_UUID>"
  title = "Ticket TICKET-9001"
  participantIds = @("<USER_UUID>")
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/webhook/ticket-created" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $body
```

### 14.5. Retry Testi

Aynı ticketId ile Java webhook çağrısı tekrarlandığında Java aynı externalRef'i
NestJS'e yollar. Beklenen:

- İlk cevapta `created=true`.
- Tekrarda `reused=true`.
- Uygulamada ikinci grup oluşmaz.
- Başlangıç mesajı ikinci kez yazılmaz.

<!-- pagebreak -->

## 15. Docker, Yapılandırma ve Production Kuralları

### 15.1. Tam Stack

```powershell
docker compose up -d --build
docker compose ps
npm.cmd run test:full-stack
```

Beklenen:

- postgres healthy.
- migrate ve built-in bootstrap exit 0.
- backend, java-webhook ve frontend healthy.
- full-stack test `"ok": true`.

### 15.2. NestJS Önemli Ortam Değişkenleri

| Değişken | Varsayılan | Production kuralı |
| --- | --- | --- |
| `NODE_ENV` | development | `production` |
| `PORT` | 3000 | Geçerli port |
| `API_PREFIX` | api | Boş olamaz |
| `CORS_ORIGIN` | `*` | Wildcard yasak |
| `SWAGGER_ENABLED` | Dev true | Gerekmiyorsa false |
| `BODY_LIMIT` | 1mb | b/kb/mb formatı |
| `DATABASE_URL` | Opsiyonel dev | PostgreSQL URL zorunlu |
| `JWT_SECRET` | Dev fallback | En az 32 rastgele karakter |
| `JWT_EXPIRES_IN` | 1d | Risk politikasına göre |
| `BOT_WEBHOOK_SECRET` | Dev fallback | En az 32 farklı karakter |
| `RATE_LIMIT_TTL_MS` | 60000 | Pozitif integer |
| `RATE_LIMIT_MAX` | 120 | Pozitif integer |
| `SOCKET_RATE_LIMIT_TTL_MS` | 10000 | Pozitif integer |
| `SOCKET_RATE_LIMIT_MAX` | 60 | Pozitif integer |
| `DEMO_USERS_ENABLED` | Dev true | false |
| `DEV_ROUTES_ENABLED` | Dev true | false |
| `SERVE_DEMO_UI` | Dev true | false |

Production başlangıcı şu durumlarda bilerek başarısız olur:

- DATABASE_URL yok veya PostgreSQL URL değil.
- CORS wildcard.
- JWT/BOT secret kısa, placeholder veya bilinen development değeri.
- Demo users, dev routes veya demo UI açık.

### 15.3. Secret Yönetimi

- Root `.env` Git tarafından izlenmez.
- JWT, BOT ve incoming webhook secret birbirinden farklı tutulur.
- Secret değerleri Swagger screenshot, PDF, log veya commit içine girmez.
- Bir secret sızarsa yalnızca dosyadan silmek yeterli değildir; değer rotate
  edilmelidir.

<!-- pagebreak -->

## 16. Test, Gözlem ve Troubleshooting

### 16.1. Backend Testleri

```powershell
cd backend
npm.cmd run typecheck
npm.cmd run test:typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run prisma:validate
npm.cmd run db:audit
```

### 16.2. Java Testleri

```powershell
cd java-webhook
.\mvnw.cmd test
```

Test edilen davranışlar:

- Secret boşsa startup reddi.
- Geçersiz incoming token'ın forward edilmemesi.
- Payload validation.
- BOT path/header/body mapping.
- 4xx için retry yapılmaması.
- 5xx ve connection timeout için sınırlı retry.
- Controlled 502.
- Connect/read timeout.
- Liveness/readiness ayrımı.

### 16.3. Contract ve Full Stack

```powershell
npm.cmd run test:contract
npm.cmd run test:full-stack
```

Contract testi Postman/Newman koleksiyonunu çalıştırır. Full-stack testi
frontend proxy, backend health/Swagger, Java health/readiness, auth, role,
ticket, direct/group socket, attachment ve webhook akışlarını birlikte
doğrular.

### 16.4. Sık Hatalar

| Belirti | Olası neden | Kontrol |
| --- | --- | --- |
| `401 Unauthorized` REST | JWT eksik/süresi dolmuş | Authorization header |
| `401 Invalid bot secret` | Yanlış secret sınırı | `x-bot-secret` |
| Java webhook 401 | Incoming token yanlış | `X-Webhook-Token` |
| Java webhook 400 | JSON/UUID/eventType validation | Request body |
| Java webhook 502 | NestJS 4xx/5xx veya erişilemiyor | backend log + `/ready` |
| Java `/ready` 503 | Backend health down | `/api/health`, compose ps |
| `429 Too Many Requests` | Login/global limit | Retry-After ve bekleme |
| Socket `VALIDATION_ERROR` | Fazla/eksik/yanlış payload | DTO event sözleşmesi |
| Socket `RATE_LIMITED` | 10 saniyede event limiti | retryAfterMs |
| Mesaj iki kez | clientMessageId yok | UUID retry anahtarı |
| Bot grubu tekrar kullanılıyor | externalRef aynı | Yeni olayda yeni externalRef |
| Attachment 400 | Boyut/tür/imza uyuşmuyor | 5 MB, whitelist, gerçek dosya |
| Call hemen bitiyor | Offline/busy/reconnect | socket ve call hata kodu |

### 16.5. Log ve Metrics

Backend request logger request id, method, route, status ve süreyi structured
olarak loglar. Socket bağlantı ve çağrı yaşam döngüsü de ID'lerle loglanır.
Secret ve tam payload loglanmamalıdır.

Admin metrics endpointi hızlı teşhis için kullanılabilir; production
observability yerine geçmez. Uzun vadede Prometheus/OpenTelemetry ve merkezi
log toplama önerilir.

<!-- pagebreak -->

## 17. Güvenlik ve v0.1 Sınırları

### 17.1. Mevcut Koruma

- JWT ve role/participant kontrolleri.
- Ayrı BOT ve incoming webhook secret.
- Constant-time incoming token karşılaştırması.
- Global DTO whitelist.
- HTTP ve socket rate limit.
- Helmet, CORS ve body limiti.
- Password hash.
- Attachment signature kontrolü.
- Idempotent message ve automation group işlemleri.
- Optimistic ticket concurrency.
- Non-root Java ve backend container kullanıcıları.

### 17.2. v0.1 İçin Bilinen Sınırlar

- JWT frontend localStorage'da tutulur.
- Password değişimi mevcut JWT'leri revoke etmez.
- Java incoming webhook HMAC signature/timestamp kullanmaz; shared token
  kullanır.
- BOT secret tek shared secret'tır, client bazlı key/permission yoktur.
- Java retry senkron ve kısa süreli blocking bekleme kullanır.
- Çağrı session state gateway memory'sindedir; backend restartında aktif çağrı
  kurtarılamaz.
- Presence ve in-process metrics backend instance memory'sindedir.
- Tek instance Socket.IO varsayımı vardır; yatay ölçek için Redis adapter
  gerekir.
- TURN production ortamında ayrıca yapılandırılmalıdır.
- Swagger production'da açık bırakılacaksa erişim kontrolü düşünülmelidir.

### 17.3. Production Yol Haritası

1. Incoming webhook için HMAC + timestamp + replay cache.
2. BOT client başına key, scope ve audit kaydı.
3. JWT refresh token rotation ve token revocation.
4. Redis Socket.IO adapter ve shared presence/call state.
5. Async queue ile webhook retry/dead-letter.
6. Prometheus/OpenTelemetry ve merkezi log.
7. Strict CSP/Permissions-Policy.
8. Production TURN ve TLS.

<!-- pagebreak -->

## 18. OpenAPI Endpoint Kataloğu

Bu bölüm `docs/openapi.snapshot.json` dosyasından otomatik üretilir.

<!-- OPENAPI_ENDPOINTS_START -->
### Health

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Public | `-` | 200 | Backend health status |

### Metrics

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/metrics` | Bearer JWT | `-` | 200 | In-process HTTP, socket and message metrics |

### Auth

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | `LoginDto` | 200 | User logged in successfully |
| `GET` | `/api/auth/me` | Bearer JWT | `-` | 200 | Current authenticated user |
| `PATCH` | `/api/auth/password` | Bearer JWT | `ChangePasswordDto` | 200 | Password changed successfully |
| `POST` | `/api/auth/register` | Public | `RegisterDto` | 201 | User registered successfully |

### Users

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/users` | Bearer JWT | `-` | 200 | Registered users |
| `GET` | `/api/users/me` | Bearer JWT | `-` | 200 | Current user's profile |
| `PATCH` | `/api/users/me` | Bearer JWT | `UpdateProfileDto` | 200 | Current user's profile updated |
| `GET` | `/api/users/{userId}` | Bearer JWT | `-` | 200 | Registered user profile |

### Conversations

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/conversations` | Bearer JWT | `-` | 200 | Current user's conversations |
| `GET` | `/api/conversations/contacts` | Bearer JWT | `-` | 200 | Users related through an active direct conversation |
| `POST` | `/api/conversations/direct` | Bearer JWT | `CreateDirectConversationDto` | 201 | Direct conversation created or returned |
| `POST` | `/api/conversations/groups` | Bearer JWT | `CreateGroupConversationDto` | 201 | Group conversation created |
| `DELETE` | `/api/conversations/{conversationId}` | Bearer JWT | `-` | 200 | API operation |
| `GET` | `/api/conversations/{conversationId}` | Bearer JWT | `-` | 200 | Conversation detail |
| `PATCH` | `/api/conversations/{conversationId}` | Bearer JWT | `UpdateGroupConversationDto` | 200 | Group conversation updated |
| `PATCH` | `/api/conversations/{conversationId}/archive` | Bearer JWT | `-` | 200 | Conversation archive state toggled for the current user |
| `GET` | `/api/conversations/{conversationId}/attachments/{attachmentId}` | Bearer JWT | `-` | 200 | Attachment content |
| `PATCH` | `/api/conversations/{conversationId}/bookmark` | Bearer JWT | `-` | 200 | Conversation bookmark toggled for the current user |
| `POST` | `/api/conversations/{conversationId}/leave` | Bearer JWT | `-` | 200 | Current user left the group conversation |
| `GET` | `/api/conversations/{conversationId}/management` | Bearer JWT | `-` | 200 | Private management conversation for authorized group roles |
| `GET` | `/api/conversations/{conversationId}/messages` | Bearer JWT | `-` | 200 | Conversation messages |
| `POST` | `/api/conversations/{conversationId}/messages` | Bearer JWT | `CreateMessageDto` | 201 | Message created |
| `POST` | `/api/conversations/{conversationId}/messages/attachments` | Bearer JWT | `multipart/form-data` | 201 | Message with persistent attachments created |
| `GET` | `/api/conversations/{conversationId}/messages/search` | Bearer JWT | `-` | 200 | Search messages in conversation |
| `DELETE` | `/api/conversations/{conversationId}/messages/{messageId}` | Bearer JWT | `-` | 200 | Message deleted |
| `PATCH` | `/api/conversations/{conversationId}/messages/{messageId}` | Bearer JWT | `UpdateMessageDto` | 200 | Message updated |
| `PATCH` | `/api/conversations/{conversationId}/messages/{messageId}/unread` | Bearer JWT | `-` | 200 | Conversation marked as unread from the selected message |
| `PATCH` | `/api/conversations/{conversationId}/owner` | Bearer JWT | `TransferGroupOwnerDto` | 200 | Group owner transferred |
| `GET` | `/api/conversations/{conversationId}/participants` | Bearer JWT | `-` | 200 | Conversation participants |
| `POST` | `/api/conversations/{conversationId}/participants` | Bearer JWT | `AddParticipantDto` | 201 | Participant added |
| `DELETE` | `/api/conversations/{conversationId}/participants/{userId}` | Bearer JWT | `-` | 200 | Participant removed |
| `PATCH` | `/api/conversations/{conversationId}/participants/{userId}/role` | Bearer JWT | `UpdateParticipantRoleDto` | 200 | Participant group role updated |
| `PATCH` | `/api/conversations/{conversationId}/read` | Bearer JWT | `-` | 200 | Conversation marked as read |

### Calls

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/calls` | Bearer JWT | `-` | 200 | Current user's latest audio calls |

### Bookmarks

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/bookmarks` | Bearer JWT | `-` | 200 | Message bookmarks owned by the current user |
| `POST` | `/api/bookmarks` | Bearer JWT | `CreateMessageBookmarkDto` | 201 | Message bookmarked |
| `DELETE` | `/api/bookmarks/{messageId}` | Bearer JWT | `-` | 200 | API operation |
| `PATCH` | `/api/bookmarks/{messageId}` | Bearer JWT | `UpdateMessageBookmarkDto` | 200 | Bookmark title updated |

### Contact Invitations

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/contact-invitations` | Bearer JWT | `-` | 200 | Pending invitations received by the current user |
| `POST` | `/api/contact-invitations` | Bearer JWT | `CreateContactInvitationDto` | 201 | Contact invitation created |
| `PATCH` | `/api/contact-invitations/{invitationId}` | Bearer JWT | `RespondContactInvitationDto` | 200 | Contact invitation accepted or declined |

### Support Tickets

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/tickets` | Bearer JWT | `-` | 200 | Visible support tickets |
| `POST` | `/api/tickets` | Bearer JWT | `CreateSupportTicketDto` | 201 | Support ticket created |
| `GET` | `/api/tickets/{ticketId}` | Bearer JWT | `-` | 200 | Support ticket detail |
| `PATCH` | `/api/tickets/{ticketId}` | Bearer JWT | `UpdateSupportTicketDto` | 200 | Support ticket updated by an administrator |
| `PATCH` | `/api/tickets/{ticketId}/assignee` | Bearer JWT | `AssignSupportTicketDto` | 200 | Support ticket assigned, transferred, or unassigned |
| `POST` | `/api/tickets/{ticketId}/claim` | Bearer JWT | `ClaimSupportTicketDto` | 200 | Unassigned support ticket claimed by current admin |

### Bot

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/bot/create-group` | x-bot-secret | `CreateBotGroupDto` | 201 | Legacy alias used by the Java ticket webhook |
| `POST` | `/api/bot/groups` | x-bot-secret | `CreateBotGroupDto` | 201 | Create or return an idempotent automation group |
| `GET` | `/api/bot/groups/{conversationId}` | x-bot-secret | `-` | 200 | Get an automation group and its current settings |
| `PATCH` | `/api/bot/groups/{conversationId}` | x-bot-secret | `UpdateGroupConversationDto` | 200 | Update automation group settings |
| `POST` | `/api/bot/groups/{conversationId}/messages` | x-bot-secret | `CreateBotMessageDto` | 201 | Send a persistent realtime message as the bot |
| `DELETE` | `/api/bot/groups/{conversationId}/messages/{messageId}` | x-bot-secret | `-` | 200 | Delete a message previously sent by the bot |
| `PATCH` | `/api/bot/groups/{conversationId}/messages/{messageId}` | x-bot-secret | `UpdateMessageDto` | 200 | Edit a message previously sent by the bot |
| `GET` | `/api/bot/groups/{conversationId}/participants` | x-bot-secret | `-` | 200 | List active automation group participants |
| `POST` | `/api/bot/groups/{conversationId}/participants` | x-bot-secret | `AddBotGroupParticipantsDto` | 201 | Add users to an automation group |
| `DELETE` | `/api/bot/groups/{conversationId}/participants/{userId}` | x-bot-secret | `-` | 200 | Remove a user from an automation group |
| `PATCH` | `/api/bot/groups/{conversationId}/participants/{userId}/role` | x-bot-secret | `UpdateParticipantRoleDto` | 200 | Promote or demote an automation group manager |

### Dev

| Method | Path | Auth | Request | Success | Purpose |
| --- | --- | --- | --- | --- | --- |
| `POST` | `/api/dev/reset` | x-dev-secret | `-` | 200 | Development-only data reset |
<!-- OPENAPI_ENDPOINTS_END -->

<!-- pagebreak -->

## 19. OpenAPI Şema Sözlüğü

Bu bölüm Swagger component şemalarından otomatik üretilir. `Required` bilgisi
OpenAPI snapshot'ına, daha ayrıntılı min/max kuralları ilgili DTO sınıfına
dayanır.

<!-- OPENAPI_SCHEMAS_START -->
#### ApiSuccessEnvelopeDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `success` | `boolean` | Yes | - |
| `data` | `object` | Yes | - |

#### HealthResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `status` | `string` | Yes | - |
| `service` | `string` | Yes | - |
| `uptime` | `number` | Yes | - |
| `timestamp` | `string` | Yes | format=date-time |

#### MetricsCountersResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `httpRequestsTotal` | `number` | Yes | - |
| `httpErrorsTotal` | `number` | Yes | - |
| `httpDurationMsTotal` | `number` | Yes | - |
| `socketConnectionsTotal` | `number` | Yes | - |
| `socketDisconnectsTotal` | `number` | Yes | - |
| `socketEventsTotal` | `number` | Yes | - |
| `socketErrorsTotal` | `number` | Yes | - |
| `messagesCreatedTotal` | `number` | Yes | - |

#### MetricsGaugesResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `activeSockets` | `number` | Yes | - |
| `averageHttpDurationMs` | `number` | Yes | - |

#### MetricsResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `uptimeSeconds` | `number` | Yes | - |
| `counters` | `MetricsCountersResponseDto` | Yes | - |
| `gauges` | `MetricsGaugesResponseDto` | Yes | - |
| `socketEventsByName` | `object` | Yes | - |
| `collectedAt` | `string` | Yes | format=date-time |

#### UserResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `automationId` | `object \| null` | No | Short user reference accepted by the bot API |
| `username` | `string` | Yes | - |
| `email` | `string` | Yes | - |
| `role` | `string` | Yes | enum=admin, user |
| `about` | `object \| null` | No | - |
| `location` | `object \| null` | No | - |
| `profileImage` | `object \| null` | No | - |
| `isBot` | `boolean` | Yes | Whether this account is an automation bot |
| `createdAt` | `string` | Yes | format=date-time |

#### UpdateProfileDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `username` | `string` | No | - |
| `about` | `object` | No | - |
| `location` | `object` | No | - |
| `profileImage` | `object \| null` | No | Compressed PNG, JPEG or WebP data URL |

#### AuthResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `accessToken` | `string` | Yes | JWT access token |
| `user` | `UserResponseDto` | Yes | - |

#### RegisterDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `username` | `string` | Yes | - |
| `email` | `string` | Yes | - |
| `password` | `string` | Yes | - |

#### LoginDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `email` | `string` | Yes | - |
| `password` | `string` | Yes | - |

#### PasswordChangedResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `user` | `UserResponseDto` | Yes | - |
| `changedAt` | `string` | Yes | format=date-time |

#### ChangePasswordDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `currentPassword` | `string` | Yes | - |
| `newPassword` | `string` | Yes | - |

#### ConversationParticipantResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | format=uuid |
| `role` | `string` | Yes | enum=owner, manager, member |
| `joinedAt` | `string` | Yes | format=date-time |
| `lastReadAt` | `object \| null` | No | format=date-time |
| `leftAt` | `object \| null` | No | format=date-time |

#### ConversationResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `type` | `string` | Yes | enum=direct, group, management |
| `name` | `object \| null` | No | - |
| `description` | `object \| null` | No | - |
| `createdBy` | `string` | Yes | format=uuid |
| `externalRef` | `object \| null` | No | - |
| `isBotManaged` | `boolean` | Yes | - |
| `sourceName` | `object \| null` | No | - |
| `memberCanSendMessages` | `boolean` | Yes | - |
| `membersCanLeave` | `boolean` | Yes | - |
| `status` | `string` | Yes | enum=active, closed, archived |
| `isBookmarked` | `boolean` | Yes | default=False |
| `isArchived` | `boolean` | Yes | default=False |
| `parentConversationId` | `object \| null` | No | format=uuid |
| `participants` | `array<ConversationParticipantResponseDto>` | Yes | - |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |

#### CreateDirectConversationDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `participantId` | `string` | Yes | - |

#### CreateGroupConversationDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `name` | `string` | Yes | - |
| `participantIds` | `array<string>` | Yes | - |
| `managerIds` | `array<string>` | No | - |
| `description` | `string` | No | - |
| `memberCanSendMessages` | `boolean` | No | default=False |
| `membersCanLeave` | `boolean` | No | default=True |

#### MessageAttachmentResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `fileName` | `string` | Yes | - |
| `mimeType` | `string` | Yes | - |
| `fileSize` | `number` | Yes | - |
| `createdAt` | `string` | Yes | format=date-time |

#### MessageReplyResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `conversationId` | `string` | Yes | format=uuid |
| `senderId` | `object \| null` | No | format=uuid |
| `content` | `string` | Yes | - |
| `messageType` | `string` | Yes | enum=user, system |
| `isForwarded` | `boolean` | Yes | default=False |
| `createdAt` | `string` | Yes | format=date-time |
| `deletedAt` | `object \| null` | No | format=date-time |
| `attachments` | `array<MessageAttachmentResponseDto>` | Yes | - |

#### MessageResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `clientMessageId` | `object \| null` | No | format=uuid |
| `conversationId` | `string` | Yes | format=uuid |
| `senderId` | `object \| null` | No | format=uuid |
| `replyToMessageId` | `object \| null` | No | format=uuid |
| `replyTo` | `MessageReplyResponseDto \| null` | No | - |
| `content` | `string` | Yes | - |
| `messageType` | `string` | Yes | enum=user, system |
| `isForwarded` | `boolean` | Yes | default=False |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `object \| null` | No | format=date-time |
| `deletedAt` | `object \| null` | No | format=date-time |
| `attachments` | `array<MessageAttachmentResponseDto>` | Yes | - |

#### ConversationSummaryResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `type` | `string` | Yes | enum=direct, group, management |
| `name` | `object \| null` | No | - |
| `description` | `object \| null` | No | - |
| `createdBy` | `string` | Yes | format=uuid |
| `externalRef` | `object \| null` | No | - |
| `isBotManaged` | `boolean` | Yes | - |
| `sourceName` | `object \| null` | No | - |
| `memberCanSendMessages` | `boolean` | Yes | - |
| `membersCanLeave` | `boolean` | Yes | - |
| `status` | `string` | Yes | enum=active, closed, archived |
| `isBookmarked` | `boolean` | Yes | default=False |
| `isArchived` | `boolean` | Yes | default=False |
| `parentConversationId` | `object \| null` | No | format=uuid |
| `participants` | `array<ConversationParticipantResponseDto>` | Yes | - |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |
| `participantCount` | `number` | Yes | - |
| `lastMessage` | `MessageResponseDto \| null` | No | - |
| `unreadCount` | `number` | Yes | - |

#### OffsetPageInfoResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `limit` | `number` | Yes | - |
| `offset` | `number` | Yes | - |
| `total` | `number` | Yes | - |
| `hasMore` | `boolean` | Yes | - |

#### ConversationListResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `items` | `array<ConversationSummaryResponseDto>` | Yes | - |
| `pageInfo` | `OffsetPageInfoResponseDto` | Yes | - |

#### UpdateGroupConversationDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `name` | `string` | No | - |
| `description` | `string` | No | - |
| `memberCanSendMessages` | `boolean` | No | default=False |
| `membersCanLeave` | `boolean` | No | default=True |
| `status` | `string` | No | enum=active, closed, archived |

#### TransferGroupOwnerDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | - |

#### CreateMessageDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `content` | `string` | Yes | - |
| `clientMessageId` | `string` | No | Client-generated idempotency key for safe retries |
| `replyToMessageId` | `string` | No | Message in this conversation being replied to |
| `isForwarded` | `boolean` | No | default=False; Marks a message created by forwarding another message |

#### CursorPageInfoResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `limit` | `number` | Yes | - |
| `before` | `object \| null` | No | format=date-time |
| `nextBefore` | `object \| null` | No | format=date-time |
| `hasMore` | `boolean` | Yes | - |

#### MessageListResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `items` | `array<MessageResponseDto>` | Yes | - |
| `pageInfo` | `CursorPageInfoResponseDto` | Yes | - |

#### MessageSearchPageInfoResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `limit` | `number` | Yes | - |
| `total` | `number` | Yes | - |

#### MessageSearchResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `items` | `array<MessageResponseDto>` | Yes | - |
| `pageInfo` | `MessageSearchPageInfoResponseDto` | Yes | - |

#### UpdateMessageDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `content` | `string` | Yes | - |

#### ReadStateResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `conversationId` | `string` | Yes | format=uuid |
| `readAt` | `string` | Yes | format=date-time |
| `unreadCount` | `number` | Yes | - |

#### ParticipantLeftResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `conversationId` | `string` | Yes | format=uuid |
| `userId` | `string` | Yes | format=uuid |
| `leftAt` | `string` | Yes | format=date-time |

#### AddParticipantDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `userId` | `string` | Yes | - |

#### UpdateParticipantRoleDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `role` | `string` | Yes | enum=manager, member |

#### CallPeerResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `username` | `string` | Yes | - |
| `profileImage` | `object \| null` | No | - |

#### CallResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `conversationId` | `string` | Yes | format=uuid |
| `direction` | `string` | Yes | enum=incoming, outgoing |
| `status` | `string` | Yes | enum=ringing, active, completed, missed, declined, failed |
| `startedAt` | `string` | Yes | format=date-time |
| `answeredAt` | `object \| null` | No | format=date-time |
| `endedAt` | `object \| null` | No | format=date-time |
| `endedReason` | `object \| null` | No | - |
| `durationSeconds` | `number` | Yes | - |
| `peer` | `CallPeerResponseDto` | Yes | - |

#### MessageBookmarkConversationResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `type` | `string` | Yes | enum=direct, group, management |
| `name` | `object \| null` | No | - |
| `parentConversationId` | `object \| null` | No | format=uuid |

#### MessageBookmarkResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `userId` | `string` | Yes | format=uuid |
| `messageId` | `string` | Yes | format=uuid |
| `title` | `object \| null` | No | - |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |
| `message` | `MessageResponseDto` | Yes | - |
| `conversation` | `MessageBookmarkConversationResponseDto` | Yes | - |
| `sender` | `UserResponseDto \| null` | No | - |

#### CreateMessageBookmarkDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `messageId` | `string` | Yes | format=uuid |
| `title` | `string` | No | maxLength=120 |

#### UpdateMessageBookmarkDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `title` | `string \| null` | No | maxLength=120 |

#### ContactInvitationResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `senderId` | `string` | Yes | format=uuid |
| `recipientId` | `string` | Yes | format=uuid |
| `message` | `object \| null` | No | - |
| `status` | `string` | Yes | enum=pending, accepted, declined |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |
| `respondedAt` | `object \| null` | No | format=date-time |
| `sender` | `UserResponseDto` | Yes | - |
| `recipient` | `UserResponseDto` | Yes | - |

#### CreateContactInvitationDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `email` | `string` | Yes | - |
| `message` | `string` | No | - |

#### ContactInvitationActionResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `invitation` | `ContactInvitationResponseDto` | Yes | - |
| `conversationId` | `object \| null` | No | format=uuid |

#### RespondContactInvitationDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `status` | `string` | Yes | enum=accepted, declined |

#### BotGroupCreationResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `type` | `string` | Yes | enum=direct, group, management |
| `name` | `object \| null` | No | - |
| `description` | `object \| null` | No | - |
| `createdBy` | `string` | Yes | format=uuid |
| `externalRef` | `object \| null` | No | - |
| `isBotManaged` | `boolean` | Yes | - |
| `sourceName` | `object \| null` | No | - |
| `memberCanSendMessages` | `boolean` | Yes | - |
| `membersCanLeave` | `boolean` | Yes | - |
| `status` | `string` | Yes | enum=active, closed, archived |
| `isBookmarked` | `boolean` | Yes | default=False |
| `isArchived` | `boolean` | Yes | default=False |
| `parentConversationId` | `object \| null` | No | format=uuid |
| `participants` | `array<ConversationParticipantResponseDto>` | Yes | - |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |
| `created` | `boolean` | Yes | True when this request created the automation group |
| `reused` | `boolean` | Yes | True when an existing group was returned for the supplied externalRef |

#### CreateBotGroupDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `ownerId` | `string` | No | Deprecated alias: UUID or built-in automation ID; this user is added as a manager |
| `name` | `string` | Yes | - |
| `participantIds` | `array<string>` | Yes | User UUIDs or built-in automation IDs |
| `managerIds` | `array<string>` | No | Manager UUIDs or built-in automation IDs; managers are added as members |
| `description` | `string` | No | - |
| `memberCanSendMessages` | `boolean` | No | default=False |
| `membersCanLeave` | `boolean` | No | default=False |
| `sourceName` | `string` | No | - |
| `externalRef` | `string` | No | - |
| `initialSystemMessage` | `string` | No | - |
| `initialBotMessage` | `string` | No | Preferred field for the first message sent by the bot |

#### AddBotGroupParticipantsDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `participantIds` | `array<string>` | Yes | User UUIDs or built-in automation IDs to add or reactivate |
| `managerIds` | `array<string>` | No | Added user UUIDs or built-in automation IDs that should become managers |

#### CreateBotMessageDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `content` | `string` | Yes | - |
| `clientMessageId` | `string` | No | Stable UUID used to deduplicate retries from external systems |

#### SupportTicketRequesterResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `username` | `string` | Yes | - |
| `email` | `string` | Yes | - |

#### SupportTicketActivityResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `ticketId` | `string` | Yes | format=uuid |
| `actorId` | `object \| null` | No | format=uuid |
| `action` | `string` | Yes | enum=created, assigned, unassigned, transferred, status_changed, priority_changed, note_updated |
| `fromValue` | `object \| null` | No | - |
| `toValue` | `object \| null` | No | - |
| `createdAt` | `string` | Yes | format=date-time |
| `actor` | `SupportTicketRequesterResponseDto \| null` | No | - |

#### SupportTicketResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `id` | `string` | Yes | format=uuid |
| `requesterId` | `string` | Yes | format=uuid |
| `assignedAdminId` | `object \| null` | No | format=uuid |
| `subject` | `string` | Yes | - |
| `message` | `string` | Yes | - |
| `priority` | `string` | Yes | enum=low, medium, high |
| `status` | `string` | Yes | enum=open, in_progress, resolved, closed |
| `adminNote` | `object \| null` | No | - |
| `version` | `number` | Yes | minimum=1 |
| `createdAt` | `string` | Yes | format=date-time |
| `updatedAt` | `string` | Yes | format=date-time |
| `resolvedAt` | `object \| null` | No | format=date-time |
| `requester` | `SupportTicketRequesterResponseDto \| null` | No | - |
| `assignedAdmin` | `SupportTicketRequesterResponseDto \| null` | No | - |
| `activities` | `array<SupportTicketActivityResponseDto>` | Yes | - |

#### CreateSupportTicketDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `subject` | `string` | Yes | - |
| `message` | `string` | Yes | - |
| `priority` | `string` | Yes | enum=low, medium, high; default=medium |

#### SupportTicketListResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `items` | `array<SupportTicketResponseDto>` | Yes | - |
| `pageInfo` | `OffsetPageInfoResponseDto` | Yes | - |

#### UpdateSupportTicketDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `expectedVersion` | `number` | Yes | minimum=1 |
| `status` | `string` | No | enum=open, in_progress, resolved, closed |
| `priority` | `string` | No | enum=low, medium, high |
| `adminNote` | `string \| null` | No | - |

#### ClaimSupportTicketDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `expectedVersion` | `number` | Yes | minimum=1 |

#### AssignSupportTicketDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `adminId` | `object \| null` | Yes | format=uuid |
| `expectedVersion` | `number` | Yes | minimum=1 |

#### DevResetResponseDto

| Field | Type | Required | Rules / Description |
| --- | --- | --- | --- |
| `bookmarks` | `object` | Yes | - |
| `calls` | `object` | Yes | - |
| `contactInvitations` | `object` | Yes | - |
| `conversations` | `object` | Yes | - |
| `tickets` | `object` | Yes | - |
| `users` | `object` | Yes | - |
<!-- OPENAPI_SCHEMAS_END -->

<!-- pagebreak -->

## 20. Referans Komutlar

Swagger snapshot yenileme:

```powershell
Invoke-WebRequest `
  -Uri "http://127.0.0.1:3000/api/docs-json" `
  -OutFile "docs/openapi.snapshot.json"
```

Doküman ve PDF üretme:

```powershell
python scripts/generate-api-webhook-report.py
```

Çıktılar:

- `docs/api-java-webhook-reference.md`
- `output/pdf/ello-api-java-webhook-dokumani.pdf`

Genel teknik doküman:

- `output/pdf/ello-teknik-dokumani.pdf`

Veri modeli:

- `docs/database-data-model.md`
- `output/pdf/ellodb-veri-modeli.pdf`
