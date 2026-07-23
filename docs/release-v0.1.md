# ellO v0.1 Release Checklist

Bu dokuman Main Backend tarafinin final entegrasyon ve release kapilarini tutar.
Database ve Java release paketleri `main-backend-release-v01` ile birlestirildi.

## Production Environment

Backend:

```env
NODE_ENV=production
PORT=3000
API_PREFIX=api
CORS_ORIGIN=https://chat.example.com
SWAGGER_ENABLED=false
BODY_LIMIT=1mb
RATE_LIMIT_TTL_MS=60000
RATE_LIMIT_MAX=120
SOCKET_RATE_LIMIT_TTL_MS=10000
SOCKET_RATE_LIMIT_MAX=60
DEMO_USERS_ENABLED=false
DEV_ROUTES_ENABLED=false
SERVE_DEMO_UI=false
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=at-least-32-random-characters
JWT_EXPIRES_IN=1d
BOT_WEBHOOK_SECRET=at-least-32-random-characters
```

Frontend build:

```env
REACT_APP_DEFAULTAUTH=fake
REACT_APP_API_URL=https://api.example.com/api
REACT_APP_SOCKET_URL=https://api.example.com/chat
```

Java webhook environment degerleri `java-webhook/README.md` ile ayni tutulur.
`BOT_WEBHOOK_SECRET`, Java ve NestJS tarafinda birebir ayni olmalidir.

## Baslatma Sirasi

1. `.env.compose.example` dosyasini `.env` olarak kopyala ve secret'lari degistir.
2. `docker compose up -d --build` ile final stack'i baslat.
3. `migrate` servisinin `0` koduyla kapandigini dogrula.
4. PostgreSQL, backend, Java webhook ve frontend healthcheck'lerini dogrula.
5. `built-in-users-bootstrap` servisinin `0` koduyla kapandigini ve backend'den
   once tamamlandigini dogrula.

Detayli akis: `docs/full-stack-docker.md`

## Release Gate

- [x] Backend unit, e2e, build ve Prisma kontrolleri gecti.
- [x] Frontend typecheck, unit, build ve Playwright kontrolleri gecti.
- [x] Java testleri production Docker image icinde 20/20 gecti.
- [x] Bos PostgreSQL veritabaninda migration basarili.
- [x] Backend ve DB restart sonrasinda kullanici ve mesajlar korundu.
- [x] PostgreSQL backup temiz test database'ine restore edildi ve audit gecti.
- [x] Production ADMIN bootstrap temiz database'de dogrulandi.
- [x] Database ve Java release paketleri Main Backend ile birlestirildi.
- [x] Birlesik final Docker Compose stack smoke testi gecti.
- [ ] Iki farkli cihazda direct ve group realtime mesajlasma calisti.
- [x] USER ve ADMIN yetki kontrolleri gecti.
- [x] Ayni ticket iki kez geldiginde tek bot grubu olustu.
- [x] Dev reset, demo kullanicilar ve demo UI production'da kapali.
- [x] Tum Git gecmisinde Gitleaks secret taramasi temiz.
- [x] Bilinen kisitlar release notuna yazildi.

Release notu taslagi: `docs/release-notes-v0.1.md`

## Release Komutlari

Tum PR'lar merge edilip `emir_frontend` uzerinde son kontrol tamamlandiktan sonra:

```bash
git switch emir_frontend
git pull --ff-only origin emir_frontend
git tag -a v0.1.0 -m "ellO v0.1.0"
git push origin v0.1.0
```

Tag, kalite kapilari kapanmadan atilmaz.

## v0.1 Disi

- Sifre sifirlama ve e-posta dogrulama
- Gelismis monitoring ve alarm sistemi
- Dosya yukleme
- Masaustu `.exe` paketleme
