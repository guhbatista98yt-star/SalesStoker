Quero evoluir o módulo de Campanhas da aplicação para que ele seja realmente completo, altamente personalizável, confiável e utilizável no dia a dia da operação, sem depender de ajustes no código a cada nova campanha.

IMPORTANTE:
Não quero um módulo simples de cadastro.
Quero um sistema robusto de campanhas comerciais, com arquitetura sólida, regras configuráveis pelo app, relatórios detalhados, memória de cálculo, apuração confiável, visualização de resultados e exportação de documentos.

O objetivo é que eu consiga criar, configurar, acompanhar, conferir e exportar qualquer campanha diretamente pelo sistema.

================================================================
1. OBJETIVO GERAL DO MÓDULO
================================================================

Criar dentro do módulo de Configurações uma área completa de Campanhas, com botão/menu de acesso chamado:

- Campanhas
- Criar Campanhas

Esse módulo precisa permitir:

- criar campanha
- editar campanha
- clonar campanha
- salvar como rascunho
- ativar campanha
- pausar campanha
- encerrar campanha
- cancelar campanha
- versionar campanha
- simular campanha
- apurar campanha
- visualizar resultados
- conferir memória de cálculo
- exportar relatórios e documentos
- auditar alterações e apurações

Quero tudo isso dentro do app.

================================================================
2. CONCEITO OBRIGATÓRIO DA ARQUITETURA
================================================================

As campanhas NÃO podem ser tratadas apenas como “regra + prêmio”.

Cada campanha precisa separar claramente estas camadas:

1. Critério de elegibilidade / participação
2. Critério de ativação / gatilho
3. Critério de apuração
4. Critério de ranking
5. Critério de cálculo do prêmio
6. Critério de pagamento
7. Critério de desempate
8. Critério de relatório / conferência
9. Critério de auditoria / rastreabilidade

Essas camadas precisam ser independentes entre si.

Exemplo:
- uma campanha pode classificar pelo crescimento geral
- mas pagar apenas sobre uma linha específica de produtos
- ou exigir mix mínimo de produtos para liberar participação
- ou exigir gatilho antes de começar a contar
- ou premiar todos que atingirem, sem ranking
- ou premiar só os primeiros colocados
- ou pagar percentual sobre valor vendido
- ou pagar valor fixo ao atingir condição

O módulo precisa suportar isso sem hardcode.

================================================================
3. ESTRUTURA DO MÓDULO
================================================================

Quero que o módulo tenha:

1. Listagem de campanhas
2. Tela de criação de campanha
3. Tela de edição
4. Tela de clonagem
5. Simulador
6. Apuração
7. Resultados
8. Relatórios
9. Exportação
10. Auditoria
11. Histórico de versões

Na listagem, quero:
- busca
- filtros por status, período, tipo, fornecedor, grupo, criador, prioridade
- badges visuais por status
- alerta visual de conflito
- indicador se a campanha é acumulável ou exclusiva
- botão de criar
- botão de editar
- botão de clonar
- botão de ativar
- botão de pausar
- botão de encerrar
- botão de resultados
- botão de exportação

================================================================
4. CAMPOS E BLOCOS DE CONFIGURAÇÃO DA CAMPANHA
================================================================

Cada campanha deve ser organizada em blocos ou abas:

1. Dados Gerais
2. Público-Alvo
3. Produtos / Fornecedores / Categorias / Mix
4. Critério de Participação
5. Gatilhos
6. Regra de Apuração
7. Regra de Ranking
8. Regra de Premiação
9. Regra de Pagamento
10. Limites / Exceções / Conflitos
11. Simulação
12. Resultados
13. Relatórios
14. Exportação
15. Auditoria
16. Versionamento

================================================================
5. DADOS GERAIS
================================================================

Cada campanha deve ter no mínimo:

- id
- código interno único
- nome da campanha
- descrição
- objetivo
- tipo da campanha
- empresa / filial
- fornecedor principal, se aplicável
- observações internas
- status: rascunho, ativa, pausada, encerrada, cancelada
- prioridade
- acumulável: sim/não
- exclusiva: sim/não
- campanha de origem, se clonada
- criado por
- alterado por
- data de criação
- data de atualização
- motivo da alteração

