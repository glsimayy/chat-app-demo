# Database Setup

Bu dokuman Database tarafinin local PostgreSQL ve Prisma taslagi ile calismasi icin tutulur.

## Local PostgreSQL

Repo root klasorunde:

```bash
docker compose up -d postgres
```

Baglanti bilgisi:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_app_demo
```

Backend tarafinda `.env.example` icinde ayni connection string bulunur.

## Prisma Kontrol

Backend klasorunde:

```bash
cd backend
npm run prisma:validate
```

Bu komut DB'ye baglanmadan `backend/prisma/schema.prisma` dosyasinin gecerli olup olmadigini kontrol eder.

## Ilk Migration Icin Onerilen Akis

PostgreSQL ayaktayken:

```bash
cd backend
npm run prisma:migrate:dev -- --name init
npm run prisma:generate
```

Not: Su an Main Backend in-memory servislerle calisiyor. Migration almak DB semasini olusturur ama backend servisleri henuz Prisma client kullanmaz.

## Model Ozeti

Prisma taslagi su modelleri icerir:

- `User`
- `Conversation`
- `ConversationParticipant`
- `Message`

Enumlar:

- `UserRole`
- `ConversationType`
- `ParticipantRole`
- `MessageType`

## Dikkat Edilecek Noktalar

- `conversation_participants` tablosunda composite primary key: `conversationId + userId`.
- `leftAt` alanı soft leave icin kullanilir.
- `messages.deletedAt` soft delete icin kullanilir.
- `messages.senderId` nullable; system message veya silinmis user senaryolarinda null olabilir.
- Direct conversation unique constraint'i henuz schema seviyesinde kesinlestirilmedi. Uygulama katmaninda duplicate direct conversation engelleniyor.
