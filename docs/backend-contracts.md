# Backend Contracts

Bu dokuman Main Backend, Java ve Database tarafinin ayni kontrata gore calismasi icin tutulur.

## Local URL'ler

- API base URL: `http://localhost:3000/api`
- Health check: `GET /api/health`
- Swagger UI: `GET /api/docs`
- Swagger JSON: `GET /api/docs-json`
- Demo test ekrani: `GET /demo` (`SERVE_DEMO_UI=true`)
- Socket.IO namespace: `/chat`
- Admin metrics: `GET /api/metrics`
- Postman collection: `docs/postman/chat-app-demo.postman_collection.json`

## Env Notlari

- `CORS_ORIGIN` tek origin veya virgul ile ayrilmis coklu origin alabilir.
- Production ortaminda `CORS_ORIGIN=*` kabul edilmez. Ayni allowlist HTTP ve
  Socket.IO icin kullanilir.
- `DATABASE_URL` development/test ortaminda opsiyonel, production'da zorunludur.
- `DEMO_USERS_ENABLED`, `DEV_ROUTES_ENABLED` ve `SERVE_DEMO_UI` development
  ozelliklerini yonetir ve production'da `false` olmalidir.
- Production ortaminda `JWT_SECRET` ve `BOT_WEBHOOK_SECRET` en az 32 karakter olmalidir.
- `SWAGGER_ENABLED` sadece `true` veya `false` olabilir ve production'da
  varsayilan olarak kapalidir.
- `BODY_LIMIT`, `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX`,
  `SOCKET_RATE_LIMIT_TTL_MS` ve `SOCKET_RATE_LIMIT_MAX` guvenlik limitlerini
  kontrol eder.

## Local Kontrol Komutlari

Backend klasorunde:

```bash
npm run typecheck
npm run test:typecheck
npm test
npm run test:e2e
npm run build
npm run prisma:validate
npm run test:smoke
npm run test:load
```

`test:smoke` server acikken auth, direct chat, pagination, Socket.IO, presence,
reconnect sync, tekrar mesaj korumasi, bot group ve group rename akislarini
kontrol eder. `test:load` varsayilan olarak 5 socket ile 50 mesaj gonderir ve
throughput ile ACK p50/p95/max surelerini raporlar.

## Genel Response Formati

Her HTTP response `x-request-id` header'i dondurur. Client isterse request'e kendi `x-request-id` header'ini verebilir, verilmezse backend uretir.

Basarili response:

```json
{
  "success": true,
  "data": {}
}
```