Período:
- data inicial
- data final
- hora inicial opcional
- hora final opcional
- dias válidos da semana
- recorrência opcional
- período comparativo, quando a campanha usar crescimento

================================================================
6. PÚBLICO-ALVO E ABRANGÊNCIA
================================================================

Permitir selecionar:

- todos os vendedores
- vendedores específicos
- grupos de vendedores
- supervisor, se existir
- rota/região, se existir
- fornecedor específico
- múltiplos fornecedores
- grupo de fornecedores, se fizer sentido
- produtos específicos
- grupos de produtos
- seção
- categoria
- subcategoria
- marca
- linha
- cliente específico
- grupo de clientes
- canal de venda, se existir

Também permitir:
- inclusões
- exclusões pontuais
- lógica de “todos exceto”
- multiseleção com busca
- filtros rápidos

Exemplo:
- campanha válida para grupo X, exceto vendedor Y
- campanha válida para fornecedor A, exceto produto B

================================================================
7. TIPOS DE CAMPANHAS QUE O MÓDULO PRECISA SUPORTAR
================================================================

Quero suporte real para campanhas como:

1. Comissão percentual
Exemplo:
“O vendedor ganha 1% de comissão sobre o valor vendido dos produtos X, Y e Z.”

2. Campanha por mix
Exemplo:
“O vendedor precisa vender pelo menos 5 produtos do mix do fornecedor para participar.”

3. Campanha com gatilho
Exemplo:
“O vendedor precisa atingir um gatilho mínimo para liberar a participação ou premiação.”

4. Campanha de atingimento sem ranking
Exemplo:
“Todos que atingirem as condições ganham o prêmio.”

5. Campanha por ranking
Exemplo:
“Ganha quem mais vendeu.”

6. Campanha por crescimento
Exemplo:
“Ganha quem mais cresceu em relação ao período anterior.”

7. Campanha híbrida
Exemplo:
“Ranking pelo crescimento geral, mas pagamento calculado apenas sobre vendas de conexões.”

8. Campanha por faixa
Exemplo:
“Se vender de X a Y ganha A; de Y+1 a Z ganha B.”

9. Campanha por combo
Exemplo:
“Precisa vender um conjunto mínimo de itens para validar.”

10. Campanha com prêmio fixo
11. Campanha com prêmio percentual
12. Campanha por meta
13. Campanha multi-regra
14. Campanha com múltiplos ganhadores
15. Campanha com múltiplos critérios de premiação na mesma campanha

================================================================
8. MOTOR DE REGRAS
================================================================

O motor de regras precisa ser centralizado no backend, sem lógica sensível hardcoded no frontend.

Permitir criar regras com:

- E
- OU
- E NÃO
- OU NÃO
- grupos lógicos
- blocos aninhados
- prioridade entre regras
- exceções
- bloqueios
- regras obrigatórias
- regras complementares

Permitir condições como:

- fornecedor = X
- produto = Y
- grupo/categoria/linha = Z
- vendedor pertence ao grupo A
- quantidade >= N
- quantidade entre X e Y
- valor >= N
- valor entre X e Y
- meta mínima atingida
- mix mínimo atingido
- combo completo atingido
- desconto <= X
- margem >= X
- múltiplos de embalagem
- primeira venda do período
- venda acumulada >= X
- campanha válida só em determinados dias/horários
- cliente pertence ao grupo X
- filial = X
- rota = X
- canal = X

O backend deve validar:
- sintaxe lógica
- coerência
- regras contraditórias
- conflitos com outras campanhas
- ausência de comportamento imprevisível
- estrutura mínima obrigatória

================================================================
9. GATILHOS
================================================================

Permitir configurar gatilhos como:

- ao atingir quantidade X
- ao atingir valor X
- ao vender produto Y
- ao completar mix mínimo
- ao completar combo
- ao atingir meta parcial
- ao atingir meta total
- ao mudar de faixa
- ao iniciar o período
- ao encerrar o período
- ao ocorrer uma combinação específica de condições

