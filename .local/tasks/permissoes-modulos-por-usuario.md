# Permissões de Módulos por Usuário

## What & Why
Adicionar uma nova seção "Permissões" em Configurações que permite ao administrador bloquear ou liberar a visualização de cada módulo do sistema individualmente por usuário. O objetivo é dar controle granular ao admin sobre o que cada perfil de usuário consegue acessar na interface.

## Done looks like
- Em Configurações há uma nova aba/seção chamada "Permissões" (ou "Acesso aos Módulos")
- A seção exibe a lista de usuários cadastrados com seus nomes e papéis
- Para cada usuário é possível ver e alternar (toggle on/off) o acesso a cada módulo: Dashboard, Vendedores, Metas, Alertas, Visão Semanal, Visão Mensal, Visão em Loja, Campanhas
- As alterações são salvas no banco de dados e persistem entre sessões
- O menu lateral (sidebar) de cada usuário reflete em tempo real quais módulos ele tem permissão de ver — módulos bloqueados não aparecem na navegação
- O admin e o sistema de papéis (roles) existente não são afetados — as permissões de módulo são uma camada adicional em cima do controle de papel atual

## Out of scope
- Criação ou exclusão de usuários nesta tela (já existe em outro fluxo)
- Permissões a nível de ação/botão (apenas visibilidade de módulo)
- Histórico de alterações de permissão

## Tasks
1. **Modelo de dados para permissões de módulo** — Adicionar uma coluna `modulePermissions` (JSON) à tabela `users` existente para armazenar um objeto com os módulos habilitados/desabilitados por usuário. Incluir migração para adicionar a coluna sem quebrar dados existentes.

2. **Endpoints de API para permissões** — Criar endpoint `GET /api/users` para listar todos os usuários (nome, papel, permissões) e `PATCH /api/users/:id/permissions` para atualizar as permissões de módulo de um usuário. Somente usuários com papel `admin` podem acessar esses endpoints.

3. **Seção "Permissões" em Configurações** — Adicionar a nova seção ao `NAV_ITEMS` da página de configurações. A seção deve listar os usuários com cards expansíveis mostrando toggles para cada módulo (Dashboard, Vendedores, Metas, Alertas, Visão Semanal, Visão Mensal, Visão em Loja, Campanhas). Salvar alterações imediatamente ao clicar no toggle.

4. **Sidebar respeita permissões de módulo** — Ao carregar o sidebar, buscar as permissões do usuário logado (disponíveis no token/contexto de auth) e renderizar somente os itens de navegação que estão habilitados. Módulos bloqueados ficam invisíveis para o usuário.

## Relevant files
- `shared/models/auth.ts`
- `server/auth.ts`
- `client/src/components/app-sidebar.tsx`
- `client/src/pages/configuracoes.tsx`
- `client/src/hooks/use-auth.ts`
