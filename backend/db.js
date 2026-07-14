const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'glsm.0606',
    server: 'localhost',
    database: 'ElloDB',
    options: {
        encrypt: false,           
        trustServerCertificate: true,
        enableArithAbort: true  
    }
};

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('ElloDB veritabanına başarıyla bağlandı!');
        return pool;
    })
    .catch(err => {
        console.error('Veritabanı bağlantı hatası: ', err);
        process.exit(1);
    });

module.exports = { sql, poolPromise };