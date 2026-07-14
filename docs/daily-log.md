# Daily Log

## 13.07.2026 Pazartesi

### Main Backend

- NestJS backend kurulumu yapildi.
- Global API prefix `api` olarak ayarlandi.
- Swagger UI `/api/docs` altinda acildi.
- Demo frontend `/demo` altinda servis edildi.
- Health check endpointi eklendi: `GET /api/health`.
- Global validation pipe, exception filter ve response interceptor eklendi.
- Request id ve request logging middleware eklendi.
- CORS, Helmet ve Compression aktif edildi.
- Env validation guclendirildi.
- Auth modulu eklendi:
  - Register
  - Login
  - Current user endpoint
  - Change password endpoint
  - JWT token uretimi
  - JWT guard
  - Role guard
- Users modulu eklendi:
  - In-memory user storage
  - User arama/listeleme
  - Ilk kullaniciyi admin yapma
- Dev reset endpointi eklendi:
  - `POST /api/dev/reset`
  - Smoke test verilerini temizleme
- Conversations modulu eklendi:
  - Direct conversation
  - Group conversation
  - Group rename
  - Group owner transfer
  - Message create/list
  - Message edit/delete
  - Message pagination
  - Message search
  - Conversation summary
  - Conversation filtering
  - Read tracking
  - Participant add/remove
  - Group leave
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
- Database hazirligi:
  - Prisma schema taslagi
  - Local PostgreSQL Docker Compose
  - Database setup dokumani

### Verification

- `npm run typecheck` basarili.
- `npm run build` basarili.
- `npm run prisma:validate` eklendi.
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

## 14.07.2026 Sali

### Demo Frontend

- Backend testleri icin tek sayfalik demo arayuzu eklendi:
  - Register/login
  - Aktif kullanici gosterimi
  - Kullanici listeleme
  - Direct conversation olusturma
  - Group conversation olusturma
  - REST ile mesaj gonderme
  - Socket.IO baglanma ve conversation odasina girme
  - Mesajlari listeleme ve okundu isaretleme

### Realtime

- REST endpointi ile olusturulan mesajlarin Socket.IO odasina yayinlanmasi saglandi.
- Socket.IO mesaj yayinlama mantigi ortak helper uzerinden toplandi.
- Frontend tarafinda ayni mesajin iki kez gosterilmesini engelleyen kontrol eklendi.

### Local Ayar

- Local frontend icin CORS origin listesine `http://127.0.0.1:5173` eklendi.

### Verification

- Demo frontend ile direct ve group chat akislarinin calistigi kontrol edildi.
- Socket baglantisi ve oda mantigi test edildi.
- `npm run typecheck` basarili.
- `npm run build` basarili.
