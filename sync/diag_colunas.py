"""
Diagnóstico: descobre colunas reais das tabelas/views usadas em SQL_CONTAS_RECEBER.
Rode: py sync\diag_colunas.py
"""
import os, pyodbc
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

dsn = os.environ["DB2_DSN"]
uid = os.environ["DB2_UID"]
pwd = os.environ["DB2_PWD"]

conn = pyodbc.connect(f"DSN={dsn};UID={uid};PWD={pwd}", autocommit=True)
cur = conn.cursor()

OBJECTS = [
    ("VIEW",  "CONTAS_RECEBER_SALDOS_VIEW"),
    ("TABLE", "CLIENTE_FORNECEDOR"),
]

for kind, name in OBJECTS:
    print(f"\n{'='*60}")
    print(f"{kind}: DBA.{name}")
    print('='*60)
    try:
        cur.execute(
            "SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS "
            "FROM SYSCAT.COLUMNS "
            "WHERE TABSCHEMA = 'DBA' AND TABNAME = ? "
            "ORDER BY COLNO",
            (name,)
        )
        rows = cur.fetchall()
        if not rows:
            print("  (nenhuma coluna encontrada — tabela/view pode não existir ou schema diferente)")
        for r in rows:
            nullable = "NULL" if r[4] == "Y" else "NOT NULL"
            print(f"  {r[0]:<40} {r[1]}({r[2]}) {nullable}")
    except Exception as e:
        print(f"  ERRO: {e}")

conn.close()
print("\nDiagnóstico concluído.")
