const Database = require('better-sqlite3');
const db = new Database('database.db', { readonly: true });

const names = ['MARCOS', 'JOANES', 'REJANE', 'MAGNO', 'NAILTON', 'CARLISON', 'ERIVAN', 'JANIO', 'MARIANE', 'ALAN', 'EMILLY', 'MARCOS FELIPE', 'LAURA LETICIA'];
const conditions = names.map(n => `UPPER(NOME_VENDEDOR) LIKE '%${n}%'`).join(' OR ');

const rows = db.prepare(`
  SELECT IDVENDEDOR as id, NOME_VENDEDOR as name, MIN(IDEMPRESA) as empresa
  FROM cache_vendas 
  WHERE (${conditions}) 
    AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
  GROUP BY IDVENDEDOR
  ORDER BY name
`).all();

rows.forEach(r => console.log(`${r.id} - ${r.name} (empresa: ${r.empresa})`));
db.close();
