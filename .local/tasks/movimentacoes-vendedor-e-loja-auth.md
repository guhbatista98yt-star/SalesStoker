# Movimentações por Vendedor e Ajuste Visão em Loja

## What & Why
Adicionar visualização de movimentações de vendas e devoluções por vendedor (usando a query SQL fornecida), com um botão de acesso na página de vendedores. Também remover a segunda camada de login que aparece ao acessar o módulo "Visão em Loja", tornando o acesso direto para quem já está autenticado no sistema.

## Done looks like
- Na página de vendedores (`/vendedores`), cada card de vendedor ou o cabeçalho da página possui um botão "Movimentações" que abre um modal ou painel com a listagem de vendas e devoluções daquele vendedor no período selecionado.
- O modal exibe: data, nome do cliente, empresa, número da nota/cupom, série, valor contábil e lucro. Devoluções aparecem visualmente destacadas (ex: linha em vermelho ou sufixo "-DEV").
- O período do modal segue o seletor de período já existente na página.
- Ao acessar `/analises/visao-em-loja`, não é mais exibido nenhum formulário de login secundário — o acesso é concedido diretamente para qualquer usuário já autenticado (incluindo roles admin e supervisor), ou redirecionado para o login principal se não estiver autenticado.

## Out of scope
- Exportação das movimentações para Excel/PDF.
- Filtros adicionais dentro do modal (ex: filtrar só devoluções ou só vendas).
- Alteração no fluxo de autenticação principal do sistema.

## Tasks
1. **Backend — Endpoint de movimentações** — Criar rota `GET /api/movimentacoes/:vendedorId/:startDate/:endDate` que executa a query SQL de movimentações adaptada (substituindo a data hardcoded e o `idclifor` fixo por parâmetros dinâmicos), retornando os dados agrupados por nota.

2. **Frontend — Botão e modal de movimentações** — Na página de vendedores e/ou no `SalespersonCard`, adicionar um botão "Movimentações" que abre um modal/dialog exibindo a tabela de vendas e devoluções do vendedor selecionado, consumindo o endpoint criado.

3. **Frontend — Remover gate de login da Visão em Loja** — Em `visao-em-loja.tsx`, remover o componente `VisaoLojaLogin` e toda a lógica de verificação de `localStorage` (`visao_loja_auth`). Usuários autenticados no sistema acessam a página diretamente; usuários sem autenticação principal são redirecionados ao login normal.

## Relevant files
- `client/src/pages/vendedores.tsx`
- `client/src/components/dashboard/salesperson-card.tsx`
- `client/src/pages/visao-em-loja.tsx`
- `server/routes.ts`
- `attached_assets/movimentacoes_vendas_devolucoes_1775970502345.sql`
