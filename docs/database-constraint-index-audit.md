# Database Constraint and Index Audit

Tarih: 22 Temmuz 2026

Bu kontrol Prisma migration'lari ile olusan PostgreSQL semasinin v0.1 veri
butunlugu ve temel sorgu ihtiyaclarini kapsadigini dogrular. Otomatik kanit:

```bash
cd backend
npm run db:audit
```

## Unique ve Primary Key Kurallari

| Alan | Kural | Amac |
| --- | --- | --- |
| `users.email` | Unique | Ayni email ile ikinci hesap olusmasini engeller |
| `users.username` | Unique | Kullanici adini tekil tutar |
| `conversations.externalRef` | Unique | Ayni dis olaydan ikinci BOT grubu olusmasini engeller |
| `conversations.parentConversationId` | Unique | Grup basina tek yonetici sohbeti saglar |
| `conversation_participants` | `conversationId + userId` primary key | Ayni uyeyi ayni sohbete iki kez eklemez |
| `messages` | `senderId + clientMessageId` unique | Client retry mesajlarini tekillestirir |

Direct conversation cifti icin database-level unique anahtar yoktur; mevcut
servis ayni iki kullanici arasindaki sohbeti uygulama kilidiyle tekillestirir.
Bu davranis concurrency yuk testiyle izlenmeli ve yuksek trafik oncesi normalize
edilmis pair key dusunulmelidir.

## Foreign Key Silme Kurallari

| Iliski | Delete davranisi | Gerekce |
| --- | --- | --- |
| Conversation creator -> User | Restrict | Sahip olunan sohbet varken kullanici kaybi engellenir |
| Management chat -> Parent group | Cascade | Ana grup silinince ozel yonetici sohbeti de silinir |
| Participant -> Conversation | Cascade | Sohbet silinince uyelik satirlari kalmaz |
| Participant -> User | Cascade | Kullanici silinince uyelik satirlari kalmaz |
| Message -> Conversation | Cascade | Sohbet silinince mesajlar kalmaz |
| Message sender -> User | Set null | Kullanici silinse de mesaj gecmisi korunur |
| Attachment -> Message | Cascade | Mesaj fiziksel olarak silinince dosya verisi de temizlenir |
| Ticket requester -> User | Cascade | Kullanici silinince kendi destek talepleri temizlenir |
| Ticket assignee -> User | Set null | Admin silinince ticket ortak havuza geri doner |
| Ticket activity -> Ticket | Cascade | Ticket silinince activity gecmisi temizlenir |
| Ticket activity actor -> User | Set null | Admin silinse de islem gecmisi korunur |

## Index Incelemesi

- Conversation listeleme: participant `userId`, conversation `updatedAt`,
  `type` ve `status` indexleri bulunur.
- Mesaj gecmisi: `(conversationId, createdAt)` composite indexi pagination ve
  sirali gecmis sorgularini destekler.
- Idempotency: `(senderId, clientMessageId)` unique indexi bulunur.
- Attachment lookup: `message_attachments.messageId` indexi bulunur.
- Soft state filtreleri: participant `leftAt` ve message `deletedAt` indexleri
  bulunur.
- BOT lookup: `externalRef` unique indexi bulunur.
- Ticket havuzu: `(assignedAdminId, status)` ve `(status, priority)` indexleri
  admin filtrelerini destekler.
- Ticket gecmisi: `(ticketId, createdAt)` indexi activity zaman cizelgesini
  destekler.

v0.1 veri hacmi icin yeni index gerekmiyor. PostgreSQL `EXPLAIN ANALYZE` ve slow
query olcumleri olmadan ek index eklenmemelidir; her index yazma maliyeti ve disk
kullanimi getirir.

## Sonuc

Otomatik audit 30 beklenen indexi ve 11 foreign key delete kuralini kontrol eder.
Schema degisikliginde audit listesi ve bu belge ayni PR icinde guncellenmelidir.
