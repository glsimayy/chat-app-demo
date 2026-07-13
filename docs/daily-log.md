# Daily Log

## 13.07.2026 Pazartesi

### Main Backend

- NestJS backend kurulumu yapildi.
- Global API prefix `api` olarak ayarlandi.
- Swagger UI `/api/docs` altinda acildi.
- Health check endpointi eklendi: `GET /api/health`.
- Global validation pipe, exception filter ve response interceptor eklendi.
- CORS, Helmet ve Compression aktif edildi.
- Env validation guclendirildi.
- Auth modulu eklendi:
  - Register
  - Login
  - Current user endpoint
  - JWT token uretimi
  - JWT guard
  - Role guard
- Users modulu eklendi:
  - In-memory user storage
  - User arama/listeleme
  - Ilk kullaniciyi admin yapma
- Conversations modulu eklendi:
  - Direct conversation
  - Group conversation
  - Group rename
  - Message create/list
  - Message edit/delete
  - Message pagination
  - Conversation summary
  - Read tracking
  - Participant add/remove
  - System message
- Socket.IO realtime chat modulu eklendi:
  - JWT ile socket auth
  - Conversation room join
  - Realtime conversation update
  - Realtime message push
  - Realtime message edit/delete
  - Online presence
  - Typing indicator
  - Realtime read receipt
- Java/bot entegrasyonu icin endpoint eklendi:
  - `POST /api/bot/groups`
  - `x-bot-secret` korumasi
  - `externalRef` destegi

### Verification

- `npm run typecheck` basarili.
- `npm run build` basarili.
- `npm run test:smoke` eklendi.
- `npm audit --audit-level=moderate` temiz.
- REST auth/direct conversation/message flow test edildi.
- Socket.IO join/send/message push flow test edildi.
- Group participant add/remove flow test edildi.
- Bot group create flow test edildi.

### Git

- Commit atildi:
  - `d5841b1 Initialize NestJS chat backend`

### Sonraki Adim

- Java tarafina bot endpoint kontrati verilecek.
- Database tarafina tablo/model kontrati verilecek.
- Main Backend tarafinda Prisma gecisine hazir servis ayrimi yapilacak.
