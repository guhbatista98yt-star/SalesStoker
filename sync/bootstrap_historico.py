"""
CONECTUBOS — Carga Histórica Inicial (2 anos)
==============================================

Executa somente quando o PostgreSQL ainda não possui histórico completo.
Carrega mês a mês os últimos 2 anos de dados do DB2.

REGRAS DE SEGURANÇA (ERP):
  - Consultas sempre filtradas por período (sem table scan)
  - Somente colunas necessárias (sem SELECT *)
  - WITH UR em todas as leituras DB2
  - Conexão DB2 aberta, lida e FECHADA antes de qualquer processamento local
  - Commit/rollback por lote no PostgreSQL
  - Lock de execução — evita dois processos simultâneos
  - Idempotente — pode ser interrompido e retomado sem duplicar dados

USO:
  python bootstrap_historico.py              # detecta e executa se necessário
  python bootstrap_historico.py --force      # força reexecução mesmo se concluído
  python bootstrap_historico.py --status     # mostra estado atual sem executar
  python bootstrap_historico.py --rotina vendas  # processa apenas uma rotina
"""

from __future__ import annotations

import argparse
import logging
import os
import socket
import sys
import time
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Generator, Iterator

import psycopg2
import psycopg2.extras
import pyodbc
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(__file__))
from erp_queries import SQL_VENDAS, SQL_CAMPANHAS, SQL_TUBOS  # noqa: E402
from erp_sync import _fix_monetary                            # noqa: E402

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()  # fallback: project root .env

# ─── Configuração ─────────────────────────────────────────────────────────────

DB2_DSN = os.environ.get("DB2_DSN", "CISSODBC")
DB2_UID = os.environ.get("DB2_UID", "CONSULTA")
DB2_PWD = os.environ.get("DB2_PWD", "")
DB2_HOST = os.environ.get("DB2_HOST", "")
PG_DSN  = os.environ["DATABASE_URL"]

ANOS_HISTORICO = 2          # quantos anos de histórico carregar
BATCH_SIZE     = 2_000      # linhas por fetchmany
LOCK_TTL_SEC   = 7_200      # 2 horas — carga histórica pode demorar

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("bootstrap_historico")

# ─── Conexões ─────────────────────────────────────────────────────────────────

def _db2_conn_string() -> str:
    if DB2_HOST:
        return (
            f"DSN={DB2_DSN};UID={DB2_UID};PWD={DB2_PWD};"
            "MODE=SHARE;CLIENTENCALG=2;PROTOCOL=TCPIP;"
            f"TXNISOLATION=1;SERVICENAME=50000;HOSTNAME={DB2_HOST};"
            "DATABASE=CISSERP;"
        )
    return f"DSN={DB2_DSN};UID={DB2_UID};PWD={DB2_PWD}"


@contextmanager
def db2_connection() -> Generator[pyodbc.Connection, None, None]:
    conn: pyodbc.Connection | None = None
    try:
        conn = pyodbc.connect(_db2_conn_string(), autocommit=True, timeout=30)
        conn.execute("SET CURRENT SCHEMA DBA")
        log.debug("DB2 aberto (schema=DBA)")
        yield conn
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
            log.debug("DB2 fechado")


@contextmanager
def pg_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    conn: psycopg2.extensions.connection | None = None
    try:
        conn = psycopg2.connect(PG_DSN)
        yield conn
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()


# ─── Lock ─────────────────────────────────────────────────────────────────────

def _acquire_lock(pg: psycopg2.extensions.connection, rotina: str) -> bool:
    host = socket.gethostname()
    now  = datetime.now(timezone.utc)
    exp  = now + timedelta(seconds=LOCK_TTL_SEC)
    with pg.cursor() as cur:
        cur.execute(
            "DELETE FROM job_locks WHERE routine_name = %s AND expires_at < %s",
            (f"bootstrap_{rotina}", now),
        )
        try:
            cur.execute(
                "INSERT INTO job_locks (routine_name, locked_at, locked_by, expires_at) "
                "VALUES (%s, %s, %s, %s)",
                (f"bootstrap_{rotina}", now, host, exp),
            )
            pg.commit()
            return True
        except psycopg2.errors.UniqueViolation:
            pg.rollback()
            return False


