const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', '..', 'database.db');
const db = new Database(dbPath);
db.exec("UPDATE users SET first_name = 'Supervisor', last_name = '' WHERE email = 'supervisor@conectubos.com'");
console.log('Nome atualizado com sucesso!');
db.close();