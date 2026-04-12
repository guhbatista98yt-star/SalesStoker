-- PEDIDOS PENDENTES.
-- Objetivo: Retornar o total de orçamentos pendentes (pré-notas ainda não pagas ou convertidas)
-- por vendedor, considerando apenas os orçamentos válidos e recentes (últimos 2 dias)

-- CTE 1: Orçamentos pendentes ainda não convertidos em pré-nota ou já pagos
WITH OrcamentosPendentes AS (
    SELECT
        O.IDORCAMENTO,
        O.IDEMPRESA
    FROM
        DBA.ORCAMENTO O
    LEFT JOIN
        DBA.ORCAMENTO_PRE_NOTA OPN
        ON OPN.IDORCAMENTO = O.IDORCAMENTO
        AND OPN.IDEMPRESAORCAMENTO = O.IDEMPRESA
    WHERE
        O.FLAGPRENOTA = 'T' -- Tem pré-nota gerada
        AND O.FLAGPRENOTAPAGA = 'F' -- Mas ainda não foi paga
        AND O.FLAGCANCELADO = 'F'
        AND O.DTMOVIMENTO >= (CURRENT DATE - 2 DAYS)
        AND DATE(COALESCE(O.DTVALIDADE, CURRENT DATE)) >= CURRENT DATE -- Validade ainda ativa
        AND O.IDEMPRESA IN (1, 3)
        AND COALESCE(OPN.IDPLANILHAPRENOTA, 0) = 0 -- Ainda não virou uma pré-nota efetiva
),

-- CTE 2: Soma dos produtos por orçamento, agrupando por vendedor
ProdutosPendentesAgregados AS (
    SELECT
        OP.IDVENDEDOR,
        OP.IDORCAMENTO,
        SUM(OP.VALTOTLIQUIDO) AS VALOR_TOTAL_ORCAMENTO
    FROM
        DBA.ORCAMENTO_PROD OP
    INNER JOIN
        OrcamentosPendentes OPend
        ON OP.IDORCAMENTO = OPend.IDORCAMENTO
        AND OP.IDEMPRESA = OPend.IDEMPRESA
    WHERE
        OP.IDVENDEDOR IS NOT NULL
        AND OP.IDVENDEDOR > 0
    GROUP BY
        OP.IDVENDEDOR,
        OP.IDORCAMENTO
)

-- Consulta final: sumariza valor e quantidade de orçamentos por vendedor
SELECT
    CF.IDCLIFOR AS CODIGO_VENDEDOR,
    CF.NOME AS NOME_VENDEDOR,
    COUNT(PPA.IDORCAMENTO) AS QTD_PEDIDOS,
    COALESCE(SUM(PPA.VALOR_TOTAL_ORCAMENTO), 0) AS VALOR_TOTAL
FROM
    DBA.CLIENTE_FORNECEDOR CF
LEFT JOIN
    ProdutosPendentesAgregados PPA
    ON CF.IDCLIFOR = PPA.IDVENDEDOR
WHERE
    CF.IDCLIFOR IN (13656, 1000024, 1005676, 1006781, 1011021, 1000023, 1000020, 1014430)
GROUP BY
    CF.IDCLIFOR,
    CF.NOME
ORDER BY
    VALOR_TOTAL DESC;