def _release_lock(pg: psycopg2.extensions.connection, rotina: str) -> None:
    with pg.cursor() as cur:
        cur.execute("DELETE FROM job_locks WHERE routine_name = %s", (f"bootstrap_{rotina}",))
    pg.commit()


# ─── Estado ───────────────────────────────────────────────────────────────────

def _bootstrap_concluido(pg: psycopg2.extensions.connection, rotina: str) -> bool:
    with pg.cursor() as cur:
        cur.execute(
            "SELECT status FROM bootstrap_status WHERE routine_name = %s",
            (rotina,),
        )
        row = cur.fetchone()
        return row is not None and row[0] == "concluido"


def _init_bootstrap_status(
    pg: psycopg2.extensions.connection,
    rotina: str,
    data_inicio: date,
    data_fim: date,
    total_meses: int,
) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bootstrap_status
              (routine_name, status, data_inicio, data_fim, total_meses, started_at, updated_at)
            VALUES (%s, 'em_andamento', %s, %s, %s, NOW(), NOW())
            ON CONFLICT (routine_name) DO UPDATE SET
              status      = 'em_andamento',
              data_inicio = EXCLUDED.data_inicio,
              data_fim    = EXCLUDED.data_fim,
              total_meses = EXCLUDED.total_meses,
              started_at  = COALESCE(bootstrap_status.started_at, NOW()),
              updated_at  = NOW()
            """,
            (rotina, data_inicio.isoformat(), data_fim.isoformat(), total_meses),
        )
    pg.commit()


def _mark_bootstrap_concluido(pg: psycopg2.extensions.connection, rotina: str) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            UPDATE bootstrap_status SET
              status = 'concluido', finished_at = NOW(), updated_at = NOW(),
              meses_ok = (SELECT COUNT(*) FROM bootstrap_historico
                          WHERE routine_name = %s AND status = 'ok'),
              total_records = (SELECT COALESCE(SUM(records_written), 0) FROM bootstrap_historico
                               WHERE routine_name = %s AND status = 'ok')
            WHERE routine_name = %s
            """,
            (rotina, rotina, rotina),
        )
    pg.commit()


def _mark_bootstrap_erro(pg: psycopg2.extensions.connection, rotina: str, msg: str) -> None:
    with pg.cursor() as cur:
        cur.execute(
            "UPDATE bootstrap_status SET status='erro', error_msg=%s, updated_at=NOW() "
            "WHERE routine_name = %s",
            (msg[:2000], rotina),
        )
    pg.commit()


def _get_meses_pendentes(pg: psycopg2.extensions.connection, rotina: str) -> list[tuple[date, date]]:
    """Returns list of (periodo_inicio, periodo_fim) that are still pending or failed."""
    with pg.cursor() as cur:
        cur.execute(
            "SELECT periodo_inicio, periodo_fim FROM bootstrap_historico "
            "WHERE routine_name = %s AND status IN ('pendente', 'erro') "
            "ORDER BY periodo_inicio",
            (rotina,),
        )
        rows = cur.fetchall()
    return [(r[0], r[1]) for r in rows]


def _next_month(d: date) -> date:
    """Returns the first day of the next month."""
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def _plan_meses(rotina: str, data_inicio: date, data_fim: date) -> list[tuple[date, date]]:
    """Generates month-by-month windows from data_inicio to data_fim."""
    meses: list[tuple[date, date]] = []
    cur = data_inicio.replace(day=1)
    while cur <= data_fim:
        fim_mes = _next_month(cur) - timedelta(days=1)
        fim_mes = min(fim_mes, data_fim)
        meses.append((cur, fim_mes))
        cur = _next_month(cur)
    return meses


