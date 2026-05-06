# Copiloto de Compras — Dashboard Frontend

## What & Why
Criar o módulo frontend completo do "Copiloto de Compras" integrado à API backend. O objetivo é dar ao comprador uma interface visual, analítica e rápida que funcione como um copiloto digital: bater o olho e saber o que está crítico, o que comprar, quando comprar e o impacto de cada decisão.

## Done looks like
- Nova rota `/compras` acessível para usuários com perfil de compras (Comprador, Supervisor de Compras, Gerente, Admin)
- Link no menu de navegação lateral existente para o módulo
- **Dashboard principal** com:
  - Cards de KPIs no topo: fornecedores críticos, produtos críticos, itens zerados em até 3 dias, em até 7 dias, abaixo do estoque de segurança, excesso de estoque, valor estimado de compra, pedidos sugeridos, pedidos em aberto, fornecedores com maior risco
  - Painel de alertas em tempo real com tipo, produto/fornecedor, criticidade, tempo estimado para ruptura, ação sugerida e botões de ação
  - Ranking de fornecedores com colunas: fornecedor, itens críticos, cobertura média, lead time, valor estimado, criticidade, status visual com badges de cor
  - Ranking de produtos críticos com colunas: código, descrição, fornecedor, estoque atual, cobertura em dias, data estimada de ruptura, sugestão de compra, criticidade
  - Gráficos analíticos via Recharts: cobertura por fornecedor, itens por criticidade, excesso x ruptura, previsão de ruptura por faixa de dias
  - Painel de sugestão consolidada por fornecedor com urgência e valor estimado
  - Drawer/modal de simulação rápida: escolher produto/fornecedor, informar quantidade, ver cobertura antes x depois, nova criticidade e nova data estimada de ruptura
- **Página de detalhe por fornecedor** (`/compras/fornecedores/:id`) com todos os indicadores do fornecedor e tabela completa de produtos
- **Página de detalhe por produto** (`/compras/produtos/:id`) com todos os dados do produto, consumo médio diário/semanal/mensal, histórico resumido e simulação inline
- Cores de criticidade padronizadas: crítico (vermelho), alto (laranja), moderado (amarelo), atenção (azul), normal (verde)
- Totalmente responsivo: cards empilhados no mobile, tabelas convertidas em listas/cards, filtros recolhíveis, simulação adaptada
- Compatível visualmente com o restante do sistema (Tailwind + shadcn/ui + Lucide)
- Usa TanStack Query para buscar dados das API endpoints criados no backend, com auto-refresh configurável

## Out of scope
- Central de notificações e sistema de som (tratados em tarefa separada)
- Backend/API (tratados em tarefa separada)

## Tasks
1. **Estrutura de rotas e navegação** — Adicionar a rota `/compras` ao router do frontend (wouter), criar o link no menu lateral existente com controle de permissão por perfil de usuário.

2. **Componentes de criticidade e badges** — Criar componentes reutilizáveis de criticidade (badge colorido, ícone, indicador visual) usados em todo o módulo.

3. **Dashboard principal — cards de KPIs** — Implementar o topo do dashboard com os cards de indicadores principais buscando de `GET /api/compras/dashboard`.

4. **Painel de alertas** — Implementar o bloco de alertas em tempo real com lista destacada, botões de ação (silenciar, marcar como visto, abrir detalhe), buscando de `GET /api/compras/alertas`.

5. **Rankings de fornecedores e produtos** — Implementar as tabelas de ranking de fornecedores e de produtos críticos com ordenação, filtros rápidos e links para as páginas de detalhe.

6. **Gráficos analíticos** — Implementar os gráficos com Recharts: cobertura por fornecedor, distribuição por criticidade, excesso x ruptura, previsão de ruptura por faixa de dias.

7. **Sugestão consolidada e simulação** — Implementar o painel de sugestão consolidada por fornecedor e o drawer de simulação rápida com campo de quantidade e exibição clara do antes x depois.

8. **Página de detalhe por fornecedor** — Criar a rota `/compras/fornecedores/:id` com indicadores do fornecedor e tabela detalhada de produtos, buscando de `GET /api/compras/fornecedores/:id`.

9. **Página de detalhe por produto** — Criar a rota `/compras/produtos/:id` com todos os campos do produto, consumo, giro, histórico resumido e simulação inline, buscando de `GET /api/compras/produtos/:id`.

10. **Responsividade e polish** — Garantir que cards empilham corretamente no mobile, tabelas se convertem em listas/cards em telas pequenas, filtros ficam recolhíveis e o layout não quebra em nenhum tamanho de tela.

## Relevant files
- `client/src/App.tsx`
- `client/src/components/ui/`
- `client/src/hooks/use-auth.ts`
- `client/src/pages/`
