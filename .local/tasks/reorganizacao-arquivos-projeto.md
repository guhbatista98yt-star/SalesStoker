# Reorganização e Limpeza de Arquivos

## What & Why
The project has accumulated clutter: scripts scattered at the root level, two folders doing the same job (`script/` vs `scripts/`), duplicate files, and asset files with auto-generated unreadable names. Cleaning this up makes the project navigable and professional.

## Done looks like
- No loose scripts or utility files sitting at the project root
- A single `scripts/` folder with clear subfolders: `db/` for database maintenance and `seed/` for seeding scripts
- SQL reference files consolidated under `scripts/sql/` with readable names
- `attached_assets/` replaced by a `docs/` folder with meaningful filenames
- Duplicate `query-vendors.cjs` removed (keep `.js` version)
- `test_acomp.ts` deleted (11-line debug file with no production use)
- `script/build.ts` moved into `scripts/` and the now-empty `script/` folder removed
- All internal import paths and references updated so the app continues to work
- `client/src/` left completely untouched (active tasks in progress depend on it)

## Out of scope
- Refactoring `client/src/` folder structure (active tasks #1, #2, #3 are modifying those files)
- Renaming server-side modules or shared schema files
- Changing the database file location

## Tasks
1. **Clean root-level files** — Move `recover_db.py`, `reset_db.py`, and `update-user.cjs` into `scripts/db/`. Delete `test_acomp.ts` (debug-only file). Move `script/build.ts` into `scripts/` and delete the now-empty `script/` folder. Update any references to these files in `package.json` scripts.

2. **Reorganize `scripts/` with subfolders** — Create `scripts/db/` for database maintenance scripts (`recover_db.py`, `reset_db.py`, `update-user.cjs`, `sync_db2.py`, `create-user.js`, `seed-vendor-module-users.cjs`) and `scripts/seed/` for seeding scripts (`seed_campaign_goals.py`). Remove the duplicate `query-vendors.cjs`, keeping only `query-vendors.js` (rename to `query-vendors.cjs` only if `.cjs` is required by Node). Move `requirements.txt` to `scripts/`. Remove `scripts/iniciar.bat` if it is not used.

3. **Rename and consolidate SQL and docs** — Rename the SQL files in `attached_assets/` to readable names and move them into `scripts/sql/` (e.g., `estoque_geral.sql`, `lista_produtos.sql`, `movimentacoes_vendas.sql`, `orcamentos.sql`). Rename the `.txt` requirement files in `attached_assets/` to meaningful names and move them to a new top-level `docs/` folder (e.g., `docs/requisitos-campanhas.md`, `docs/requisitos-configuracoes.md`). Delete the now-empty `attached_assets/` folder and the `.zip` file inside it (it is a database backup duplicate). Check if `scripts/sql/` already contains any of these SQL files and avoid duplication.

## Relevant files
- `package.json`
- `scripts/create-user.js`
- `scripts/query-vendors.cjs`
- `scripts/query-vendors.js`
- `scripts/seed_campaign_goals.py`
- `scripts/seed-vendor-module-users.cjs`
- `scripts/sync_db2.py`
- `scripts/iniciar.bat`
- `scripts/requirements.txt`
- `scripts/database-schema.sql`
- `scripts/sql/tubos_conexoes_amanco.sql`
- `scripts/sql/tubos_conexoes.sql`
- `scripts/sql/vendas_pendentes.sql`
- `scripts/sql/vendas_produtos_campanhas.sql`
- `scripts/sql/vendas.sql`
- `script/build.ts`
- `recover_db.py`
- `reset_db.py`
- `update-user.cjs`
- `test_acomp.ts`
- `attached_assets/estoque_geral_1775970502344.sql`
- `attached_assets/lista_produtos_1775970502345.sql`
- `attached_assets/movimentacoes_vendas_devolucoes_1775970502345.sql`
- `attached_assets/orcamentos_1775970502346.sql`
- `attached_assets/Pasted-Quero-evoluir-o-m-dulo-de-Campanhas-da-aplica-o-para-qu_1775970324511.txt`
- `attached_assets/Pasted-Quero-implementar-dentro-do-m-dulo-de-Configura-es-da-a_1775967619992.txt`
- `attached_assets/database_1775964693471.zip`
