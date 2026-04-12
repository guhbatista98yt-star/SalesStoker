"""
Seed script: inserts campaign goals (gatilhos) directly into SQLite.
Run from project root: python scripts/seed/seed_campaign_goals.py
"""
import sqlite3
import os
import uuid

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "database.db")

YEAR = 2026

# Create table if missing (safe to run even if already exists)
def ensure_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS campaign_goals (
            id TEXT PRIMARY KEY,
            salespersonId TEXT NOT NULL,
            campaignName TEXT NOT NULL,
            year INTEGER NOT NULL,
            triggerValue REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(salespersonId, campaignName, year)
        )
    """)
    conn.commit()
    print("Table campaign_goals OK")

def get_vendedor_ids(conn):
    """Returns a dict {UPPER(name): id} from cache_vendas"""
    rows = conn.execute("""
        SELECT CAST(IDVENDEDOR AS TEXT) as id, MAX(NOME_VENDEDOR) as name
        FROM cache_vendas
        WHERE IDVENDEDOR IS NOT NULL AND NOME_VENDEDOR IS NOT NULL
        GROUP BY IDVENDEDOR
    """).fetchall()
    return {row[1].upper().strip(): row[0] for row in rows}

def upsert_goal(conn, salesperson_id, campaign_name, year, trigger_value):
    conn.execute("""
        INSERT INTO campaign_goals (id, salespersonId, campaignName, year, triggerValue)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(salespersonId, campaignName, year)
        DO UPDATE SET triggerValue = excluded.triggerValue
    """, (str(uuid.uuid4()), salesperson_id, campaign_name, year, trigger_value))

def main():
    conn = sqlite3.connect(DB_PATH)
    print(f"Connected to: {DB_PATH}")
    ensure_table(conn)

    vendors = get_vendedor_ids(conn)
    print(f"Found {len(vendors)} vendors in DB")

    # --- DTR Amanco ---
    dtr_overrides = {
        "ALAN": 30000.0,
        "JANIO": 30000.0,
        "ERIVAN": 40000.0,
        "MARIANE": 40000.0,
        "CARLISON": 50000.0,
    }
    dtr_default = 60000.0

    # --- TV Amanco ---
    tv_overrides = {
        "ALAN": 40000.0,
        "JANIO": 40000.0,
        "ERIVAN": 50000.0,
        "MARIANE": 50000.0,
        "CARLISON": 55000.0,
    }
    tv_default = 60000.0

    # --- Elit ---
    elit_default = 3000.0

    inserted = 0
    not_found = []

    for name_upper, vendor_id in vendors.items():
        # DTR Amanco
        dtr_val = next((v for k, v in dtr_overrides.items() if k in name_upper), dtr_default)
        upsert_goal(conn, vendor_id, "dtr_amanco", YEAR, dtr_val)

        # TV Amanco
        tv_val = next((v for k, v in tv_overrides.items() if k in name_upper), tv_default)
        upsert_goal(conn, vendor_id, "tv_amanco", YEAR, tv_val)

        # Elit
        upsert_goal(conn, vendor_id, "elit", YEAR, elit_default)

        inserted += 1
        print(f"  {vendor_id} {name_upper}: DTR={dtr_val:.0f} | TV={tv_val:.0f} | Elit={elit_default:.0f}")

    conn.commit()
    print(f"\nDone! {inserted} vendors seeded for year {YEAR}.")

    if not_found:
        print("WARNING - Could not find these names in DB:", not_found)

    conn.close()

if __name__ == "__main__":
    main()
