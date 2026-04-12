# Integração API Python ↔ Dashboard Web

## Arquitetura

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    DB2      │ ──▶ │  API Python │ ──▶ │  SQLite     │
│  (origem)   │     │  (sync)     │     │  database.db│
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Navegador  │ ◀── │  Dashboard  │ ◀── │  Lê SQLite  │
│  (usuário)  │     │  Web:9003   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**IMPORTANTE:** SQLite é um arquivo local (`./database.db`), não tem IP/porta.
O navegador acessa a API em `http://IP:9003`. A API lê/grava no `database.db`.

## Configuração

| Item | Valor |
|------|-------|
| **Banco de dados** | `./database.db` (raiz do projeto) |
| **URL da API** | `http://IP_DO_SERVIDOR:9003` |
| **Formato de data** | `YYYY-MM-DD` |

---

## Escala de Valores (CRÍTICO)

Os valores monetários devem ser **divididos por 1.000.000** e arredondados com 2 casas decimais **ANTES** de salvar no SQLite.

```python
# Na API Python - DIVIDIR ANTES DE SALVAR
VALTOTLIQUIDO = round(valor_bruto / 1_000_000, 2)
VALOR_LIQUIDO = round(valor_bruto / 1_000_000, 2)
VALOR_TOTAL = round(valor_bruto / 1_000_000, 2)
```

⚠️ **O frontend NÃO divide novamente** - apenas exibe o valor que está no banco.

Exemplo: `1.25` no banco = `R$ 1,25 milhões` na tela

---

## Tabelas de Cache

A API Python deve popular estas tabelas no SQLite:

### 1. `cache_vendas` (vendas.sql)

| Coluna | Tipo | Origem DB2 | Nota |
|--------|------|------------|------|
| IDVENDEDOR | TEXT | IDVENDEDOR | |
| NOME_VENDEDOR | TEXT | NOME_VENDEDOR | |
| IDPLANILHA | TEXT | IDPLANILHA | |
| IDSUBPRODUTO | TEXT | IDSUBPRODUTO | |
| VALTOTLIQUIDO | REAL | VALTOTLIQUIDO | **÷ 1.000.000** |
| DTMOVIMENTO | TEXT | DTMOVIMENTO | **YYYY-MM-DD** |

### 2. `cache_tubos_conexoes` (tubos_conexoes.sql)

| Coluna | Tipo | Origem DB2 | Nota |
|--------|------|------------|------|
| DTMOVIMENTO | TEXT | DTMOVIMENTO | **YYYY-MM-DD** |
| IDVENDEDOR | TEXT | IDVENDEDOR | |
| NOMEVENDEDOR | TEXT | NomeVendedor | **Renomear** |
| VALOR_LIQUIDO | REAL | VALOR_LIQUIDO | **÷ 1.000.000** |
| TIPOPRODUTO | TEXT | TipoProduto | **Renomear + Normalizar** |

⚠️ **Renomeação e normalização obrigatórias:**
- `NomeVendedor` → `NOMEVENDEDOR`
- `TipoProduto` → `TIPOPRODUTO`
- `'Tubo'` → `'TUBO'`
- `'Conexão'` → `'CONEXAO'` (sem acento)

### 3. `cache_vendas_pendentes` (vendas_pendentes.sql)

| Coluna | Tipo | Origem DB2 | Nota |
|--------|------|------------|------|
| CODIGO_VENDEDOR | TEXT | CODIGO_VENDEDOR | |
| NOME_VENDEDOR | TEXT | NOME_VENDEDOR | |
| QTD_PEDIDOS | INTEGER | QTD_PEDIDOS | |
| VALOR_TOTAL | REAL | VALOR_TOTAL | **÷ 1.000.000** |

---

## Exemplo de Sync (Python)

