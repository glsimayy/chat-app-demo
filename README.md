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

Production notu: `JWT_SECRET` ve `BOT_WEBHOOK_SECRET` en az 32 karakter olmalidir.

### Calistirma

```bash
npm run start:dev
```

Local adresler:

- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/api/docs`
- Socket.IO namespace: `http://localhost:3000/chat`

### Kontrol

Server acikken:

```bash
npm run typecheck
npm run build
npm run prisma:validate
npm run test:smoke
```

`test:smoke` asagidaki akislarin calistigini kontrol eder:

- health
- auth
- direct conversation
- message pagination
- Socket.IO message send/update/delete
- Socket.IO presence
- bot group create
- group rename

## Takim Dokumanlari

- Backend kontratlari: `docs/backend-contracts.md`
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
- Java/bot entegrasyonu icin `POST /api/bot/groups`

## Notlar

- Ilk register olan kullanici local modda `admin` olur.
- Grup olusturma REST endpointi admin ister.
- Bot group endpointi JWT yerine `x-bot-secret` header'i kullanir.
- Database entegrasyonu icin beklenen model kontrati `docs/backend-contracts.md` icinde tutulur.
- `DATABASE_URL` simdilik opsiyoneldir, Prisma gecisinde aktif kullanilacak.