Permitir ações do gatilho como:
- liberar participação
- liberar premiação
- aplicar nova faixa
- atualizar ranking
- gerar notificação interna
- registrar log
- bloquear excesso
- aplicar exceção
- desconsiderar acúmulo
- encadear regra complementar

================================================================
10. BASES INDEPENDENTES DA CAMPANHA
================================================================

Quero campos e estrutura para separar claramente:

- base de elegibilidade
- base de gatilho
- base de apuração
- base de ranking
- base de cálculo do prêmio
- base de pagamento
- base de relatório
- base comparativa, quando houver crescimento

Isso é obrigatório.

Exemplo:
uma campanha pode:
- participar com base no mix do fornecedor
- ranquear pelo crescimento geral
- pagar sobre conexões
- exportar um relatório analítico diferente do ranking

================================================================
11. EXEMPLOS REAIS QUE O MÓDULO PRECISA ATENDER
================================================================

EXEMPLO 1
“O vendedor irá ganhar 1% de comissão em cima do valor da venda dos seguintes produtos.”

Configuração esperada:
- vendedores elegíveis
- lista de produtos elegíveis
- tipo: comissão percentual
- percentual: 1%
- base de cálculo/pagamento: valor vendido somente desses produtos
- relatório por vendedor e produto
- memória de cálculo da comissão

EXEMPLO 2
“O vendedor precisa vender pelo menos 5 produtos do mix do fornecedor e atingir o gatilho; após isso ele participa e todos que atingirem ganham o prêmio.”

Configuração esperada:
- fornecedor selecionável
- mix elegível configurável
- regra de participação: mínimo de 5 produtos do mix
- gatilho configurável
- campanha sem ranking
- prêmio configurável: fixo, percentual, pontos ou outro
- relatório mostrando claramente quem atingiu, quando atingiu e qual condição cumpriu

EXEMPLO 3
“Na DTR da Amanco, será pago o vendedor que mais cresceu no geral e o que mais vendeu, porém o valor pago será em cima do que foi vendido em conexões.”

Configuração esperada:
- campanha com múltiplos critérios
- ranking 1: maior crescimento geral
- ranking 2: maior venda total
- base de crescimento: geral
- base de venda/ranking: geral ou configurável
- base de pagamento: apenas conexões
- múltiplos vencedores
- relatório mostrando ranking, crescimento, venda total e valor elegível de conexões para pagamento

================================================================
12. PREMIAÇÃO
================================================================

Permitir múltiplos tipos de premiação:

- valor fixo
- percentual
- pontos
- ranking
- prêmio por faixa
- prêmio progressivo
- prêmio por volume
- prêmio por meta
- prêmio por fornecedor
- prêmio por produto
- prêmio por combo
- premiação individual
- premiação coletiva

Também permitir:
- faixas progressivas
- escalonamento
- pesos diferentes por item
- regra de desempate
- teto máximo
- valor mínimo para pagar
- corte mínimo
- arredondamento
- quantidade de contemplados
- prêmio por posição
- prêmio por atingimento

================================================================
13. LIMITES, EXCEÇÕES E CONFLITOS
================================================================

Permitir:

- limite por vendedor
- limite por cliente
- limite por produto
- limite por pedido
- limite diário
- limite semanal
- limite mensal
- limite por campanha
- limite por período

Exceções:
- excluir vendedor específico
- excluir produto específico
- excluir cliente específico
- excluir dia/horário
- excluir filial ou grupo

Conflitos:
- detectar campanhas sobrepostas
- mostrar conflitos antes de ativar
- definir qual campanha vence
- respeitar prioridade
- respeitar exclusividade
- impedir ativação com conflito crítico sem revisão

================================================================
14. SIMULADOR
================================================================

Antes de ativar a campanha, quero um simulador completo.

O simulador deve aceitar:
- vendedor
- grupo de vendedor
- fornecedor
- produto
- grupo de produto
- quantidade
- valor
- cliente
- período
- pedido
- cenário acumulado
- cenário comparativo, se houver crescimento

