# Daily Log

## 22.07.2026 Carsamba - Support Ticket ve Full Stack Testi

- Database branchindeki sade konu, mesaj ve aciliyet formu ellO temasina uygun
  ayri bir Support sekmesine donusturuldu.
- Kullanicilar ticket olusturup yalnizca kendi kayitlarini gorebilir; admin tum
  kayitlarda arama/filtreleme yapip durum, oncelik ve cevap notu guncelleyebilir.
- `SupportTicket` Prisma modeli, PostgreSQL migration'i, Swagger kontrati ve
  in-memory gelistirme destegi eklendi.
- Ticket sahipligi ve admin cozumleme akisi unit test ve full-stack Docker testi
  ile dogrulandi; masaustu ile mobil yerlesim kontrol edildi.

- Yerel Docker Compose calismasinda Swagger varsayilan olarak acildi;
  production environment orneginde kapali tutuldu.
- `npm.cmd run test:full-stack` komutuyla image build ve stack baslatma dahil
  tek komutluk release kontrolu eklendi.
- Test frontend ve same-origin API proxy, backend health, Swagger UI/OpenAPI,
  Java health/readiness, ADMIN ve user rolleri, direct Socket.IO teslimi ve
  retry idempotency kontrollerini kapsiyor.
- Java ticket webhook secret kontrolu, idempotent otomasyon grubu, read-only
  member politikasi, group Socket.IO teslimi ve mesaj kaliciligi dogrulaniyor.
- Tam komut production benzeri Docker stack uzerinde 13/13 kontrolle basarili
  calisti; production Node bagimlilik audit'i temiz gecti.

## 21.07.2026 Sali - Final Stack Entegrasyonu

- Java webhook production Dockerfile, health/readiness ve backend
  timeout/retry/502 paketi review edilip Main Backend ile birlestirildi.
- Database migration audit, backup/restore ve production ADMIN bootstrap paketi
  temiz PostgreSQL veritabaninda dogrulanip Main Backend ile birlestirildi.
- PostgreSQL, migration, NestJS backend, Java webhook ve frontend icin birlesik
  production benzeri Docker Compose stack'i hazirlandi.
- Final stack calistirma environment ornegi ve operasyon dokumani eklendi.
- Temiz test database'inde production ADMIN login, frontend login ekrani, Java
  webhook, ayni ticket icin idempotency ve backend restart kaliciligi gecti.
- Bootstrap servisi backend'den once calisacak sekilde siralanarak ilk acilista
  ADMIN hesabinin backend tarafindan gorulmesi garanti altina alindi.
- Gitleaks ile tum Git gecmisi tarandi; CI test secret'i ve suresi dolmus eski tema
  JWT fixture'lari siniflandirildi, kullanilmayan fixture dosyasi kaldirildi ve
  dar kapsamli allowlist ile tarama temiz hale getirildi.
- Her push ve pull request'te tum Git gecmisini tarayan salt-okunur Secret Scan
  GitHub Actions workflow'u eklendi.
- Frontend API ve Socket.IO trafigi Nginx same-origin proxy arkasina alindi;
  boylece Compose stack degisken laptop IP'sini frontend build'ine gommeden
  ayni yerel agdaki ikinci cihazlardan kullanilabilir hale getirildi.
- Production Compose uzerinde iki bagimsiz Socket.IO istemcisi Nginx proxy'ye
  baglandi; realtime mesaj, duplicate kontrolu ve laptop LAN IP'sinden API
  health istegi basariyla dogrulandi.
- Guvenli olmayan yerel ag adreslerinde `crypto.randomUUID()` bulunmadigi icin
  direct ve grup mesajlarinin socket'e ulasmamasina yol acan frontend hatasi
  tarayici uyumlu istemci mesaj kimligi ureticisiyle giderildi.
- LAN adresinden direct ve grup mesaji gonderimi tarayicida, grup mesajinin
  ikinci Socket.IO istemcisine yenilemesiz teslimi de ayri bir admin oturumuyla
  dogrulandi.
- Mobil sohbet alani `100dvh` ve temaya uyumlu safe-area tamponu ile duzenlendi;
  390x844 gorunumde yazma alani ile telefon gezinme bolgesi arasinda 22 px tampon
  kaldigi kontrol edildi.

## 21.07.2026 Sali - Database Release Hardening