Hata response:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-07-13T17:00:00.000Z"
}
```

## Main Backend Endpointleri

### Auth

`POST /api/auth/register`

```json
{
  "email": "user@test.local",
  "username": "user_1",
  "password": "Password123!"
}
```

`POST /api/auth/login`

```json
{
  "email": "user@test.local",
  "password": "Password123!"
}
```

Donen token sonraki protected endpointlerde kullanilir:

```http
Authorization: Bearer <jwt>
```

`GET /api/auth/me`

JWT token ile mevcut kullaniciyi dondurur.

`PATCH /api/auth/password`

JWT token ile mevcut kullanicinin sifresini degistirir.

```json
{
  "currentPassword": "Password123!",
  "newPassword": "NewPassword123!"
}
```

### Users

`GET /api/users`

Opsiyonel arama:

```http
GET /api/users?search=emir
```

`GET /api/users/{userId}`

Kayitli kullanicinin public profil bilgisini dondurur. Endpoint JWT ister.

### Dev

`POST /api/dev/reset`

Route sadece `DEV_ROUTES_ENABLED=true` iken aciktir ve dogru `x-dev-secret`
header'i ister. Production ortaminda 404 doner.

Sadece local/dev kullanım içindir. In-memory user, conversation ve message verilerini temizler. Smoke test sonrası manuel demo denemeden once kullanılabilir. Production ortamında kapalıdır.

### Conversations

`POST /api/conversations/direct`

```json
{
  "participantId": "user-uuid"
}
```

`POST /api/conversations/groups`

Bu endpoint admin kullanici ister.

```json
{
  "name": "Staj Proje Ekibi",
  "description": "Release koordinasyon grubu",
  "participantIds": ["user-uuid-1", "user-uuid-2"],
  "managerIds": ["user-uuid-1"],
  "memberCanSendMessages": false,
  "membersCanLeave": true
}
```

Yeni gruplarda `memberCanSendMessages` varsayilan olarak `false` olur.
Olusturan admin manuel grubun owner'idir; `managerIds` icindeki kullanicilar
gruba otomatik olarak manager rolunde eklenir.

`GET /api/conversations`

Query parametreleri:

- `type`: `direct` veya `group`.
- `search`: conversation name, external ref, participant username veya participant email icinde arar.
- `limit`: 1-100 arasi kayit sayisi. Default `50`.
- `offset`: pagination offset. Default `0`.

Konusma listesini `updatedAt` alanina gore yeniden eskiye sirali dondurur. Her item icinde ek ozet alanlari vardir:

```json
{
  "items": [
    {
      "participantCount": 3,
      "lastMessage": {
        "id": "message-uuid",
        "conversationId": "conversation-uuid",
        "senderId": "user-uuid",
        "content": "Merhaba",
        "messageType": "user",
        "createdAt": "2026-07-13T17:00:00.000Z"
      },
      "unreadCount": 2
    }
  ],
  "pageInfo": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasMore": false
  }
}
```

`GET /api/conversations/{conversationId}`

`PATCH /api/conversations/{conversationId}`

Manager grup adi ve aciklamasini degistirebilir. Mesaj, ayrilma ve durum
politikalari sadece owner veya global admin tarafindan degistirilebilir.

```json
{
  "name": "Yeni Grup Adi",
  "description": "Yeni aciklama",
  "memberCanSendMessages": false,
  "membersCanLeave": true,
  "status": "active"
}
```

Durum degerleri `active | closed | archived` olur. `closed` ve `archived`
gruplarda yeni kullanici mesaji kabul edilmez.

`PATCH /api/conversations/{conversationId}/owner`

Grup owner'i veya admin kullanici ownership'i aktif bir participante devredebilir.

```json
{
  "userId": "new-owner-user-uuid"
}
```

`POST /api/conversations/{conversationId}/messages`

```json
{
  "content": "Selam ekip",
  "clientMessageId": "client-generated-uuid"
}
```

`clientMessageId` opsiyoneldir. Ayni kullanici ayni id, conversation ve content
ile tekrar gonderirse backend yeni mesaj olusturmaz; ilk mesaji geri dondurur.
Ayni id farkli conversation veya content ile kullanilirsa `409 Conflict` doner.

`POST /api/conversations/{conversationId}/messages/attachments`

`multipart/form-data` kabul eder:

- `content`: opsiyonel mesaj metni, en fazla 2000 karakter.
- `clientMessageId`: opsiyonel UUID idempotency anahtari.
- `files`: zorunlu, mesaj basina en fazla 5 dosya.

Her dosya en fazla 5 MB olabilir. Desteklenen tipler JPEG, PNG, GIF, WebP,
PDF ve plain text'tir. Backend MIME degerine ek olarak dosya imzasini da
kontrol eder. Dosyanin binary icerigi PostgreSQL'de tutulur; message
response yalnizca `id`, `fileName`, `mimeType`, `fileSize` ve `createdAt`
metadata alanlarini dondurur.

`GET /api/conversations/{conversationId}/attachments/{attachmentId}`

Dosyayi binary olarak dondurur. JWT zorunludur ve yalnizca conversation'in
aktif katilimcilari dosyaya erisebilir. Gorseller `inline`, diger dosyalar
`attachment` content disposition ile sunulur.

`GET /api/conversations/{conversationId}/messages`

Query parametreleri:

- `limit`: 1-100 arasi mesaj sayisi. Default `50`.
- `before`: ISO date. Bu tarihten onceki mesajlari getirir.

Ornek:

```http
GET /api/conversations/{conversationId}/messages?limit=20&before=2026-07-13T17:00:00.000Z
```

Response:

```json
{
  "items": [
    {
      "id": "message-uuid",
      "clientMessageId": "client-generated-uuid",
      "conversationId": "conversation-uuid",
      "senderId": "user-uuid",
      "content": "Merhaba",
      "messageType": "user",
      "attachments": [
        {
          "id": "attachment-uuid",
          "fileName": "release.png",
          "mimeType": "image/png",
          "fileSize": 245760,
          "createdAt": "2026-07-22T17:00:00.000Z"
        }
      ],
      "createdAt": "2026-07-13T17:00:00.000Z"
    }
  ],
  "pageInfo": {
    "limit": 20,
    "before": "2026-07-13T17:00:00.000Z",
    "nextBefore": "2026-07-13T16:59:00.000Z",
    "hasMore": true
  }
}
```

`GET /api/conversations/{conversationId}/messages/search`

Query parametreleri:

- `q`: aranacak metin.
- `limit`: 1-50 arasi sonuc sayisi. Default `20`.

Soft delete edilmis mesajlar arama sonucuna dahil edilmez.

Ornek:

```http
GET /api/conversations/{conversationId}/messages/search?q=merhaba&limit=10
```

`PATCH /api/conversations/{conversationId}/messages/{messageId}`

Sadece mesaji atan kullanici kendi mesajini duzenleyebilir.

```json
{
  "content": "Mesaj duzenlendi."
}
```

`DELETE /api/conversations/{conversationId}/messages/{messageId}`

Sadece mesaji atan kullanici kendi mesajini silebilir. Silme soft delete olarak calisir:

- `content` bosaltilir.
- `deletedAt` dolar.
- Iliskili attachment binary kayitlari kalici olarak temizlenir.
- Mesaj kaydi pagination icinde kalmaya devam eder.

`PATCH /api/conversations/{conversationId}/read`

Konusmayi mevcut kullanici icin okundu isaretler.

`POST /api/conversations/{conversationId}/leave`

Mevcut kullaniciyi grup konusmasindan cikarir. `membersCanLeave=false` ise
istek reddedilir. Owner once ownership'i aktif bir uyeye devretmelidir.

`GET /api/conversations/{conversationId}/management`

Ana gruba bagli ozel yonetici sohbetini dondurur. Sadece owner, manager ve
gruba uye global adminler erisebilir. Normal uye icin `404` doner ve bu sohbet
`GET /api/conversations` listesine dahil edilmez.

`GET /api/conversations/{conversationId}/participants`

`POST /api/conversations/{conversationId}/participants`

Grup owner'i, manager veya global admin yeni uye ekleyebilir. Basarili islem
`participant:added` socket eventini ve bir sistem mesajini yayinlar.

```json
{
  "userId": "user-uuid"
}
```

`DELETE /api/conversations/{conversationId}/participants/{userId}`

Manager sadece normal uyeleri; owner ve global admin manager dahil izin verilen
uyeleri cikarabilir. Basarili islem `participant:removed` socket eventini,
cikarilan kullaniciya `conversation:left` eventini ve bir sistem mesajini yayinlar.

`PATCH /api/conversations/{conversationId}/participants/{userId}/role`

Owner veya global admin bir uyeyi manager yapabilir ya da member rolune
dondurebilir.

```json
{
  "role": "manager"
}
```

## Support Tickets

Tum support ticket endpointleri JWT ister.

`POST /api/tickets`

Normal kullanici veya admin yeni destek talebi olusturabilir:

```json
{
  "subject": "Release grubuna katilamiyorum",
  "message": "Grup aciliyor ancak katilma islemi hata veriyor.",
  "priority": "high"
}
```

Priority degerleri: `low`, `medium`, `high`.

`GET /api/tickets`

- Normal kullanici sadece kendi taleplerini gorur.
- Admin tum talepleri gorur.
- `status`, `priority`, `search`, `assignment`, `limit` ve `offset` query
  alanlari desteklenir.
- Admin icin `assignment`: `all`, `mine` veya `unassigned` olabilir.

`GET /api/tickets/{ticketId}`

Normal kullanici sadece kendi ticket detayini, admin tum ticket detaylarini
gorur.

`POST /api/tickets/{ticketId}/claim`

Sahipsiz ticket'i mevcut admine atar:

```json
{
  "expectedVersion": 1
}
```

`PATCH /api/tickets/{ticketId}/assignee`

Her global admin ticket'i baska bir admine devredebilir veya `null` ile ortak
havuza geri birakabilir:

```json
{
  "adminId": "admin-user-uuid",
  "expectedVersion": 2
}
```

`PATCH /api/tickets/{ticketId}`

Sadece ticket'a atanmis admin kullanabilir:

```json
{
  "expectedVersion": 2,
  "status": "resolved",
  "priority": "high",
  "adminNote": "Erisim kaydi yenilendi ve sorun giderildi."
}
```

Status degerleri: `open`, `in_progress`, `resolved`, `closed`. `resolved` veya
`closed` durumunda `resolvedAt` otomatik atanir; ticket yeniden acilirsa
temizlenir.

Her atama, devretme, durum, oncelik ve cevap degisikligi actor ve zaman
bilgisiyle `activities` listesine yazilir. Guncelleme isteklerindeki
`expectedVersion` mevcut ticket `version` degeriyle uyusmazsa API `409 Conflict`
dondurur; istemci ticket'i yenileyip tekrar denemelidir.

## Dis Uygulama Bot Otomasyonu

Java servisi, Postman, Swagger veya baska bir guvenilir servis bu endpointleri
webhook, zamanlanmis is ya da dis sistem olayi sonucunda cagirabilir.

Tum bot endpointleri su header'i ister:

```http
x-bot-secret: <BOT_WEBHOOK_SECRET>
Content-Type: application/json
```

### Otomasyon grubu olusturma

`POST /api/bot/groups`

Java ticket webhook'u icin geriye uyumlu alias:

`POST /api/bot/create-group`

Body:

```json
{
  "name": "Destek Talebi #4821",
  "description": "Musteri destek koordinasyonu",
  "participantIds": ["user-uuid-1", "user-uuid-2"],
  "managerIds": ["manager-user-uuid"],
  "externalRef": "ticket-4821",
  "sourceName": "Destek sistemi",
  "memberCanSendMessages": false,
  "membersCanLeave": false,
  "initialBotMessage": "Destek talebi alindi. Bir temsilci yakinda katilacak."
}
```

Alanlar:

- `name`: Grup adi.
- `participantIds`: Gruba eklenecek diger kullanicilar.
- `managerIds`: Gruba manager olarak eklenecek kullanicilar.
- BOT gruplarinda insan owner bulunmaz. Eski istemcilerden gelen `ownerId`
  alani geriye uyumluluk icin manager olarak yorumlanir.
- `memberCanSendMessages`: Gonderilmezse `false`.
- `membersCanLeave`: Gonderilmezse `false`.
- `sourceName`: Grubu olusturan dis sistem icin kullaniciya gosterilebilir ad.
- `externalRef`: Dis sistem id'si. Ornek: ticket id, meeting id, webhook id.
- Ayni `externalRef` ile tekrarlanan istek mevcut grubu dondurur; yeni grup veya
  ikinci bir baslangic mesaji olusturmaz.
- `initialBotMessage`: Grup acildiktan sonra `ellO Automation Bot` adina gonderilir.
- Eski Java payloadlari icin `initialSystemMessage` alani da desteklenir.
- Bot servis hesabi gruba otomatik eklenir. Parolasi disariya acilmaz ve normal
  kullanici oturumu icin kullanilmaz.

Beklenen basarili response:

```json
{
  "success": true,
  "data": {
    "id": "conversation-uuid",
    "type": "group",
    "name": "Destek Talebi #4821",
    "createdBy": "automation-bot-user-uuid",
    "externalRef": "ticket-4821",
    "isBotManaged": true,
    "memberCanSendMessages": false,
    "membersCanLeave": false,
    "participants": [],
    "createdAt": "2026-07-13T17:00:00.000Z",
    "updatedAt": "2026-07-13T17:00:00.000Z"
  }
}
```

### Var olan otomasyon grubuna kullanici ekleme

`POST /api/bot/groups/{conversationId}/participants`

```json
{
  "participantIds": ["user-uuid-3", "user-uuid-4"],
  "managerIds": ["user-uuid-3"]
}
```

Tekrar gonderilen kullanici id'leri grupta ikinci bir uyelik olusturmaz. Daha
once gruptan ayrilmis bir kullanici yeniden aktif edilir. Islem katilimcilara
realtime olarak yansir.

### Bot adina mesaj gonderme

`POST /api/bot/groups/{conversationId}/messages`

```json
{
  "content": "Talep onceligi yuksek olarak degistirildi.",
  "clientMessageId": "3f0fe459-3816-4b83-b60a-5d195797f030"
}
```

`clientMessageId` dis uygulamanin retry anahtaridir. Ayni UUID ve ayni icerikle
tekrarlanan istek mevcut mesaji dondurur. Mesaj PostgreSQL'e yazilir ve acik
istemcilere `message:new` Socket.IO eventiyle iletilir.

`PATCH /api/bot/groups/{conversationId}` grup politikasini, aciklamasini veya
durumunu degistirir. `PATCH /api/bot/groups/{conversationId}/participants/{userId}/role`
ise bir kullaniciyi manager/member yapar.

Postman koleksiyonu calistirildiginda uygulamada su ornekler olusur:

- `Support TICKET-4821`: destek talebi, sonradan escalation kullanicisi ekleme.
- `Critical Alert MON-9001`: izleme sistemi alarmi.
- `Onboarding HR-77`: insan kaynaklari onboarding akisi.

## Socket.IO Kontrati

Client namespace:

```text
/chat
```

Auth:

```js
io("http://localhost:3000/chat", {
  auth: { token: "<jwt>" },
});
```

Alternatif olarak `Authorization: Bearer <jwt>` header'i da desteklenir.

Socket event hatalari `exception` eventi ile ayni formatta dondurulur:

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid socket payload",
  "errors": [],
  "timestamp": "2026-07-15T17:00:00.000Z"
}
```

