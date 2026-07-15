# Chat App Demo

Realtime chat demo backend.

## Backend

Backend NestJS ile yazildi ve su an in-memory data ile calisir. Server restart edilince local veriler sifirlanir.

### Kurulum

```bash
cd backend
npm install
```

`.env.example` dosyasini referans alarak local `.env` dosyasi olusturulabilir.

Production notlari:

- `JWT_SECRET` ve `BOT_WEBHOOK_SECRET` en az 32 karakter olmalidir.
- `CORS_ORIGIN` wildcard (`*`) olamaz.
- Swagger varsayilan olarak kapalidir.
- HTTP ve Socket.IO rate limit ayarlari `.env.example` icinden degistirilebilir.

Local PostgreSQL gerekirse repo root klasorunde:

```bash
docker compose up -d postgres
```

### Calistirma

```bash
npm run start:dev
```

Local adresler:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`
- Demo test ekrani: `http://localhost:3000/demo`
- Socket.IO namespace: `http://localhost:3000/chat`
- Dev reset: `POST http://localhost:3000/api/dev/reset`

### Kontrol

Server acikken:

```bash
npm run typecheck
npm run test:typecheck
npm test
npm run test:e2e
npm run build
npm run prisma:validate
npm run test:smoke
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
- bot group create
- group rename

Bu kontroller `.github/workflows/backend-ci.yml` ile her ilgili push ve pull
request'te otomatik calisir.

## Takim Dokumanlari

- Backend kontratlari: `docs/backend-contracts.md`
- Database kurulumu: `docs/database-setup.md`
- Gunluk kayit: `docs/daily-log.md`

## Ana Ozellikler

- JWT auth
- User search
- Direct conversation
- Group conversation
- Group rename
- Message create/update/delete
- Message pagination
- Read tracking
- Participant add/remove
- Socket.IO realtime messaging
- Typing indicator
- Read receipt
- Online presence
- Java/bot entegrasyonu icin `POST /api/bot/create-group`
- Geriye uyumlu bot alias'i: `POST /api/bot/groups`

## Notlar

- Ilk register olan kullanici local modda `admin` olur.
- Grup olusturma REST endpointi admin ister.
- Bot group endpointi JWT yerine `x-bot-secret` header'i kullanir.
- Auth endpointleri HTTP rate limit, Socket.IO eventleri socket bazli rate limit uygular.
- Database entegrasyonu icin beklenen model kontrati `docs/backend-contracts.md` icinde tutulur.
- `DATABASE_URL` simdilik opsiyoneldir, Prisma gecisinde aktif kullanilacak.
- Smoke test local server'da test kullanicilari olusturur. Manuel demo oncesi `POST /api/dev/reset` ile in-memory veri temizlenebilir.
