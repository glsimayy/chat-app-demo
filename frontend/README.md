# ellO Frontend

ellO frontend, React ve TypeScript ile geliştirilmiştir. REST API, Socket.IO
realtime olayları ve WebRTC sesli arama akışlarını kullanır.

Tam sistemi ilk kez kuruyorsan repo kökündeki
[README.md](../README.md) içindeki Docker Compose adımlarını kullan.

## Yerel Çalıştırma

Gereksinimler:

- Node.js 20 veya daha yeni LTS
- Çalışan ellO backend (`http://localhost:3000`)

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd start
```

Frontend `http://localhost:5173` adresinde açılır.

## Ortam Değişkenleri

```dotenv
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_SOCKET_URL=http://localhost:3000/chat
REACT_APP_WEBRTC_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"}]
```

Docker build'inde API ve Socket.IO aynı origin üzerindeki `/api` ve `/chat`
adreslerini kullanır. Production WebRTC bağlantıları için
`REACT_APP_WEBRTC_ICE_SERVERS` içine kimlik doğrulamalı TURN sunucusu
eklenmelidir.

## Komutlar

```powershell
npm.cmd start
npm.cmd run typecheck
npm.cmd run test:ci
npm.cmd run build
```

Playwright:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Playwright testleri kendi test backend'ini kullanır ve normal yerel PostgreSQL
verisini değiştirmez.