Sabit hata kodlari: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`,
`CONFLICT`, `VALIDATION_ERROR`, `RATE_LIMITED` ve `INTERNAL_ERROR`.

Client ACK callback gonderirse basari ve hata callback uzerinden standart
zarfta doner. Callback yoksa hata `exception` eventi olarak push edilir.

### session:ready ve conversation:sync

Baglanti kurulunca server `session:ready` eventi ile kullanicinin aktif
conversation id'lerini gonderir. Reconnect sonrasinda client room uyeliklerini
geri kurmak icin su eventi yollar:

```json
{
  "conversationIds": ["conversation-uuid"]
}
```

Server ACK ve `conversation:synced` push'u ile senkronlanan id'leri ve
`syncedAt` zamanini dondurur.

### conversation:join

Client event:

```json
{
  "conversationId": "conversation-uuid"
}
```

Server push:

```text
conversation:joined
```

Ayni join sonrasinda client'a mevcut online durumlari da gonderilir:

```text
presence:snapshot
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "users": [
    {
      "userId": "user-uuid",
      "online": true
    }
  ]
}
```

Room'daki diger client'lara kullanicinin online oldugu bildirilir:

```text
presence:online
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid"
}
```

Kullanici tum socket baglantilarini kapatinca:

```text
presence:offline
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid"
}
```

### conversation:update

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "name": "Yeni Grup Adi"
}
```

