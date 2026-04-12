const Database = require('better-sqlite3');
const db = new Database('database.db');
db.exec("UPDATE users SET first_name = 'Supervisor', last_name = '' WHERE email = 'supervisor@conectubos.com'");
console.log('Nome atualizado com sucesso!');
db.close();