def _ensure_meses_planejados(
    pg: psycopg2.extensions.connection,
    rotina: str,
    meses: list[tuple[date, date]],
) -> None:
    """Inserts pending rows for months not yet registered."""
    with pg.cursor() as cur:
        for inicio, fim in meses:
            cur.execute(
                """
                INSERT INTO bootstrap_historico
                  (routine_name, periodo_inicio, periodo_fim, status)
                VALUES (%s, %s, %s, 'pendente')
                ON CONFLICT (routine_name, periodo_inicio) DO NOTHING
                """,
                (rotina, inicio.isoformat(), fim.isoformat()),
            )
    pg.commit()


def _mark_mes_inicio(pg: psycopg2.extensions.connection, rotina: str, inicio: date) -> None:
    with pg.cursor() as cur:
        cur.execute(
            "UPDATE bootstrap_historico SET status='em_andamento', started_at=NOW() "
            "WHERE routine_name=%s AND periodo_inicio=%s",
            (rotina, inicio.isoformat()),
        )
    pg.commit()


def _mark_mes_ok(
    pg: psycopg2.extensions.connection,
    rotina: str,
    inicio: date,
    records_read: int,
    records_written: int,
) -> None:
    with pg.cursor() as cur:
        cur.execute(
            "UPDATE bootstrap_historico SET status='ok', finished_at=NOW(), "
            "records_read=%s, records_written=%s "
            "WHERE routine_name=%s AND periodo_inicio=%s",
            (records_read, records_written, rotina, inicio.isoformat()),
        )
        cur.execute(
            "UPDATE bootstrap_status SET meses_ok=meses_ok+1, "
            "total_records=total_records+%s, updated_at=NOW() WHERE routine_name=%s",
            (records_written, rotina),
        )
    pg.commit()


def _mark_mes_erro(
    pg: psycopg2.extensions.connection, rotina: str, inicio: date, msg: str
) -> None:
    with pg.cursor() as cur:
        cur.execute(
            "UPDATE bootstrap_historico SET status='erro', finished_at=NOW(), error_msg=%s "
            "WHERE routine_name=%s AND periodo_inicio=%s",
            (msg[:2000], rotina, inicio.isoformat()),
        )
    pg.commit()


# ─── DB2 reader helper ────────────────────────────────────────────────────────

def _fetch_all(cursor: pyodbc.Cursor, batch_size: int = BATCH_SIZE) -> list[tuple]:
    rows: list[tuple] = []
    while True:
        chunk = cursor.fetchmany(batch_size)
        if not chunk:
            break
        rows.extend(chunk)
    return rows


# ─── Rotinas de extração por mês ──────────────────────────────────────────────

def _sync_vendas_mes(
    pg: psycopg2.extensions.connection, inicio: date, fim: date
) -> tuple[int, int]:
    """Loads one month of vendas from DB2 into cache_vendas."""
    rows: list[tuple] = []

    with db2_connection() as db2:
        cur = db2.cursor()
        cur.execute(SQL_VENDAS, (inicio, fim))
        rows = _fetch_all(cur)
        cur.close()

    total_read = len(rows)

    with pg.cursor() as pgcur:
        pgcur.execute(
            'DELETE FROM cache_vendas WHERE "DT_MOVIMENTO" >= %s AND "DT_MOVIMENTO" <= %s',
            (inicio, fim),
        )
        # Columns: IDVENDEDOR[0] NOME_VENDEDOR[1] IDEMPRESA[2]
        #          IDPLANILHA[3] DT_MOVIMENTO[4] TOTALVENDA_LINHA[5]
        if rows:
            psycopg2.extras.execute_values(
                pgcur,
                'INSERT INTO cache_vendas ("IDVENDEDOR","NOME_VENDEDOR","IDEMPRESA",'
                '"IDPLANILHA","DT_MOVIMENTO","TOTALVENDA_LINHA",synced_at) VALUES %s',
                [
                    (r[0], r[1], r[2], r[3], r[4],
                     _fix_monetary(r[5]),
                     datetime.now(timezone.utc))
                    for r in rows
                ],
                page_size=BATCH_SIZE,
            )
    pg.commit()
    return total_read, total_read


