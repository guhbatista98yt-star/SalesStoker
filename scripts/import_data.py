#!/usr/bin/env python3
"""
Import data-only from pg_dump files into the current PostgreSQL database.
Extracts COPY...FROM stdin blocks and streams them to psql.
Skips tables with incompatible schemas between the two system dumps.
"""

import os
import sys
import subprocess
import tempfile

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

# Tables to skip when importing from the stoker dump (schema mismatch or conflicts)
STOKER_SKIP_TABLES = {
    "users",     # different column layout (username/name vs email/first_name)
    "sessions",  # WMS session tokens — not compatible with CONECTUBOS auth sessions
}

# Tables to skip when importing from the main dump (no data or already managed)
MAIN_SKIP_TABLES = set()


def extract_copy_blocks(filepath, skip_tables=None):
    """
    Generator that yields complete COPY...FROM stdin blocks from a pg_dump file.
    Each block starts with 'COPY public.<table> ...' and ends with '\\.'
    """
    skip_tables = skip_tables or set()
    in_copy = False
    skip_current = False
    block_lines = []

    print(f"  Reading: {filepath}")
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("COPY public."):
                # Parse table name: "COPY public.some_table (col1, col2) FROM stdin;"
                rest = line[len("COPY public."):]
                table_name = rest.split(" ")[0].strip().strip('"')
                skip_current = table_name in skip_tables
                if skip_current:
                    print(f"    ⏭  Skipping table: {table_name}")
                    in_copy = False
                else:
                    in_copy = True
                    block_lines = [line]
            elif in_copy:
                block_lines.append(line)
                if line.strip() == "\\.":
                    yield "".join(block_lines)
                    in_copy = False
                    block_lines = []
            elif skip_current:
                if line.strip() == "\\.":
                    skip_current = False


def count_rows_in_block(block):
    """Count data rows in a COPY block (lines between header and \\.)"""
    lines = block.split("\n")
    # First line is the COPY statement, last non-empty is \.
    return max(0, len(lines) - 3)


def build_sql(files_and_skips):
    """
    Build the complete SQL to import: disable FK, truncate, COPY data, re-enable FK.
    Returns a list of SQL strings to run sequentially.
    """
    # First collect all table names being imported to truncate them
    tables_to_truncate = []
    blocks_by_file = []

    for filepath, skip_tables in files_and_skips:
        file_blocks = []
        for block in extract_copy_blocks(filepath, skip_tables):
            # Extract table name from block
            first_line = block.split("\n")[0]
            rest = first_line[len("COPY public."):]
            table_name = rest.split(" ")[0].strip().strip('"')
            rows = count_rows_in_block(block)
            file_blocks.append((table_name, block, rows))
            if table_name not in tables_to_truncate:
                tables_to_truncate.append(table_name)
        blocks_by_file.append(file_blocks)

    return tables_to_truncate, blocks_by_file


def run_psql(sql_content, description=""):
    """Run SQL via psql, return (success, error_msg)"""
    result = subprocess.run(
        ["psql", DATABASE_URL, "--no-password", "-v", "ON_ERROR_STOP=1"],
        input=sql_content.encode("utf-8"),
        capture_output=True,
        timeout=300,
    )
    if result.returncode != 0:
        return False, result.stderr.decode("utf-8", errors="replace")[:2000]
    return True, result.stdout.decode("utf-8", errors="replace")


def main():
    files_and_skips = [
        ("attached_assets/database_1776038544983.sql", MAIN_SKIP_TABLES),
        ("attached_assets/data_stoker_1777857095626.sql", STOKER_SKIP_TABLES),
    ]

    print("\n=== CONECTUBOS — Database Import ===\n")

    # ── Step 1: collect all blocks ───────────────────────────────────────────
    print("Step 1: Scanning SQL files for COPY blocks...")
    tables_to_truncate, blocks_by_file = build_sql(files_and_skips)
    print(f"  Found {len(tables_to_truncate)} tables to import\n")

    # ── Step 2: disable FK constraints ───────────────────────────────────────
    print("Step 2: Disabling FK constraint checks...")
    ok, msg = run_psql("SET session_replication_role = replica;\n")
    if not ok:
        print(f"  WARNING: Could not disable FK checks: {msg}")

    # ── Step 3: TRUNCATE all target tables ───────────────────────────────────
    print("Step 3: Truncating target tables...")
    # Truncate in reverse order to handle FK dependencies, with CASCADE
    trunc_sql = "SET session_replication_role = replica;\n"
    for t in reversed(tables_to_truncate):
        trunc_sql += f'TRUNCATE TABLE public."{t}" RESTART IDENTITY CASCADE;\n'
    trunc_sql += "SET session_replication_role = DEFAULT;\n"

    ok, msg = run_psql(trunc_sql)
    if not ok:
        print(f"  ERROR during truncate: {msg}")
        # Try one by one and skip failures
        for t in reversed(tables_to_truncate):
            sql = f'SET session_replication_role = replica;\nTRUNCATE TABLE public."{t}" CASCADE;\nSET session_replication_role = DEFAULT;\n'
            ok2, msg2 = run_psql(sql)
            if not ok2:
                print(f"    ⚠  Could not truncate {t}: {msg2[:200]}")
    else:
        print(f"  ✓ Truncated {len(tables_to_truncate)} tables\n")

    # ── Step 4: Import COPY blocks ───────────────────────────────────────────
    file_names = [f[0] for f in files_and_skips]
    total_rows = 0
    total_errors = 0

    for i, file_blocks in enumerate(blocks_by_file):
        fname = os.path.basename(file_names[i])
        print(f"Step 4.{i+1}: Importing data from {fname}...")
        if not file_blocks:
            print("  (no blocks found)\n")
            continue

        for table_name, block, rows in file_blocks:
            sql = f"SET session_replication_role = replica;\n{block}\nSET session_replication_role = DEFAULT;\n"
            ok, msg = run_psql(sql)
            if ok:
                total_rows += rows
                status = f"✓ {table_name}: {rows:,} rows"
                print(f"  {status}")
            else:
                total_errors += 1
                short_err = msg.strip().split("\n")[0][:120]
                print(f"  ✗ {table_name}: FAILED — {short_err}")

        print()

    # ── Step 5: Reset sequences ───────────────────────────────────────────────
    print("Step 5: Resetting sequences...")
    seq_sql = """
DO $$
DECLARE
    r RECORD;
    maxval BIGINT;
    seqname TEXT;
BEGIN
    FOR r IN
        SELECT
            t.relname AS tablename,
            a.attname AS colname,
            pg_get_serial_sequence(t.relname, a.attname) AS seqname
        FROM pg_class t
        JOIN pg_attribute a ON a.attrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND a.attnum > 0
          AND pg_get_serial_sequence(t.relname, a.attname) IS NOT NULL
    LOOP
        BEGIN
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.colname, r.tablename) INTO maxval;
            EXECUTE format('SELECT setval(%L, GREATEST(%s, 1))', r.seqname, maxval);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END;
$$;
"""
    ok, msg = run_psql(seq_sql)
    if ok:
        print("  ✓ Sequences updated\n")
    else:
        print(f"  ⚠  Sequence reset warning: {msg[:200]}\n")

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=== Import complete ===")
    print(f"  Tables imported : {len(tables_to_truncate)}")
    print(f"  Rows imported   : {total_rows:,}")
    print(f"  Errors          : {total_errors}")

    if total_errors > 0:
        print("\n  Some tables failed. Run again or check schema compatibility.")
        sys.exit(1)
    else:
        print("\n  ✓ All done!")


if __name__ == "__main__":
    main()
