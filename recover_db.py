import sqlite3
import os
import sys

def main():
    db_corrompido = "database.db"
    db_novo = "database_novo.db"
    
    if not os.path.exists(db_corrompido):
        print(f"ERRO: Arquivo {db_corrompido} não encontrado.")
        sys.exit(1)
        
    if os.path.exists(db_novo):
        os.remove(db_novo)
        
    print(f"Tentando recuperar dados importantes de {db_corrompido}...")
    
    conn_old = sqlite3.connect(db_corrompido)
    conn_new = sqlite3.connect(db_novo)
    
    cursor_new = conn_new.cursor()
    
    # Recriar schemas das tabelas locais importantes
    print("Criando estrutura do novo banco...")
    cursor_new.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            role TEXT DEFAULT 'admin',
            team_members TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    cursor_new.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cnpj TEXT UNIQUE NOT NULL
        )
    """)
    
    cursor_new.execute("""
        CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            salesperson_id TEXT NOT NULL,
            company_id TEXT NOT NULL,
            type TEXT NOT NULL,
            target_value REAL NOT NULL,
            month INTEGER NOT NULL,
            year INTEGER NOT NULL
        )
    """)
    
    cursor_new.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            salesperson_id TEXT,
            severity TEXT DEFAULT 'warning',
            is_read INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    tabelas_para_salvar = ["users", "companies", "goals", "alerts"]
    sucesso_total = True
    
    for tabela in tabelas_para_salvar:
        print(f"Tentando extrair dados da tabela '{tabela}'...")
        try:
            old_cursor = conn_old.cursor()
            old_cursor.execute(f"SELECT * FROM {tabela}")
            linhas = old_cursor.fetchall()
            
            if linhas:
                # Pegar nomes das colunas
                colunas = [desc[0] for desc in old_cursor.description]
                placeholders = ",".join(["?"] * len(colunas))
                
                cursor_new.executemany(
                    f"INSERT INTO {tabela} ({','.join(colunas)}) VALUES ({placeholders})",
                    linhas
                )
                print(f"  -> Sucesso: {len(linhas)} registros salvos em {tabela}.")
            else:
                print(f"  -> Tabela {tabela} estava vazia.")
        except Exception as e:
            print(f"  -> ERRO ao ler/salvar a tabela {tabela}: {e}")
            sucesso_total = False
            
    conn_new.commit()
    conn_old.close()
    conn_new.close()
    
    print("\n--- RESUMO ---")
    if sucesso_total:
        print(f"Recuperação finalizada com sucesso. Você pode renomear o arquivo original para 'database_bkp.db' e renomear '{db_novo}' para 'database.db'.")
    else:
        print(f"A recuperação encontrou erros (veja as mensagens acima), mas os dados que puderam ser lidos foram salvos em '{db_novo}'.")
        print("Se os dados importantes não foram recuperados, você precisará usar um backup anterior ou começar do zero (apagando o database.db original).")

if __name__ == "__main__":
    main()