Server push:

```text
conversation:updated
```

Payload guncellenmis conversation objesidir.

### conversation:transfer-owner

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "new-owner-user-uuid"
}
```

Server push:

```text
conversation:updated
```

Payload guncellenmis conversation objesidir.

### conversation:leave

Client event:

```json
{
  "conversationId": "conversation-uuid"
}
```

Ayrilan client'a server push:

```text
conversation:left
```

Room'daki diger client'lara server push:

```text
participant:left
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid",
  "leftAt": "2026-07-13T17:00:00.000Z"
}
```

### participant:added

Gruba uye eklendiginde aktif katilimcilara server push:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid",
  "joinedAt": "2026-07-13T17:00:00.000Z"
}
```

### participant:removed

Gruptan uye cikarildiginda aktif katilimcilara server push:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid",
  "removedAt": "2026-07-13T17:00:00.000Z",
  "removedBy": "admin-or-owner-uuid"
}
```

### message:send

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "content": "Merhaba",
  "clientMessageId": "client-generated-uuid"
}
```

Server push:

```text
message:new
```

### message:update

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "messageId": "message-uuid",
  "content": "Duzenlenen mesaj"
}
```

Server push:

```text
message:updated
```

Payload guncellenmis message objesidir.

### message:delete

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "messageId": "message-uuid"
}
```

