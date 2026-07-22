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

Migration sonrasinda beklenen index ve foreign key kurallarini kontrol etmek
icin:

```bash
npm run db:audit
```

Backend `DATABASE_URL` tanimliysa kullanicilari, konusmalari, katilimcilari,
mesajlari ve destek taleplerini Prisma ile PostgreSQL'e kaydeder. Degisken
tanimli degilse yerel test ve hizli gelistirme icin in-memory moda geri doner.
In-memory modda sunucu kapaninca veri silinir.

## Model Ozeti

- `User`
- `Conversation`
- `ConversationParticipant`
- `Message`
- `SupportTicket`
- `UserRole`, `ConversationType`, `ParticipantRole`, `ConversationStatus` ve
  `MessageType`, `SupportTicketPriority`, `SupportTicketStatus` enumlari

## Dikkat Edilecek Noktalar

- `conversation_participants` composite primary key kullanir: `conversationId + userId`.
- `leftAt` soft leave icin kullanilir.
- `messages.deletedAt` soft delete icin kullanilir.
- `messages.senderId` system mesajlari icin nullable olabilir.
- `conversations.externalRef` unique'tir; ayni bot olayi ikinci bir grup olusturmaz.
- Direct conversation tekrari uygulama katmaninda engellenir.
- `support_tickets.requesterId` kullanici silindiginde cascade ile temizlenir.

Detayli inceleme sonucu `docs/database-constraint-index-audit.md` dosyasindadir.

## Production ADMIN Bootstrap

Demo kullanicilari production ortaminda kapali tutulur. Ilk ADMIN hesabi acik
metin sifreyi kaynak koda veya komut argumanina yazmadan environment uzerinden
hazirlanir:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST:5432/DATABASE"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "uzun-ve-guclu-bir-sifre!1A"
npm run db:bootstrap-admin
Remove-Item Env:ADMIN_PASSWORD
```

Sifre en az 12 karakter olmali; buyuk harf, kucuk harf, rakam ve sembol
icermelidir. Komut ayni email veya username ile tekrar calistirilabilir ve
mevcut hesabi ADMIN rolune getirir. Email ile username farkli iki hesaba aitse
komut guvenli sekilde durur.

## Backup

Yerel Docker PostgreSQL container'ini custom-format `pg_dump` ile yedeklemek
icin backend klasorunde:

```powershell
npm run db:backup -- backups/pre-release.dump
```

Script mevcut dosyanin uzerine yazmaz ve basarisiz dump sonucunda yarim dosyayi
temizler. Farkli container veya database icin `DB_CONTAINER`, `POSTGRES_DB` ve
`POSTGRES_USER` environment degerleri kullanilir.

Production'da ayni format dogrudan PostgreSQL araclariyla alinabilir:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --file pre-release.dump
```

Backup dosyalari repoya commitlenmez. Uretimde sifreli, erisim kontrollu ve
uygulama sunucusundan ayri bir konumda tutulmalidir.

## Restore

Restore hedef semadaki mevcut nesneleri temizler. Yanlis database'e restore
edilmesini onlemek icin hedef database adi acikca onaylanmalidir:

```powershell
$env:CONFIRM_DATABASE_RESTORE = "chat_app_demo"
npm run db:restore -- backups/pre-release.dump
Remove-Item Env:CONFIRM_DATABASE_RESTORE
```

Restore sonrasinda:

```powershell
npx prisma migrate deploy
npm run db:audit
```

Ardindan backend baslatilir; ADMIN login, kullanici sayisi, grup sayisi ve son
mesajlar uygulama API'sinden kontrol edilir.

## Troubleshooting

- `Can't reach database server`: Container health sonucunu `docker compose ps`
  ile kontrol edin ve `DATABASE_URL` host/port degerini dogrulayin.
- `P1001`: PostgreSQL henuz hazir degildir veya firewall erisimi engelliyordur.
- `P3005`: Hedef sema bos degildir ancak Prisma migration gecmisi yoktur. Veri
  silmeden once backup alin ve baseline/recovery karari verin.
- `P3018`: Migration yarim kalmistir. Yeni migration calistirmadan once hatayi,
  `_prisma_migrations` kaydini ve database semasini inceleyin.
- Restore sirasinda aktif baglanti hatasi: Backend ve Java webhook yazma
  trafigini durdurun, sonra restore'u yeniden calistirin.

## Recovery Runbook

1. Yazma trafigini durdurun ve backend'i bakim moduna alin.
2. Mevcut bozuk durumun ayri bir forensic backup'ini alin.
3. Son saglam backup'i yeni ve bos bir recovery database'ine restore edin.
4. `npx prisma migrate deploy` ve `npm run db:audit` calistirin.
5. Kullanici, conversation, participant ve message sayilarini eski sistemle
   karsilastirin; ADMIN login ve son mesajlari kontrol edin.
6. Uygulamanin `DATABASE_URL` degerini recovery database'ine yonlendirin.
7. Backend'i acin, health ve smoke testlerini calistirin; sonra yazma trafigini
   kontrollu sekilde geri alin.

Uretimde uygulanmis migration dosyasi degistirilmez. Hata yeni bir ileri
duzeltme migration'i ile giderilir; migration gecmisi manuel silinmez.