O simulador deve retornar:
- participa ou não
- por quê
- já atingiu ou não
- gatilho bateu ou não
- entra no ranking ou não
- em que posição ficaria
- qual base foi usada
- qual valor conta para cálculo
- qual valor conta para pagamento
- qual prêmio seria gerado
- quais itens contaram
- quais itens não contaram
- memória legível do raciocínio

================================================================
15. RESULTADOS DENTRO DO PRÓPRIO MÓDULO
================================================================

O módulo também precisa ter uma área própria de visualização de resultados, sem depender de planilhas paralelas.

Cada campanha deve ter abas ou seções como:

- Resumo Executivo
- Apuração
- Ranking
- Resultado por vendedor
- Resultado analítico por produto
- Conferência da premiação
- Memória de cálculo
- Auditoria
- Exportação

================================================================
16. RESUMO EXECUTIVO
================================================================

Quero uma visão resumida com:

- nome da campanha
- período
- fornecedor
- produtos/grupos envolvidos
- tipo da campanha
- status
- total de vendedores elegíveis
- total de participantes
- total de atingidos
- total de premiados
- valor total apurado
- valor total premiável
- quantidade total vendida
- data/hora da última apuração

Quero isso em cards e indicadores visuais.

================================================================
17. RANKING
================================================================

Quando houver campanha competitiva, quero uma aba de ranking com:

- posição
- vendedor
- grupo
- supervisor, se existir
- valor apurado
- quantidade apurada
- percentual de crescimento, se aplicável
- valor elegível para pagamento
- prêmio calculado
- status final

Também quero:
- filtros
- ordenação
- destaque visual para premiados
- critério de empate
- indicação clara da métrica usada

================================================================
18. RESULTADO POR VENDEDOR
================================================================

Criar visão detalhada por vendedor com:

- vendedor
- grupo
- supervisor
- status na campanha
- elegível ou não
- participou ou não
- atingiu ou não
- gatilho atingido ou não
- posição no ranking, se houver
- valor vendido total
- valor válido para campanha
- valor válido para pagamento
- quantidade total
- quantidade válida
- mix atingido ou não
- prêmio calculado
- prêmio final
- motivo de bloqueio ou desclassificação

================================================================
19. RESULTADO ANALÍTICO POR PRODUTO
================================================================

Quero visão detalhada por produto com:

- produto
- descrição
- fornecedor
- categoria/grupo/linha
- vendedor
- quantidade vendida
- valor vendido
- se contou para participação
- se contou para gatilho
- se contou para ranking
- se contou para pagamento
- se foi desconsiderado
- motivo de desconsideração

================================================================
20. MEMÓRIA DE CÁLCULO
================================================================

Toda campanha precisa ter memória de cálculo legível.

Quero uma área que explique, por vendedor, por que ele:
- participou
- não participou
- atingiu
- não atingiu
- ficou em determinada posição
- recebeu determinado prêmio
- teve itens considerados ou desconsiderados

Exemplo:
- vendedor João vendeu 7 produtos válidos do mix
- atingiu o gatilho em determinada data
- teve venda total geral de R$ X
- teve venda elegível para pagamento de R$ Y
- ficou em 1º lugar em determinado critério
- recebeu prêmio calculado por determinada regra

Sem memória de cálculo, não considerar o módulo concluído.

================================================================
21. CONFERÊNCIA DA PREMIAÇÃO
================================================================

Criar aba específica para conferência final da campanha mostrando:

- quem ganhou
- por qual critério ganhou
- qual base foi usada
- qual fórmula foi aplicada
- qual valor final será pago
- se houve empate
- se houve desempate
- quem ficou de fora e por quê
- total geral a pagar

Essa tela deve servir como base oficial para validação do pagamento.

================================================================
22. RELATÓRIOS
================================================================

Os relatórios precisam ser completos, porque serão a base oficial da premiação.

Quero no mínimo:

1. Relatório geral da campanha
- resumo
- período
- fornecedor
- critérios
- status
- elegíveis
- participantes
- atingidos
- premiados