Server push:

```text
message:deleted
```

Payload soft delete uygulanmis message objesidir.

### typing:start

Client event:

```json
{
  "conversationId": "conversation-uuid"
}
```

Diger client'lara server push:

```text
typing:started
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid"
}
```

### typing:stop

Client event:

```json
{
  "conversationId": "conversation-uuid"
}
```

Diger client'lara server push:

```text
typing:stopped
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid"
}
```

### message:read

Client event:

```json
{
  "conversationId": "conversation-uuid"
}
```

Server push:

```text
message:read
```

Payload:

```json
{
  "conversationId": "conversation-uuid",
  "userId": "user-uuid",
  "readAt": "2026-07-13T17:00:00.000Z"
}
```

## Database Tarafi Icin Beklenen Modeller

Main Backend su an in-memory calisiyor. Database entegrasyonunda beklenen ana tablolar:

Prisma taslagi `backend/prisma/schema.prisma` icinde tutulur. Ilk DB gecisinde bu dosya uzerinden migration alinabilir. Local PostgreSQL kurulumu icin `docs/database-setup.md` dosyasina bakilabilir.

### users

- `id`: uuid primary key
- `email`: unique string
- `username`: unique string
- `passwordHash`: string
- `role`: enum `admin | user`
- `createdAt`: datetime
- `updatedAt`: datetime

