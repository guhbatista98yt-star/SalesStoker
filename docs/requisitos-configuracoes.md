Quero implementar dentro do módulo de Configurações da aplicação um novo recurso chamado **Campanhas**, com um botão/menu de acesso chamado **Criar Campanhas**.

ATENÇÃO:
Não quero um cadastro simples de campanhas.
Quero um módulo realmente robusto, profissional, escalável e confiável, que permita criar campanhas comerciais altamente personalizadas, mas com regras seguras, previsíveis, auditáveis e fáceis de manter no futuro.

O sistema precisa evitar:
- regras contraditórias
- conflito silencioso entre campanhas
- lógica espalhada no frontend
- processamento imprevisível
- dificuldade de manutenção
- erros futuros por excesso de flexibilidade sem estrutura

A solução precisa ser pensada para uso real em operação, com estabilidade, clareza e crescimento futuro.

====================================================
1. OBJETIVO DO MÓDULO
====================================================

Criar um módulo completo de gestão de campanhas comerciais, acessível a partir de Configurações, para que seja possível:

- criar campanhas novas
- editar campanhas
- clonar campanhas
- salvar campanhas como rascunho
- ativar campanhas
- pausar campanhas
- encerrar campanhas
- versionar campanhas
- simular campanhas antes de ativar
- auditar todas as alterações
- controlar conflitos entre campanhas
- definir prioridades, regras, gatilhos e exceções

Esse módulo deve permitir campanhas personalizadas por:
- fornecedor
- produto
- grupo de produtos
- seção/categoria/subcategoria
- vendedor
- grupo de vendedores
- cliente
- grupo de clientes
- período
- meta
- faixa
- mix
- combo
- progressão
- volume
- faturamento
- múltiplas condições combinadas

====================================================
2. IMPORTANTE: COMO QUERO A ARQUITETURA
====================================================

Não quero liberdade total sem controle.

Quero que o módulo seja dividido em 2 níveis:

NÍVEL 1 — CAMPANHAS PADRÃO
Mais simples e rápidas de cadastrar:
- por fornecedor
- por produto
- por grupo
- por período
- por meta
- por faixa
- por combo
- por quantidade
- por faturamento

NÍVEL 2 — CAMPANHAS AVANÇADAS
Com construtor de regras:
- blocos lógicos
- conectores E / OU / E NÃO / OU NÃO
- grupos aninhados
- gatilhos
- exceções
- prioridades
- conflitos
- ações automáticas

Se perceber que “campanha totalmente livre” aumenta muito a complexidade, implemente com segurança primeiro, sem perder flexibilidade, mas mantendo governança.

====================================================
3. TELA / UX / INTERFACE
====================================================

Quero uma interface profissional, moderna, funcional e clara.
Nada poluído, nada infantil, nada improvisado.

Na tela principal do módulo Campanhas, quero:
- listagem de campanhas
- filtros por status, período, tipo, fornecedor, grupo, criador e prioridade
- campo de busca
- badges visuais por status
- indicadores de conflito
- indicador se a campanha é acumulável ou exclusiva
- botão de criar nova campanha
- botão de clonar campanha
- botão de visualizar detalhes
- botão de editar
- botão de ativar/pausar/encerrar

Na tela de criação/edição, quero a campanha dividida em abas ou blocos:

1. Dados Gerais
2. Público-Alvo
3. Produtos / Fornecedores / Grupos
4. Condições e Regras
5. Gatilhos e Ações
6. Premiação / Resultado
7. Limites / Exceções / Conflitos
8. Simulação
9. Auditoria / Histórico
10. Versionamento

Também quero:
- resumo da campanha em linguagem natural
- preview da regra de forma legível
- alerta visual de inconsistência
- alerta visual de sobreposição com campanha ativa
- validação em tempo real
- experiência fluida sem travamentos

====================================================
4. DADOS GERAIS DA CAMPANHA
====================================================

Cada campanha deve ter no mínimo os seguintes campos:

- id
- código interno único
- nome da campanha
- descrição
- objetivo
- tipo da campanha
- empresa / filial
- status (rascunho, ativa, pausada, encerrada, cancelada)
- prioridade
- acumulável? sim/não
- exclusiva? sim/não
- campanha mãe / origem, se for clonada
- data de criação
- data de atualização
- criado por
- alterado por
- motivo da alteração
- observações internas

Período:
- data inicial
- data final
- hora inicial opcional
- hora final opcional
- dias da semana válidos
- recorrência opcional

====================================================
5. ABRANGÊNCIA / PÚBLICO-ALVO
====================================================

A campanha deve poder ser aplicada de forma segmentada.

Permitir selecionar:
- todos os vendedores
- vendedores específicos
- grupos de vendedores
- supervisor, se existir
- rota/região, se existir
- todos os fornecedores
- fornecedor específico
- produtos específicos
- grupo de produtos
- seção
- categoria
- subcategoria
- marca
- cliente específico
- grupo de clientes
- canal de venda, se existir

