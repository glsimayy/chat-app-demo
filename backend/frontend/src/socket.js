import { io } from "socket.io-client";

// Backend sunucusunun adresi - ortam değişkeninden al, yoksa localhost kullan
// Vite kullanıyorsan: VITE_SOCKET_URL, CRA kullanıyorsan: REACT_APP_SOCKET_URL
const SOCKET_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SOCKET_URL) ||
  process.env.REACT_APP_SOCKET_URL ||
  "http://localhost:5000";

export const socket = io(SOCKET_URL, {
  autoConnect: false, // login sonrası manuel bağlanacağız
});

let heartbeatInterval = null;

// 1. Sunucuya başarıyla bağlanıldığında "ben online'ım" sinyali gönder
socket.on("connect", () => {
  console.log("Sunucuya bağlandı, online sinyali gönderiliyor. ID:", socket.id);
  socket.emit("user_online");
  startHeartbeat();
});

// 2. Bağlantı kopma durumunu konsolda görmek için
socket.on("disconnect", (reason) => {
  console.log("Sunucu bağlantısı koptu:", reason);
  stopHeartbeat();
});

// 3. Bağlantı hiç kurulamazsa (sunucu kapalı, CORS hatası vb.)
socket.on("connect_error", (err) => {
  console.error("Bağlantı hatası:", err.message);
});

// 4. Otomatik yeniden bağlanma başarılı olduğunda
socket.io.on("reconnect", (attempt) => {
  console.log("Yeniden bağlanıldı, deneme sayısı:", attempt);
});

// Kalp Atışı (Heartbeat): Her 30 saniyede bir sunucuya hayatta olduğunu bildir
function startHeartbeat() {
  stopHeartbeat(); // aynı anda birden fazla interval oluşmasını engelle
  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit("heartbeat");
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Login sonrası token ile bağlan
export const connectSocket = (token) => {
  socket.auth = { token };
  socket.connect();
};

// Logout sırasında bağlantıyı temiz şekilde kapat
export const disconnectSocket = () => {
  socket.emit("user_offline");
  stopHeartbeat();
  socket.disconnect();
};

// Sekme/tarayıcı kapatılırken sunucuya haber ver
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    if (socket.connected) {
      socket.emit("user_offline");
    }
  });
}