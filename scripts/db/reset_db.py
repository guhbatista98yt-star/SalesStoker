import sqlite3
import os

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATABASE_PATH = os.path.join(PROJECT_ROOT, "database.db")

def reset_db():
    print("Iniciando limpeza do banco de dados (preservando usuarios e metas)...")
    
    if not os.path.exists(DATABASE_PATH):
        print(f"Erro: O banco de dados nao foi encontrado em {DATABASE_PATH}")
        return

    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # Limpando as tabelas cacheadas apagando a tabela inteira (re-criadas pelo DB2)
        cursor.execute("DROP TABLE IF EXISTS cache_vendas")
        cursor.execute("DROP TABLE IF EXISTS cache_vendas_pendentes")
        cursor.execute("DROP TABLE IF EXISTS cache_tubos_conexoes")
        cursor.execute("DROP TABLE IF EXISTS companies")
        cursor.execute("DROP TABLE IF EXISTS alerts")

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
