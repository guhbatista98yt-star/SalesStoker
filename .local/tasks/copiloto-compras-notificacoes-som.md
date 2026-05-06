# Copiloto de Compras — Notificações e Som

## What & Why
Implementar o sistema profissional de notificações em tempo real e avisos sonoros para o módulo de Copiloto de Compras. O objetivo é alertar o comprador rapidamente sobre situações críticas sem gerar poluição visual ou sonora, com controle total por usuário e configuração global administrativa.

## Done looks like
- **Tempo real via SSE (Server-Sent Events)** — endpoint `GET /api/compras/sse` que mantém conexão aberta e envia eventos de alerta em tempo real para usuários com perfil de compras, sem polling pesado
- **Central de notificações** — ícone com badge de contagem não lida no header do sistema, drawer/painel lateral com lista de alertas recentes, filtros por criticidade/tipo/status, marcar como lido, marcar todos como lidos, silenciar, abrir detalhe do item/fornecedor diretamente
- **Sistema de som** — reprodução de áudio no navegador ao chegar alerta novo, com dois sons distintos (crítico e importante), fallback silencioso se o navegador bloquear, fila de reprodução com debounce para não tocar múltiplos sons simultaneamente
- **Anti-spam e deduplicação** — o backend só gera novo alerta se houve mudança real de estado ou piora de criticidade; cooldown configurável por produto/fornecedor; deduplicação por chave composta (tipo + referência + faixa de criticidade); alertas equivalentes são atualizados em vez de recriados
- **Preferências por usuário** — tela de configuração acessível pelo usuário de compras: ativar/desativar notificações, ativar/desativar som, limitar som apenas a alertas críticos, silenciar temporariamente (15min, 1h, 4h, até amanhã), salvo em `user_alert_preferences`
- **Configuração global administrativa** — tela admin para: habilitar/desabilitar sistema de alertas, definir cooldown padrão, criticidade mínima para tocar som, janela de repetição, política de agrupamento, tempo de expiração e retenção de histórico; salvo em `purchase_settings`
- **Estados de alerta gerenciados** — novo, não lido, lido, reconhecido, adiado, silenciado, resolvido, reaberto; o badge conta apenas não lidos; o som toca apenas para eventos novos relevantes, não a cada refresh
- **Responsivo no mobile** — badge visível, central acessível, interação simples, som respeitando preferências sem quebrar layout
- **Logs de auditoria** — registrar alerta criado, atualizado, resolvido, lido, silenciado, adiado e regra que originou o alerta

## Out of scope
- Dashboard visual principal (tratado em tarefa de frontend)
- Motor de sugestão e endpoints da API core (tratados em tarefa de backend)
- Push notifications nativas do sistema operacional (somente notificações in-app)

## Tasks
1. **Endpoint SSE** — Criar `GET /api/compras/sse` que mantém conexão SSE autenticada, envia eventos de novos alertas e faz cleanup ao desconectar. Gerenciar mapa de clientes SSE no servidor para broadcast.

2. **Hook de tempo real no frontend** — Criar hook React que conecta ao endpoint SSE, recebe eventos e atualiza o estado de alertas e badge de contagem sem recarregar a página.

3. **Central de notificações** — Implementar ícone com badge no header, drawer com lista de alertas com filtros, ações (marcar lido, silenciar, abrir detalhe) e botão "marcar todos como lidos".

4. **Sistema de som** — Implementar `client/src/lib/purchase-sounds.ts` com fila de reprodução, debounce, dois arquivos de áudio distintos por criticidade, controle de volume, fallback silencioso e respeito às preferências do usuário salvas.

5. **Anti-spam no backend** — Implementar lógica de cooldown, chave de deduplicação e controle de estado no motor de alertas para garantir que um mesmo alerta não seja recriado sem mudança real; integrar com a tabela `alert_delivery_state`.

6. **Tela de preferências do usuário** — Criar seção de configuração de alertas de compras acessível pelo próprio usuário: notificações, som, modo apenas crítico, silenciar temporariamente.

7. **Configuração global administrativa** — Criar tela admin para parâmetros globais do sistema de alertas, salvos em `purchase_settings` via `GET/PUT /api/compras/configuracoes`.

8. **Logs de auditoria de alertas** — Garantir registro de eventos relevantes (criação, leitura, silêncio, resolução) em `purchase_alert_events` para rastreabilidade.

## Relevant files
- `server/alert-engine.ts`
- `server/compras/alert-engine.ts`
- `server/compras/routes.ts`
- `server/schema-bootstrap.ts`
- `client/src/App.tsx`
- `client/src/hooks/use-auth.ts`