def _sync_campanhas_mes(
    pg: psycopg2.extensions.connection, inicio: date, fim: date
) -> tuple[int, int]:
    rows: list[tuple] = []

    with db2_connection() as db2:
        cur = db2.cursor()
        cur.execute(SQL_CAMPANHAS, (inicio, fim))
        rows = _fetch_all(cur)
        cur.close()

    total_read = len(rows)

    with pg.cursor() as pgcur:
        pgcur.execute(
            'DELETE FROM cache_campanhas WHERE "DTMOVIMENTO" >= %s AND "DTMOVIMENTO" <= %s',
            (inicio, fim),
        )
        # Columns: IDVENDEDOR[0] NOMEVENDEDOR[1] IDPRODUTO[2] FABRICANTE[3]
        #          VALOR_LIQUIDO[4] QTD[5] DTMOVIMENTO[6]
        if rows:
            psycopg2.extras.execute_values(
                pgcur,
                'INSERT INTO cache_campanhas ("IDVENDEDOR","NOMEVENDEDOR","IDPRODUTO",'
                '"FABRICANTE","VALOR_LIQUIDO","QTD","DTMOVIMENTO",synced_at) VALUES %s',
                [
                    (r[0], r[1], r[2], r[3],
                     _fix_monetary(r[4]), _fix_monetary(r[5]),
                     r[6], datetime.now(timezone.utc))
                    for r in rows
                ],
                page_size=BATCH_SIZE,
            )
    pg.commit()
    return total_read, total_read


def _sync_tubos_mes(
    pg: psycopg2.extensions.connection, inicio: date, fim: date
) -> tuple[int, int]:
    rows: list[tuple] = []

    with db2_connection() as db2:
        cur = db2.cursor()
        cur.execute(SQL_TUBOS, (inicio, fim))
        rows = _fetch_all(cur)
        cur.close()

    total_read = len(rows)

    with pg.cursor() as pgcur:
        pgcur.execute(
            'DELETE FROM cache_tubos_conexoes '
            'WHERE "DT_MOVIMENTO" >= %s AND "DT_MOVIMENTO" <= %s',
            (inicio, fim),
        )
        # Columns: IDVENDEDOR[0] NOME_VENDEDOR[1] IDEMPRESA[2]
        #          DT_MOVIMENTO[3] TOTALVENDA_LINHA[4]
        if rows:
            psycopg2.extras.execute_values(
                pgcur,
                'INSERT INTO cache_tubos_conexoes ("IDVENDEDOR","NOME_VENDEDOR","IDEMPRESA",'
                '"DT_MOVIMENTO","TOTALVENDA_LINHA",synced_at) VALUES %s',
                [
                    (r[0], r[1], r[2], r[3],
                     _fix_monetary(r[4]),
                     datetime.now(timezone.utc))
                    for r in rows
                ],
                page_size=BATCH_SIZE,
            )
    pg.commit()
    return total_read, total_read


ROTINAS_FN = {
    "vendas":    _sync_vendas_mes,
    "campanhas": _sync_campanhas_mes,
    "tubos":     _sync_tubos_mes,
}


# ─── Runner por rotina ────────────────────────────────────────────────────────

