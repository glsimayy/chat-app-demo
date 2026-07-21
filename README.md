# Chat App Demo

Realtime chat demo backend.

## Tum Uygulamayi Calistirma

Backend ve frontend bagimliliklari kurulduktan sonra repo kok klasorunde:

```bash
npm install
npm run dev
```

Bu komut backend'i `http://localhost:3000`, frontend'i
`http://localhost:5173` adresinde birlikte baslatir. `Ctrl+C` iki sureci de
kapatir; Windows kapanis onayi sorarsa `Y` girilebilir. PowerShell script
politikasi `npm` komutunu engelliyorsa ayni komutlar `npm.cmd install` ve
`npm.cmd run dev` olarak calistirilabilir.

## Backend

Backend NestJS ile yazildi. Gelistirme ve test ortaminda `DATABASE_URL`
tanimliysa PostgreSQL + Prisma ile kalici, tanimli degilse in-memory calisir.
Production ortaminda `DATABASE_URL` zorunludur. In-memory modda server restart
edilince local veriler sifirlanir.

### Kurulum

```bash
cd backend
npm install
```

`.env.example` dosyasini referans alarak local `.env` dosyasi olusturulabilir.

Production notlari:

- `JWT_SECRET` ve `BOT_WEBHOOK_SECRET` en az 32 karakter olmalidir.
- `CORS_ORIGIN` wildcard (`*`) olamaz.
- `DATABASE_URL` gecerli bir PostgreSQL baglanti adresi olmalidir.
- `DEMO_USERS_ENABLED`, `DEV_ROUTES_ENABLED` ve `SERVE_DEMO_UI` production'da
  `false` olmalidir.
- Swagger varsayilan olarak kapalidir.
- HTTP ve Socket.IO rate limit ayarlari `.env.example` icinden degistirilebilir.

Kalici local PostgreSQL icin repo root klasorunde:

```bash
docker compose up -d postgres
cd backend
npx prisma migrate deploy
npm run prisma:generate
npm run db:audit
```

Production ADMIN bootstrap, backup/restore ve recovery adimlari
`docs/database-setup.md` dosyasindadir.

### Calistirma

```bash
npm run start:dev
```

Local adresler:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`
- Demo test ekrani: `http://localhost:3000/demo` (`SERVE_DEMO_UI=true`)
- Socket.IO namespace: `http://localhost:3000/chat`
- Runtime metrics (admin): `http://localhost:3000/api/metrics`
- Dev reset: `POST http://localhost:3000/api/dev/reset`
  (`DEV_ROUTES_ENABLED=true`)

Development modunda `DEMO_USERS_ENABLED=true` ise backend her acildiginda su
demo hesaplari hazirlanir:

| Rol   | Kullanici adi | E-posta            | Sifre       |
| ----- | ------------- | ------------------ | ----------- |
| Admin | `admin`       | `admin@ello.local` | `Admin123!` |
| User  | `user1`       | `user1@ello.local` | `User123!`  |
| User  | `user2`       | `user2@ello.local` | `User123!`  |

### Kontrol

Server acikken:

```bash
npm run typecheck
npm run test:typecheck
npm test
npm run test:e2e
npm run build
npm run prisma:validate
npm run db:audit
npm run test:smoke
npm run test:load
```

Unit ve e2e testleri config, CORS, rate limit, validation ve yetki kurallarini
kontrol eder. `test:smoke` ise calisan server uzerinde asagidaki akislarin
tamamini birlikte kontrol eder:

- health
- auth
- direct conversation
- message pagination
- Socket.IO message send/update/delete
- Socket.IO presence
- reconnect conversation sync
- idempotent message retry
- bot group create
- group rename

Bu kontroller `.github/workflows/backend-ci.yml` ile her ilgili push ve pull
request'te gercek PostgreSQL 16 servisi uzerinde otomatik calisir.

## Java Webhook

Ticket webhook adaptoru `java-webhook` klasorundedir. Java 17 veya daha yeni
bir JDK ile:

