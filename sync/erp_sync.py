"""
CONECTUBOS — ERP→PostgreSQL Sync Reference Implementation
==========================================================

Responsible for reading data from DB2 (ERP DBA schema) and writing to
PostgreSQL cache tables read by the Node.js application.

SAFETY DESIGN PRINCIPLES
─────────────────────────
1. No SELECT * — only the columns the application actually uses.
2. Every DB2 read has an explicit date/period filter — no full table scans.
3. DB2 connection is opened, used, committed and CLOSED before any heavy
   local processing. The ERP is never held while we crunch data.
4. Incremental sync via watermark — only new/changed rows are fetched.
5. Job lock prevents two instances of the same routine running at once.
6. Every run is logged to sync_logs with duration and row counts.
7. Watermark is updated ONLY after the full PostgreSQL write succeeds.
8. Heavy historical loads must run off-hours (see SCHEDULE section).

USAGE
──────
  python erp_sync.py vendas            # run incremental vendas sync
  python erp_sync.py campanhas         # run incremental campanhas sync
  python erp_sync.py tubos             # run incremental tubos/conexoes sync
  python erp_sync.py pendentes         # run pending orders sync
  python erp_sync.py estoque_sugestao  # run stock snapshot for Copiloto (TRUNCATE+INSERT)
  python erp_sync.py contas_receber     # run full receivables snapshot
  python erp_sync.py all               # run all routines

DEPENDENCIES
─────────────
  pip install pyodbc psycopg2-binary python-dotenv
"""

from __future__ import annotations

import argparse
import logging
import os
import socket
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from typing import Any, Generator, Iterator

import psycopg2
import psycopg2.extras
import pyodbc
from erp_queries import SQL_VENDAS, SQL_CAMPANHAS, SQL_TUBOS, SQL_PENDENTES, SQL_ESTOQUE_SUGESTAO, SQL_CONTAS_RECEBER
from dotenv import load_dotenv

# ─── Configuration ────────────────────────────────────────────────────────────

# Load .env from the sync/ folder first, fall back to project root
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()  # fallback: project root .env

DB2_DSN       = os.environ.get("DB2_DSN", "")  # e.g. "ERPPROD"
DB2_UID       = os.environ.get("DB2_UID", "")
DB2_PWD       = os.environ.get("DB2_PWD", "")
PG_DSN        = os.environ.get("DATABASE_URL", "")  # PostgreSQL connection string

# How many rows to process per batch (controls memory usage and upsert size)
BATCH_SIZE = 2_000

# Keep at most this many days in cache (older rows are purged on sync)
# 2 years to match the historical bootstrap retention
MAX_CACHE_DAYS = 730

# Lock expiry: if a lock is older than this, treat it as stale
LOCK_TTL_SECONDS = 900  # 15 minutes — reduced from 3600 so failed runs don't block for an hour


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("erp_sync")

# ─── Context managers ─────────────────────────────────────────────────────────

@contextmanager
def db2_connection() -> Generator[pyodbc.Connection, None, None]:
    """
    Opens a DB2 connection, sets the working schema to DBA, and ensures
    the connection is ALWAYS closed — even on error.

    The connection is opened in autocommit=True for read-only queries so
    that we never hold an implicit transaction open while processing data.
    Explicit COMMIT is not needed for SELECT-only workloads, but we call
    commit() once after the cursor is fully consumed, then immediately
    close the connection.
    """
    conn: pyodbc.Connection | None = None
    try:
        missing = [name for name, value in {
            "DB2_DSN": DB2_DSN,
            "DB2_UID": DB2_UID,
            "DB2_PWD": DB2_PWD,
        }.items() if not value]
        if missing:
            raise RuntimeError(f"Variaveis DB2 ausentes: {', '.join(missing)}")
        conn = pyodbc.connect(
            f"DSN={DB2_DSN};UID={DB2_UID};PWD={DB2_PWD}",
            autocommit=True,          # no implicit transaction for reads
            timeout=30,               # connection timeout
        )
        conn.execute("SET CURRENT SCHEMA DBA")
        log.debug("DB2 connection opened (schema=DBA)")
        yield conn
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
            log.debug("DB2 connection closed")


@contextmanager
def pg_connection() -> Generator[psycopg2.extensions.connection, None, None]:
    """Opens a PostgreSQL connection; commits on success, rolls back on error."""
    conn: psycopg2.extensions.connection | None = None
    try:
        if not PG_DSN:
            raise RuntimeError("Variavel DATABASE_URL ausente")
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


# ─── Schema guard ─────────────────────────────────────────────────────────────
#
# Mirrors the column-addition logic in server/schema-bootstrap.ts so the Python
# sync scripts are self-sufficient even when the Node server hasn't run yet on
# this machine (e.g. fresh Windows install, CI environment, or manual runs).

