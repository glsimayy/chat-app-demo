// backend/server.js
const { poolPromise } = require('./db');

async function startServer() {
    await poolPromise;
    console.log("Sunucu hazır ve veritabanı bağlantısı kuruldu.");
}

startServer();