A tela precisa permitir:
- busca rápida
- multiseleção
- filtros
- exclusões pontuais
- lógica de inclusão e exclusão

Exemplo:
- campanha válida para grupo X, exceto vendedor Y
- campanha válida para fornecedor A, exceto produto B

====================================================
6. MOTOR DE REGRAS
====================================================

Esse é o coração do módulo.

Quero um motor de regras confiável, centralizado no backend, sem depender de lógica sensível no frontend.

Permitir criar condições como:

- fornecedor = X
- produto = Y
- grupo de produto = Z
- vendedor pertence ao grupo A
- quantidade >= N
- valor vendido >= N
- quantidade entre X e Y
- valor entre X e Y
- mix mínimo atingido
- combo completo atingido
- meta mínima atingida
- primeira venda do período
- venda acumulada no período >= X
- desconto <= X
- margem >= X
- venda em múltiplos de embalagem
- campanha válida apenas em dias específicos
- campanha válida apenas em horário específico
- cliente pertence ao grupo X
- filial = X
- rota = X
- canal = X

Conectores:
- E
- OU
- E NÃO
- OU NÃO

Permitir:
- blocos agrupados
- regras aninhadas
- prioridade entre blocos
- regra obrigatória
- regra opcional complementar
- exceções

Quero que o backend valide:
- sintaxe lógica
- coerência das regras
- ausência de ciclos ou contradições
- conflitos com outras campanhas ativas
- estrutura mínima obrigatória

====================================================
7. GATILHOS E AÇÕES
====================================================

Permitir gatilhos automáticos, como:

- ao atingir quantidade X
- ao atingir valor X
- ao vender produto Y
- ao bater meta parcial
- ao bater meta total
- ao fechar combo
- ao passar de faixa
- ao iniciar o período
- ao encerrar o período
- ao ocorrer combinação específica de condições

Permitir ações como:
- liberar premiação
- aplicar nova faixa
- atualizar ranking
- registrar ocorrência
- gerar log
- enviar notificação interna
- marcar campanha como atingida
- travar excesso
- aplicar exceção
- desconsiderar acúmulo
- encadear regra complementar

====================================================
8. PREMIAÇÃO / RESULTADO
====================================================

Quero múltiplos tipos de premiação.

Permitir:
- valor fixo
- percentual
- pontos
- ranking
- bônus por faixa
- progressão
- bônus por volume
- bônus por meta atingida
- bônus por fornecedor
- bônus por produto
- bônus por combo
- premiação individual
- premiação coletiva

Também permitir:
- faixas progressivas
- escalonamento
- pesos diferentes por item
- regra de desempate
- arredondamento
- corte mínimo
- teto máximo de bonificação

====================================================
9. LIMITES, EXCEÇÕES E CONFLITOS
====================================================

Preciso de controle fino.

Permitir:
- limite máximo por vendedor
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
- excluir dias/horários
- excluir filial ou grupo

Conflitos:
- detectar campanhas que atingem o mesmo cenário
- mostrar conflito antes de ativar
- definir qual regra vence
- permitir prioridade manual
- permitir exclusividade
- impedir ativação se houver conflito crítico

====================================================
10. SIMULADOR
====================================================

Antes de ativar qualquer campanha, quero um simulador completo.

A simulação deve aceitar:
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

O simulador deve retornar:
- se a campanha aplicaria ou não
- quais condições foram atendidas
- quais condições falharam
- qual regra foi usada
- qual prioridade foi aplicada
- se houve conflito
- se a campanha é bloqueada por limite/exceção
- qual premiação seria gerada
- explicação detalhada do porquê

Quero isso de forma legível e auditável.

====================================================
11. AUDITORIA E HISTÓRICO
====================================================

Tudo precisa ser auditável.

Registrar:
- usuário
- data/hora
- ação executada
- valores anteriores
- valores novos
- motivo da alteração
- status anterior
- status novo
- versão gerada

Auditar ações como:
- criação
- edição
- ativação
- pausa
- encerramento
- cancelamento
- clonagem
- alteração de prioridade
- alteração de regra
- alteração de premiação
- alteração de público

Não permitir mudança importante sem rastreabilidade.

====================================================
12. VERSIONAMENTO
====================================================

A campanha precisa ser versionada.

Cada campanha deve ter:
- versão
- histórico de versões
- usuário que criou a versão
- motivo da revisão
- data/hora

Se campanha ativa for alterada:
- não alterar de forma solta
- gerar nova versão, ou
- obrigar duplicação controlada, ou
- permitir edição apenas de campos não críticos

Escolher a alternativa mais segura e estável.

Também quero:
- comparar versões
- restaurar versão anterior quando possível
- manter histórico íntegro

====================================================
13. BANCO DE DADOS / MODELAGEM
====================================================

Quero uma modelagem limpa, escalável e preparada para crescimento.

Criar estrutura adequada para entidades como:
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