2. Relatório por vendedor
- vendedor
- grupo
- supervisor
- elegibilidade
- participação
- atingimento
- gatilho
- posição
- valores
- quantidades
- prêmio
- memória resumida

3. Relatório analítico por produto
- produto
- fornecedor
- categoria/grupo/linha
- vendedor
- quantidade
- valor
- se contou para participação
- se contou para ranking
- se contou para pagamento
- motivo de exclusão

4. Relatório de auditoria
- alterações da campanha
- mudanças de regras
- mudanças de prêmio
- mudanças de período
- quem alterou
- quando alterou

5. Relatório de conferência da premiação
- vencedores
- motivo da premiação
- fórmula aplicada
- base usada
- memória de cálculo

================================================================
23. EXPORTAÇÃO
================================================================

A exportação é obrigatória.

Quero exportar:
- Excel
- CSV
- PDF, quando fizer sentido

Quero poder exportar:
1. resumo executivo
2. ranking
3. resultado por vendedor
4. resultado analítico por produto
5. conferência da premiação
6. memória de cálculo
7. auditoria da campanha

No Excel/CSV:
- colunas corretas
- títulos claros
- filtros
- ordem lógica
- dados completos

No PDF:
- cabeçalho com nome da campanha
- período
- critérios
- data/hora da geração
- resumo
- vencedores
- memória resumida
- total da premiação
- layout legível e profissional

Também quero um documento específico de pagamento da campanha com:
- nome da campanha
- período
- premiados
- critério da premiação
- valor apurado
- valor final a pagar
- observações
- data de geração

Criar:
- um modelo financeiro
- um modelo analítico

================================================================
24. APURAÇÃO E REPROCESSAMENTO
================================================================

Quero que o sistema permita:

- apurar campanha
- recalcular campanha
- reprocessar apuração
- registrar quando a apuração foi gerada
- mostrar se o resultado está atualizado
- manter histórico de apurações, quando fizer sentido

Também quero auditoria da apuração e da exportação:
- quem apurou
- quando apurou
- quem recalculou
- quem exportou
- qual relatório exportou
- data/hora da exportação

================================================================
25. VERSIONAMENTO
================================================================

Cada campanha precisa ter:

- versão
- histórico de versões
- usuário que criou a versão
- motivo da revisão
- data/hora

Se a campanha estiver ativa e for alterada:
- não alterar de forma solta
- gerar nova versão
- ou obrigar duplicação controlada
- ou permitir edição apenas em campos não críticos

Escolher a alternativa mais segura.

Também quero:
- comparação entre versões
- possibilidade de restaurar versão anterior quando possível
- histórico íntegro

================================================================
26. BANCO DE DADOS E MODELAGEM
================================================================

Criar modelagem escalável e limpa, preparada para campanhas multi-regra e multi-base.

Sugestão de entidades:
- campaigns
- campaign_versions
- campaign_targets
- campaign_products
- campaign_suppliers
- campaign_sellers
- campaign_customers
- campaign_condition_groups
- campaign_conditions
- campaign_triggers
- campaign_actions
- campaign_rewards
- campaign_limits
- campaign_exceptions
- campaign_conflicts
- campaign_logs
- campaign_simulations
- campaign_execution_history
- campaign_results
- campaign_exports

A modelagem deve suportar:
- múltiplas regras
- múltiplos blocos lógicos
- múltiplas bases
- múltiplos critérios de premiação
- múltiplos vencedores
- relatórios detalhados
- memória de cálculo
- auditoria
- evolução futura

================================================================
27. BACKEND
================================================================

Quero o backend como fonte de verdade da lógica.

Implementar:
- services organizados
- validações fortes
- engine de regras centralizada
- separação clara entre cadastro, simulação, apuração e execução
- tratamento de erro consistente
- mensagens claras
- proteção contra estados inválidos

Não quero:
- regra crítica apenas no frontend
- lógica duplicada
- comportamento oculto
- hardcode para campanhas específicas

================================================================
28. FRONTEND
================================================================

Quero frontend profissional, claro e prático.

