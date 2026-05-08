"""
CONECTUBOS — Reset de Dados (mantém cadastros de usuário)
===========================================================

Limpa todos os dados operacionais e de cache para permitir uma
sincronização completa a partir do zero.

TABELAS PRESERVADAS (cadastros):
  users, companies, roles, role_permissions, access_audit,
  vendor_display_settings, vendor_groups, vendor_group_members,
  app_settings, purchase_settings, user_alert_preferences,
  alert_delivery_state, compras_fornecedores_config, compras_produtos_config

TABELAS LIMPAS (dados/cache):
  Todos os cache_* (ERP), sync_state, sync_logs, job_locks,
  bootstrap_historico, bootstrap_status,
  goals, goal_settings, alert_configs, alert_notifications,
  campaigns e relacionadas, commission_rules, commission_records,
  purchase_alerts, purchase_alert_events

USO:
  python reset_dados.py              -- exibe o plano e pede confirmação
  ALLOW_DATA_RESET=true python reset_dados.py --confirmar
"""

from __future__ import annotations

import argparse
import sys
import os
import psycopg2
from dotenv import load_dotenv

# Carrega .env da pasta sync/ primeiro, depois raiz do projeto
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# Conexão PostgreSQL: nunca usa fallback para evitar resetar o banco errado.
PG_URL = os.environ.get("DATABASE_URL", "")
if not PG_URL:
    raise SystemExit("DATABASE_URL não configurado. Reset cancelado.")

# ---------------------------------------------------------------------------
# Tabelas que serão LIMPAS (TRUNCATE CASCADE)
# ---------------------------------------------------------------------------
TABELAS_PARA_LIMPAR = [
    # Cache ERP — dados sincronizados do DB2
    "cache_vendas",
    "cache_vendas_pendentes",
    "cache_campanhas",
    "cache_tubos_conexoes",
    "cache_estoque_sugestao",

    # Controle de sync
    "sync_state",
    "sync_logs",
    "job_locks",
    "bootstrap_historico",
    "bootstrap_status",

    # Metas e alertas de vendas
    "goals",
    "goal_settings",
    "alert_configs",
    "alert_notifications",

    # Campanhas
    "campaign_audit_logs",
    "campaign_versions",
    "campaign_simulations",
    "campaign_results",
    "campaign_result_details",
    "campaign_goals",
    "campaigns",

    # Comissões
    "commission_records",
    "commission_rules",

    # Alertas de compras
    "purchase_alert_events",
    "purchase_alerts",
]

# ---------------------------------------------------------------------------
# Tabelas PRESERVADAS (apenas para exibição informativa)
# ---------------------------------------------------------------------------
TABELAS_PRESERVADAS = [
    "users",
    "companies",
    "roles",
    "role_permissions",
    "access_audit",
    "vendor_display_settings",
    "vendor_groups",
    "vendor_group_members",
    "app_settings",
    "purchase_settings",
    "user_alert_preferences",
    "alert_delivery_state",
    "compras_fornecedores_config",
    "compras_produtos_config",
]


def contar_linhas(cur: psycopg2.extensions.cursor, tabela: str) -> int:
    try:
        cur.execute(f'SELECT COUNT(*) FROM "{tabela}"')
        row = cur.fetchone()
        return row[0] if row else 0
    except Exception:
        return -1  # tabela não existe ainda


def tabela_existe(cur: psycopg2.extensions.cursor, tabela: str) -> bool:
    cur.execute(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = %s",
        (tabela,)
    )
    return cur.fetchone() is not None


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset de dados do CONECTUBOS")
    parser.add_argument(
        "--confirmar",
        action="store_true",
        help="Executa o reset sem perguntar, somente com ALLOW_DATA_RESET=true",
    )
    args = parser.parse_args()

    print("=" * 62)
    print("  CONECTUBOS — Reset de Dados")
    print("=" * 62)

    try:
        conn = psycopg2.connect(PG_URL)
        conn.autocommit = False
        cur = conn.cursor()
    except Exception as e:
        print(f"\n[ERRO] Não foi possível conectar ao PostgreSQL: {e}")
        sys.exit(1)

    # Mostra contagens antes do reset
    print("\nTabelas que serão LIMPAS:")
    total_linhas = 0
    existentes: list[str] = []
    for tabela in TABELAS_PARA_LIMPAR:
        if tabela_existe(cur, tabela):
            n = contar_linhas(cur, tabela)
            print(f"  {tabela:<40} {n:>8} linhas")
            total_linhas += n
            existentes.append(tabela)
        else:
            print(f"  {tabela:<40}  (não existe — será ignorada)")

    print(f"\n  Total de linhas que serão removidas: {total_linhas:,}")

    print("\nTabelas PRESERVADAS (cadastros):")
    for tabela in TABELAS_PRESERVADAS:
        if tabela_existe(cur, tabela):
            n = contar_linhas(cur, tabela)
            print(f"  {tabela:<40} {n:>8} linhas  [OK]")

    print()

    if args.confirmar and os.environ.get("ALLOW_DATA_RESET", "").lower() not in {"1", "true", "yes", "sim"}:
        print("\n[ERRO] --confirmar exige ALLOW_DATA_RESET=true para evitar limpeza acidental.")
        conn.close()
        sys.exit(1)

    if os.environ.get("NODE_ENV") == "production" and os.environ.get("ALLOW_PRODUCTION_DATA_RESET", "").lower() not in {"1", "true", "yes", "sim"}:
        print("\n[ERRO] Reset bloqueado em produção. Defina ALLOW_PRODUCTION_DATA_RESET=true apenas com autorização explícita.")
        conn.close()
        sys.exit(1)

    if not args.confirmar:
        resposta = input(
            "Confirma o reset? Digite  RESETAR DADOS  para continuar: "
        ).strip().upper()
        if resposta != "RESETAR DADOS":
            print("Operação cancelada.")
            conn.close()
            sys.exit(0)

    # Executa o TRUNCATE
    print("\nLimpando tabelas...")
    erros = 0
    for tabela in existentes:
        try:
            cur.execute(f'TRUNCATE TABLE "{tabela}" RESTART IDENTITY CASCADE')
            print(f"  [OK] {tabela}")
        except Exception as e:
            print(f"  [ERRO] {tabela}: {e}")
            erros += 1
            conn.rollback()
            conn.autocommit = False

    if erros == 0:
        conn.commit()
        print("\n[CONCLUÍDO] Todos os dados foram limpos com sucesso.")
        print("\nPróximo passo: rode o sync para puxar os dados do ERP:")
        print("  cd sync")
        print("  python erp_sync.py all")
        print("  python bootstrap_historico.py --force")
    else:
        conn.rollback()
        print(f"\n[ATENÇÃO] {erros} erro(s) ocorreram. Nenhuma alteração foi salva.")

    conn.close()


if __name__ == "__main__":
    main()
