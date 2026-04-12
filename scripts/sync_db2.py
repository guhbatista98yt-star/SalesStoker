#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sincronizador DB2 → SQLite para Sales Analytics Dashboard
Coleta dados do DB2 e salva no database.db local.
Modo INCREMENTAL: usa CHAVE única para evitar duplicatas.

Uso:
    python sync_db2.py                        # Sync incremental (última semana)
    python sync_db2.py --desde 2025-01-01     # Carga desde data específica
    python sync_db2.py --loop 600             # Sync a cada 10 minutos
    python sync_db2.py --loop 600 --serve     # Sync + servidor web
"""

import os
import sys
import time
import sqlite3
import argparse
import subprocess
import traceback
import threading
import logging
import logging.handlers
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

try:
    import pyodbc
except ImportError:
    print("ERRO: pyodbc não instalado. Execute: pip install pyodbc")
    sys.exit(1)

# === CONFIGURAÇÃO ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATABASE_PATH = os.path.join(PROJECT_ROOT, "database.db")
LOGS_DIR = os.path.join(PROJECT_ROOT, "logs")

# Credenciais DB2 - lidas de variáveis de ambiente com fallback hardcoded
_DB2_DSN_DEFAULT = "CISSODBC"
_DB2_UID_DEFAULT = "CONSULTA"
_DB2_PWD_DEFAULT = "qazwsx@123"
_DB2_HOST_DEFAULT = "192.168.1.200"

DB2_DSN = os.environ.get("DB2_DSN", "")
DB2_UID = os.environ.get("DB2_UID", "")
DB2_PWD = os.environ.get("DB2_PWD", "")
DB2_HOST = os.environ.get("DB2_HOST", "")

_usando_fallback = not all([DB2_DSN, DB2_UID, DB2_PWD, DB2_HOST])

if _usando_fallback:
    DB2_DSN = DB2_DSN or _DB2_DSN_DEFAULT
    DB2_UID = DB2_UID or _DB2_UID_DEFAULT
    DB2_PWD = DB2_PWD or _DB2_PWD_DEFAULT
    DB2_HOST = DB2_HOST or _DB2_HOST_DEFAULT

STRING_CONEXAO_DB2 = (
    f"DSN={DB2_DSN};UID={DB2_UID};PWD={DB2_PWD};"
    "MODE=SHARE;CLIENTENCALG=2;PROTOCOL=TCPIP;"
    f"TXNISOLATION=1;SERVICENAME=50000;HOSTNAME={DB2_HOST};"
    "DATABASE=CISSERP;"
)

# === LOGGING ===
os.makedirs(LOGS_DIR, exist_ok=True)

_logger = logging.getLogger("sync_db2")
_logger.setLevel(logging.DEBUG)

_fmt = logging.Formatter("[%(asctime)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

_console_handler = logging.StreamHandler(sys.stdout)
_console_handler.setFormatter(_fmt)
_logger.addHandler(_console_handler)

_file_handler = logging.handlers.RotatingFileHandler(
    os.path.join(LOGS_DIR, "sync_db2.log"),
    maxBytes=5 * 1024 * 1024,
    backupCount=3,
    encoding="utf-8",
)
_file_handler.setFormatter(_fmt)
_logger.addHandler(_file_handler)


def log(msg: str):
    """Log com timestamp — escreve no stdout e no arquivo rotativo."""
    _logger.info(msg)


# Aviso de fallback após o logger estar configurado
if _usando_fallback:
    log("AVISO: Credenciais DB2 não encontradas em variáveis de ambiente — usando valores padrão hardcoded. Configure DB2_DSN, DB2_UID, DB2_PWD e DB2_HOST para eliminar este aviso.")


# === HELPERS DE CONEXÃO ===

def conectar_sqlite() -> sqlite3.Connection:
    """Abre conexão SQLite com pragmas de performance."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-20000")
    conn.execute("PRAGMA temp_store=MEMORY")
    return conn


def conectar_db2() -> pyodbc.Connection:
    """Conecta ao DB2."""
    log("Conectando ao DB2...")
    return pyodbc.connect(STRING_CONEXAO_DB2, timeout=30)


def executar_sql_db2(conn: pyodbc.Connection, query: str, chunksize: int = 2000) -> List[Dict[str, Any]]:
    """Executa SQL no DB2 e retorna lista de dicionários usando fetchmany para economizar memória."""
    cursor = conn.cursor()
    try:
        cursor.execute("SET CURRENT SCHEMA DBA")
        cursor.execute(query)

        if cursor.description is None:
            return []

        colunas = [col[0].strip() for col in cursor.description]
        resultados: List[Dict[str, Any]] = []
        while True:
            chunk = cursor.fetchmany(chunksize)
            if not chunk:
                break
            for row in chunk:
                resultados.append(dict(zip(colunas, row)))
        return resultados

    except pyodbc.Error as e:
        log(f"  ERRO SQL: {e}")
        log(f"  Query (primeiros 500 chars): {query[:500]}...")
        return []
    finally:
        try:
            cursor.close()
        except Exception:
            pass


def formatar_data(valor) -> str:
    """Formata data para YYYY-MM-DD."""
    if valor is None:
        return ""
    if hasattr(valor, 'strftime'):
        return valor.strftime('%Y-%m-%d')
    return str(valor)[:10]


def formatar_hora(valor) -> str:
    """Formata hora para HH:MM:SS."""
    if valor is None:
        return ""
    if hasattr(valor, 'strftime'):
        return valor.strftime('%H:%M:%S')
    return str(valor)[:8]


def calcular_periodo_historico(dias: int = 450):
    """Retorna (data_inicio, data_fim) para o período histórico solicitado."""
    data_fim = datetime.now().strftime('%Y-%m-%d')
    data_inicio = (datetime.now() - timedelta(days=dias)).strftime('%Y-%m-%d')
    return data_inicio, data_fim


# === INICIALIZAÇÃO DO SCHEMA ===

