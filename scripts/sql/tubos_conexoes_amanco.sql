-- TUBOS E CONEXÕES - BUSCA RESTRITA SOMENTE AMANCO
-- Copiado de "tubos_conexoes.sql" original ajustando apenas o FABRICANTE
WITH DEVOLUCOES_CACHE AS (
    SELECT
        ND.IDEMPRESA,
        ND.IDPLANILHA,
        ND.NUMSEQUENCIADEVOLUCAO,
        ND.IDPRODUTO,
        ND.IDSUBPRODUTO
    FROM
        DBA.NOTAS_DEVOLUCAO ND
    JOIN DBA.DEVOLUCAO_LOGISTICA_MOVIMENTO DLM
        ON  DLM.IDEMPRESA = ND.IDEMPRESA
        AND DLM.IDPLANILHA = ND.IDPLANILHA
        AND DLM.NUMSEQUENCIADEV = ND.NUMSEQUENCIADEVOLUCAO
        AND DLM.IDPRODUTO = ND.IDPRODUTO
        AND DLM.IDSUBPRODUTO = ND.IDSUBPRODUTO
    WHERE
        DLM.FLAGGERARREENTREGA = 'T'
),
VendasBrutasPeriodoDetalhe AS (
        SELECT
            EA.DTMOVIMENTO,
            EA.IDVENDEDOR,
            CF.NOME AS NomeVendedor,
            CASE
                WHEN OI.TIPOMOVIMENTO = 'E' AND NOT EXISTS (
                    SELECT 1
                    FROM DEVOLUCOES_CACHE DC
                    WHERE DC.IDEMPRESA = EA.IDEMPRESA
                      AND DC.IDPLANILHA = EA.IDPLANILHA
                      AND DC.NUMSEQUENCIADEVOLUCAO = EA.NUMSEQUENCIA
                      AND DC.IDPRODUTO = EA.IDPRODUTO
                      AND DC.IDSUBPRODUTO = EA.IDSUBPRODUTO
                ) THEN -ABS(EA.VALTOTLIQUIDO)
                WHEN OI.TIPOMOVIMENTO = 'E' THEN 0
                ELSE ABS(EA.VALTOTLIQUIDO)
            END AS VALOR_LIQUIDO,
            CASE
                WHEN LEFT (
                    COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, ''),
                    4
                ) = 'TUBO'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%EXTENS.%' THEN 'Tubo'
                WHEN LEFT (
                    COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, ''),
                    4
                ) <> 'TUBO'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || ' ' || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%EXTENS.%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%ADESIVO%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%BOIA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%FITA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%4X2%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%VEDACAO%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%CAIXA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%ESFE%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%LAVAT.%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%ELETROD.%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%QUADRO%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%VALVULA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%ENGATE%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%TAMPA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%TORN.%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%FIXACAO%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%RALO%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%GRELHA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%TELHA%'
                AND (
                    COALESCE(P.DESCRCOMPRODUTO, '') || COALESCE(PG.SUBDESCRICAO, '')
                ) NOT LIKE '%CUMEEIRA%' THEN 'Conexão'
                ELSE 'Outros'
            END AS TipoProduto
        FROM
            DBA.ESTOQUE_ANALITICO EA
            INNER JOIN DBA.PRODUTO P ON EA.IDPRODUTO = P.IDPRODUTO
            INNER JOIN DBA.PRODUTO_GRADE PG ON P.IDPRODUTO = PG.IDPRODUTO
            AND EA.IDSUBPRODUTO = PG.IDSUBPRODUTO
            INNER JOIN DBA.OPERACAO_INTERNA OI ON EA.IDOPERACAO = OI.IDOPERACAO
            LEFT JOIN DBA.CLIENTE_FORNECEDOR CF ON EA.IDVENDEDOR = CF.IDCLIFOR
        WHERE
            -- ✅ FILTRO EXCLUSIVO AMANCO (MARCA 30)
            P.IDMARCAFABRICANTE = 30
            AND OI.TIPOMOVIMENTO IN ('V', 'E')
            AND EA.DTMOVIMENTO BETWEEN {{d '{data_inicio}'}} AND {{d '{data_fim}'}}
            AND EA.IDEMPRESA IN (1, 3)
            AND EA.IDVENDEDOR IS NOT NULL
            AND EA.IDVENDEDOR > 0
    )
    -- Consulta Final
SELECT
    DTMOVIMENTO,
    IDVENDEDOR,
    NomeVendedor,
    VALOR_LIQUIDO,
    TipoProduto
FROM
    VendasBrutasPeriodoDetalhe
WHERE
    TipoProduto IN ('Tubo', 'Conexão');