# Módulo Alertas Funcional com Notificações Sonoras

## What & Why
O módulo de Alertas existe na interface mas não funciona de verdade: faltam endpoints de API, não há motor que avalie os dados e dispare alertas, e as configurações são perdidas ao reiniciar o servidor. O objetivo é tornar o módulo plenamente funcional e adicionar sinais sonoros para que o supervisor possa acompanhar alertas em tempo real.

## Done looks like
- As configurações de alertas (ativar/desativar regras como "Queda YoY", "Ticket Médio Baixo", etc.) são salvas no banco de dados e persistem entre reinicializações.
- Os endpoints `GET /api/alert-configs`, `PATCH /api/alert-configs/:id` e `POST /api/alerts/:id/read` existem e funcionam corretamente.
- Um motor de avaliação roda periodicamente (ex: a cada 5-15 minutos) consultando os dados de vendas reais e gerando notificações de alerta quando as regras configuradas são violadas.
- Na aba "Notificações" do módulo Alertas, as notificações disparadas aparecem com data/hora, descrição e status (lida/não lida).
- Quando um novo alerta é gerado, um sinal sonoro é reproduzido na interface do supervisor (e em qualquer sessão aberta do módulo Alertas), podendo ser ativado/desativado pelo usuário.
- O `AlertsPanel` no dashboard principal exibe os alertas ativos em tempo real (via polling ou atualização automática).

## Out of scope
- Notificações push para dispositivos móveis ou e-mail.
- Criação de regras de alerta personalizadas pelo usuário (o botão "Nova Regra" permanece como melhoria futura).
- Integração com sistemas externos de monitoramento.

## Tasks
1. **Backend — Persistência das configurações** — Migrar o armazenamento de `alertConfigs` da memória para o banco de dados SQLite, implementando os métodos de leitura e atualização em `SqliteStorage`. Garantir que as configs sejam populadas via seed inicial se a tabela estiver vazia.

2. **Backend — Endpoints faltantes** — Criar as rotas `GET /api/alert-configs`, `PATCH /api/alert-configs/:id` e `POST /api/alerts/:id/read` em `server/routes.ts`, conectadas ao storage persistente.

3. **Backend — Motor de avaliação de alertas** — Implementar um job periódico (setInterval ou similar) no servidor que consulta os dados de vendas reais, avalia cada regra de alerta ativa (ex: comparar vendas do dia com meta, verificar ticket médio, identificar quedas) e persiste notificações no banco quando as condições são atingidas. Evitar duplicar alertas já notificados no mesmo período.

4. **Frontend — Polling e exibição em tempo real** — Configurar a página `alertas.tsx` e o `AlertsPanel` para fazer polling periódico (ex: a cada 60 segundos) buscando novos alertas, exibindo-os atualizados sem necessidade de recarregar a página.

5. **Frontend — Sinal sonoro** — Ao detectar um novo alerta não lido (comparando a lista anterior com a nova durante o polling), reproduzir um som de notificação usando a Web Audio API ou um arquivo de áudio. Adicionar um botão na interface para ativar/desativar o som, com preferência salva em `localStorage`.

## Relevant files
- `client/src/pages/alertas.tsx`
- `client/src/components/dashboard/alerts-panel.tsx`
- `client/src/pages/dashboard.tsx`
- `server/routes.ts`
- `server/storage.ts`
- `shared/schema.ts`
- `scripts/database-schema.sql`
