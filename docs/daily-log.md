# Daily Log

## 16.07.2026 Persembe

### Main Backend v0.1 Hazirligi

- `main-backend-release-v01` branch'i guncel `emir_frontend` tabanindan acildi.
- Production ortaminda `DATABASE_URL` zorunlu hale getirildi.
- PostgreSQL disindaki database URL'leri baslangicta reddediliyor.
- CORS origin listesi HTTP/HTTPS origin formatina gore dogrulaniyor.
- Demo kullanicilar, dev route'lari ve demo UI ayri env bayraklarina baglandi.
- Bu uc development ozelligi production ortaminda zorla kapali hale getirildi.
- Dev reset route'u kapaliyken 404 donuyor.
- Java webhook icin bot secret kontrolu sabit zamanli karsilastirmaya gecirildi.
- Frontend API ve Socket URL'leri ayri production env degerleriyle ayarlanabilir hale getirildi.
- Graceful shutdown hook'u aktif edildi.
- v0.1 production env ve release gate dokumani eklendi.

### Verification

- Backend uygulama ve test typecheck basarili.
- 27 backend unit testi basarili.
- 8 backend e2e testi basarili.
- Backend production build ve Prisma schema validation basarili.
- Frontend typecheck ve unit testi basarili.
- Frontend production build basarili.
- 8 Playwright testi basarili.
- Auth ve bot webhook rate limit senaryolari 429 cevabiyla dogrulandi.
- Test sonrasinda 3000 ve 5173 portlari kapali birakildi.

### Bekleyen Bagimliliklar

- Database branch'inden gercek PostgreSQL restart, backup ve restore kaniti.
- Java branch'inden container, readiness ve backend-down testleri.
- Iki PR sonrasi final compose ve v0.1 release adayi testi.

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

## 15.07.2026 Carsamba

### Backend Guvenlik ve Test

- HTTP auth rate limiting ve Socket.IO event rate limiting eklendi.
- HTTP ve Socket.IO ayni CORS allowlist'ine baglandi.
- Production wildcard CORS engellendi ve Swagger varsayilan kapali yapildi.
- Socket exception cevaplari sabit hata kodlariyla standartlastirildi.
- Jest unit testleri ve Supertest e2e testleri eklendi.
- GitHub Actions backend CI akisi eklendi.

### Verification

- Uygulama ve test typecheck basarili.
- 7 unit test basarili.
- 5 HTTP e2e test basarili.
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
