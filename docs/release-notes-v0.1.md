# ellO v0.1.0 Release Notes

## Ozet

ellO v0.1.0, JWT tabanli kimlik dogrulama ve rol kontrolu bulunan; direct ve
group sohbetleri REST API ile Socket.IO uzerinden gercek zamanli sunan ilk ic
beta surumudur. Frontend, NestJS backend, PostgreSQL ve Java ticket webhook
servisi tek urun akisi icinde calisacak sekilde tasarlanmistir.

## Ana Ozellikler

- Register, login, kalici oturum ve ADMIN/USER yetki kontrolleri
- Direct ve group conversation olusturma ve yonetme
- Gercek zamanli mesaj gonderme, duzenleme ve silme
- Online presence, typing indicator ve read receipt
- Grup katilimcisi ekleme/cikarma, gruptan ayrilma, ad degistirme ve sahiplik devri
- Owner/manager/member rolleri ve varsayilan salt okunur grup politikasi
- Owner, manager ve gruptaki global adminlere ozel yonetici sohbeti
- Grup aciklamasi, ayrilma politikasi ve active/closed/archived durumlari
- Contacts listesinden direct conversation bulma veya otomatik olusturma
- Mesaj sayfalama, arama, kalici bookmark ve `clientMessageId` ile tekrar
  gonderim korumasi
- Owner gerektirmeyen BOT gruplari, BOT mesaji ve dis API ile manager/politika atama
- PostgreSQL kaliciligi ve Prisma migration altyapisi
- Admin runtime metrikleri, health endpointi ve yapilandirilmis loglar

## Guvenlik ve Dayaniklilik

- JWT ve Socket.IO kimlik dogrulamasi
- ADMIN/USER rol matrisi ve bot secret korumasi
- HTTP auth/bot ve Socket.IO event rate limitleri
- Production ortaminda wildcard CORS reddi
- Production ortaminda demo hesaplari, dev reset ve demo UI'nin zorla kapatilmasi
- En az 32 karakter production secret kontrolu
- Hassas query parametrelerini maskeleyen HTTP request loglari
- Backend restart ve PostgreSQL restart sonrasinda veri kaliciligi

## Dogrulanan Kontroller

- Backend unit, e2e, typecheck, build ve Prisma kontrolleri yerelde gecti.
- Frontend unit, typecheck, production build ve Playwright kontrolleri yerelde gecti.
- Iki bagimsiz browser oturumunda direct/group mesajlar yenilemesiz iletildi.
- Mesaj duzenleme/silme islemleri iki acik istemciye gercek zamanli yansidi.
- PostgreSQL migration bos veritabaninda uygulandi ve restart kaliciligi dogrulandi.
- Mesaj arama ve bookmark ekleme/acma/silme Playwright akisi gecti; bookmark
  backend restartindan sonra PostgreSQL'den geri yuklendi.
- Java webhook testleri production Docker build icinde 20/20 gecti.
- PostgreSQL custom-format backup temiz test database'ine restore edildi; ADMIN,
  grup ve mesaj verileri uygulama tarafindan yeniden okundu.
- Database audit 21 indexi ve 6 foreign key delete kuralini dogruladi.
- Production ADMIN bootstrap guclu parola politikasi ve tekrar calistirma
  guvenligiyle temiz database'de dogrulandi.
- Java webhook icin non-root multi-stage production image, ayri health/readiness,
  kontrollu timeout/retry ve 502 davranisi dogrulandi.
- Database migration, audit, backup/restore ve ADMIN bootstrap release araclari
  Main Backend ile birlestirildi.
- Birlesik Docker Compose stack temiz test database'iyle baslatildi; production
  login, Java webhook, ticket idempotency ve restart kaliciligi dogrulandi.
- Frontend same-origin Nginx proxy ile API ve Socket.IO'ya baglandi; LAN IP'si
  uzerinden health ve iki bagimsiz istemciyle realtime mesaj akisi gecti.

## Release Oncesi Bekleyen Kontroller

- GitHub CI kontrollerinin yesile donmesi
- Gercek iki cihazla LAN/firewall erisim kontrolu (otomatik coklu istemci testi gecti)

## Bilinen Kisitlar

- Sifre sifirlama ve e-posta dogrulama bulunmuyor.
- Dosya ve medya yukleme bulunmuyor.
- Yonetici sohbetinde ayri okunmamis sayaci, dosya paylasimi ve BOT mesaji bulunmuyor.
- Gelismis monitoring, alarm ve merkezi log toplama bulunmuyor.
- Masaustu `.exe` paketi bulunmuyor; frontend web uygulamasi olarak calisiyor.
- Development/test ortaminda `DATABASE_URL` verilmezse in-memory fallback
  kullanilabilir; production ortaminda PostgreSQL zorunludur.

## Calistirma

Production environment sozlesmesi, baslatma sirasi ve release kapilari
`docs/release-v0.1.md` dosyasinda tutulur. Kalite kapilari tamamlanmadan
`v0.1.0` tag'i atilmaz.
