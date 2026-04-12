# Refatoração Profissional do sync_db2.py

## What & Why
O arquivo `scripts/sync_db2.py` é o coração do sistema — responsável por sincronizar dados do DB2 para o SQLite local. Uma análise detalhada identificou bugs de dados, gargalos sérios de performance e fragilidades de confiabilidade que precisam ser corrigidos de forma cirúrgica, sem alterar o comportamento externo do script.

## Done looks like
- O script roda mais rápido (inserções em batch com executemany ao invés de loop linha-por-linha)
- Logs em arquivo rotativo além do stdout, facilitando diagnóstico em servidor
- Nenhuma tabela é destruída durante a inicialização rotineira (DROP removido do fluxo de sync normal)
- A CHAVE única de cache_vendas inclui TIPO_LINHA, eliminando a colisão entre linhas NORMAL e DEV(REENTREGA)
- Conexões DB2 e SQLite são fechadas corretamente mesmo em caso de erro (finally garantido)
- Credenciais lidas de variáveis de ambiente, com fallback para os valores atuais e aviso no log
- Pragmas de performance ativados no SQLite (WAL mode, synchronous=NORMAL, cache_size)
- Cursor do pyodbc fechado corretamente após cada query
- Imports de traceback e threading movidos para o topo do arquivo
- Lógica duplicada de data (campanhas/amanco_mix) extraída para função auxiliar
- Retry automático de conexão DB2 no modo loop (até 3 tentativas com backoff)
- fetchmany() em lotes para leitura do DB2, evitando carregamento total em memória

## Out of scope
- Alteração nas queries SQL do DB2
- Mudança no schema das tabelas SQLite
- Alteração no comportamento de linha de comando (argumentos --desde, --loop, --serve)
- Alteração nos arquivos SQL externos (pasta scripts/sql/)

## Tasks
1. **Corrigir bug da CHAVE e remover DROP do init** — Incluir TIPO_LINHA na composição da CHAVE única de cache_vendas. Remover as instruções DROP TABLE IF EXISTS de inicializar_sqlite() (as tabelas já são limpas com DELETE dentro de cada função de sync). Manter CREATE TABLE IF NOT EXISTS para criar na primeira execução.

2. **Garantir fechamento correto de conexões** — Refatorar sincronizar() para usar blocos finally que garantem o fechamento de conn_db2 e conn_sqlite mesmo em caso de exceção. Fechar o cursor do pyodbc em executar_sql_db2() via finally ou context manager.

3. **Trocar loop de inserção por executemany em batch** — Substituir os loops `for row in dados` com INSERT individual em todas as funções de sync (sync_vendas, sync_pendentes, sync_tubos_conexoes, sync_campanhas, sync_amanco_mix) por preparação de lista de tuplas e chamada única de cursor.executemany(). Manter o tratamento de erro mas elevar para o nível do batch.

4. **Ativar pragmas de performance no SQLite** — Criar função auxiliar conectar_sqlite() que abre a conexão e configura PRAGMA journal_mode=WAL, PRAGMA synchronous=NORMAL, PRAGMA cache_size=-20000, PRAGMA temp_store=MEMORY. Usar essa função em todos os pontos que abrem o SQLite.

5. **Ler credenciais de variáveis de ambiente** — Ler DB2_DSN, DB2_UID, DB2_PWD, DB2_HOST do ambiente, com fallback nos valores hardcoded atuais. Emitir um aviso de log se estiver usando fallback. Nunca logar a senha.

6. **Adicionar logging em arquivo rotativo** — Configurar logging padrão do Python (logging.handlers.RotatingFileHandler) apontando para logs/sync_db2.log com rotação de 5MB e 3 backups. A função log() existente deve escrever tanto no stdout quanto no arquivo.

7. **Extrair lógica duplicada e mover imports para o topo** — Criar função auxiliar calcular_periodo_historico(dias) para eliminar duplicação em sync_campanhas e sync_amanco_mix. Mover import traceback e import threading para o topo do arquivo. Adicionar retry com backoff na conexão DB2 para o modo loop.

8. **Usar fetchmany() para leitura em chunks** — Modificar executar_sql_db2() para usar cursor.fetchmany(chunksize=2000) em vez de fetchall(), retornando um gerador ou lista acumulada. Isso evita carregamento total do resultado em memória para datasets grandes.

## Relevant files
- `scripts/sync_db2.py`
- `scripts/sql/vendas_produtos_campanhas.sql`
- `scripts/sql/tubos_conexoes_amanco.sql`
