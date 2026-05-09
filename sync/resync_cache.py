"""
CONECTUBOS — Re-sincronização Direcionada de Cache de Vendas
=============================================================

Limpa apenas os caches de vendas (cache_vendas, cache_campanhas,
cache_tubos_conexoes) e zera os watermarks de sync, forçando o próximo
ciclo de erp_sync.py a re-puxar os dados do ERP com a consulta corrigida.

NÃO toca em: users, goals, campaigns, commissions, app_settings, etc.

Uso:
  python sync/resync_cache.py          -- pede confirmação
  python sync/resync_cache.py --sim    -- executa sem perguntar
"""

from __future__ import annotations

import argparse
import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

PG_URL = os.environ.get("DATABASE_URL", "")
if not PG_URL:
    raise SystemExit("DATABASE_URL não configurado.")

# Routines whose sync_state rows will be deleted (forces full re-pull)
ROUTINES = ["cache_vendas", "cache_campanhas", "cache_tubos_conexoes"]

# Cache tables to truncate
CACHE_TABLES = ["cache_vendas", "cache_campanhas", "cache_tubos_conexoes"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sim", action="store_true", help="Executa sem pedir confirmação")
    parser.add_argument(
        "--tubos-only", action="store_true",
        help="Limpa apenas cache_tubos_conexoes (preserva vendas e campanhas)",
    )
    args = parser.parse_args()

    if args.tubos_only:
        tables   = ["cache_tubos_conexoes"]
        routines = ["cache_tubos_conexoes"]
    else:
        tables   = CACHE_TABLES
        routines = ROUTINES

    print("=" * 60)
    print("  CONECTUBOS — Re-sync de Cache de Vendas")
    print("=" * 60)
    print()
    print("Tabelas que serão LIMPAS:")
    for t in tables:
        print(f"  - {t}")
    print()
    print("Watermarks que serão zerados (sync_state):")
    for r in routines:
        print(f"  - {r}")
    print()
    print("PRESERVADO: users, goals, campaigns, commissions, app_settings, ...")
    print()

    if not args.sim:
        resp = input("Confirmar? [s/N] ").strip().lower()
        if resp not in ("s", "sim", "y", "yes"):
            print("Cancelado.")
            sys.exit(0)

    conn = psycopg2.connect(PG_URL)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Truncate cache tables
        for table in tables:
            cur.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY')
            print(f"[OK] TRUNCATE {table}")

        # 2. Delete sync_state entries so erp_sync re-fetches from default watermark
        for routine in routines:
            cur.execute("DELETE FROM sync_state WHERE routine_name = %s", (routine,))
            print(f"[OK] sync_state removido: {routine}")

        # 3. Clear any stale job_locks for these routines
        for routine in routines:
            name = routine.replace("cache_", "")  # "vendas", "campanhas", "tubos_conexoes"
            cur.execute("DELETE FROM job_locks WHERE routine_name = %s", (name,))
            cur.execute("DELETE FROM job_locks WHERE routine_name = %s", (routine,))

        conn.commit()
        print()
        print("[CONCLUÍDO] Cache limpo com sucesso.")
        print()
        if args.tubos_only:
            print("Próximo passo — re-sincronizar tubos com SQL corrigido:")
            print("  cd sync && python erp_sync.py tubos")
        else:
            print("Próximo passo — re-sincronizar com SQL corrigido:")
            print("  cd sync")
            print("  python erp_sync.py vendas")
            print("  python erp_sync.py campanhas")
            print("  python erp_sync.py tubos")
            print()
            print("Ou tudo de uma vez (aguarde alguns minutos):")
            print("  python erp_sync.py all")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERRO] {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