Implementar:
- formulários organizados
- filtros
- busca
- seleção múltipla
- construtor visual de regras
- preview da campanha em linguagem natural
- alertas de conflito
- simulador integrado
- visão de resultados
- exportação

A UX deve priorizar:
- clareza
- previsibilidade
- agilidade
- manutenção futura

================================================================
29. SEGURANÇA E PERMISSÕES
================================================================

Implementar controle de acesso por perfil.

Exemplo:
- usuário comum: não cria nem altera campanha
- gestor autorizado: cria, edita e acompanha
- administrador: cria, ativa, pausa, encerra, versiona, revisa conflitos, exporta tudo

Bloquear:
- ativação de campanha inválida
- exclusão física de campanha já usada
- edição crítica sem versionamento
- alteração sem log
- campanha com conflito crítico sem revisão

================================================================
30. PERFORMANCE
================================================================

Esse módulo não pode comprometer a aplicação.

Implementar:
- consultas eficientes
- paginação
- índices
- lazy loading quando fizer sentido
- cache só onde for seguro
- prevenção de processamento desnecessário
- atenção especial na apuração das campanhas ativas

Se houver rotinas pesadas:
- isolar processamento
- não bloquear fluxo principal
- documentar estratégia

================================================================
31. TESTES
================================================================

Quero testes para os cenários críticos.

Cobrir no mínimo:
- criação
- edição
- clonagem
- ativação
- pausa
- encerramento
- versionamento
- conflito entre campanhas
- simulação
- comissão percentual sobre produtos específicos
- mix mínimo + gatilho + prêmio por atingimento
- ranking por crescimento geral com pagamento em linha específica
- campanha por faixa
- campanha com combo
- campanha com exceção
- campanha acumulável
- campanha exclusiva
- limite excedido
- regra inválida
- exportação
- memória de cálculo
- reprocessamento da apuração

================================================================
32. O QUE NÃO ACEITO
================================================================

Não quero:
- módulo apenas visual
- cadastro simples sem motor confiável
- ranking e pagamento presos à mesma base obrigatoriamente
- relatório superficial
- campanha sem memória de cálculo
- necessidade de ajuste no código a cada campanha
- tela bonita mas sem confiabilidade operacional
- conflito silencioso
- baixa rastreabilidade
- exportação pobre
- apuração sem explicação

================================================================
33. RESUMO LEGÍVEL EM LINGUAGEM NATURAL
================================================================

Quero que cada campanha tenha um resumo automático em linguagem natural.

Exemplo:
“Campanha válida de 01/05/2026 a 31/05/2026 para vendedores do grupo X, considerando produtos do fornecedor Y. O vendedor participa ao vender pelo menos 5 itens do mix e atingir o gatilho definido. Todos que cumprirem as condições recebem a premiação configurada. O ranking, quando existir, será calculado pela base definida, e o pagamento será apurado sobre a base específica configurada para a campanha.”

Isso ajuda revisão, conferência e validação.

================================================================
34. ENTREGA ESPERADA
================================================================

Quero que você revise e reestruture o módulo de campanhas já criado para garantir personalização total dentro do app.

Entregue:
1. ajustes de modelagem
2. ajustes de backend
3. ajustes de frontend
4. construtor de regras confiável
5. separação entre participação, gatilho, ranking, cálculo e pagamento
6. simulador forte
7. apuração confiável
8. visualização de resultados no próprio módulo
9. relatórios detalhados
10. memória de cálculo
11. exportação Excel/CSV/PDF
12. documento de pagamento
13. auditoria completa
14. versionamento
15. testes dos cenários críticos
16. revisão ponta a ponta

Antes de concluir, valide obrigatoriamente se o módulo consegue atender, sem gambiarra e sem hardcode, campanhas como:

- comissão de 1% sobre produtos específicos
- mix mínimo + gatilho + prêmio por atingimento
- ranking por crescimento geral com pagamento calculado apenas sobre uma linha específica de produtos
- campanhas com múltiplos critérios de premiação
- campanhas onde todos os atingidos ganham
- campanhas onde apenas os melhores ganham