_REQUIRED_COLUMNS: list[tuple[str, str, str]] = [
    # (table, column, definition)
    ("cache_campanhas",             "IDEMPRESA",     "TEXT NOT NULL DEFAULT ''"),
    ("cache_estoque_sugestao",      "DESCRICAO",     "TEXT NOT NULL DEFAULT ''"),
    ("cache_tubos_conexoes",        "TIPO_PRODUTO",  "TEXT NOT NULL DEFAULT ''"),
    ("cache_vendas",                "IDCLIENTE",     "TEXT"),
    ("cache_vendas",                "NOME_CLIENTE",  "TEXT"),
    ("compras_fornecedores_config", "company_id",    "INTEGER NOT NULL DEFAULT 1"),
    ("compras_produtos_config",     "company_id",    "INTEGER NOT NULL DEFAULT 1"),
]


def ensure_schema(pg: psycopg2.extensions.connection) -> None:
    """Adds any missing columns that the Node schema-bootstrap would normally add."""
    with pg.cursor() as cur:
        for table, col, definition in _REQUIRED_COLUMNS:
            cur.execute(
                """
                SELECT 1 FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s
                """,
                (table, col),
            )
            if cur.fetchone() is None:
                cur.execute(
                    f'ALTER TABLE {table} ADD COLUMN IF NOT EXISTS "{col}" {definition}'
                )
                log.info(f"[schema] Adicionada coluna {table}.{col}")
    pg.commit()


# ─── Job lock helpers ─────────────────────────────────────────────────────────

def _acquire_lock(pg: psycopg2.extensions.connection, routine: str) -> bool:
    """
    Tries to acquire an advisory lock for `routine`.
    Returns True if lock acquired, False if another instance is running.
    Stale locks (expired) are automatically cleared.
    """
    host = socket.gethostname()
    now  = datetime.now(timezone.utc)
    exp  = now + timedelta(seconds=LOCK_TTL_SECONDS)

    with pg.cursor() as cur:
        # Clear expired locks first
        cur.execute(
            "DELETE FROM job_locks WHERE routine_name = %s AND expires_at < %s",
            (routine, now),
        )
        # Try to insert (will fail on PK conflict if lock is held)
        try:
            cur.execute(
                """
                INSERT INTO job_locks (routine_name, locked_at, locked_by, expires_at)
                VALUES (%s, %s, %s, %s)
                """,
                (routine, now, host, exp),
            )
            pg.commit()
            return True
        except psycopg2.errors.UniqueViolation:
            pg.rollback()
            return False


def _release_lock(pg: psycopg2.extensions.connection, routine: str) -> None:
    with pg.cursor() as cur:
        cur.execute("DELETE FROM job_locks WHERE routine_name = %s", (routine,))
    pg.commit()


# ─── Sync state helpers ───────────────────────────────────────────────────────

def _get_watermark(pg: psycopg2.extensions.connection, routine: str) -> date | None:
    """Returns the last successfully synced DT_MOVIMENTO (date) for `routine`."""
    with pg.cursor() as cur:
        cur.execute(
            "SELECT last_dt_movimento FROM sync_state WHERE routine_name = %s",
            (routine,),
        )
        row = cur.fetchone()
        if row and row[0]:
            return row[0] if isinstance(row[0], date) else date.fromisoformat(str(row[0]))
    return None


def _update_watermark(
    pg: psycopg2.extensions.connection,
    routine: str,
    watermark: date,
    records_read: int,
    records_written: int,
) -> None:
    """Updates sync_state after a successful run."""
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_state
              (routine_name, last_success_at, last_dt_movimento, status,
               records_read, records_written, last_error, updated_at)
            VALUES (%s, NOW(), %s, 'idle', %s, %s, NULL, NOW())
            ON CONFLICT (routine_name) DO UPDATE SET
              last_success_at  = EXCLUDED.last_success_at,
              last_dt_movimento = EXCLUDED.last_dt_movimento,
              status           = 'idle',
              records_read     = EXCLUDED.records_read,
              records_written  = EXCLUDED.records_written,
              last_error       = NULL,
              updated_at       = NOW()
            """,
            (routine, watermark.isoformat(), records_read, records_written),
        )
    pg.commit()


def _record_error(pg: psycopg2.extensions.connection, routine: str, msg: str) -> None:
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_state (routine_name, status, last_error, updated_at)
            VALUES (%s, 'error', %s, NOW())
            ON CONFLICT (routine_name) DO UPDATE SET
              status = 'error', last_error = EXCLUDED.last_error, updated_at = NOW()
            """,
            (routine, msg[:2000]),
        )
    pg.commit()


# ─── Sync log helpers ─────────────────────────────────────────────────────────