def run_bootstrap_rotina(rotina: str, force: bool = False) -> None:
    log.info(f"=== Bootstrap histórico: {rotina} ===")

    hoje      = date.today()
    data_fim  = hoje
    data_ini  = (hoje - timedelta(days=ANOS_HISTORICO * 365)).replace(day=1)

    with pg_connection() as pg:
        if not force and _bootstrap_concluido(pg, rotina):
            log.info(f"[{rotina}] Bootstrap já concluído. Use --force para reprocessar.")
            return

        if not _acquire_lock(pg, rotina):
            log.warning(f"[{rotina}] Já em execução em outro processo — abortando.")
            return

    try:
        meses = _plan_meses(rotina, data_ini, data_fim)
        total_meses = len(meses)
        log.info(f"[{rotina}] Período: {data_ini} → {data_fim} | {total_meses} meses")

        with pg_connection() as pg:
            _init_bootstrap_status(pg, rotina, data_ini, data_fim, total_meses)
            _ensure_meses_planejados(pg, rotina, meses)

        with pg_connection() as pg:
            pendentes = _get_meses_pendentes(pg, rotina)

        log.info(f"[{rotina}] {len(pendentes)} meses pendentes")

        fn = ROTINAS_FN[rotina]

        for idx, (inicio, fim) in enumerate(pendentes, 1):
            t0 = time.time()
            log.info(f"[{rotina}] Mês {idx}/{len(pendentes)}: {inicio} → {fim}")

            with pg_connection() as pg:
                _mark_mes_inicio(pg, rotina, inicio)

            try:
                with pg_connection() as pg:
                    read, written = fn(pg, inicio, fim)
                with pg_connection() as pg:
                    _mark_mes_ok(pg, rotina, inicio, read, written)
                elapsed = round(time.time() - t0, 1)
                log.info(f"[{rotina}] ✓ {inicio}: {read} lidas, {written} gravadas em {elapsed}s")

            except Exception as exc:
                msg = str(exc)
                log.exception(f"[{rotina}] ✗ {inicio}: {msg}")
                with pg_connection() as pg:
                    _mark_mes_erro(pg, rotina, inicio, msg)

        with pg_connection() as pg:
            pendentes_restantes = _get_meses_pendentes(pg, rotina)
            if not pendentes_restantes:
                _mark_bootstrap_concluido(pg, rotina)
                log.info(f"[{rotina}] ✅ Bootstrap concluído com sucesso!")
            else:
                msg = f"{len(pendentes_restantes)} meses com erro"
                _mark_bootstrap_erro(pg, rotina, msg)
                log.warning(f"[{rotina}] Bootstrap incompleto — {msg}")

    finally:
        with pg_connection() as pg:
            _release_lock(pg, rotina)


# ─── Status display ───────────────────────────────────────────────────────────

def show_status() -> None:
    with pg_connection() as pg:
        with pg.cursor() as cur:
            cur.execute(
                "SELECT routine_name, status, data_inicio, data_fim, "
                "total_meses, meses_ok, total_records, started_at, finished_at "
                "FROM bootstrap_status ORDER BY routine_name"
            )
            rows = cur.fetchall()

    if not rows:
        print("Nenhum bootstrap registrado ainda.")
        return

    for r in rows:
        print(
            f"  {r[0]:15s} | {r[1]:12s} | {str(r[2]):10s}→{str(r[3]):10s} "
            f"| {r[5]}/{r[4]} meses | {r[6] or 0:,} registros"
        )

    with pg_connection() as pg:
        with pg.cursor() as cur:
            cur.execute(
                "SELECT routine_name, periodo_inicio, status, records_written, error_msg "
                "FROM bootstrap_historico WHERE status IN ('erro','em_andamento') "
                "ORDER BY routine_name, periodo_inicio"
            )
            erros = cur.fetchall()

    if erros:
        print("\nMeses com problemas:")
        for e in erros:
            print(f"  {e[0]} | {e[1]} | {e[2]} | {e[4] or ''}")


# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="CONECTUBOS — Bootstrap Histórico 2 anos")
    parser.add_argument("--force",  action="store_true", help="Reprocessa mesmo se já concluído")
    parser.add_argument("--status", action="store_true", help="Exibe estado sem executar")
    parser.add_argument(
        "--rotina",
        choices=list(ROTINAS_FN.keys()),
        default=None,
        help="Executa somente uma rotina",
    )
    args = parser.parse_args()

    if args.status:
        show_status()
        return

    rotinas = [args.rotina] if args.rotina else list(ROTINAS_FN.keys())

    for r in rotinas:
        run_bootstrap_rotina(r, force=args.force)


if __name__ == "__main__":
    main()
