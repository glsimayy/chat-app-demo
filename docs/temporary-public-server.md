# ellO Gecici Internet Sunucusu

Bu akis uygulamayi kalici olarak deploy etmez. Bilgisayardaki Docker
servislerini calistirir ve yalnizca frontend'i gecici bir Cloudflare Quick
Tunnel adresiyle internete acar.

Backend, Java webhook ve PostgreSQL portlari internete dogrudan acilmaz. API ve
Socket.IO trafigi frontend Nginx proxy'si uzerinden ayni adresle calisir.

## Gereksinimler

1. Docker Desktop kurulu ve Engine running olmali.
2. Repo kokunde gecerli bir `.env` dosyasi bulunmali.
3. Komutlar repo kokunde calistirilmali.

## Sunucuyu Acma

Normal kullanim:

```powershell
npm.cmd run server:temporary
```

Kod veya Docker image degistiyse yeniden build ederek ac:

```powershell
npm.cmd run server:temporary:build
```

Script su islemleri otomatik yapar:

1. Docker ve `.env` kontrolu yapar.
2. Docker Compose servislerini baslatir.
3. Frontend health kontrolunu bekler.
4. Eski `ello-quick-tunnel` container'ini kaldirir.
5. Yeni Cloudflare Quick Tunnel acar.
6. Terminale `https://...trycloudflare.com` adresini yazdirir.

Terminal kapatilsa bile Docker container'lari calismaya devam eder. Paylasilacak
adres terminaldeki `Public:` satiridir. Her yeniden acilista bu adres degisebilir.

## Yalnizca Internet Erisimini Kapatma

```powershell
npm.cmd run server:temporary:stop
```

Bu komut public tunnel'i kapatir, fakat yerel ellO servislerini calisir birakir.

Yerel servisleri de durdurmak icin:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\stop-temporary-server.ps1 -StopStack
```

`docker compose down -v` kullanma. `-v` PostgreSQL volume'unu ve verileri siler.

## Durum Kontrolu

```powershell
docker compose ps
docker logs ello-quick-tunnel
```

Yerel adres:

```text
http://localhost:5173
```

## Guvenlik

- Quick Tunnel adresi URL'yi bilen herkes tarafindan acilabilir.
- Test hesaplarinin parolasi basit oldugu icin adresi yalnizca ekip
  arkadaslariyla paylas.
- Test bitince public tunnel'i kapat.
- Backend `3000`, Java `8080` ve PostgreSQL `5432` portlarini modemden veya
  firewall'dan internete acma.
- Bu yontem demo ve gecici test icindir; production deployment degildir.
