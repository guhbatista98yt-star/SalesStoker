import sqlite3
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_PATH = os.path.join(PROJECT_ROOT, "database.db")

def reset_db():
    if os.environ.get("ALLOW_SQLITE_CACHE_RESET", "").lower() not in {"1", "true", "yes", "sim"}:
        print("Reset SQLite bloqueado. Defina ALLOW_SQLITE_CACHE_RESET=true somente com autorização explícita.")
        return

    print("Iniciando limpeza do banco de dados (preservando usuarios e metas)...")
    
    if not os.path.exists(DATABASE_PATH):
        print(f"Erro: O banco de dados nao foi encontrado em {DATABASE_PATH}")
        return

    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # Limpando dados de cache sem remover a estrutura das tabelas.
        for table in ["cache_vendas", "cache_vendas_pendentes", "cache_tubos_conexoes", "companies", "alerts"]:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if cursor.fetchone():
                cursor.execute(f"DELETE FROM {table}")

        conn.commit()

        # Força a reorganizacão e limpeza do espaco do arquivo de banco de dados
        # cursor.execute("VACUUM")
        
        conn.close()
        
        print("Sucesso! As tabelas de cache foram limpas e os usuarios e metas foram mantidos.")
        print("Agora voce pode iniciar a sincronizacao ou esperar a proxima execucao automatica da API.")
        
    except Exception as e:
        print(f"Ocorreu um erro durante a limpeza: {e}")

if __name__ == "__main__":
    reset_db()
