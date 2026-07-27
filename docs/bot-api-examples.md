# Bot API Kullanim Ornekleri

Bu ornekler Windows PowerShell'de sirayla calistirilabilir. Backend'in
`http://localhost:3000` adresinde acik oldugu varsayilir.

Swagger uzerinden denemek icin ayni islemler
`http://localhost:3000/api/docs#/bot` altinda hazir request ornekleriyle
bulunur.

## 1. Ortak Degiskenler

Root `.env` dosyasindaki `BOT_WEBHOOK_SECRET` degerini asagidaki degiskene
gir:

```powershell
$api = "http://localhost:3000/api"
$botSecret = "<BOT_WEBHOOK_SECRET>"
$headers = @{ "x-bot-secret" = $botSecret }
```

Bot endpointleri JWT yerine `x-bot-secret` kullanir.

## 2. Grup Olustur

Built-in demo kullanicilari `1` ile `6` arasindaki kisa ID'lerle
gonderilebilir. Normal kullanicilar icin UUID kullanilir.

```powershell
$createBody = @{
  name = "Destek Talebi #4821"
  description = "Musteri destek koordinasyonu"
  participantIds = @("2", "4")
  managerIds = @("1")
  memberCanSendMessages = $false
  membersCanLeave = $false
  sourceName = "Destek sistemi"
  externalRef = "ticket-4821-$(Get-Date -Format yyyyMMddHHmmss)"
  initialBotMessage = "Destek talebi alindi. Bir temsilci yakinda katilacak."
} | ConvertTo-Json

$group = Invoke-RestMethod `
  -Method Post `
  -Uri "$api/bot/groups" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $createBody

$conversationId = $group.data.id
$conversationId
```

`externalRef` tekrar gonderim anahtaridir. Ayni degerle tekrar cagrildiginda
yeni grup acilmaz; response icinde `reused: true` doner.

## 3. Grubu Ve Uyeleri Oku

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri "$api/bot/groups/$conversationId" `
  -Headers $headers

Invoke-RestMethod `
  -Method Get `
  -Uri "$api/bot/groups/$conversationId/participants" `
  -Headers $headers
```

## 4. Uye Ekle, Rolunu Degistir Ve Cikar

```powershell
$participantsBody = @{
  participantIds = @("6")
  managerIds = @("5")
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "$api/bot/groups/$conversationId/participants" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body $participantsBody

Invoke-RestMethod `
  -Method Patch `
  -Uri "$api/bot/groups/$conversationId/participants/6/role" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ role = "manager" } | ConvertTo-Json)

Invoke-RestMethod `
  -Method Delete `
  -Uri "$api/bot/groups/$conversationId/participants/6" `
  -Headers $headers
```

Otomasyon botu gruptan cikarilamaz. Bu istek `400 Bad Request` doner.

## 5. Bot Mesaji Gonder, Duzenle Ve Sil

```powershell
$message = Invoke-RestMethod `
  -Method Post `
  -Uri "$api/bot/groups/$conversationId/messages" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{
    content = "Talep onceligi yuksek olarak degistirildi."
    clientMessageId = [guid]::NewGuid().ToString()
  } | ConvertTo-Json)

$messageId = $message.data.id

Invoke-RestMethod `
  -Method Patch `
  -Uri "$api/bot/groups/$conversationId/messages/$messageId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ content = "Talep onceligi kritik olarak duzeltildi." } | ConvertTo-Json)

Invoke-RestMethod `
  -Method Delete `
  -Uri "$api/bot/groups/$conversationId/messages/$messageId" `
  -Headers $headers
```

Bot yalnizca kendi gonderdigi ve daha once silinmemis mesajlari
duzenleyebilir veya silebilir. Degisiklikler acik istemcilere Socket.IO ile
anlik iletilir.

## 6. Grubu Kapat, Ac Veya Arsivle

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "$api/bot/groups/$conversationId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "closed" } | ConvertTo-Json)

Invoke-RestMethod `
  -Method Patch `
  -Uri "$api/bot/groups/$conversationId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "active" } | ConvertTo-Json)

Invoke-RestMethod `
  -Method Patch `
  -Uri "$api/bot/groups/$conversationId" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ status = "archived" } | ConvertTo-Json)
```

`closed` ve `archived` gruplara yeni mesaj gonderilemez. Yeniden mesaj
gondermek icin status `active` yapilmalidir.