```powershell
cd java-webhook
$env:WEBHOOK_SECRET = "local-webhook-secret"
$env:BOT_WEBHOOK_SECRET = "backend ile ayni bot secret"
$env:CHAT_BACKEND_BASE_URL = "http://localhost:3000"
.\mvnw.cmd spring-boot:run
```

Servis `http://localhost:8080/webhook/ticket-created` endpoint'ini acar ve
dogruladigi istegi NestJS `POST /api/bot/create-group` endpoint'ine iletir.
Kurulum ve payload ornegi `java-webhook/README.md` icindedir.
Java testleri `.github/workflows/java-webhook-ci.yml` ile otomatik calisir.

## Takim Dokumanlari

- Backend kontratlari: `docs/backend-contracts.md`
- Database kurulumu: `docs/database-setup.md`
- Gunluk kayit: `docs/daily-log.md`
- Postman koleksiyonu: `docs/postman/chat-app-demo.postman_collection.json`

## Frontend

```bash
cd frontend
npm install
npm start
```

Frontend `npm start` ile sabit olarak `http://localhost:5173` adresinde calisir.
API ve Socket adresleri `frontend/.env.example` referans alinarak
`REACT_APP_API_URL` ve `REACT_APP_SOCKET_URL` ile degistirilebilir. Varsayilan
adresler `http://localhost:3000/api` ve `http://localhost:3000/chat` olur.
Mesajlar socket bagliyken ACK ile gonderilir, baglanti yoksa ayni
`clientMessageId` ile REST fallback kullanilir.

Frontend kontrolleri:

```bash
npm run typecheck
npm run test:ci
npm run build
npx playwright install chromium
npm run test:e2e
```

Playwright testi development hesaplariyla admin login, direct message ve group
message akislarini gercek frontend, backend ve Socket.IO uzerinde kontrol eder.

## Ana Ozellikler

- JWT auth
- User search
- Direct conversation
- Group conversation
- Group rename
- Group owner/manager roles and message policies
- Private manager chat linked to each group
- Active, closed and archived group states
- Message create/update/delete
- Message pagination
- Read tracking
- Participant add/remove
- Socket.IO realtime messaging
- Typing indicator
- Read receipt
- Online presence
- Socket reconnect ve conversation sync
- `clientMessageId` ile tekrar gonderim korumasi
- Admin runtime metrics
- Structured HTTP ve Socket.IO loglari
- Dis uygulamadan bot grubu olusturma: `POST /api/bot/groups`
- Otomasyon grubuna uye ekleme: `POST /api/bot/groups/:conversationId/participants`
- Bot adina mesaj gonderme: `POST /api/bot/groups/:conversationId/messages`
- Bot grubu ayarlarini degistirme: `PATCH /api/bot/groups/:conversationId`
- Bot grubunda manager atama: `PATCH /api/bot/groups/:conversationId/participants/:userId/role`
- Java ticket webhook alias'i: `POST /api/bot/create-group`

## Notlar

- Development modunda hazir admin hesabi olusturulur; yeni kayitlar `user` olur.
- Grup olusturma REST endpointi admin ister.
- Bot group endpointi JWT yerine `x-bot-secret` header'i kullanir.
- Auth endpointleri HTTP rate limit, Socket.IO eventleri socket bazli rate limit uygular.
- Database model kontrati `docs/backend-contracts.md` icinde tutulur.
- `DATABASE_URL` sadece development/test icin opsiyoneldir; production'da zorunludur.
- Smoke test local server'da test kullanicilari olusturur. Manuel demo oncesi `POST /api/dev/reset` ile gelistirme verisi temizlenebilir.
- v0.1 release kapilari ve production baslatma sirasi `docs/release-v0.1.md`
  icinde tutulur.
- v0.1 ozellikleri, bekleyen teslimler ve bilinen kisitlar
  `docs/release-notes-v0.1.md` icinde tutulur.
