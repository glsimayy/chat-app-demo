# ellO Chat Application

ellO; React, NestJS, PostgreSQL, Socket.IO, WebRTC ve Spring Boot kullanan
gerçek zamanlı bir ekip mesajlaşma uygulamasıdır. Projede birebir ve grup
sohbetleri, dosya ekleri, sesli arama, destek talepleri, otomasyon BOT API'si,
moderasyon ve yönetici izleme paneli bulunur.

Bu README, repoyu hiç kurmamış birinin clone işleminden çalışan uygulamaya
kadar izlemesi gereken yolu anlatır. En kolay ve projeye en yakın yöntem
**Docker Compose** kullanmaktır.

## İçindekiler

1. [Mimari](#mimari)
2. [Sıfırdan kurulum - Docker](#sıfırdan-kurulum---docker)
3. [Uygulamayı açma ve hesaplar](#uygulamayı-açma-ve-hesaplar)
4. [Durdurma, yeniden başlatma ve güncelleme](#durdurma-yeniden-başlatma-ve-güncelleme)
5. [Yerel geliştirme](#yerel-geliştirme)
6. [Test ve doğrulama](#test-ve-doğrulama)
7. [BOT API ve Java webhook](#bot-api-ve-java-webhook)
8. [Geçici internet erişimi](#geçici-internet-erişimi)
9. [Sık karşılaşılan sorunlar](#sık-karşılaşılan-sorunlar)
10. [Dokümanlar](#dokümanlar)

## Mimari

| Bileşen | Teknoloji | Görev |
| --- | --- | --- |
| Frontend | React + TypeScript | Arayüz, REST istemcisi, Socket.IO ve WebRTC |
| Main Backend | NestJS + TypeScript | Auth, yetki, sohbet, mesaj ve realtime kuralları |
| Database | PostgreSQL 16 + Prisma | Kalıcı kullanıcı, sohbet, mesaj, ticket ve dosya verisi |
| Java Webhook | Spring Boot + Java 17 | Dış ticket olaylarını BOT API isteğine dönüştürme |
| Reverse proxy | Nginx | Frontend üzerinden `/api` ve `/chat` proxy'si |

Docker kurulumunda tarayıcı yalnızca `http://localhost:5173` adresini kullanır.
Frontend container, API ve Socket.IO trafiğini ilgili servislere yönlendirir.

## Sıfırdan Kurulum - Docker

### 1. Gereksinimleri kur

Yeni makinede şunlar gereklidir:

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- En az 6 GB boş disk alanı
- Boş `5173`, `3000`, `8080` ve `5432` portları

Windows'ta Docker Desktop için BIOS/UEFI sanallaştırması ve WSL 2 açık
olmalıdır. Docker Desktop'ı başlatıp sol altta **Engine running** yazısını
görmeden sonraki adıma geçme.

Docker kurulumunda ayrıca Node.js, PostgreSQL veya Java kurmak gerekmez;
bunlar container image'ları içinde sağlanır.

### 2. Repoyu clone et

PowerShell, Terminal veya Git Bash aç:

```powershell
git clone https://github.com/glsimayy/chat-app-demo.git
cd chat-app-demo
```

Doğru klasörde olduğunu kontrol et:

```powershell
git status
git rev-parse --short HEAD
```

### 3. Ortam dosyasını oluştur

Windows PowerShell:

```powershell
Copy-Item .env.compose.example .env
```

macOS veya Linux:

```bash
cp .env.compose.example .env
```

`.env` dosyasını bir metin editöründe aç. Aşağıdaki değerleri mutlaka
değiştir:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` içindeki PostgreSQL parolası
- `JWT_SECRET`
- `BOT_WEBHOOK_SECRET`
- `WEBHOOK_SECRET`

`POSTGRES_PASSWORD` ve `DATABASE_URL` içindeki parola birebir aynı olmalıdır:

```dotenv
POSTGRES_PASSWORD=<guclu-ve-url-uyumlu-parola>
DATABASE_URL=postgresql://postgres:<ayni-parola>@postgres:5432/chat_app_demo
```

PowerShell'de 64 karakterlik rastgele bir secret üretmek için:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
```

Komutu üç kez çalıştırıp farklı çıktıları `JWT_SECRET`,
`BOT_WEBHOOK_SECRET` ve `WEBHOOK_SECRET` alanlarına yaz. `.env` dosyasını
commit etme veya ekip sohbetinde paylaşma.

### 4. Yapılandırmayı kontrol et

Repo kökünde:

```powershell
docker compose config --quiet
```

Komut çıktı vermeden tamamlanırsa Compose dosyası ve zorunlu değişkenler
geçerlidir. Hata alınırsa `.env` içindeki eksik veya hatalı değeri düzelt.

### 5. Tüm sistemi build edip başlat

```powershell
docker compose up -d --build
```

İlk build, image'lar indirildiği için birkaç dakika sürebilir. Servisleri
kontrol et:

```powershell
docker compose ps
docker compose ps -a
```

Uzun süre çalışan `postgres`, `backend`, `java-webhook` ve `frontend`
servislerinin durumu `healthy` olmalıdır. Tek seferlik `migrate` ve
`built-in-users-bootstrap` servislerinin `Exited (0)` olması normaldir.

### 6. Health kontrollerini çalıştır

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/ready
```

Beklenen sonuç:

- Backend health: `status = ok`
- Java health: servis ayakta
- Java readiness: backend'e erişebiliyor

## Uygulamayı Açma ve Hesaplar

Tarayıcıdan aç:

- Uygulama: [http://localhost:5173](http://localhost:5173)
- Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- Backend health: [http://localhost:3000/api/health](http://localhost:3000/api/health)

Docker başlangıcında aşağıdaki altı geliştirme hesabı idempotent biçimde
hazırlanır. Tüm şifreler `123456` değeridir.

| BOT ID | Kullanıcı adı | E-posta | Rol |
| --- | --- | --- | --- |
| `1` | `emiradmin` | `emiradmin@ello.com` | Admin |
| `2` | `emiruser` | `emiruser@ello.com` | User |
| `3` | `aslıadmin` | `asliadmin@ello.com` | Admin |
| `4` | `aslıuser` | `asliuser@ello.com` | User |
| `5` | `gülsimaadmin` | `gulsimaadmin@ello.com` | Admin |
| `6` | `gülsimauser` | `gulsimauser@ello.com` | User |

İlk temiz kurulumda sohbet listesi boş olabilir. Kullanıcılar doğrudan sohbet
başlatabilir; admin hesapları manuel grup oluşturabilir. BOT endpointlerindeki
kullanıcı alanları bu hesaplar için UUID yerine `1`-`6` BOT ID değerlerini de
kabul eder.

## Durdurma, Yeniden Başlatma ve Güncelleme

### Veriyi koruyarak kapat

```powershell
docker compose down
```

PostgreSQL verisi Docker volume içinde kalır.

### Tekrar aç

```powershell
docker compose up -d
```

### Yeni commitleri aldıktan sonra güncelle

```powershell
git pull
docker compose up -d --build
```

Migration ve sabit kullanıcı bootstrap işlemi otomatik çalışır.

### Logları izle

```powershell
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f java-webhook
```

Çıkmak için `Ctrl+C` kullanılır; container'lar çalışmaya devam eder.

### Bütün yerel veriyi sil

Yalnızca gerçekten temiz bir veritabanı istendiğinde:

```powershell
docker compose down --volumes
docker compose up -d --build
```

`--volumes` bütün yerel kullanıcı, sohbet, mesaj, dosya ve ticket verisini geri
alınamaz biçimde siler. Normal kapatma için kullanılmamalıdır.

## Yerel Geliştirme

Docker dışı geliştirme için ayrıca şunlar gerekir:

- Node.js 20 veya daha yeni LTS
- npm
- Java 17 veya daha yeni JDK
- PostgreSQL 16; en kolay yöntem yalnızca PostgreSQL container'ını kullanmaktır

### 1. Bağımlılıkları kur

Repo kökünde:

```powershell
npm.cmd install
npm.cmd --prefix backend install
npm.cmd --prefix frontend install
```

### 2. Development env dosyalarını hazırla

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

`backend/.env` içindeki local PostgreSQL adresi `localhost:5432` kullanır.
Root `.env` içindeki Docker adresi ise `postgres:5432` kullanır; bu iki adresi
birbirine karıştırma.

### 3. PostgreSQL ve migration'ı hazırla

```powershell
docker compose up -d postgres
npm.cmd --prefix backend run prisma:generate
Push-Location backend
npx.cmd prisma migrate deploy
npm.cmd run db:bootstrap-built-in-users
Pop-Location
```

### 4. Backend ve frontend'i birlikte çalıştır

```powershell
npm.cmd run dev
```

Bu komut:

- Backend'i `http://localhost:3000`
- Frontend'i `http://localhost:5173`

adresinde başlatır. İkisini kapatmak için terminalde `Ctrl+C` kullan.

### 5. Java webhook'u ayrı çalıştır

Yeni bir PowerShell penceresinde:

```powershell
cd java-webhook
$env:WEBHOOK_SECRET = "<root .env ile ayni webhook secret>"
$env:BOT_WEBHOOK_SECRET = "<backend ile ayni bot secret>"
$env:CHAT_BACKEND_BASE_URL = "http://localhost:3000"
.\mvnw.cmd spring-boot:run
```

Java webhook, temel sohbet ekranını açmak için zorunlu değildir; dış ticket
entegrasyonunu test etmek için gereklidir.

## Test ve Doğrulama

### Tam stack smoke testi

Docker açıkken:

```powershell
npm.cmd run test:full-stack
```

Bu test health, Swagger, roller, direct/group realtime mesajlaşma ve Java
ticket webhook akışını kontrol eder. Mevcut veriyi silmez ancak tekrar
kullanılabilen test hesapları oluşturur.

### Backend

```powershell
npm.cmd --prefix backend run typecheck
npm.cmd --prefix backend run test:typecheck
npm.cmd --prefix backend test
npm.cmd --prefix backend run test:e2e
npm.cmd --prefix backend run build
npm.cmd --prefix backend run prisma:validate
```

### Frontend

```powershell
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test:ci
npm.cmd --prefix frontend run build
```

Playwright ilk kez kullanılacaksa:

```powershell
cd frontend
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

### Java webhook

```powershell
cd java-webhook
.\mvnw.cmd test
```

## BOT API ve Java Webhook

BOT API, normal kullanıcı JWT'si yerine şu header'ı kullanır:

```http
x-bot-secret: <BOT_WEBHOOK_SECRET>
```

Swagger'da sağ üstteki **Authorize** düğmesi normal JWT içindir. BOT
endpointinin kendi `x-bot-secret` alanına root `.env` dosyasındaki
`BOT_WEBHOOK_SECRET` değeri girilir.

Temel BOT işlemleri:

- `POST /api/bot/groups`: otomasyon grubu oluştur
- `GET /api/bot/groups/{conversationId}`: grubu oku
- `POST /api/bot/groups/{conversationId}/participants`: üye ekle
- `DELETE /api/bot/groups/{conversationId}/participants/{userId}`: üye çıkar
- `POST /api/bot/groups/{conversationId}/messages`: bot adına mesaj gönder
- `PATCH /api/bot/groups/{conversationId}`: grup ayarlarını değiştir

Java servisine gelen dış ticket isteği:

```http
POST http://localhost:8080/webhook/ticket-created
X-Webhook-Token: <WEBHOOK_SECRET>
Content-Type: application/json
```

Java servis isteği doğrular ve NestJS
`POST /api/bot/create-group` endpointine iletir. Ayrıntılı payload, timeout,
retry ve hata sözleşmeleri:

- [API ve Java webhook teknik referansı](docs/api-java-webhook-reference.md)
- [Java webhook kısa rehberi](java-webhook/README.md)
- [Postman koleksiyonu](docs/postman/chat-app-demo.postman_collection.json)

## Geçici İnternet Erişimi

Uygulamayı kısa süreliğine farklı ağdaki ekip arkadaşlarıyla test etmek için:

```powershell
npm.cmd run server:temporary:build
```

Komut Docker stack'i build eder ve geçici Cloudflare Quick Tunnel URL'si
üretir. Terminal açık kalmalıdır; Quick Tunnel production yayını değildir ve
URL her çalıştırmada değişebilir.

Kapatmak için:

```powershell
npm.cmd run server:temporary:stop
```

Detaylar ve hata giderme:
[docs/temporary-public-server.md](docs/temporary-public-server.md).

## Sık Karşılaşılan Sorunlar

### Docker engine çalışmıyor

Hata örneği:

```text
failed to connect to the docker API
```

Docker Desktop'ı aç, **Engine running** durumunu bekle ve komutu tekrar çalıştır.

### Virtualization support not detected

BIOS/UEFI içinden Intel VT-x veya AMD-V'yi aç. Windows özelliklerinden
**Virtual Machine Platform** ve **Windows Subsystem for Linux** bileşenlerini
etkinleştirip bilgisayarı yeniden başlat.

### Backend health 404 dönüyor

Doğru adres:

```text
http://localhost:3000/api/health
```

Container ve logları kontrol et:

```powershell
docker compose ps
docker compose logs --tail 150 backend
```

### Login "Invalid email or password" diyor

Kullanıcı adı yerine tabloda verilen e-posta adresini ve `123456` şifresini
kullan. Bootstrap sonucunu kontrol et:

```powershell
docker compose ps -a built-in-users-bootstrap
docker compose logs built-in-users-bootstrap
```

### Port kullanımda

Windows'ta hangi işlemin portu kullandığını gör:

```powershell
Get-NetTCPConnection -LocalPort 5173,3000,8080,5432 -ErrorAction SilentlyContinue |
  Select-Object LocalPort, State, OwningProcess
```

Eski ellO container'larını `docker compose down` ile kapat veya ilgili başka
uygulamanın portunu değiştir.

### `.env` sonrası Compose başlamıyor

Önce:

```powershell
docker compose config --quiet
```

`POSTGRES_PASSWORD` ile `DATABASE_URL` parolasının aynı olduğunu ve üç secret
alanının placeholder olmadığını kontrol et. Secret değerlerini log veya ekran
görüntüsünde paylaşma.

### Mesaj veya presence anlık güncellenmiyor

Tarayıcı geliştirici araçlarında `/chat` Socket.IO bağlantısını, ardından
backend logunu kontrol et:

```powershell
docker compose logs --tail 200 backend
```

Sayfayı yenilemeden önce iki hesabın da aynı güncel frontend build'ini
kullandığından emin ol.

## Ana Özellikler

- JWT ile register, login, profil ve parola yönetimi
- Birebir sohbet, grup, owner/manager/member rolleri ve grup politikaları
- Gruplara bağlı özel yönetici sohbeti
- Socket.IO ile mesaj, typing, read receipt, presence ve reconnect sync
- Reply, forward, edit, delete, arama, bookmark ve arşiv
- Kalıcı görsel, dosya ve sesli mesaj ekleri
- WebRTC birebir sesli arama ve kalıcı çağrı geçmişi
- Contact invitation ve çoklu admin destek ticket havuzu
- BOT API ve Spring Boot ticket webhook adaptörü
- LLM kullanmayan deterministik conversation catch-up özeti
- Grup üyelerini kullanıcı adı veya e-posta ile `@` mention etme
- Türkçe ve İngilizce arayüz
- Admin operasyon özeti, maskeli mesaj inceleme ve gerekçeli erişim kaydı
- Mesaj raporlama, moderasyon ve adminin kendisiyle ilgili rapordan ayrılması

## Güvenlik Notları

- `.env`, JWT, parola ve webhook secret değerlerini commit etme.
- `x-bot-secret` frontend bundle'ına konmamalıdır.
- Production'da `DEMO_USERS_ENABLED`, `DEV_ROUTES_ENABLED` ve
  `SERVE_DEMO_UI` kapalı olmalıdır.
- Production CORS değeri wildcard olmamalıdır.
- Farklı ağlar arasında güvenilir WebRTC için kimlik doğrulamalı TURN sunucusu
  gerekir.
- Quick Tunnel yalnızca geliştirme ve kısa süreli test içindir.

## Dokümanlar

| Konu | Dosya |
| --- | --- |
| API + Java webhook detaylı referans | [docs/api-java-webhook-reference.md](docs/api-java-webhook-reference.md) |
| API + Java webhook PDF | [output/pdf/ello-api-java-webhook-dokumani.pdf](output/pdf/ello-api-java-webhook-dokumani.pdf) |
| Backend kontratları | [docs/backend-contracts.md](docs/backend-contracts.md) |
| BOT API örnekleri | [docs/bot-api-examples.md](docs/bot-api-examples.md) |
| Docker full stack | [docs/full-stack-docker.md](docs/full-stack-docker.md) |
| Database kurulum ve operasyon | [docs/database-setup.md](docs/database-setup.md) |
| Database veri modeli | [docs/database-data-model.md](docs/database-data-model.md) |
| Demo sunum akışı | [docs/demo-runbook.md](docs/demo-runbook.md) |
| Geçici internet sunucusu | [docs/temporary-public-server.md](docs/temporary-public-server.md) |
| Release kontrol listesi | [docs/release-v0.1.md](docs/release-v0.1.md) |
| Release notları | [docs/release-notes-v0.1.md](docs/release-notes-v0.1.md) |
