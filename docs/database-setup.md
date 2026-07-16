# Database Setup

Bu dokuman Main Backend'in local PostgreSQL ve Prisma kurulumu icindir.

## Local PostgreSQL

Repo root klasorunde:

```bash
docker compose up -d postgres
```

Backend icin baglanti bilgisi:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_app_demo
```

Ayni deger `backend/.env.example` icinde bulunur. Yerel calismada bu dosyayi
`backend/.env` olarak olusturup gerekli secret degerlerini degistirin.

## Migration Uygulama

PostgreSQL ayaktayken backend klasorunde:

```bash
npx prisma migrate deploy
npm run prisma:generate
```

Semayi veritabanina baglanmadan kontrol etmek icin:

```bash
npm run prisma:validate
```

Backend `DATABASE_URL` tanimliysa kullanicilari, konusmalari, katilimcilari ve
mesajlari Prisma ile PostgreSQL'e kaydeder. Degisken tanimli degilse yerel test
ve hizli gelistirme icin in-memory moda geri doner. In-memory modda sunucu
kapaninca veri silinir.

## Model Ozeti

- `User`
- `Conversation`
- `ConversationParticipant`
- `Message`
- `UserRole`, `ConversationType`, `ParticipantRole`, `MessageType` enumlari

## Dikkat Edilecek Noktalar

- `conversation_participants` composite primary key kullanir: `conversationId + userId`.
- `leftAt` soft leave icin kullanilir.
- `messages.deletedAt` soft delete icin kullanilir.
- `messages.senderId` system mesajlari icin nullable olabilir.
- `conversations.externalRef` unique'tir; ayni bot olayi ikinci bir grup olusturmaz.
- Direct conversation tekrari uygulama katmaninda engellenir.
