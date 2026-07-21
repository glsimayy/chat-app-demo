# ellO Full Stack Docker

Bu akis PostgreSQL, migration, NestJS backend, Java webhook ve frontend
servislerini ayni Docker Compose projesinde calistirir.

## Ilk Kurulum

Repo kokunde ornek environment dosyasini kopyala:

```powershell
Copy-Item .env.compose.example .env
```

`.env` icindeki su degerleri paylasilmayan guclu degerlerle degistir:

- `POSTGRES_PASSWORD`
- `DATABASE_URL` icindeki PostgreSQL parolasi
- `JWT_SECRET`
- `BOT_WEBHOOK_SECRET`
- `WEBHOOK_SECRET`
- `ADMIN_PASSWORD`

`POSTGRES_PASSWORD` ile `DATABASE_URL` icindeki parola ayni olmalidir.

## Baslatma

```powershell
docker compose up -d --build
docker compose ps
```

`migrate` servisi migration ve database audit islemlerini tamamlayip basariyla
kapanir. Diger servislerin `healthy` olmasi beklenir.

`admin-bootstrap` servisi ilk production ADMIN hesabini `.env` degerleriyle
backend baslamadan once otomatik olarak hazirlar. Boylece backend kullanici
verisini yuklediginde ADMIN hesabi kullanima hazirdir.

Adresler:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3000/api/health`
- Java health: `http://localhost:8080/health`
- Java readiness: `http://localhost:8080/ready`

Production Compose profilinde Swagger, demo kullanicilar, dev reset ve demo UI
kapalidir.

Frontend API ve Socket.IO baglantilarini ayni origin uzerinden Nginx ile
backend'e proxy'ler. Bu nedenle ayni agdaki baska bir cihazda uygulama
`http://LAPTOP_IP:5173` adresinden acilabilir; ikinci cihazda API adresini
ayrica degistirmek gerekmez. Laptop IP adresini PowerShell'de gormek icin:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" }
```

Ikinci cihaz erisemiyorsa Windows Firewall'da TCP `5173` portuna ayni ozel ag
icin izin verilmelidir. Backend `3000`, Java webhook `8080` ve PostgreSQL `5432`
portlarini ikinci cihaza acmak gerekmez.

## Kontrol ve Loglar

```powershell
docker compose ps
docker compose logs --tail 100 backend
docker compose logs --tail 100 java-webhook
```

Backend ve Java health kontrolleri:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
Invoke-RestMethod http://localhost:8080/health
Invoke-RestMethod http://localhost:8080/ready
```

## Kapatma

Container'lari durdurup veriyi korumak icin:

```powershell
docker compose down
```

PostgreSQL volume'u dahil tum local Compose verisini silmek icin yalnizca temiz
bir test ortami istendiginde su komut kullanilir:

```powershell
docker compose down --volumes
```

`--volumes` kalici veriyi geri donulemez sekilde siler.
