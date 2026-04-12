-- =====================================================
-- SCHEMA DO BANCO DE DADOS SQLITE
-- Sales Analytics Dashboard
-- =====================================================
-- Arquivo: ./database.db (raiz do projeto)
-- Porta da aplicação web: 9003
-- =====================================================
-- Tabela de usuários (autenticação)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABELAS DE CACHE DO DB2 (populadas pela API Python)
-- =====================================================
-- Cache de vendas (vendas.sql) - NOVA ESTRUTURA
-- Chave única: IDEMPRESA + IDPLANILHA + NUMSEQUENCIA + IDPRODUTO + IDSUBPRODUTO
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
);

-- Cache de vendas pendentes (vendas_pendentes.sql)
CREATE TABLE IF NOT EXISTS cache_vendas_pendentes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    CODIGO_VENDEDOR TEXT NOT NULL,
    NOME_VENDEDOR TEXT NOT NULL,
    QTD_PEDIDOS INTEGER NOT NULL,
    VALOR_TOTAL REAL NOT NULL,
    sync_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- TABELAS DA APLICAÇÃO
-- =====================================================
-- Empresas (extraídas do DB2)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE NOT NULL
);

-- Metas de vendas (configuradas no app)
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    salesperson_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('semanal', 'mensal')),
    target_value REAL NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL
);

-- Alertas
CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    salesperson_id TEXT,
    severity TEXT DEFAULT 'warning' CHECK (
        severity IN ('info', 'warning', 'error', 'success')
    ),
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cache_vendas_data ON cache_vendas (DT_MOVIMENTO);

CREATE INDEX IF NOT EXISTS idx_cache_vendas_vendedor ON cache_vendas (IDVENDEDOR);

CREATE INDEX IF NOT EXISTS idx_cache_vendas_empresa ON cache_vendas (IDEMPRESA);

CREATE INDEX IF NOT EXISTS idx_cache_vendas_chave ON cache_vendas (CHAVE);

CREATE INDEX IF NOT EXISTS idx_cache_pendentes_vendedor ON cache_vendas_pendentes (CODIGO_VENDEDOR);

CREATE INDEX IF NOT EXISTS idx_goals_salesperson ON goals (salesperson_id);

CREATE INDEX IF NOT EXISTS idx_goals_period ON goals (month, year);

-- =====================================================
-- VIEWS ÚTEIS PARA A APLICAÇÃO
-- =====================================================
-- Empresas distintas do cache de vendas
DROP VIEW IF EXISTS vw_empresas;

CREATE VIEW vw_empresas AS
SELECT DISTINCT
    CAST(IDEMPRESA AS TEXT) as id,
    RAZAO_SOCIAL_EMPRESA as name,
    CNPJ_EMPRESA as cnpj
FROM
    cache_vendas
WHERE
    CNPJ_EMPRESA IS NOT NULL;

-- Vendedores distintos
DROP VIEW IF EXISTS vw_vendedores;

CREATE VIEW vw_vendedores AS
SELECT DISTINCT
    IDVENDEDOR as id,
    NOME_VENDEDOR as name,
    IDEMPRESA as company_id
FROM
    cache_vendas
WHERE
    IDVENDEDOR IS NOT NULL
    AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%';

-- KPIs por vendedor
DROP VIEW IF EXISTS vw_kpis_vendedor;

CREATE VIEW vw_kpis_vendedor AS
SELECT
    IDVENDEDOR,
    NOME_VENDEDOR,
    IDEMPRESA,
    SUM(TOTALVENDA_LINHA) as total_vendas,
    SUM(LUCRO_LINHA) as total_lucro,
    COUNT(*) as qtd_vendas,
    DT_MOVIMENTO
FROM
    cache_vendas
GROUP BY
    IDVENDEDOR,
    IDEMPRESA,
    DT_MOVIMENTO;

-- A Faturar por vendedor
DROP VIEW IF EXISTS vw_a_faturar;

CREATE VIEW vw_a_faturar AS
SELECT
    CODIGO_VENDEDOR as IDVENDEDOR,
    NOME_VENDEDOR,
    SUM(QTD_PEDIDOS) as total_pedidos,
    SUM(VALOR_TOTAL) as valor_a_faturar
FROM
    cache_vendas_pendentes