def inicializar_sqlite():
    """Inicializa o banco SQLite com o schema. Não destrói tabelas existentes."""
    log(f"Inicializando SQLite em {DATABASE_PATH}...")
    conn = conectar_sqlite()
    cursor = conn.cursor()

    cursor.execute("""
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            CHAVE TEXT UNIQUE NOT NULL,
            TIPO_LINHA TEXT,
            IDEMPRESA INTEGER NOT NULL,
            CNPJ_EMPRESA TEXT,
            RAZAO_SOCIAL_EMPRESA TEXT,
            IDVENDEDOR TEXT NOT NULL,
            NOME_VENDEDOR TEXT NOT NULL,
            IDCLIENTE TEXT,
            NOME_CLIENTE TEXT,
            IDPLANILHA TEXT NOT NULL,
            NUMSEQUENCIA INTEGER,
            IDOPERACAO INTEGER,
            TIPOMOVIMENTO TEXT,
            DT_MOVIMENTO TEXT NOT NULL,
            DTH_NOTA TEXT,
            HR_EMISSAO TEXT,
            IDPRODUTO TEXT,
            IDSUBPRODUTO TEXT,
            DESCRRESPRODUTO TEXT,
            DESCRICAOPRODUTO TEXT,
            QTDPRODUTO REAL,
            VALTOTLIQUIDO REAL,
            VALLUCRO REAL,
            TOTALVENDA_LINHA REAL NOT NULL,
            LUCRO_LINHA REAL,
            sync_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_vendas_pendentes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            IDEMPRESA INTEGER NOT NULL,
            CODIGO_VENDEDOR TEXT NOT NULL,
            NOME_VENDEDOR TEXT NOT NULL,
            VALOR_TOTAL REAL NOT NULL,
            sync_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_tubos_conexoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            IDEMPRESA INTEGER NOT NULL,
            DT_MOVIMENTO TEXT NOT NULL,
            IDVENDEDOR TEXT NOT NULL,
            NOME_VENDEDOR TEXT NOT NULL,
            VALOR_LIQUIDO REAL NOT NULL,
            TIPO_PRODUTO TEXT NOT NULL,
            sync_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_campanhas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            DTMOVIMENTO TEXT NOT NULL,
            IDVENDEDOR TEXT NOT NULL,
            NOMEVENDEDOR TEXT NOT NULL,
            IDPRODUTO TEXT,
            IDSUBPRODUTO TEXT,
            DESCRICAO_PRODUTO TEXT,
            FABRICANTE TEXT,
            QTD REAL NOT NULL,
            VALOR_LIQUIDO REAL NOT NULL,
            sync_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cache_amanco_mix (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            DTMOVIMENTO TEXT NOT NULL,
            IDVENDEDOR TEXT NOT NULL,
            NomeVendedor TEXT NOT NULL,
            VALOR_LIQUIDO REAL NOT NULL,
            TipoProduto TEXT NOT NULL,
            sync_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            cnpj TEXT UNIQUE NOT NULL
        )
    """)

    cursor.execute("""
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

    cursor.execute("""
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

    # Índices
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_vendas_data ON cache_vendas(DT_MOVIMENTO)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_vendas_vendedor ON cache_vendas(IDVENDEDOR)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_vendas_empresa ON cache_vendas(IDEMPRESA)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_vendas_chave ON cache_vendas(CHAVE)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_pendentes_vendedor ON cache_vendas_pendentes(CODIGO_VENDEDOR)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_tubos_vendedor ON cache_tubos_conexoes(IDVENDEDOR)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_tubos_tipo ON cache_tubos_conexoes(TIPO_PRODUTO)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_campanhas_vendedor ON cache_campanhas(IDVENDEDOR)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_amanco_vendedor ON cache_amanco_mix(IDVENDEDOR)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_cache_amanco_tipo ON cache_amanco_mix(TipoProduto)")

    conn.commit()
    conn.close()
    log("Schema SQLite inicializado com sucesso!")


# === GERAÇÃO DE SQL ===

def gerar_sql_vendas(data_inicio: str, data_fim: str) -> str:
    """Gera SQL de vendas para um período."""
    return f"""
WITH DETALHE AS
(
    SELECT
        'NORMAL' AS TIPO_LINHA,
        EA.IDEMPRESA,
        EMP.CNPJ AS CNPJ_EMPRESA,
        EMP.RAZAOSOCIAL AS RAZAO_SOCIAL_EMPRESA,
        CASE WHEN COALESCE(EA.IDVENDEDOR, 0) = 0 THEN 0 ELSE EA.IDVENDEDOR END AS IDVENDEDOR,
        CASE WHEN COALESCE(EA.IDVENDEDOR, 0) = 0 THEN '<VENDAS SEM VENDEDOR>' ELSE VENDEDOR.NOME END AS NOME_VENDEDOR,
        N.IDCLIFOR AS IDCLIENTE,
        CLI.NOME AS NOME_CLIENTE,
        EA.IDPLANILHA,
        EA.NUMSEQUENCIA,
        EA.IDOPERACAO,
        OI.TIPOMOVIMENTO,
        NES.DTMOVIMENTO AS DT_MOVIMENTO,
        N.DTMOVIMENTO AS DTH_NOTA,
        NES.HREMISSAO AS HR_EMISSAO,
        EA.IDPRODUTO,
        EA.IDSUBPRODUTO,
        (SELECT PV.DESCRRESPRODUTO FROM PRODUTOS_VIEW PV WHERE PV.IDPRODUTO = EA.IDPRODUTO AND PV.IDSUBPRODUTO = EA.IDSUBPRODUTO FETCH FIRST 1 ROW ONLY) AS DESCRRESPRODUTO,
        (SELECT PV.DESCRICAOPRODUTO FROM PRODUTOS_VIEW PV WHERE PV.IDPRODUTO = EA.IDPRODUTO AND PV.IDSUBPRODUTO = EA.IDSUBPRODUTO FETCH FIRST 1 ROW ONLY) AS DESCRICAOPRODUTO,
        EA.QTDPRODUTO,
        EA.VALTOTLIQUIDO,
        EA.VALLUCRO,
        CASE OI.TIPOMOVIMENTO WHEN 'E' THEN EA.VALTOTLIQUIDO * -1 ELSE EA.VALTOTLIQUIDO END AS TOTALVENDA_LINHA,
        CASE
            WHEN EA.TIPOBAIXAMESTRE = 'K' THEN
                (SELECT CASE WHEN OI.TIPOMOVIMENTO = 'E' THEN SUM(COALESCE(EST.VALLUCRO, 0) * EST.QTDPRODUTO) * -1 ELSE SUM(COALESCE(EST.VALLUCRO, 0) * EST.QTDPRODUTO) END
                 FROM ESTOQUE_ANALITICO EST WHERE COALESCE(EST.NUMSEQUENCIAKIT, 0) = EA.NUMSEQUENCIA AND EST.IDPLANILHA = EA.IDPLANILHA
                 AND EST.IDSUBPRODUTO IN (SELECT PRODKIT.IDSUBPRODUTO FROM PRODUTO_KIT PRODKIT WHERE PRODKIT.IDPRODUTOKIT = EA.IDPRODUTO AND PRODKIT.IDSUBPRODUTOKIT = EA.IDSUBPRODUTO))
            ELSE CASE OI.TIPOMOVIMENTO WHEN 'E' THEN (COALESCE(EA.VALLUCRO, 0) * EA.QTDPRODUTO) * -1 ELSE (COALESCE(EA.VALLUCRO, 0) * EA.QTDPRODUTO) END
        END AS LUCRO_LINHA
    FROM
        ESTOQUE_ANALITICO EA
        LEFT JOIN CLIENTE_FORNECEDOR VENDEDOR ON EA.IDVENDEDOR = VENDEDOR.IDCLIFOR,
        NOTAS N, NOTAS_ENTRADA_SAIDA NES, OPERACAO_INTERNA OI, OPERACAO_INTERNA CONFIG, CLIENTE_FORNECEDOR CLI, PRODUTO P, EMPRESA EMP
    WHERE
        EMP.IDEMPRESA = EA.IDEMPRESA AND EA.IDPRODUTO = P.IDPRODUTO AND CONFIG.IDOPERACAO = 3000
        AND N.IDEMPRESA = NES.IDEMPRESA AND N.IDPLANILHA = NES.IDPLANILHA AND EA.IDOPERACAO = NES.IDOPERACAO
        AND N.IDEMPRESA = EA.IDEMPRESA AND N.IDPLANILHA = EA.IDPLANILHA AND N.IDCLIFOR = CLI.IDCLIFOR
        AND N.FLAGNOTACANCEL = 'F' AND EA.IDOPERACAO <> 1301
        AND ((EA.NUMSEQUENCIAKIT IS NULL) OR (EA.NUMSEQUENCIAKIT <= 0))
        AND OI.IDOPERACAO = NES.IDOPERACAO AND OI.FLAGMOVPRODUTOS = 'T' AND OI.TIPOMOVIMENTO IN ('V','E')
        AND EA.IDEMPRESA IN (1,2,3) AND NES.TIPOITEMCATEGORIA NOT IN ('D5','D8')
        AND NES.DTMOVIMENTO BETWEEN {{d '{data_inicio}'}} AND {{d '{data_fim}'}}
        AND (N.SERIENOTA <> 'CAN' OR (N.SERIENOTA = 'CAN' AND CONFIG.TIPOMOVIMENTO = 'V'))
        AND (SELECT COUNT(0) FROM NOTAS_DEVOLUCAO ND, DEVOLUCAO_LOGISTICA_MOVIMENTO DLM, NOTAS_ENTRADA_SAIDA ORIGEM_DEVOLUCAO
             WHERE ND.IDEMPRESA = EA.IDEMPRESA AND ND.IDPLANILHA = EA.IDPLANILHA AND ND.NUMSEQUENCIADEVOLUCAO = EA.NUMSEQUENCIA
             AND ND.IDPRODUTO = EA.IDPRODUTO AND ND.IDSUBPRODUTO = EA.IDSUBPRODUTO AND ORIGEM_DEVOLUCAO.IDEMPRESA = ND.IDEMPRESA
             AND ORIGEM_DEVOLUCAO.IDPLANILHA = ND.IDPLANILHADEVOLUCAO AND DLM.IDEMPRESA = ND.IDEMPRESA AND DLM.IDPLANILHA = ND.IDPLANILHA
             AND DLM.NUMSEQUENCIADEV = ND.NUMSEQUENCIADEVOLUCAO AND DLM.IDPRODUTO = ND.IDPRODUTO AND DLM.IDSUBPRODUTO = ND.IDSUBPRODUTO
             AND DLM.FLAGGERARREENTREGA = 'T') = 0
        AND NOT EXISTS (SELECT 1 FROM ORCAMENTO_PRE_NOTA OPN INNER JOIN ORCAMENTO_PROD_NOTA_ANTECIPADA OPNA
            ON OPNA.IDEMPRESAORCAMENTO = OPN.IDEMPRESAORCAMENTO AND OPNA.IDORCAMENTO = OPN.IDORCAMENTO
            LEFT JOIN ESTOQUE_ANALITICO EA1 ON OPN.IDEMPRESAPRENOTA = EA1.IDEMPRESA AND OPN.IDPLANILHAPRENOTA = EA1.IDPLANILHA
            LEFT JOIN ESTOQUE_ANALITICO EA2 ON OPNA.IDEMPRESANOTA = EA2.IDEMPRESA AND OPNA.IDPLANILHANOTA = EA2.IDPLANILHA
            LEFT JOIN OPERACAO_INTERNA OP1 ON OP1.IDOPERACAO = EA1.IDOPERACAO
            LEFT JOIN OPERACAO_INTERNA OP2 ON OP2.IDOPERACAO = EA2.IDOPERACAO
            WHERE OPN.IDPLANILHAPRENOTA = EA.IDPLANILHA AND OP1.TIPOMOVIMENTO = 'V' AND OP2.TIPOMOVIMENTO = 'V' FETCH FIRST 1 ROWS ONLY)
    
    UNION ALL
    
    SELECT
        'DEV(REENTREGA)' AS TIPO_LINHA,
        EA.IDEMPRESA,
        EMP.CNPJ AS CNPJ_EMPRESA,
        EMP.RAZAOSOCIAL AS RAZAO_SOCIAL_EMPRESA,
        CASE WHEN COALESCE(EA.IDVENDEDOR, 0) = 0 THEN 0 ELSE EA.IDVENDEDOR END AS IDVENDEDOR,
        CASE WHEN COALESCE(EA.IDVENDEDOR, 0) = 0 THEN '<VENDAS SEM VENDEDOR>-DEV(Reentrega)' ELSE VENDEDOR.NOME || '-DEV(Reentrega)' END AS NOME_VENDEDOR,
        N.IDCLIFOR AS IDCLIENTE,
        CLI.NOME AS NOME_CLIENTE,
        EA.IDPLANILHA,
        EA.NUMSEQUENCIA,
        EA.IDOPERACAO,
        OI.TIPOMOVIMENTO,
        NES.DTMOVIMENTO AS DT_MOVIMENTO,
        N.DTMOVIMENTO AS DTH_NOTA,
        NES.HREMISSAO AS HR_EMISSAO,
        EA.IDPRODUTO,
        EA.IDSUBPRODUTO,
        (SELECT PV.DESCRRESPRODUTO FROM PRODUTOS_VIEW PV WHERE PV.IDPRODUTO = EA.IDPRODUTO AND PV.IDSUBPRODUTO = EA.IDSUBPRODUTO FETCH FIRST 1 ROW ONLY) AS DESCRRESPRODUTO,
        (SELECT PV.DESCRICAOPRODUTO FROM PRODUTOS_VIEW PV WHERE PV.IDPRODUTO = EA.IDPRODUTO AND PV.IDSUBPRODUTO = EA.IDSUBPRODUTO FETCH FIRST 1 ROW ONLY) AS DESCRICAOPRODUTO,
        EA.QTDPRODUTO,
        EA.VALTOTLIQUIDO,
        EA.VALLUCRO,
        CASE OI.TIPOMOVIMENTO WHEN 'E' THEN EA.VALTOTLIQUIDO * -1 ELSE EA.VALTOTLIQUIDO END AS TOTALVENDA_LINHA,
        CASE
            WHEN EA.TIPOBAIXAMESTRE = 'K' THEN
                (SELECT CASE WHEN OI.TIPOMOVIMENTO = 'E' THEN SUM(COALESCE(EST.VALLUCRO, 0) * EST.QTDPRODUTO) * -1 ELSE SUM(COALESCE(EST.VALLUCRO, 0) * EST.QTDPRODUTO) END
                 FROM ESTOQUE_ANALITICO EST WHERE COALESCE(EST.NUMSEQUENCIAKIT, 0) = EA.NUMSEQUENCIA AND EST.IDPLANILHA = EA.IDPLANILHA
                 AND EST.IDSUBPRODUTO IN (SELECT PRODKIT.IDSUBPRODUTO FROM PRODUTO_KIT PRODKIT WHERE PRODKIT.IDPRODUTOKIT = EA.IDPRODUTO AND PRODKIT.IDSUBPRODUTOKIT = EA.IDSUBPRODUTO))
            ELSE CASE OI.TIPOMOVIMENTO WHEN 'E' THEN (COALESCE(EA.VALLUCRO, 0) * EA.QTDPRODUTO) * -1 ELSE (COALESCE(EA.VALLUCRO, 0) * EA.QTDPRODUTO) END
        END AS LUCRO_LINHA
    FROM
        ESTOQUE_ANALITICO EA
        LEFT JOIN CLIENTE_FORNECEDOR VENDEDOR ON EA.IDVENDEDOR = VENDEDOR.IDCLIFOR,
        NOTAS N, NOTAS_ENTRADA_SAIDA NES, OPERACAO_INTERNA OI, CLIENTE_FORNECEDOR CLI, PRODUTO P, EMPRESA EMP
    WHERE
        EMP.IDEMPRESA = EA.IDEMPRESA AND EA.IDPRODUTO = P.IDPRODUTO
        AND N.IDEMPRESA = NES.IDEMPRESA AND N.IDPLANILHA = NES.IDPLANILHA AND EA.IDOPERACAO = NES.IDOPERACAO
        AND N.IDEMPRESA = EA.IDEMPRESA AND N.IDPLANILHA = EA.IDPLANILHA AND N.IDCLIFOR = CLI.IDCLIFOR
        AND N.FLAGNOTACANCEL = 'F' AND EA.IDOPERACAO <> 1301
        AND ((EA.NUMSEQUENCIAKIT IS NULL) OR (EA.NUMSEQUENCIAKIT <= 0))
        AND OI.IDOPERACAO = NES.IDOPERACAO AND OI.FLAGMOVPRODUTOS = 'T' AND OI.TIPOMOVIMENTO = 'E'
        AND EA.IDEMPRESA IN (1,2,3) AND NES.TIPOITEMCATEGORIA NOT IN ('D5','D8')
        AND NES.DTMOVIMENTO BETWEEN {{d '{data_inicio}'}} AND {{d '{data_fim}'}}
        AND (SELECT COUNT(0) FROM NOTAS_DEVOLUCAO ND, DEVOLUCAO_LOGISTICA_MOVIMENTO DLM, NOTAS_ENTRADA_SAIDA ORIGEM_DEVOLUCAO, OPERACAO_INTERNA OI_DEVOLUCAO
             WHERE ND.IDEMPRESA = EA.IDEMPRESA AND ND.IDPLANILHA = EA.IDPLANILHA AND ND.NUMSEQUENCIADEVOLUCAO = EA.NUMSEQUENCIA
             AND ND.IDPRODUTO = EA.IDPRODUTO AND ND.IDSUBPRODUTO = EA.IDSUBPRODUTO AND ORIGEM_DEVOLUCAO.IDEMPRESA = ND.IDEMPRESA
             AND ORIGEM_DEVOLUCAO.IDPLANILHA = ND.IDPLANILHADEVOLUCAO AND DLM.IDEMPRESA = ND.IDEMPRESA AND DLM.IDPLANILHA = ND.IDPLANILHA
             AND DLM.NUMSEQUENCIADEV = ND.NUMSEQUENCIADEVOLUCAO AND DLM.IDPRODUTO = ND.IDPRODUTO AND DLM.IDSUBPRODUTO = ND.IDSUBPRODUTO
             AND OI.TIPOMOVIMENTO = 'E' AND OI_DEVOLUCAO.IDOPERACAO = ORIGEM_DEVOLUCAO.IDOPERACAO AND OI_DEVOLUCAO.TIPOMOVIMENTO = 'V'
             AND ORIGEM_DEVOLUCAO.IDOPERACAO = 3001 AND DLM.FLAGGERARREENTREGA = 'T') > 0
)

SELECT * FROM DETALHE
ORDER BY IDEMPRESA, IDVENDEDOR, DTH_NOTA, IDPLANILHA, NUMSEQUENCIA, IDPRODUTO, IDSUBPRODUTO
FOR READ ONLY
"""


def gerar_sql_pendentes() -> str:
    """Gera SQL de vendas pendentes (a faturar) - orçamentos com pré-nota não paga, por empresa e vendedor."""
    return """
WITH OrcamentosPendentes AS (
    SELECT
        O.IDORCAMENTO,
        O.IDEMPRESA,
        O.IDCLIFOR AS IDCLIENTE,
        O.DTMOVIMENTO,
        O.DTVALIDADE
    FROM DBA.ORCAMENTO O
    LEFT JOIN DBA.ORCAMENTO_PRE_NOTA OPN
        ON  OPN.IDORCAMENTO        = O.IDORCAMENTO
        AND OPN.IDEMPRESAORCAMENTO = O.IDEMPRESA
    WHERE
        O.FLAGPRENOTA = 'T'
        AND O.FLAGPRENOTAPAGA = 'F'
        AND O.FLAGCANCELADO = 'F'
        AND O.DTMOVIMENTO >= (CURRENT DATE - 2 DAYS)
        AND DATE(COALESCE(O.DTVALIDADE, CURRENT DATE)) >= CURRENT DATE
        AND O.IDEMPRESA IN (1, 3)
        AND COALESCE(OPN.IDPLANILHAPRENOTA, 0) = 0
),
ProdutosPendentesAgregados AS (
    SELECT
        OP.IDEMPRESA,
        OP.IDVENDEDOR,
        OP.IDORCAMENTO,
        SUM(OP.VALTOTLIQUIDO) AS VALOR_TOTAL_ORCAMENTO
    FROM DBA.ORCAMENTO_PROD OP
    INNER JOIN OrcamentosPendentes OPend
        ON  OP.IDORCAMENTO = OPend.IDORCAMENTO
        AND OP.IDEMPRESA   = OPend.IDEMPRESA
    WHERE
        OP.IDVENDEDOR IS NOT NULL
        AND OP.IDVENDEDOR > 0
    GROUP BY
        OP.IDEMPRESA,
        OP.IDVENDEDOR,
        OP.IDORCAMENTO
)
SELECT
    PPA.IDEMPRESA,
    PPA.IDVENDEDOR AS CODIGO_VENDEDOR,
    VEN.NOME AS NOME_VENDEDOR,
    PPA.VALOR_TOTAL_ORCAMENTO AS VALOR_TOTAL
FROM ProdutosPendentesAgregados PPA
LEFT JOIN DBA.CLIENTE_FORNECEDOR VEN
    ON VEN.IDCLIFOR = PPA.IDVENDEDOR
ORDER BY
    PPA.VALOR_TOTAL_ORCAMENTO DESC
FOR READ ONLY
"""


def gerar_sql_tubos_conexoes() -> str:
    """Gera SQL de tubos e conexões - últimos 3 meses automaticamente."""
    return """
WITH VendasBrutasPeriodoDetalhe AS (
    SELECT
        EA.IDEMPRESA,
        EA.DTMOVIMENTO,
        EA.IDVENDEDOR,
        CF.NOME AS NomeVendedor,
        CASE
            WHEN OI.TIPOMOVIMENTO = 'E' THEN -ABS(EA.VALTOTLIQUIDO)
            ELSE ABS(EA.VALTOTLIQUIDO)
        END AS VALOR_LIQUIDO,
        CASE
            WHEN LEFT(COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, ''), 4) = 'TUBO'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%EXTENS.%'
            THEN 'Tubo'
            WHEN LEFT(COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, ''), 4) <> 'TUBO'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%EXTENS.%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%ADESIVO%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%BOIA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%FITA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%4X2%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%VEDACAO%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%CAIXA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%ESFE%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%LAVAT.%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%ELETROD.%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%QUADRO%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%VALVULA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%ENGATE%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%TAMPA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%TORN.%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%FIXACAO%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%RALO%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%GRELHA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%TELHA%'
                 AND (COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')) NOT LIKE '%CUMEEIRA%'
            THEN 'Conexao'
            ELSE 'Outros'
        END AS TipoProduto
    FROM
        DBA.ESTOQUE_ANALITICO EA
    INNER JOIN DBA.PRODUTO P
        ON EA.IDPRODUTO = P.IDPRODUTO
    INNER JOIN DBA.PRODUTO_GRADE PG
        ON P.IDPRODUTO = PG.IDPRODUTO AND EA.IDSUBPRODUTO = PG.IDSUBPRODUTO
    INNER JOIN DBA.OPERACAO_INTERNA OI
        ON EA.IDOPERACAO = OI.IDOPERACAO
    LEFT JOIN DBA.CLIENTE_FORNECEDOR CF
        ON EA.IDVENDEDOR = CF.IDCLIFOR
    WHERE
        P.FABRICANTE IN ('AMANCO', 'PLASTUBOS', 'KRONA', 'PRECON')
        AND OI.TIPOMOVIMENTO IN ('V', 'E')
        AND EA.DTMOVIMENTO BETWEEN DATE(SUBSTR(CHAR(CURRENT DATE - 3 MONTHS), 1, 7) || '-01') AND CURRENT DATE
        AND EA.IDEMPRESA IN (1, 3)
        AND EA.IDVENDEDOR IS NOT NULL
        AND EA.IDVENDEDOR > 0
)
SELECT
    IDEMPRESA,
    DTMOVIMENTO,
    IDVENDEDOR,
    NomeVendedor,
    VALOR_LIQUIDO,
    TipoProduto
FROM
    VendasBrutasPeriodoDetalhe
WHERE
    TipoProduto IN ('Tubo', 'Conexao')
FOR READ ONLY
"""


# === FUNÇÕES DE SINCRONIZAÇÃO ===

def sync_vendas(conn_db2: pyodbc.Connection, conn_sqlite: sqlite3.Connection, data_inicio: str, data_fim: str):
    """Sincroniza tabela cache_vendas."""
    cursor = conn_sqlite.cursor()

    log(f"Sincronizando VENDAS ({data_inicio} até {data_fim})...")
    query = gerar_sql_vendas(data_inicio, data_fim)

    try:
        dados = executar_sql_db2(conn_db2, query)
    except Exception as e:
        log(f"  ERRO ao executar query: {e}")
        return

    log(f"  {len(dados)} registros obtidos do DB2")

    try:
        cursor.execute("DELETE FROM cache_vendas WHERE DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?", (data_inicio, data_fim))
        log(f"  {cursor.rowcount} registros antigos removidos do cache ({data_inicio} até {data_fim})")
    except Exception as e:
        log(f"  Erro ao limpar cache antigo: {e}")

    if len(dados) == 0:
        log("  Nenhum registro para inserir")
        conn_sqlite.commit()
        return

    registros = []
    for row in dados:
        chave = (
            f"{row.get('IDEMPRESA', '')}-{row.get('IDPLANILHA', '')}-"
            f"{row.get('NUMSEQUENCIA', '')}-{row.get('IDPRODUTO', '')}-"
            f"{row.get('IDSUBPRODUTO', '')}-{row.get('TIPO_LINHA', '')}"
        )
        registros.append((
            chave,
            row.get('TIPO_LINHA', ''),
            row.get('IDEMPRESA', 0),
            row.get('CNPJ_EMPRESA', ''),
            row.get('RAZAO_SOCIAL_EMPRESA', ''),
            str(row.get('IDVENDEDOR', '')),
            row.get('NOME_VENDEDOR', ''),
            str(row.get('IDCLIENTE', '')),
            row.get('NOME_CLIENTE', ''),
            str(row.get('IDPLANILHA', '')),
            row.get('NUMSEQUENCIA', 0),
            row.get('IDOPERACAO', 0),
            row.get('TIPOMOVIMENTO', ''),
            formatar_data(row.get('DT_MOVIMENTO')),
            formatar_data(row.get('DTH_NOTA')),
            formatar_hora(row.get('HR_EMISSAO')),
            str(row.get('IDPRODUTO', '')),
            str(row.get('IDSUBPRODUTO', '')),
            row.get('DESCRRESPRODUTO', ''),
            row.get('DESCRICAOPRODUTO', ''),
            float(row.get('QTDPRODUTO', 0) or 0),
            float(row.get('VALTOTLIQUIDO', 0) or 0) / 1000000,
            float(row.get('VALLUCRO', 0) or 0) / 1000000,
            float(row.get('TOTALVENDA_LINHA', 0) or 0) / 1000000,
            float(row.get('LUCRO_LINHA', 0) or 0) / 1000000,
        ))

    try:
        cursor.executemany("""
            INSERT OR REPLACE INTO cache_vendas (
                CHAVE, TIPO_LINHA, IDEMPRESA, CNPJ_EMPRESA, RAZAO_SOCIAL_EMPRESA,
                IDVENDEDOR, NOME_VENDEDOR, IDCLIENTE, NOME_CLIENTE,
                IDPLANILHA, NUMSEQUENCIA, IDOPERACAO, TIPOMOVIMENTO,
                DT_MOVIMENTO, DTH_NOTA, HR_EMISSAO,
                IDPRODUTO, IDSUBPRODUTO, DESCRRESPRODUTO, DESCRICAOPRODUTO,
                QTDPRODUTO, VALTOTLIQUIDO, VALLUCRO, TOTALVENDA_LINHA, LUCRO_LINHA
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, registros)
        conn_sqlite.commit()
        log(f"  {len(registros)} registros inseridos/atualizados em cache_vendas")
    except Exception as e:
        log(f"  ERRO no batch insert de cache_vendas: {e}")
        conn_sqlite.rollback()

    cursor.execute("""
        INSERT OR REPLACE INTO companies (id, name, cnpj)
        SELECT DISTINCT CAST(IDEMPRESA AS TEXT), RAZAO_SOCIAL_EMPRESA, CNPJ_EMPRESA
        FROM cache_vendas
        WHERE CNPJ_EMPRESA IS NOT NULL AND CNPJ_EMPRESA != ''
    """)
    conn_sqlite.commit()


def sync_pendentes(conn_db2: pyodbc.Connection, conn_sqlite: sqlite3.Connection):
    """Sincroniza tabela cache_vendas_pendentes (sempre substitui)."""
    cursor = conn_sqlite.cursor()

    log("Sincronizando VENDAS_PENDENTES (substituindo dados atuais)...")

    try:
        dados = executar_sql_db2(conn_db2, gerar_sql_pendentes())
    except Exception as e:
        log(f"  ERRO ao executar query: {e}")
        return

    log(f"  {len(dados)} registros obtidos do DB2")

    cursor.execute("DELETE FROM cache_vendas_pendentes")

    registros = [
        (
            int(row.get('IDEMPRESA', 1) or 1),
            str(row.get('CODIGO_VENDEDOR', '')),
            row.get('NOME_VENDEDOR', ''),
            float(row.get('VALOR_TOTAL', 0) or 0) / 100,
        )
        for row in dados
    ]

    try:
        cursor.executemany("""
            INSERT INTO cache_vendas_pendentes (IDEMPRESA, CODIGO_VENDEDOR, NOME_VENDEDOR, VALOR_TOTAL)
            VALUES (?, ?, ?, ?)
        """, registros)
        conn_sqlite.commit()
        log(f"  {len(registros)} registros salvos em cache_vendas_pendentes")
    except Exception as e:
        log(f"  ERRO no batch insert de cache_vendas_pendentes: {e}")
        conn_sqlite.rollback()


def sync_tubos_conexoes(conn_db2: pyodbc.Connection, conn_sqlite: sqlite3.Connection):
    """Sincroniza tabela cache_tubos_conexoes (sempre substitui - último 1 ano)."""
    cursor = conn_sqlite.cursor()

    log("Sincronizando TUBOS_CONEXOES (último 1 ano)...")

    try:
        dados = executar_sql_db2(conn_db2, gerar_sql_tubos_conexoes())
    except Exception as e:
        log(f"  ERRO ao executar query: {e}")
        return

    log(f"  {len(dados)} registros obtidos do DB2")

    cursor.execute("DELETE FROM cache_tubos_conexoes")

    registros = [
        (
            int(row.get('IDEMPRESA', 1) or 1),
            formatar_data(row.get('DTMOVIMENTO')),
            str(row.get('IDVENDEDOR', '')),
            row.get('NomeVendedor', '') or row.get('NOMEVENDEDOR', ''),
            float(row.get('VALOR_LIQUIDO', 0) or 0) / 1000000,
            row.get('TipoProduto', '') or row.get('TIPOPRODUTO', ''),
        )
        for row in dados
    ]

    try:
        cursor.executemany("""
            INSERT INTO cache_tubos_conexoes (IDEMPRESA, DT_MOVIMENTO, IDVENDEDOR, NOME_VENDEDOR, VALOR_LIQUIDO, TIPO_PRODUTO)
            VALUES (?, ?, ?, ?, ?, ?)
        """, registros)
        conn_sqlite.commit()
        log(f"  {len(registros)} registros salvos em cache_tubos_conexoes")
    except Exception as e:
        log(f"  ERRO no batch insert de cache_tubos_conexoes: {e}")
        conn_sqlite.rollback()


def sync_campanhas(conn_db2: pyodbc.Connection, conn_sqlite: sqlite3.Connection):
    """Sincroniza tabela cache_campanhas lendo o SQL de arquivo (últimos 15 meses para YoY)."""
    cursor = conn_sqlite.cursor()
    log("Sincronizando CAMPANHAS (Elit e Amanco - 15 meses)...")

    data_inicio, data_fim = calcular_periodo_historico(dias=450)

    sql_path = os.path.join(PROJECT_ROOT, "scripts", "sql", "vendas_produtos_campanhas.sql")
    try:
        with open(sql_path, 'r', encoding='utf-8') as f:
            query = f.read()
    except Exception as e:
        log(f"  Erro lendo SQL {sql_path}: {e}")
        return

    query = query.replace("{{d '{data_inicio}'}}", f"{{d '{data_inicio}'}}")
    query = query.replace("{{d '{data_fim}'}}", f"{{d '{data_fim}'}}")

    try:
        dados = executar_sql_db2(conn_db2, query)
    except Exception as e:
        log(f"  ERRO ao executar query: {e}")
        return

    log(f"  {len(dados)} registros obtidos do DB2")
    cursor.execute("DELETE FROM cache_campanhas")

    registros = [
        (
            formatar_data(row.get('DTMOVIMENTO')),
            str(row.get('IDVENDEDOR', '')),
            row.get('NOMEVENDEDOR', ''),
            str(row.get('IDPRODUTO', '')),
            str(row.get('IDSUBPRODUTO', '')),
            row.get('DESCRICAO_PRODUTO', ''),
            row.get('FABRICANTE', ''),
            float(row.get('QTD', 0) or 0),
            float(row.get('VALOR_LIQUIDO', 0) or 0) / 1000000,
        )
        for row in dados
    ]

    try:
        cursor.executemany("""
            INSERT INTO cache_campanhas (DTMOVIMENTO, IDVENDEDOR, NOMEVENDEDOR, IDPRODUTO, IDSUBPRODUTO, DESCRICAO_PRODUTO, FABRICANTE, QTD, VALOR_LIQUIDO)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, registros)
        conn_sqlite.commit()
        log(f"  {len(registros)} registros salvos em cache_campanhas")
    except Exception as e:
        log(f"  ERRO no batch insert de cache_campanhas: {e}")
        conn_sqlite.rollback()


def sync_amanco_mix(conn_db2: pyodbc.Connection, conn_sqlite: sqlite3.Connection):
    """Sincroniza tabela cache_amanco_mix lendo o SQL de arquivo (últimos 15 meses para YoY)."""
    cursor = conn_sqlite.cursor()
    log("Sincronizando AMANCO MIX (Tubos e Conexões - 15 meses)...")

    data_inicio, data_fim = calcular_periodo_historico(dias=450)

    sql_path = os.path.join(PROJECT_ROOT, "scripts", "sql", "tubos_conexoes_amanco.sql")
    try:
        with open(sql_path, 'r', encoding='utf-8') as f:
            query = f.read()
    except Exception as e:
        log(f"  Erro lendo SQL {sql_path}: {e}")
        return

    query = query.replace("{{d '{data_inicio}'}}", f"{{d '{data_inicio}'}}")
    query = query.replace("{{d '{data_fim}'}}", f"{{d '{data_fim}'}}")

    try:
        dados = executar_sql_db2(conn_db2, query)
    except Exception as e:
        log(f"  ERRO ao executar query: {e}")
        return

    log(f"  {len(dados)} registros obtidos do DB2")
    cursor.execute("DELETE FROM cache_amanco_mix")

    registros = [
        (
            formatar_data(row.get('DTMOVIMENTO')),
            str(row.get('IDVENDEDOR', '')),
            row.get('NomeVendedor', '') or row.get('NOMEVENDEDOR', ''),
            float(row.get('VALOR_LIQUIDO', 0) or 0) / 1000000,
            row.get('TipoProduto', '') or row.get('TIPOPRODUTO', ''),
        )
        for row in dados
    ]

    try:
        cursor.executemany("""
            INSERT INTO cache_amanco_mix (DTMOVIMENTO, IDVENDEDOR, NomeVendedor, VALOR_LIQUIDO, TipoProduto)
            VALUES (?, ?, ?, ?, ?)
        """, registros)
        conn_sqlite.commit()
        log(f"  {len(registros)} registros salvos em cache_amanco_mix")
    except Exception as e:
        log(f"  ERRO no batch insert de cache_amanco_mix: {e}")
        conn_sqlite.rollback()


# === SINCRONIZAÇÃO PRINCIPAL ===

def sincronizar(data_inicial: Optional[str] = None) -> bool:
    """Executa sincronização completa."""
    log("=" * 60)
    log("INICIANDO SINCRONIZAÇÃO DB2 → SQLite")
    log("=" * 60)

    inicializar_sqlite()

    conn_db2 = None
    conn_sqlite = None
    try:
        conn_db2 = conectar_db2()
        log("Conectado ao DB2 com sucesso!")

        conn_sqlite = conectar_sqlite()
        log(f"Conectado ao SQLite: {DATABASE_PATH}")

        hoje = datetime.now().strftime('%Y-%m-%d')

        if data_inicial:
            data_inicio = data_inicial
        else:
            data_inicio = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

        inicio = time.time()
        sync_vendas(conn_db2, conn_sqlite, data_inicio, hoje)
        sync_pendentes(conn_db2, conn_sqlite)
        sync_tubos_conexoes(conn_db2, conn_sqlite)
        sync_campanhas(conn_db2, conn_sqlite)
        sync_amanco_mix(conn_db2, conn_sqlite)

        duracao = time.time() - inicio
        log(f"Sincronização concluída em {duracao:.2f} segundos")
        log("=" * 60)
        return True

    except pyodbc.Error as e:
        log(f"ERRO DB2: {e}")
        traceback.print_exc()
        return False
    except Exception as e:
        log(f"ERRO: {e}")
        traceback.print_exc()
        return False
    finally:
        if conn_db2 is not None:
            try:
                conn_db2.close()
            except Exception:
                pass
        if conn_sqlite is not None:
            try:
                conn_sqlite.close()
            except Exception:
                pass


# === SERVIDOR E LOOP ===

def iniciar_servidor():
    """Inicia o servidor web do dashboard."""
    log("Iniciando servidor web...")
    os.chdir(PROJECT_ROOT)

    try:
        subprocess.run("npm --version", shell=True, capture_output=True, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        log("ERRO: npm não encontrado. Instale Node.js primeiro.")
        log("Baixe em: https://nodejs.org/")
        return

    log("Acesse: http://localhost:9001")

    is_windows = sys.platform == "win32"
    if is_windows:
        log("Executando servidor (Windows)...")
        env = os.environ.copy()
        env["NODE_ENV"] = "development"
        subprocess.run("npx tsx server/index.ts", shell=True, cwd=PROJECT_ROOT, env=env)
    else:
        log("Executando: npm run dev")
        subprocess.run("npm run dev", shell=True, cwd=PROJECT_ROOT)


def _conectar_db2_com_retry(max_tentativas: int = 3, backoff: float = 5.0):
    """Tenta conectar ao DB2 até max_tentativas vezes com backoff exponencial."""
    for tentativa in range(1, max_tentativas + 1):
        try:
            conn = conectar_db2()
            log("Conectado ao DB2 com sucesso!")
            return conn
        except pyodbc.Error as e:
            log(f"  Tentativa {tentativa}/{max_tentativas} falhou: {e}")
            if tentativa < max_tentativas:
                espera = backoff * (2 ** (tentativa - 1))
                log(f"  Aguardando {espera:.0f}s antes de tentar novamente...")
                time.sleep(espera)
    raise RuntimeError(f"Falha ao conectar ao DB2 após {max_tentativas} tentativas")


def loop_sync(intervalo: int, data_inicial: Optional[str] = None):
    """Executa sync em loop com retry automático na reconexão do DB2."""
    while True:
        time.sleep(intervalo)
        log("Sincronização incremental automática...")

        conn_db2 = None
        conn_sqlite = None
        try:
            inicializar_sqlite()
            conn_db2 = _conectar_db2_com_retry()
            conn_sqlite = conectar_sqlite()

            hoje = datetime.now().strftime('%Y-%m-%d')
            data_inicio = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

            inicio = time.time()
            sync_vendas(conn_db2, conn_sqlite, data_inicio, hoje)
            sync_pendentes(conn_db2, conn_sqlite)
            sync_tubos_conexoes(conn_db2, conn_sqlite)
            sync_campanhas(conn_db2, conn_sqlite)
            sync_amanco_mix(conn_db2, conn_sqlite)

            duracao = time.time() - inicio
            log(f"Sync concluída em {duracao:.2f}s. Próxima em {intervalo}s ({intervalo // 60} min)")

        except Exception as e:
            log(f"ERRO no loop de sync: {e}")
            traceback.print_exc()
        finally:
            if conn_db2 is not None:
                try:
                    conn_db2.close()
                except Exception:
                    pass
            if conn_sqlite is not None:
                try:
                    conn_sqlite.close()
                except Exception:
                    pass


def main():
    parser = argparse.ArgumentParser(
        description="Sincronizador DB2 → SQLite",
        epilog="""
Exemplos:
  python sync_db2.py                              # Sync incremental (última semana)
  python sync_db2.py --desde 2025-01-01           # Carga desde janeiro/2025
  python sync_db2.py --loop 600                   # Sync a cada 10 min
  python sync_db2.py --desde 2025-01-01 --loop 600 --serve  # TUDO JUNTO!
        """
    )
    parser.add_argument("--desde", type=str, metavar="YYYY-MM-DD",
                        help="Data inicial para carga (ex: 2025-01-01)")
    parser.add_argument("--loop", type=int, metavar="SEGUNDOS",
                        help="Executa em loop a cada N segundos (ex: 600 = 10 min)")
    parser.add_argument("--serve", action="store_true",
                        help="Após sincronizar, inicia o servidor web")

    args = parser.parse_args()

    sucesso = sincronizar(data_inicial=args.desde)

    if not sucesso:
        log("Falha na sincronização inicial.")
        if not args.serve:
            sys.exit(1)

    if args.loop:
        log(f"Iniciando sync em background a cada {args.loop} segundos ({args.loop // 60} min)")
        sync_thread = threading.Thread(
            target=loop_sync,
            args=(args.loop, args.desde),
            daemon=True,
        )
        sync_thread.start()

    if args.serve:
        try:
            iniciar_servidor()
        except KeyboardInterrupt:
            log("Servidor encerrado pelo usuário.")
    elif args.loop and not args.serve:
        log("Modo loop ativo. Pressione Ctrl+C para parar.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            log("Encerrado pelo usuário.")


if __name__ == "__main__":
    main()