### conversations

- `id`: uuid primary key
- `type`: enum `direct | group | management`
- `name`: nullable string
- `description`: nullable string
- `createdBy`: user id
- `externalRef`: nullable string
- `isBotManaged`: boolean
- `sourceName`: nullable string
- `memberCanSendMessages`: boolean
- `membersCanLeave`: boolean
- `status`: enum `active | closed | archived`
- `parentConversationId`: yonetici sohbetlerinde ana grup id'si
- `createdAt`: datetime
- `updatedAt`: datetime

### conversation_participants

- `conversationId`: conversation id
- `userId`: user id
- `role`: enum `owner | manager | member`
- `joinedAt`: datetime
- `lastReadAt`: nullable datetime
- `leftAt`: nullable datetime

Unique onerisi:

- Aktif participant icin `conversationId + userId + leftAt` mantigi dusunulmeli.

### messages

- `id`: uuid primary key
- `clientMessageId`: nullable uuid; sender ile birlikte unique
- `conversationId`: conversation id
- `senderId`: nullable user id
- `content`: string
- `messageType`: enum `user | system`
- `createdAt`: datetime
- `updatedAt`: nullable datetime
- `deletedAt`: nullable datetime

## Su Anki Notlar

- Ilk kayit olan kullanici local/in-memory modda `admin` olur.
- Sonraki kullanicilar `user` olur.
- Grup olusturma endpointi admin ister.
- Bot endpointi JWT istemez, `x-bot-secret` ister.
- Veriler su an server restart edilince sifirlanir.