Requisitos:
- relacionamentos bem definidos
- índices adequados
- integridade referencial
- suporte a múltiplas regras e blocos
- suporte a múltiplos alvos
- suporte a auditoria e histórico
- suporte a expansão futura

====================================================
14. BACKEND
====================================================

Quero o backend como fonte de verdade das regras.

Implementar:
- validação forte
- services organizados
- separação clara entre cadastro, validação, simulação e execução
- engine de regras centralizada
- tratamento de erro consistente
- mensagens claras
- proteção contra estados inválidos

Não quero:
- regra importante decidida só no frontend
- lógica duplicada
- comportamento oculto
- acoplamento desnecessário

====================================================
15. FRONTEND
====================================================

Quero um frontend bem feito, mas sem empurrar lógica crítica para o cliente.

Implementar:
- formulários organizados
- validações de usabilidade
- filtros
- busca
- seleção múltipla
- resumo visual
- construtor visual de regras
- alertas de conflito
- preview da campanha
- simulador integrado
- histórico visual

A UX deve priorizar:
- clareza
- velocidade
- previsibilidade
- facilidade de manutenção

====================================================
16. PERFORMANCE
====================================================

Esse módulo não pode comprometer a aplicação.

Implementar:
- carregamento otimizado
- consultas eficientes
- paginação
- índices
- lazy loading onde fizer sentido
- cache apenas onde for seguro
- prevenção de processamento desnecessário
- atenção especial ao cálculo de campanhas ativas

Se houver rotinas pesadas:
- isolar processamento
- evitar bloquear fluxo principal
- documentar estratégia

====================================================
17. SEGURANÇA E PERMISSÕES
====================================================

Implementar controle de acesso por perfil.

Exemplo:
- usuário comum: não cria nem altera campanha
- gestor autorizado: cria e edita
- administrador: cria, ativa, pausa, encerra, versiona, revisa conflitos

Bloquear:
- ativação de campanha inválida
- exclusão física de campanha já utilizada
- edição crítica sem versionamento
- mudança sem log

====================================================
18. REGRAS OPERACIONAIS IMPORTANTES
====================================================

Quero regras para evitar bagunça no futuro:

- campanha não pode ser ativada sem validação completa
- campanha com conflito relevante deve exigir revisão
- campanha ativa não pode ser alterada livremente
- campanha encerrada não deve voltar sem regra segura
- campanha cancelada deve manter histórico
- campanhas equivalentes precisam de prioridade clara
- campanhas acumuláveis precisam ser tratadas sem duplicidade indevida

====================================================
19. TESTES
====================================================

Quero testes para os cenários críticos.

Cobrir no mínimo:
- criação de campanha
- edição
- ativação
- pausa
- encerramento
- versionamento
- conflito entre campanhas
- simulação
- premiação por faixa
- campanha com combo
- campanha com exceção
- campanha acumulável
- campanha exclusiva
- limite excedido
- regra inválida
- prioridade entre campanhas

====================================================
20. ENTREGA ESPERADA
====================================================

Quero que você:

1. Analise a arquitetura atual da aplicação
2. Crie esse módulo de forma compatível com a estrutura atual
3. Modele banco, backend e frontend corretamente
4. Crie o construtor visual de regras
5. Crie o simulador
6. Crie auditoria
7. Crie versionamento
8. Crie tratamento de conflitos
9. Crie controle de permissões
10. Garanta performance
11. Garanta previsibilidade
12. Documente a lógica
13. Gere testes
14. Revise tudo ponta a ponta antes de considerar concluído

====================================================
21. O QUE EU QUERO EVITAR
====================================================

Evitar a solução superficial.

Não quero:
- módulo apenas visual sem motor confiável
- regra hardcoded
- cadastro bonito mas sem consistência
- flexibilidade sem governança
- campanhas com resultado imprevisível
- conflito silencioso
- baixa rastreabilidade
- lógica confusa para manutenção futura

====================================================
22. DIFERENCIAL IMPORTANTE
====================================================

Quero também um resumo legível em linguagem natural para cada campanha.

Exemplo:
“Campanha válida de 01/05/2026 a 31/05/2026 para vendedores do grupo X, considerando produtos do fornecedor Y. Ao atingir 500 unidades vendidas no período, aplica bonificação de 2%, sem acúmulo com campanhas da mesma categoria.”

Isso ajuda revisão, conferência e validação operacional.

====================================================
23. DECISÃO TÉCNICA IMPORTANTE
====================================================

Se você identificar que alguma parte dessa flexibilidade pode gerar complexidade excessiva, comportamento ambíguo ou risco operacional, quero que implemente da forma mais segura e sustentável, preservando flexibilidade com controle.

Prioridade máxima:
- estabilidade
- clareza
- auditabilidade
- segurança
- performance
- evolução futura

Antes de finalizar, faça uma revisão crítica ponta a ponta e elimine:
- inconsistências lógicas
- gargalos
- falhas de UX
- conflitos de regra
- brechas de segurança
- comportamentos imprevisíveis
- riscos de manutenção