```python
import sqlite3
from datetime import datetime

DB_PATH = "./database.db"

def normalizar_tipo_produto(tipo: str) -> str:
    """Normaliza TipoProduto para TUBO/CONEXAO"""
    tipo_upper = tipo.upper().replace('Ã', 'A').replace('ã', 'a')
    if 'TUBO' in tipo_upper:
        return 'TUBO'
    elif 'CONEXA' in tipo_upper:
        return 'CONEXAO'
    return 'OUTROS'

def sync_vendas(dados_db2: list):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Limpa cache antigo
    cursor.execute("DELETE FROM cache_vendas")
    
    # Insere novos dados
    for row in dados_db2:
        cursor.execute("""
            INSERT INTO cache_vendas 
            (IDVENDEDOR, NOME_VENDEDOR, IDPLANILHA, IDSUBPRODUTO, VALTOTLIQUIDO, DTMOVIMENTO)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            row['IDVENDEDOR'],
            row['NOME_VENDEDOR'],
            row.get('IDPLANILHA'),
            row.get('IDSUBPRODUTO'),
            round(row['VALTOTLIQUIDO'] / 1_000_000, 2),  # DIVIDIR AQUI!
            row['DTMOVIMENTO'].strftime('%Y-%m-%d') if hasattr(row['DTMOVIMENTO'], 'strftime') else row['DTMOVIMENTO']
        ))
    
    conn.commit()
    conn.close()

def sync_tubos_conexoes(dados_db2: list):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM cache_tubos_conexoes")
    
    for row in dados_db2:
        tipo_normalizado = normalizar_tipo_produto(row['TipoProduto'])
        
        # Descartar "OUTROS" se não for relevante
        if tipo_normalizado == 'OUTROS':
            continue
            
        cursor.execute("""
            INSERT INTO cache_tubos_conexoes 
            (DTMOVIMENTO, IDVENDEDOR, NOMEVENDEDOR, VALOR_LIQUIDO, TIPOPRODUTO)
            VALUES (?, ?, ?, ?, ?)
        """, (
            row['DTMOVIMENTO'].strftime('%Y-%m-%d') if hasattr(row['DTMOVIMENTO'], 'strftime') else row['DTMOVIMENTO'],
            row['IDVENDEDOR'],
            row['NomeVendedor'],  # Será salvo como NOMEVENDEDOR (nome da coluna)
            round(row['VALOR_LIQUIDO'] / 1_000_000, 2),  # DIVIDIR AQUI!
            tipo_normalizado  # TUBO ou CONEXAO
        ))
    
    conn.commit()
    conn.close()

def sync_vendas_pendentes(dados_db2: list):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM cache_vendas_pendentes")
    
    for row in dados_db2:
        cursor.execute("""
            INSERT INTO cache_vendas_pendentes 
            (CODIGO_VENDEDOR, NOME_VENDEDOR, QTD_PEDIDOS, VALOR_TOTAL)
            VALUES (?, ?, ?, ?)
        """, (
            row['CODIGO_VENDEDOR'],
            row['NOME_VENDEDOR'],
            row['QTD_PEDIDOS'],
            round(row['VALOR_TOTAL'] / 1_000_000, 2)  # DIVIDIR AQUI!
        ))
    
    conn.commit()
    conn.close()
```

---

## Checklist de Integração

- [ ] API Python conecta no DB2
- [ ] Dividir valores por 1.000.000 antes de salvar
- [ ] Formatar datas como `YYYY-MM-DD`
- [ ] Renomear `NomeVendedor` → `NOMEVENDEDOR`
- [ ] Renomear `TipoProduto` → `TIPOPRODUTO`
- [ ] Normalizar `'Tubo'` → `'TUBO'` e `'Conexão'` → `'CONEXAO'`
- [ ] Dashboard roda na porta 9003
- [ ] Dashboard lê do mesmo `./database.db`

---

## Views Disponíveis

O schema cria automaticamente estas views para consulta:

| View | Descrição |
|------|-----------|
| `vw_kpis_vendedor` | KPIs agregados por vendedor/data |
| `vw_tubos_conexoes` | Proporção Tubos x Conexões por vendedor |
| `vw_a_faturar` | Valores a faturar por vendedor |

A view `vw_tubos_conexoes` já normaliza TIPOPRODUTO, aceitando ambos os formatos:
- `'Tubo'`/`'Conexão'` (original do DB2)
- `'TUBO'`/`'CONEXAO'` (normalizado)

Mas é **recomendado** normalizar na API para consistência.