- Temiz test database'inde uc Prisma migration uygulandi.
- Guclu parola kontrollu ve tekrar calistirilabilir production ADMIN bootstrap
  eklendi; restore sonrasi ADMIN login ile dogrulandi.
- Custom-format `pg_dump` backup ve onay kilitli `pg_restore` araclari eklendi.
- Kullanici, grup ve mesaj iceren dump temizlendikten sonra geri yuklendi; tum
  kayitlarin korundugu dogrulandi.
- Otomatik audit 21 indexi ve 6 foreign key delete kuralini kontrol edecek
  sekilde Backend CI'a eklendi.
- Constraint/index incelemesi, troubleshooting ve recovery runbook dokumante
  edildi.

## 17.07.2026 Cuma

### Manuel v0.1 Testleri

- Health, Swagger ve frontend erisimi dogrulandi.
- Hatali sifre, admin/user rolleri, yetki kontrolu, logout ve kalici oturum testleri gecti.
- Direct chat, realtime mesaj, siralama, zaman ve tekrarli mesaj kontrolleri gecti.
- Mesaj duzenleme/silme islemleri ve realtime yansimalari dogrulandi.
- Baska kullanicinin mesajini duzenleme/silme yetkisi olmadigi dogrulandi.

### Login Rate Limit Duzeltmesi

- Login 429 cevabindaki `Retry-After` basligi frontend'e acildi.
- Ham `ThrottlerException` mesaji kullanici dostu mesaja cevrildi.
- Kalan bekleme suresi login ekraninda geri sayim olarak gosteriliyor.
- Bekleme boyunca login butonu kapaniyor ve sure bitince otomatik aciliyor.
- Yeni login denemesinde onceki hata state'i temizleniyor.
- Login reducer testi ve rate-limit e2e baslik kontrolu eklendi.

### Contacts ve Grup Yonetimi

- Contacts listesinden secilen kullanici icin direct conversation bulma/olusturma akisi eklendi.
- Contact ID'nin conversation ID gibi kullanilmasina neden olan `Conversation not found` hatasi giderildi.
- Gruptan cikarilan veya ayrilan kullanicilar presence ve typing state'inden aninda dusuruluyor.
- Sag detay panelinde gruptan ayrilmis katilimcilar filtreleniyor.
- Grup adini degistirme kontrolu eklendi.
- Grup sahipligini aktif bir uyeye devretme kontrolu eklendi.
- Normal grup uyeleri icin gorunur `Leave group` aksiyonu eklendi.
- Grup sahibi icin ayrilma aksiyonu, sahiplik devredilene kadar aciklamali olarak kapali tutuluyor.
- Grup rolleri ve uyelik degisiklikleri acik istemcilere realtime yansitiliyor.
- Tekrarlanan kullanici ve conversation liste istekleri birlestirilerek gereksiz 429 cevaplari azaltildi.
- Contacts, grup yonetimi ve gruptan ayrilma Playwright senaryolari eklendi.

### PostgreSQL Kalicilik Testi

- Docker PostgreSQL container'i `postgres:16-alpine` ile baslatildi.
- Prisma migration bos local PostgreSQL veritabanina uygulandi.
- `PERSISTENCE TEST` grubu, iki aktif katilimci ve marker mesaj olusturuldu.
- Backend kapatilarak yeniden acildi; kullanici, grup, katilimci ve mesajlar korundu.
- PostgreSQL container yeniden baslatildi; ayni veriler volume uzerinden korundu.
- `restart-sonrasi-kalmali-001` marker mesaji hem arayuzden hem dogrudan SQL sorgusuyla dogrulandi.

### Verification

- Frontend typecheck, 3 unit testi, 11 Playwright senaryosu ve production build basarili.
- Backend uygulama/test typecheck, 8 e2e testi ve production build basarili.

### Bagimsiz Release Hazirligi

- Java ve Database teslimleri beklenirken v0.1 release notu ve bilinen kisitlar hazirlandi.
- Hassas query parametreleri HTTP request loglarinda `REDACTED` olarak maskelendi.
- Guvenli olmayan veya asiri uzun `x-request-id` degerleri rastgele UUID ile degistirildi.
- Beklenmeyen Socket.IO hatalarinda ham stack ve hata mesaji loglanmasi kaldirildi.
- Request log sanitization testleri 3/3, tum backend unit testleri 30/30 gecti.
- Backend typecheck, test typecheck, production build ve `npm audit` kontrolleri basarili.

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