GROUP BY
    CODIGO_VENDEDOR;

-- =====================================================
-- TABELA TUBOS E CONEXÕES
-- =====================================================
CREATE TABLE IF NOT EXISTS cache_tubos_conexoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    IDEMPRESA INTEGER NOT NULL,
    DT_MOVIMENTO TEXT NOT NULL,
    IDVENDEDOR TEXT NOT NULL,
    NOME_VENDEDOR TEXT NOT NULL,
    VALOR_LIQUIDO REAL NOT NULL,
    TIPO_PRODUTO TEXT NOT NULL,
    sync_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tubos_conexoes_vendedor ON cache_tubos_conexoes (IDVENDEDOR);

CREATE INDEX IF NOT EXISTS idx_tubos_conexoes_empresa ON cache_tubos_conexoes (IDEMPRESA);

CREATE INDEX IF NOT EXISTS idx_tubos_conexoes_data ON cache_tubos_conexoes (DT_MOVIMENTO);

-- =====================================================
-- TABELA GATILHOS INDIVIDUAIS POR CAMPANHA
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_goals (
    id TEXT PRIMARY KEY,
    salespersonId TEXT NOT NULL,
    campaignName TEXT NOT NULL,
    year INTEGER NOT NULL,
    triggerValue REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (salespersonId, campaignName, year)
);

CREATE INDEX IF NOT EXISTS idx_campaign_goals_campaign ON campaign_goals (campaignName, year);

-- =====================================================
-- EQUIPES DE VENDEDORES (Vendor Groups)
-- =====================================================
CREATE TABLE IF NOT EXISTS vendor_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor_group_members (
    group_id TEXT NOT NULL,
    salesperson_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, salesperson_id),
    FOREIGN KEY (group_id) REFERENCES vendor_groups (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vgm_salesperson ON vendor_group_members (salesperson_id);

-- =====================================================
-- MÓDULO DE CAMPANHAS COMERCIAIS
-- =====================================================

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    objective TEXT,
    supplier_name TEXT,
    logo_url TEXT,
    brand_color TEXT,
    campaign_type TEXT NOT NULL DEFAULT 'padrao',
    sub_type TEXT,
    status TEXT NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho','ativa','pausada','encerrada','cancelada')),
    priority INTEGER NOT NULL DEFAULT 50,
    is_cumulative INTEGER NOT NULL DEFAULT 1,
    is_exclusive INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT,
    current_version INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    time_start TEXT,
    time_end TEXT,
    valid_weekdays TEXT DEFAULT '[]',
    recurrence TEXT,
    targets TEXT NOT NULL DEFAULT '{}',
    conditions TEXT NOT NULL DEFAULT '{}',
    triggers TEXT NOT NULL DEFAULT '[]',
    rewards TEXT NOT NULL DEFAULT '{}',
    limits TEXT NOT NULL DEFAULT '{}',
    exceptions TEXT NOT NULL DEFAULT '[]',
    natural_language TEXT,
    internal_notes TEXT,
    created_by TEXT NOT NULL,
    updated_by TEXT,
    change_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_versions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    created_by TEXT NOT NULL,
    change_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS campaign_audit_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    prev_values TEXT,
    new_values TEXT,
    change_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS campaign_simulations (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    input_data TEXT NOT NULL,
    result TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaigns_period ON campaigns (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_campaign_versions_campaign ON campaign_versions (campaign_id, version);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_campaign ON campaign_audit_logs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_audit_created ON campaign_audit_logs (created_at);

-- Performance indexes for cache_campanhas (campaign sales queries)
CREATE INDEX IF NOT EXISTS idx_cache_campanhas_data ON cache_campanhas(DTMOVIMENTO);
CREATE INDEX IF NOT EXISTS idx_cache_campanhas_fabricante ON cache_campanhas(FABRICANTE);
CREATE INDEX IF NOT EXISTS idx_cache_campanhas_data_vendedor ON cache_campanhas(DTMOVIMENTO, IDVENDEDOR);
CREATE INDEX IF NOT EXISTS idx_cache_campanhas_data_fabricante ON cache_campanhas(DTMOVIMENTO, FABRICANTE);
CREATE INDEX IF NOT EXISTS idx_cache_campanhas_produto ON cache_campanhas(IDPRODUTO);