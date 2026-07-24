const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Frontend'in bağlanabilmesi için
    methods: ["GET", "POST"]
  }
});

// Aktif kullanıcıların son sinyal zamanlarını tutmak için bir Map
const activeUsers = new Map();

io.on("connection", (socket) => {
  console.log("Bir kullanıcı bağlandı:", socket.id);

  // 1. Kullanıcı sisteme girdiğinde online sinyali
  socket.on("user_online", () => {
    activeUsers.set(socket.id, Date.now());
    console.log(`Kullanıcı online oldu: ${socket.id}`);
    // İstersen burada veritabanında kullanıcının durumunu 'true' yapabilirsin
  });

  // 2. Kalp Atışı (Heartbeat): Her 30 saniyede bir gelen sinyal
  socket.on("heartbeat", () => {
    activeUsers.set(socket.id, Date.now());
  });

  // 3. Kullanıcı sekmeyi kapattığında veya interneti koptuğunda
  socket.on("disconnect", () => {
    console.log("Kullanıcı bağlantısı koptu:", socket.id);
    activeUsers.delete(socket.id);
    // İstersen burada veritabanında kullanıcının durumunu 'false' yapabilirsin
  });
});

// Zombi Bağlantı Temizliği: 1 dakika (60000 ms) boyunca sinyal vermeyenleri düşür
setInterval(() => {
  const now = Date.now();
  for (const [socketId, lastSignalTime] of activeUsers.entries()) {
    if (now - lastSignalTime > 60000) {
      console.log(`Zombi bağlantı temizlendi (Timeout): ${socketId}`);
      activeUsers.delete(socketId);
      // Veritabanında ilgili kullanıcıyı offline yap
    }
  }
}, 30000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Backend sunucusu ${PORT} portunda çalışıyor.`);
});