def _log_run(
    pg: psycopg2.extensions.connection,
    routine: str,
    started_at: datetime,
    records_read: int,
    records_written: int,
    success: bool,
    message: str,
    params: dict,
) -> None:
    ended_at    = datetime.now(timezone.utc)
    duration_ms = int((ended_at - started_at).total_seconds() * 1000)
    with pg.cursor() as cur:
        cur.execute(
            """
            INSERT INTO sync_logs
              (routine_name, started_at, ended_at, duration_ms, parameters,
               records_read, records_written, success, message)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                routine, started_at, ended_at, duration_ms,
                psycopg2.extras.Json(params),
                records_read, records_written, success, message[:2000],
            ),
        )
    pg.commit()


# ─── DB2 batch reader ─────────────────────────────────────────────────────────

def _fetch_batches(
    cursor: pyodbc.Cursor,
    batch_size: int = BATCH_SIZE,
) -> Iterator[list[tuple]]:
    """Yields rows from an already-executed DB2 cursor in memory-safe batches."""
    while True:
        rows = cursor.fetchmany(batch_size)
        if not rows:
            break
        yield rows


# ─── Monetary value normalizer ────────────────────────────────────────────────

from decimal import Decimal as _Decimal

def _fix_monetary(v: Any) -> float:
    """
    Convert a DB2 monetary column value to a plain Python float.

    Problem: some DB2 ODBC driver versions return DECIMAL(x,6) columns as
    raw unscaled integers — e.g. the value 407 703.54 comes back as the
    integer 407_703_540_000 (= 407703.54 × 10^6).  The SQL queries already
    use the `* 1E0` trick to force DOUBLE, but this function acts as a
    second line of defense in case the driver ignores the hint.

    Rules:
      - float   → already correct, return as-is
      - Decimal → convert with float()  (stdlib Decimal honours the scale)
      - int     → divide by 10^6 to undo the implicit scale-6 storage
      - None    → 0.0
    """
    if v is None:
        return 0.0
    if isinstance(v, float):
        return v
    if isinstance(v, _Decimal):
        return float(v)
    if isinstance(v, int):
        # Raw unscaled DB2 DECIMAL(x,6) — undo the scale
        return v / 1_000_000.0
    return float(v)


# ─── Routine: cache_vendas ────────────────────────────────────────────────────

def sync_vendas(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Incremental sync of sales movements into cache_vendas.

    DB2 query:
      - Only the 6 columns the app actually reads (no SELECT *)
      - Always filtered by DT_MOVIMENTO >= watermark
      - Date window limited to avoid table scan on large history
      - WITH UR: uncommitted read — safest for analytics, no lock held

    PostgreSQL write:
      - DELETE → INSERT within a transaction (swap strategy)
      - Avoids duplicate primary key conflicts on rerun
      - Watermark updated ONLY after full success
    """
    routine = "cache_vendas"
    started = datetime.now(timezone.utc)

    watermark = _get_watermark(pg, routine)
    if watermark is None:
        # First run: start from 13 months ago to populate recent history
        watermark = date.today().replace(day=1) - timedelta(days=365)
        log.info(f"[{routine}] Primeira execução — watermark inicial: {watermark}")
    else:
        # Incremental: overlap by 3 days to catch late-arriving movements
        watermark = watermark - timedelta(days=3)
        log.info(f"[{routine}] Sync incremental desde: {watermark}")

    date_to   = date.today()
    params    = {"from": str(watermark), "to": str(date_to)}
    total_read, total_written = 0, 0

    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        # ── DB2 read ──────────────────────────────────────────────────────
        # WITH UR = uncommitted read (no shared lock on ERP pages)
        # Columns: only what the app queries
        cur.execute(SQL_VENDAS, (watermark, date_to))
        log.info(f"[{routine}] Consulta DB2 executada. Lendo em lotes de {BATCH_SIZE}…")

        # ── Stream rows out of DB2 before closing the connection ──────────
        all_rows: list[tuple] = []
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)

        cur.close()
        # DB2 connection is released here (context manager __exit__)

    log.info(f"[{routine}] {total_read} linhas lidas do DB2. Gravando no PostgreSQL…")

    # ── PostgreSQL write (after DB2 is fully closed) ──────────────────────
    with pg.cursor() as pgcur:
        # Remove rows in the sync window first (idempotent re-run)
        pgcur.execute(
            """
            DELETE FROM cache_vendas
            WHERE "DT_MOVIMENTO" >= %s AND "DT_MOVIMENTO" <= %s
            """,
            (watermark, date_to),
        )

        # Bulk insert using execute_values for performance
        # Columns: IDVENDEDOR[0] NOME_VENDEDOR[1] IDEMPRESA[2] IDPLANILHA[3]
        #          DT_MOVIMENTO[4] TOTALVENDA_LINHA[5] IDCLIENTE[6] NOME_CLIENTE[7]
        if all_rows:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_vendas
                  ("IDVENDEDOR","NOME_VENDEDOR","IDEMPRESA","IDPLANILHA",
                   "DT_MOVIMENTO","TOTALVENDA_LINHA","IDCLIENTE","NOME_CLIENTE", synced_at)
                VALUES %s
                """,
                [
                    (r[0], r[1], r[2], r[3], r[4],
                     _fix_monetary(r[5]),
                     str(r[6]) if len(r) > 6 and r[6] is not None else '',
                     str(r[7]) if len(r) > 7 and r[7] is not None else '',
                     datetime.now(timezone.utc))
                    for r in all_rows
                ],
                page_size=BATCH_SIZE,
            )
            total_written = len(all_rows)

        # Purge history beyond MAX_CACHE_DAYS to keep table lean
        cutoff = date.today() - timedelta(days=MAX_CACHE_DAYS)
        pgcur.execute(
            'DELETE FROM cache_vendas WHERE "DT_MOVIMENTO" < %s',
            (cutoff,),
        )

    pg.commit()

    # Watermark advances to today only after full success
    _update_watermark(pg, routine, date_to, total_read, total_written)
    log.info(f"[{routine}] Concluído — lidas: {total_read}, gravadas: {total_written}")
    return total_read, total_written


# ─── Routine: cache_campanhas ─────────────────────────────────────────────────

def sync_campanhas(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Incremental sync of product-level sales for campaign calculations.

    Differences from vendas:
      - Different query (SQL_CAMPANHAS) — includes product-level detail
      - Includes FABRICANTE, IDPRODUTO, QTD for product-mix calculations
      - Shorter window (campaigns rarely look > 90 days back)
    """
    routine   = "cache_campanhas"
    watermark = _get_watermark(pg, routine)
    if watermark is None:
        watermark = date.today().replace(day=1) - timedelta(days=90)
    else:
        watermark = watermark - timedelta(days=3)

    date_to = date.today()
    total_read, total_written = 0, 0

    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        cur.execute(SQL_CAMPANHAS, (watermark, date_to))
        all_rows: list[tuple] = []
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)
        cur.close()

    with pg.cursor() as pgcur:
        pgcur.execute(
            """
            DELETE FROM cache_campanhas
            WHERE "DTMOVIMENTO" >= %s AND "DTMOVIMENTO" <= %s
            """,
            (watermark, date_to),
        )
        # Columns: IDVENDEDOR[0] NOMEVENDEDOR[1] IDPRODUTO[2] FABRICANTE[3]
        #          VALOR_LIQUIDO[4] QTD[5] DTMOVIMENTO[6] IDEMPRESA[7]
        if all_rows:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_campanhas
                  ("IDVENDEDOR","NOMEVENDEDOR","IDPRODUTO","FABRICANTE",
                   "VALOR_LIQUIDO","QTD","DTMOVIMENTO","IDEMPRESA",synced_at)
                VALUES %s
                """,
                [
                    (r[0], r[1], r[2], r[3],
                     _fix_monetary(r[4]), _fix_monetary(r[5]),
                     r[6], str(r[7]) if len(r) > 7 and r[7] is not None else '',
                     datetime.now(timezone.utc))
                    for r in all_rows
                ],
                page_size=BATCH_SIZE,
            )
            total_written = len(all_rows)

        cutoff = date.today() - timedelta(days=MAX_CACHE_DAYS)
        pgcur.execute('DELETE FROM cache_campanhas WHERE "DTMOVIMENTO" < %s', (cutoff,))

    pg.commit()
    _update_watermark(pg, routine, date_to, total_read, total_written)
    log.info(f"[{routine}] lidas: {total_read}, gravadas: {total_written}")
    return total_read, total_written


# ─── Routine: cache_tubos_conexoes ───────────────────────────────────────────

def sync_tubos(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Sync of tubes & connections product category sales.
    Same strategy as vendas; different source view filtered by product group.
    """
    routine   = "cache_tubos_conexoes"
    watermark = _get_watermark(pg, routine)
    if watermark is None:
        watermark = date.today().replace(day=1) - timedelta(days=365)
    else:
        watermark = watermark - timedelta(days=3)

    date_to = date.today()
    total_read, total_written = 0, 0

    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        cur.execute(SQL_TUBOS, (watermark, date_to))
        all_rows: list[tuple] = []
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)
        cur.close()

    with pg.cursor() as pgcur:
        pgcur.execute(
            """
            DELETE FROM cache_tubos_conexoes
            WHERE "DT_MOVIMENTO" >= %s AND "DT_MOVIMENTO" <= %s
            """,
            (watermark, date_to),
        )
        # Columns: IDVENDEDOR[0] NOME_VENDEDOR[1] IDEMPRESA[2]
        #          DT_MOVIMENTO[3] TOTALVENDA_LINHA[4] TIPO_PRODUTO[5]
        if all_rows:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_tubos_conexoes
                  ("IDVENDEDOR","NOME_VENDEDOR","IDEMPRESA",
                   "DT_MOVIMENTO","TOTALVENDA_LINHA","TIPO_PRODUTO", synced_at)
                VALUES %s
                """,
                [
                    (r[0], r[1], r[2], r[3],
                     _fix_monetary(r[4]),
                     str(r[5]) if len(r) > 5 and r[5] else '',
                     datetime.now(timezone.utc))
                    for r in all_rows
                ],
                page_size=BATCH_SIZE,
            )
            total_written = len(all_rows)

        cutoff = date.today() - timedelta(days=MAX_CACHE_DAYS)
        pgcur.execute(
            'DELETE FROM cache_tubos_conexoes WHERE "DT_MOVIMENTO" < %s',
            (cutoff,),
        )

    pg.commit()
    _update_watermark(pg, routine, date_to, total_read, total_written)
    log.info(f"[{routine}] lidas: {total_read}, gravadas: {total_written}")
    return total_read, total_written


# ─── Routine: cache_vendas_pendentes ─────────────────────────────────────────

def sync_pendentes(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Pending orders sync.

    This is a FULL REPLACE strategy (not incremental) because pending orders
    change status frequently and have no reliable watermark column.

    Mitigated by:
      - Very selective query (aggregated by vendor+company)
      - Runs at most once per hour (enforced by job lock TTL)
      - Restricted to current month to limit volume
    """
    routine = "cache_vendas_pendentes"
    today   = date.today()
    month_start = today.replace(day=1)
    total_read, total_written = 0, 0

    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        cur.execute(SQL_PENDENTES, (month_start, today))
        all_rows: list[tuple] = []
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)
        cur.close()

    # Full replace — small table, safe to truncate
    # Columns: NOME_VENDEDOR[0] IDEMPRESA[1] TOTALVENDA_LINHA[2]
    with pg.cursor() as pgcur:
        pgcur.execute("TRUNCATE TABLE cache_vendas_pendentes")
        if all_rows:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_vendas_pendentes
                  ("NOME_VENDEDOR","IDEMPRESA","TOTALVENDA_LINHA", synced_at)
                VALUES %s
                """,
                [
                    (r[0], r[1],
                     _fix_monetary(r[2]),
                     datetime.now(timezone.utc))
                    for r in all_rows
                ],
                page_size=BATCH_SIZE,
            )
            total_written = len(all_rows)

    pg.commit()
    _update_watermark(pg, routine, today, total_read, total_written)
    log.info(f"[{routine}] lidas: {total_read}, gravadas: {total_written}")
    return total_read, total_written


# ─── Routine: cache_estoque_sugestao ─────────────────────────────────────────

def sync_estoque_sugestao(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Snapshot sync of current stock levels, pending purchase orders, and
    reorder points for use in the Copiloto de Compras suggestion engine.

    Strategy: FULL REPLACE (TRUNCATE + INSERT) — no watermark.
    This query has no date parameters; it reflects the live ERP state.
    The result is aggregated by (IDPRODUTO, FABRICANTE) to match the
    same join keys used by cache_campanhas.

    Columns written:
      IDPRODUTO, FABRICANTE, SALDO_ATUAL, QTDRESERVA, SALDO_DISPONIVEL,
      QTDREPOSICAO, DTULT_COMPRA, VAL_UNITARIO, QTDPENDENTE, DESCRICAO
    """
    routine = "cache_estoque_sugestao"
    total_read, total_written = 0, 0

    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        cur.execute(SQL_ESTOQUE_SUGESTAO)
        all_rows: list[tuple] = []
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)
        cur.close()

    with pg.cursor() as pgcur:
        pgcur.execute("TRUNCATE TABLE cache_estoque_sugestao")
        if all_rows:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_estoque_sugestao
                  ("IDPRODUTO","FABRICANTE",
                   "SALDO_ATUAL","QTDRESERVA","SALDO_DISPONIVEL",
                   "QTDREPOSICAO","DTULT_COMPRA","VAL_UNITARIO","QTDPENDENTE",
                   "DESCRICAO",
                   synced_at)
                VALUES %s
                """,
                [
                    (
                        r[0], r[1],
                        _fix_monetary(r[2]),   # SALDO_ATUAL
                        _fix_monetary(r[3]),   # QTDRESERVA
                        _fix_monetary(r[4]),   # SALDO_DISPONIVEL
                        _fix_monetary(r[5]),   # QTDREPOSICAO
                        r[6],                  # DTULT_COMPRA (date or None)
                        _fix_monetary(r[7]),   # VAL_UNITARIO
                        _fix_monetary(r[8]),   # QTDPENDENTE
                        str(r[9]) if r[9] else "",  # DESCRICAO
                        datetime.now(timezone.utc),
                    )
                    for r in all_rows
                ],
                page_size=BATCH_SIZE,
            )
            total_written = len(all_rows)

    pg.commit()
    _update_watermark(pg, routine, date.today(), total_read, total_written)
    log.info(f"[{routine}] lidas: {total_read}, gravadas: {total_written}")
    return total_read, total_written


# ─── Routine: cache_contas_receber ───────────────────────────────────────────
#
# Full-replace snapshot: TRUNCATE + INSERT every run.
# No watermark/date window — the view already returns only open titles.
# Status is computed in Python against today's date.
#
# Column index reference (matches SQL_CONTAS_RECEBER order):
#   [0]  IDEMPRESA              [1]  IDVENDEDOR        [2]  NOME_VENDEDOR
#   [3]  IDCLIFOR               [4]  NOME_CLIENTE
#   [5]  IDTITULO               [6]  DIGITOTITULO      [7]  SERIENOTA
#   [8]  NUMNOTA                [9]  IDPLANILHA
#   [10] DTMOVIMENTO            [11] DTVENCIMENTO      [12] DTULTIMOPAGAMENTO
#   [13] DIAS_VENCIDO (DB2)
#   [14] VALOR_TITULO           [15] VALOR_SALDO_TITULO  [16] VALOR_LIQUIDO_TITULO
#   [17] VALOR_JUROS_PENDENTE   [18] VALOR_DESCONTO      [19] VALOR_PAGO
#   [20] FORMA_RECEBIMENTO      [21] ORIGEM_MOVIMENTO    [22] OBS_TITULO
#   [23] ENDERECO_COBRANCA      [24] BAIRRO_COBRANCA
#   [25] CIDADE_COBRANCA        [26] UF_COBRANCA

def sync_contas_receber(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Full snapshot of open receivables from DB2 → cache_contas_receber.

    Strategy: full TRUNCATE + INSERT (like estoque_sugestao) because:
      - Titles may be paid/cancelled between runs and must be removed.
      - Status changes daily (A_VENCER → VENCIDO) as days pass.
      - The view is already pre-filtered for open balances.

    Status is computed in Python (not in DB2 SQL) to keep the query portable
    and to use the application server's timezone reference.
    """
    routine = "contas_receber"
    today   = date.today()
    total_read = 0
    total_written = 0

    # ── DB2 read (connection closed before any heavy processing) ────────────
    all_rows: list[tuple] = []
    with db2_connection() as db2conn:
        cur = db2conn.cursor()
        cur.execute(SQL_CONTAS_RECEBER)
        log.info(f"[{routine}] Consulta DB2 executada. Lendo em lotes de {BATCH_SIZE}…")
        for batch in _fetch_batches(cur):
            all_rows.extend(batch)
            total_read += len(batch)
        cur.close()

    log.info(f"[{routine}] {total_read} títulos lidos do DB2. Gravando no PostgreSQL…")

    # ── PostgreSQL write ─────────────────────────────────────────────────────
    with pg.cursor() as pgcur:
        pgcur.execute("TRUNCATE TABLE cache_contas_receber")

        def _compute_status(dtvenc: Any, valor_aberto: float) -> str:
            if valor_aberto <= 0:
                return "RECEBIDO"
            if not isinstance(dtvenc, date):
                return "A_VENCER"
            if dtvenc < today:
                return "VENCIDO"
            if dtvenc == today:
                return "VENCE_HOJE"
            return "A_VENCER"

        def _to_date(v: Any) -> "date | None":
            if v is None:
                return None
            if isinstance(v, date):
                return v
            try:
                return date.fromisoformat(str(v)[:10])
            except (ValueError, TypeError):
                return None

        rows_to_insert = []
        for r in all_rows:
            idempresa   = int(r[0]) if r[0] is not None else 0
            idvendedor  = int(r[1]) if r[1] is not None else 0
            idclifor    = int(r[3]) if r[3] is not None else 0
            idtitulo    = int(r[5]) if r[5] is not None else 0
            digitotitulo = int(r[6]) if r[6] is not None else 0
            serienota   = str(r[7] or "").strip()
            numnota     = int(r[8]) if r[8] is not None else 0
            idplanilha  = int(r[9]) if r[9] is not None else 0

            dtmov   = _to_date(r[10])
            dtvenc  = _to_date(r[11])
            dtultpg = _to_date(r[12])

            # dias_atraso: use DB2-computed value if available, else compute locally
            dias_db2 = int(r[13]) if r[13] is not None else 0
            if isinstance(dtvenc, date) and dtvenc < today:
                dias_atraso = max(dias_db2, (today - dtvenc).days)
            else:
                dias_atraso = 0

            valor_original = _fix_monetary(r[14])
            valor_aberto   = _fix_monetary(r[15])
            valor_liquido  = _fix_monetary(r[16])
            valor_juros    = _fix_monetary(r[17])
            valor_desconto = _fix_monetary(r[18])
            valor_pago     = _fix_monetary(r[19])

            forma_rec   = str(r[20] or "").strip()[:100]
            origem_mov  = str(r[21] or "").strip()[:20]
            obs_titulo  = str(r[22] or "").strip()[:500]
            end_cobr    = str(r[23] or "").strip()[:200]
            bairro_cobr = str(r[24] or "").strip()[:100]
            cidade_cobr = str(r[25] or "").strip()[:100]
            uf_cobr     = str(r[26] or "").strip()[:2]
            nome_vend   = str(r[2]  or "").strip()[:120]
            nome_cli    = str(r[4]  or "").strip()[:200]

            status = _compute_status(dtvenc, valor_aberto)

            chave = f"{idempresa}-{idclifor}-{idtitulo}-{digitotitulo}-{serienota}"

            rows_to_insert.append((
                chave, idempresa, idvendedor, nome_vend, idclifor, nome_cli,
                idtitulo, digitotitulo, serienota, numnota, idplanilha,
                dtmov, dtvenc, dtultpg, dias_atraso,
                valor_original, valor_aberto, valor_liquido,
                valor_juros, valor_desconto, valor_pago,
                forma_rec, origem_mov, obs_titulo,
                end_cobr, bairro_cobr, cidade_cobr, uf_cobr,
                status, datetime.now(timezone.utc),
            ))

        if rows_to_insert:
            psycopg2.extras.execute_values(
                pgcur,
                """
                INSERT INTO cache_contas_receber (
                    chave_titulo, idempresa, idvendedor, nomevendedor, idclifor, nomecliente,
                    idtitulo, digitotitulo, serienota, numnota, idplanilha,
                    dtmovimento, dtvencimento, dtultimopagamento, dias_atraso,
                    valor_original, valor_aberto, valor_liquido,
                    valor_juros_pendente, valor_desconto_concedido, valor_pago,
                    forma_recebimento, origem_movimento, observacao_titulo,
                    endereco_cobranca, bairro_cobranca, cidade_cobranca, uf_cobranca,
                    status, synced_at
                ) VALUES %s
                ON CONFLICT (chave_titulo) DO UPDATE SET
                    idempresa                = EXCLUDED.idempresa,
                    idvendedor               = EXCLUDED.idvendedor,
                    nomevendedor             = EXCLUDED.nomevendedor,
                    idclifor                 = EXCLUDED.idclifor,
                    nomecliente              = EXCLUDED.nomecliente,
                    dtmovimento              = EXCLUDED.dtmovimento,
                    dtvencimento             = EXCLUDED.dtvencimento,
                    dtultimopagamento        = EXCLUDED.dtultimopagamento,
                    dias_atraso              = EXCLUDED.dias_atraso,
                    valor_original           = EXCLUDED.valor_original,
                    valor_aberto             = EXCLUDED.valor_aberto,
                    valor_liquido            = EXCLUDED.valor_liquido,
                    valor_juros_pendente     = EXCLUDED.valor_juros_pendente,
                    valor_desconto_concedido = EXCLUDED.valor_desconto_concedido,
                    valor_pago               = EXCLUDED.valor_pago,
                    forma_recebimento        = EXCLUDED.forma_recebimento,
                    origem_movimento         = EXCLUDED.origem_movimento,
                    observacao_titulo        = EXCLUDED.observacao_titulo,
                    endereco_cobranca        = EXCLUDED.endereco_cobranca,
                    bairro_cobranca          = EXCLUDED.bairro_cobranca,
                    cidade_cobranca          = EXCLUDED.cidade_cobranca,
                    uf_cobranca              = EXCLUDED.uf_cobranca,
                    status                   = EXCLUDED.status,
                    synced_at                = EXCLUDED.synced_at
                """,
                rows_to_insert,
                page_size=BATCH_SIZE,
            )
            total_written = len(rows_to_insert)

    pg.commit()
    _update_watermark(pg, routine, today, total_read, total_written)
    log.info(f"[{routine}] Concluído — lidos: {total_read}, gravados: {total_written}")
    return total_read, total_written


