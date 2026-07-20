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
- Mesaj sayfalama, arama ve `clientMessageId` ile tekrar gonderim korumasi
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
- Java webhook testleri JDK 21 ile 10/10 gecti.

## Release Oncesi Bekleyen Teslimler

- Database branch'inden backup/restore kaniti, constraint/index review'u ve son
  database dokumani
- Java branch'inden production Dockerfile, readiness, timeout/retry ve backend-down
  senaryolari
- Java ve Database PR'larinin Main Backend tarafindan review edilmesi
- Birlesik final stack smoke testi ve GitHub CI kontrollerinin yesile donmesi
- Gercek iki cihazla LAN/firewall erisim kontrolu (otomatik coklu istemci testi gecti)

## Bilinen Kisitlar

- Sifre sifirlama ve e-posta dogrulama bulunmuyor.
- Dosya ve medya yukleme bulunmuyor.
- Yonetici sohbetinde ayri okunmamis sayaci, dosya paylasimi ve BOT mesaji bulunmuyor.
- Gelismis monitoring, alarm ve merkezi log toplama bulunmuyor.
- Masaustu `.exe` paketi bulunmuyor; frontend web uygulamasi olarak calisiyor.
- Development/test ortaminda `DATABASE_URL` verilmezse in-memory fallback
  kullanilabilir; production ortaminda PostgreSQL zorunludur.
- Java webhook production dayanıklilik maddeleri Java tesliminden sonra final
  entegrasyon testinde kapatilacaktir.

## Calistirma

Production environment sozlesmesi, baslatma sirasi ve release kapilari
`docs/release-v0.1.md` dosyasinda tutulur. Kalite kapilari tamamlanmadan
`v0.1.0` tag'i atilmaz.
