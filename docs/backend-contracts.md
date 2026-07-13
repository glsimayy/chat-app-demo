# Backend Contracts

Bu dokuman Main Backend, Java ve Database tarafinin ayni kontrata gore calismasi icin tutulur.

## Local URL'ler

- API base URL: `http://localhost:3000/api`
- Health check: `GET /api/health`
- Swagger UI: `GET /api/docs`
- Swagger JSON: `GET /api/docs-json`
- Socket.IO namespace: `/chat`

## Env Notlari

- `CORS_ORIGIN` tek origin veya virgul ile ayrilmis coklu origin alabilir.
- `DATABASE_URL` su an opsiyoneldir, Prisma gecisinde kullanilacak.
- Production ortaminda `JWT_SECRET` ve `BOT_WEBHOOK_SECRET` en az 32 karakter olmalidir.
- `SWAGGER_ENABLED` sadece `true` veya `false` olabilir.

## Local Kontrol Komutlari

Backend klasorunde:

```bash
npm run typecheck
npm run build
npm run prisma:validate
npm run test:smoke
```

`test:smoke` server acikken calisir ve auth, direct chat, pagination, Socket.IO, presence, bot group ve group rename akislarini kontrol eder.

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
  "participantIds": ["user-uuid-1", "user-uuid-2"]
}
```

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

Sadece grup konusmalari icin calisir. Grup owner'i veya admin kullanici grup adini degistirebilir.

```json
{
  "name": "Yeni Grup Adi"
}
```

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
  "content": "Selam ekip"
}
```

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
      "conversationId": "conversation-uuid",
      "senderId": "user-uuid",
      "content": "Merhaba",
      "messageType": "user",
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
- Mesaj kaydi pagination icinde kalmaya devam eder.

`PATCH /api/conversations/{conversationId}/read`

Konusmayi mevcut kullanici icin okundu isaretler.

`POST /api/conversations/{conversationId}/leave`

Mevcut kullaniciyi grup konusmasindan cikarir. Sadece member kullanici ayrilabilir; owner icin henuz ownership transfer yoktur.

`GET /api/conversations/{conversationId}/participants`

`POST /api/conversations/{conversationId}/participants`

```json
{
  "userId": "user-uuid"
}
```

`DELETE /api/conversations/{conversationId}/participants/{userId}`

## Java Tarafi Icin Bot Kontrati

Java servisi webhook, zamanlanmis is veya dis sistem tetigi aldiginda Main Backend icinde grup olusturmak icin bu endpointi cagirir.

`POST /api/bot/groups`

Header:

```http
x-bot-secret: <BOT_WEBHOOK_SECRET>
Content-Type: application/json
```

Local default secret:

```text
dev-bot-secret
```

Body:

```json
{
  "ownerId": "owner-user-uuid",
  "name": "Destek Talebi #4821",
  "participantIds": ["user-uuid-1", "user-uuid-2"],
  "externalRef": "ticket-4821",
  "initialSystemMessage": "Bot tarafindan destek grubu acildi."
}
```

Alanlar:

- `ownerId`: Grubun sahibi olacak kullanici id'si.
- `name`: Grup adi.
- `participantIds`: Gruba eklenecek diger kullanicilar.
- `externalRef`: Dis sistem id'si. Ornek: ticket id, meeting id, webhook id.
- `initialSystemMessage`: Grup acildiktan sonra sistem mesaji olarak eklenir.

Beklenen basarili response:

```json
{
  "success": true,
  "data": {
    "id": "conversation-uuid",
    "type": "group",
    "name": "Destek Talebi #4821",
    "createdBy": "owner-user-uuid",
    "externalRef": "ticket-4821",
    "participants": [],
    "createdAt": "2026-07-13T17:00:00.000Z",
    "updatedAt": "2026-07-13T17:00:00.000Z"
  }
}
```

## Socket.IO Kontrati

Client namespace:

```text
/chat
```

Auth:

```js
io("http://localhost:3000/chat", {
  auth: { token: "<jwt>" }
});
```

Alternatif olarak `Authorization: Bearer <jwt>` header'i da desteklenir.

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

### message:send

Client event:

```json
{
  "conversationId": "conversation-uuid",
  "content": "Merhaba"
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
- `type`: enum `direct | group`
- `name`: nullable string
- `createdBy`: user id
- `externalRef`: nullable string
- `createdAt`: datetime
- `updatedAt`: datetime

### conversation_participants

- `conversationId`: conversation id
- `userId`: user id
- `role`: enum `owner | member`
- `joinedAt`: datetime
- `lastReadAt`: nullable datetime
- `leftAt`: nullable datetime

Unique onerisi:

- Aktif participant icin `conversationId + userId + leftAt` mantigi dusunulmeli.

### messages

- `id`: uuid primary key
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
