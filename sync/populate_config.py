"""
populate_config.py — Populates compras_fornecedores_config directly from the
ERP caches, bypassing the "Sincronizar ERP" API button.

Run AFTER campanhas and estoque_sugestao have been synced:
    python sync/populate_config.py

Safe to run multiple times — only inserts rows that don't exist yet.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import psycopg2
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] populate_config — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

PG_DSN = os.environ.get("DATABASE_URL", "")
if not PG_DSN:
    raise SystemExit("DATABASE_URL não configurado no .env")

# ---------------------------------------------------------------------------
# Step 1 — ensure company_id column exists
# ---------------------------------------------------------------------------
ENSURE_SQL = """
ALTER TABLE compras_fornecedores_config
  ADD COLUMN IF NOT EXISTS "company_id" INTEGER NOT NULL DEFAULT 1;
"""

# ---------------------------------------------------------------------------
# Step 2 — collect distinct (fabricante, company_id) from both caches
# ---------------------------------------------------------------------------
COLLECT_SQL = """
SELECT fabricante, company_id
FROM (
    SELECT DISTINCT
        TRIM("FABRICANTE") AS fabricante,
        CASE
            WHEN "IDEMPRESA" ~ '^[0-9]+$' THEN CAST("IDEMPRESA" AS INTEGER)
            ELSE 1
        END AS company_id
    FROM cache_campanhas
    WHERE "FABRICANTE" IS NOT NULL AND TRIM("FABRICANTE") != ''
    UNION
    SELECT DISTINCT
        TRIM("FABRICANTE") AS fabricante,
        1 AS company_id
    FROM cache_estoque_sugestao
    WHERE "FABRICANTE" IS NOT NULL AND TRIM("FABRICANTE") != ''
) t
ORDER BY company_id, fabricante
"""

# ---------------------------------------------------------------------------
# Step 3 — upsert into compras_fornecedores_config
# ---------------------------------------------------------------------------
CHECK_SQL = """
SELECT id FROM compras_fornecedores_config
WHERE company_id = %s AND fabricante_nome = %s
"""

INSERT_SQL = """
INSERT INTO compras_fornecedores_config
  (id, company_id, fabricante_nome, codigo, razao_social,
   nome_fantasia, ativo, periodo_compra_dias, lead_time_dias,
   pedido_minimo_valor, observacoes, created_at, updated_at)
VALUES (%s, %s, %s, '', '', %s, 1, 30, 7, 0, '', %s, %s)
"""


def main() -> None:
    conn = psycopg2.connect(PG_DSN)
    try:
        with conn.cursor() as cur:
            # Ensure column exists
            cur.execute(ENSURE_SQL)
            conn.commit()
            log.info("Coluna company_id verificada.")

            # Collect fabricantes
            cur.execute(COLLECT_SQL)
            rows = cur.fetchall()

        if not rows:
            log.error(
                "Nenhum fabricante encontrado nas tabelas de cache. "
                "Execute primeiro: python sync/erp_sync.py campanhas"
            )
            return

        log.info(f"{len(rows)} fabricantes encontrados nos caches.")
        now = datetime.now(timezone.utc).isoformat()
        created = 0
        skipped = 0

        with conn.cursor() as cur:
            for (fabricante, company_id) in rows:
                cur.execute(CHECK_SQL, (company_id, fabricante))
                if cur.fetchone():
                    skipped += 1
                else:
                    cur.execute(INSERT_SQL, (
                        str(uuid.uuid4()), company_id, fabricante,
                        fabricante, now, now,
                    ))
                    created += 1

        conn.commit()
        log.info(
            f"Concluído — {created} fornecedores criados, "
            f"{skipped} já existiam."
        )
        log.info(
            "Atualize a página 'Configuração de Compras' no navegador."
        )

    finally:
        conn.close()


if __name__ == "__main__":
    main()
