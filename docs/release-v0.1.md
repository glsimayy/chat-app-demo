# ellO v0.1 Release Checklist

Bu dokuman Main Backend tarafinin final entegrasyon ve release kapilarini tutar.
Database ve Java PR'lari `emir_frontend` hedefiyle geldikten sonra tamamlanir.

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

1. PostgreSQL servisini baslat ve healthcheck sonucunu bekle.
2. `backend` klasorunde `npx prisma migrate deploy` calistir.
3. NestJS backend'i production environment ile baslat.
4. `GET /api/health` sonucunun 200 oldugunu dogrula.
5. Java webhook servisini backend adresi ve ortak secret ile baslat.
6. Production environment ile alinmis frontend build'ini yayinla.

## Release Gate

- [ ] Backend unit, e2e, build ve Prisma kontrolleri gecti.
- [ ] Frontend typecheck, unit, build ve Playwright kontrolleri gecti.
- [ ] Java testleri ve Java CI gecti.
- [ ] Bos PostgreSQL veritabaninda migration basarili.
- [ ] Backend ve DB restart sonrasinda kullanici ve mesajlar korundu.
- [ ] Iki farkli cihazda direct ve group realtime mesajlasma calisti.
- [ ] USER ve ADMIN yetki kontrolleri gecti.
- [ ] Ayni ticket iki kez geldiginde tek bot grubu olustu.
- [ ] Dev reset, demo kullanicilar ve demo UI production'da kapali.
- [ ] Repo secret taramasi temiz.
- [ ] Bilinen kisitlar release notuna yazildi.

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