# ─── Routine: compras_fornecedores_config ────────────────────────────────────
#
# Populates compras_fornecedores_config directly from the local cache tables,
# bypassing the Node.js "Sincronizar ERP" API button entirely.
# Run after campanhas + estoque_sugestao have been synced.
#
# Returns (fabricantes_found, rows_upserted).

_SYNC_CONFIG_SQL = """
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


def sync_fornecedores_config(pg: psycopg2.extensions.connection) -> tuple[int, int]:
    """
    Upserts compras_fornecedores_config from cache_campanhas + cache_estoque_sugestao.
    Preserves any existing user-configured values (only inserts new rows).
    """
    with pg.cursor() as cur:
        cur.execute(_SYNC_CONFIG_SQL)
        rows = cur.fetchall()  # [(fabricante, company_id), ...]

    if not rows:
        log.warning("[sync_config] Nenhum fabricante encontrado nos caches. "
                    "Execute campanhas e estoque_sugestao primeiro.")
        return 0, 0

    created = 0
    now = datetime.now(timezone.utc).isoformat()

    with pg.cursor() as cur:
        for (fabricante, company_id) in rows:
            cur.execute(
                "SELECT id FROM compras_fornecedores_config "
                "WHERE company_id = %s AND fabricante_nome = %s",
                (company_id, fabricante),
            )
            existing = cur.fetchone()
            if not existing:
                cur.execute(
                    """
                    INSERT INTO compras_fornecedores_config
                      (id, company_id, fabricante_nome, codigo, razao_social,
                       nome_fantasia, ativo, periodo_compra_dias, lead_time_dias,
                       pedido_minimo_valor, observacoes, created_at, updated_at)
                    VALUES (%s, %s, %s, '', '', %s, 1, 30, 7, 0, '', %s, %s)
                    """,
                    (str(uuid.uuid4()), company_id, fabricante, fabricante, now, now),
                )
                created += 1

    pg.commit()
    log.info(f"[sync_config] {len(rows)} fabricantes processados — {created} criados, "
             f"{len(rows) - created} já existiam.")
    return len(rows), created


# ─── Routine runner ───────────────────────────────────────────────────────────

ROUTINES: dict[str, Any] = {
    "vendas":            sync_vendas,
    "campanhas":         sync_campanhas,
    "tubos":             sync_tubos,
    "pendentes":         sync_pendentes,
    "estoque_sugestao":  sync_estoque_sugestao,
    "sync_config":       sync_fornecedores_config,
    "contas_receber":    sync_contas_receber,
}


def run_routine(name: str, force: bool = False) -> None:
    started = datetime.now(timezone.utc)
    log.info(f"=== Iniciando routine: {name}{' (--force)' if force else ''} ===")

    with pg_connection() as pg:
        ensure_schema(pg)
        if force:
            _release_lock(pg, name)
            log.info(f"[{name}] Lock liberado por --force")
        if not _acquire_lock(pg, name):
            log.warning(f"[{name}] Já está em execução em outro processo — abortando.")
            return

        records_read = records_written = 0
        success = False
        message = ""

        try:
            fn = ROUTINES[name]
            records_read, records_written = fn(pg)
            success = True
            message = f"OK — {records_read} lidas, {records_written} gravadas"
        except Exception as exc:
            message = f"ERRO: {exc}"
            log.exception(f"[{name}] Falha durante a sincronização")
            try:
                _record_error(pg, name, str(exc))
            except Exception:
                pass
        finally:
            try:
                _release_lock(pg, name)
            except Exception:
                pass
            try:
                _log_run(
                    pg, name, started,
                    records_read, records_written,
                    success, message,
                    params={"routine": name},
                )
            except Exception:
                pass

        if not success:
            sys.exit(1)

    log.info(f"=== Routine {name} concluída em {int((datetime.now(timezone.utc)-started).total_seconds())}s ===")


# ─── SCHEDULE GUIDANCE ────────────────────────────────────────────────────────
#
# LIGHT  (can run every 15 min during business hours):
#   - sync_pendentes         ~small aggregated set, current month only
#   - sync_estoque_sugestao  snapshot query — TRUNCATE + INSERT, moderate volume
#                            Recommended: every 30 min or on-demand after receiving purchases
#   - contas_receber         full snapshot — TRUNCATE + INSERT of all open titles
#                            Recommended: every 30–60 min during business hours
#                            (daily at minimum, to keep status VENCIDO/A_VENCER accurate)
#
# MEDIUM (run every 30–60 min during business hours):
#   - sync_vendas      incremental, 3-day overlap window
#   - sync_campanhas   incremental, 3-day overlap window
#   - sync_tubos       incremental, 3-day overlap window
#
# HEAVY (run ONCE per day, OUTSIDE business hours — e.g. 02:00–05:00):
#   - Initial historical load (first-run only, watermark=None)
#   - Manual full resync if data inconsistency is detected
#
# Cron example (Linux/cron):
#   */15 * * * *  python /app/sync/erp_sync.py pendentes
#   */30 8-18 * * 1-5  python /app/sync/erp_sync.py vendas
#   */30 8-18 * * 1-5  python /app/sync/erp_sync.py campanhas
#   0 2 * * *  python /app/sync/erp_sync.py tubos

# ─── Entry point ──────────────────────────────────────────────────────────────

def run_once(routine: str, force: bool = False) -> None:
    if routine == "all":
        for name in ROUTINES:
            run_routine(name, force=force)
    else:
        run_routine(routine, force=force)


def run_loop(routine: str, interval_seconds: int, force: bool = False) -> None:
    if interval_seconds < 30:
        raise ValueError("--loop deve ser de pelo menos 30 segundos para proteger o ERP")

    log.info(
        "=== Loop automatico iniciado: routine=%s, intervalo=%ss ===",
        routine,
        interval_seconds,
    )

    while True:
        cycle_started = time.monotonic()
        try:
            run_once(routine, force=force)
        except SystemExit as exc:
            if exc.code not in (0, None):
                log.error("Ciclo de sync falhou; proximo ciclo sera tentado no intervalo configurado.")
        except KeyboardInterrupt:
            log.info("Loop automatico interrompido pelo usuario.")
            raise
        except Exception:
            log.exception("Ciclo de sync falhou; proximo ciclo sera tentado no intervalo configurado.")

        elapsed = time.monotonic() - cycle_started
        sleep_for = max(0, interval_seconds - elapsed)
        log.info("Proximo ciclo em %.0fs.", sleep_for)
        time.sleep(sleep_for)


def main() -> None:
    parser = argparse.ArgumentParser(description="CONECTUBOS ERP Sync")
    parser.add_argument(
        "routine",
        choices=list(ROUTINES.keys()) + ["all"],
        help="Rotina a executar",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignora e libera o lock existente antes de executar (útil após falhas)",
    )
    parser.add_argument(
        "--loop",
        type=int,
        metavar="SEGUNDOS",
        help="Mantem a rotina rodando em loop no intervalo informado. Minimo: 30 segundos.",
    )
    args = parser.parse_args()

    if args.loop:
        run_loop(args.routine, args.loop, force=args.force)
    else:
        run_once(args.routine, force=args.force)


if __name__ == "__main__":
    main()
