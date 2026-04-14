# Copiloto de Compras — Backend e Motor

## What & Why
Criar toda a infraestrutura de backend do módulo "Copiloto de Compras": tabelas de banco, motor de sugestão de compra, motor de alertas de estoque e todos os endpoints da API `/api/compras/*`. Esse backend será a fonte de verdade para o módulo, calculando indicadores, sugestões e alertas no servidor, nunca no frontend.

## Done looks like
- Tabelas criadas via schema-bootstrap no padrão existente: `purchase_alerts`, `purchase_alert_events`, `purchase_suggestions`, `purchase_settings`, `user_alert_preferences`, `alert_sound_preferences`, `alert_delivery_state`, `alert_snoozes`, `alert_acknowledgements`
- Motor de sugestão de compra implementado em `server/compras/suggestion-engine.ts`, calculando para cada produto: consumo médio diário, cobertura em dias, ponto de reposição, sugestão de quantidade (considerando estoque atual, pedidos em aberto, lead time, estoque de segurança, lote mínimo, múltiplo de embalagem, período alvo de cobertura), urgência e criticidade
- Motor de alertas de compras implementado em `server/compras/alert-engine.ts`, com deduplicação por hash, cooldown configurável, controle de estado (novo, lido, reconhecido, adiado, silenciado, resolvido, reaberto) e regras: ruptura iminente, abaixo do estoque de segurança, lead time maior que cobertura, fornecedor crítico, excesso de estoque, pedido em aberto insuficiente
- Endpoints implementados e funcionais:
  - `GET /api/compras/dashboard` — KPIs consolidados
  - `GET /api/compras/alertas` — lista de alertas ativos com filtros
  - `GET /api/compras/fornecedores` — ranking de fornecedores com criticidade
  - `GET /api/compras/fornecedores/:id` — detalhe de fornecedor
  - `GET /api/compras/produtos` — ranking de produtos críticos
  - `GET /api/compras/produtos/:id` — detalhe de produto
  - `GET /api/compras/sugestoes` — sugestões consolidadas
  - `GET /api/compras/sugestoes/fornecedor/:id` — sugestões por fornecedor
  - `POST /api/compras/simulacao` — simulação de compra (antes x depois)
  - `GET /api/compras/notificacoes` — notificações do usuário logado
  - `POST /api/compras/notificacoes/:id/read` — marcar como lida
  - `POST /api/compras/notificacoes/silenciar` — silenciar alerta
  - `GET /api/compras/configuracoes` — preferências do usuário atual
  - `PUT /api/compras/configuracoes` — salvar preferências
- Dados buscados da ERP via tabelas cache existentes (`cache_vendas`, `cache_vendas_pendentes`) e qualquer tabela de estoque/produto já disponível; campos inexistentes documentados em comentários no código indicando de onde viriam do ERP
- Módulo registrado em `server/routes.ts` seguindo o padrão existente de `app.use()`
- Tabelas adicionadas em `server/schema-bootstrap.ts` e ao array `REQUIRED_TABLES`

## Out of scope
- Interface frontend (tratada em tarefa separada)
- WebSocket/SSE para tempo real (tratado em tarefa separada)
- Sistema de som (tratado em tarefa separada)

## Tasks
1. **Criar tabelas de banco** — Adicionar as funções bootstrap para as novas tabelas de compras em `server/schema-bootstrap.ts`, seguindo exatamente o padrão existente com `CREATE TABLE IF NOT EXISTS`, índices e `REQUIRED_TABLES`.

2. **Implementar motor de sugestão** — Criar `server/compras/suggestion-engine.ts` com a lógica central de cálculo: consumo médio, cobertura, ponto de reposição, sugestão de quantidade, urgência e criticidade. O motor deve consultar dados das tabelas cache do ERP e documentar campos ausentes.

3. **Implementar motor de alertas de compras** — Criar `server/compras/alert-engine.ts` com avaliação periódica (integrada ao padrão do `alert-engine.ts` existente), geração de alertas com deduplicação por hash, controle de cooldown e gestão de estado dos alertas.

4. **Implementar service layer** — Criar `server/compras/service.ts` com funções para dashboard KPIs, ranking de fornecedores, ranking de produtos, detalhe de fornecedor, detalhe de produto, simulação de compra e consulta de notificações de compras.

5. **Implementar endpoints da API** — Criar `server/compras/routes.ts` com todos os endpoints `/api/compras/*`, protegidos por `isAuthenticated`, usando a service layer, seguindo o padrão do módulo de campanhas.

6. **Registrar módulo** — Importar e montar o router em `server/routes.ts` e inicializar o motor de alertas de compras em `server/index.ts`.

## Relevant files
- `server/schema-bootstrap.ts`
- `server/routes.ts`
- `server/index.ts`
- `server/pg-client.ts`
- `server/auth.ts`
- `server/alert-engine.ts`
- `server/campaigns/routes.ts`
- `server/campaigns/service.ts`
- `shared/schema.ts`
