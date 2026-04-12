/**
 * Script de migração: cria os usuários de vendedores com o ID do módulo Visão em Loja (C####)
 * Executar com: node scripts/seed-vendor-module-users.cjs
 */
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

// Mapeamento: IDVENDEDOR → código do módulo Visão em Loja
const VENDOR_MODULE_CODES = {
  "1014115": "C4821", // ALAN
  "14093":   "C3076", // CARLISON
  "1004249": "C1547", // EMILLY
  "10421":   "C7839", // ERIVAN
  "1014938": "C2954", // JANIO
  "10774":   "C6183", // JOANES
  "1004703": "C9247", // LAURA LETICIA
  "11033":   "C5360", // MAGNO
  "11038":   "C8512", // MARCOS
  "1014856": "C4093", // MARCOS FELIPE
  "1012888": "C7428", // MARIANE
  "10965":   "C2671", // NAILTON
  "11704":   "C5834", // REJANE
};

const dbPath = path.join(__dirname, '..', 'database.db');
console.log('Conectando ao banco:', dbPath);

const db = new Database(dbPath);

const hashedPass = bcrypt.hashSync('1234', 10);
let added = 0;
let skipped = 0;

// Buscar os vendedores do cache_vendas
let rows = [];
try {
  rows = db.prepare(`
    SELECT CAST(IDVENDEDOR AS TEXT) as id, MAX(NOME_VENDEDOR) as name
    FROM cache_vendas
    WHERE IDVENDEDOR IS NOT NULL AND NOME_VENDEDOR IS NOT NULL
      AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
    GROUP BY IDVENDEDOR
  `).all();
} catch (e) {
  console.error('Erro ao buscar cache_vendas:', e.message);
  process.exit(1);
}

const existingUsers = db.prepare('SELECT email FROM users').all().map(u => u.email.toLowerCase());
const existingSet = new Set(existingUsers);

const insertStmt = db.prepare(
  'INSERT INTO users (email, password, first_name, role) VALUES (?, ?, ?, ?)'
);

for (const row of rows) {
  const moduleCode = VENDOR_MODULE_CODES[row.id];
  if (!moduleCode) continue; // sem código mapeado, pular

  if (existingSet.has(moduleCode.toLowerCase())) {
    console.log(`[SKIP] ${moduleCode} (${row.name}) — usuário já existe`);
    skipped++;
    continue;
  }

  try {
    insertStmt.run(moduleCode, hashedPass, row.name, 'vendedor');
    console.log(`[OK]   ${moduleCode} (${row.name}) — criado com senha 1234`);
    existingSet.add(moduleCode.toLowerCase());
    added++;
  } catch (e) {
    console.error(`[ERR]  ${moduleCode} (${row.name}):`, e.message);
  }
}

console.log(`\nConcluído: ${added} criados, ${skipped} já existiam.`);
db.close();
