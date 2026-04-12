# Sales Analytics Dashboard

## Overview

A multi-tenant executive sales dashboard application designed for Sales Supervisors and Management/Directors. The platform provides real-time sales analytics, KPI tracking, salesperson rankings, product mix analysis, and goals tracking. Built as a responsive web application with a BI-tool-inspired visual style (similar to Metabase/PowerBI), focusing on clarity and ease of data manipulation.

The application uses in-memory storage with realistic demo data (3 companies, 12 salespersons, 10 products) and SQLite for user authentication. Interface is in Portuguese (Brazilian) with currency formatting in Brazilian Real (R$). Designed for local server deployment with data populated from external DB2 API.

## Current Status

**MVP Complete** - All core features implemented and tested:
- Dashboard with 3 KPI cards: Vendas Semanal, Vendas Mensal, A Faturar Total
- "A Faturar por Vendedor" component showing individual salesperson invoice totals
- "Todas empresas" option for aggregated view across all companies
- Multi-tenant company selection
- Period selection with "closed weeks" mode (calendar logic for Sunday-Saturday weeks)
- Dark/light theme toggle
- Replit Auth integration for user authentication
- Individual value-based goals per salesperson (R$) with weekly and monthly targets
- Configuration page with tabbed interface for setting weekly/monthly value goals
- All pages functional: Dashboard, Vendedores, Metas, Alertas, Configurações, Visão Semanal, Visão Mensal

## Recent Changes (April 2026 — Copiloto de Compras: Notificações e Som)

- **5 novas tabelas PostgreSQL**: `purchase_alerts`, `purchase_alert_events`, `user_alert_preferences`, `alert_delivery_state`, `purchase_settings`. Schema 100% idempotente via `schema-bootstrap.ts`.
- **SSE endpoint** `GET /api/compras/sse` — Conexão persistente com autenticação via query param (`?token=`), já que `EventSource` não suporta headers customizados. Broadcast de alertas em tempo real por usuário via mapa SSE em memória (`server/compras/sse-manager.ts`).
- **Compras router** (`server/compras/routes.ts`) — CRUD completo: `GET /api/compras/alertas`, `PATCH /api/compras/alertas/:id/status`, `POST /api/compras/alertas/marcar-todos-lidos`, `GET/PUT /api/compras/preferencias`, `GET/PUT /api/compras/configuracoes`, `GET /api/compras/alertas/:id/eventos`.
- **Purchase Alert Engine** (`server/compras/alert-engine.ts`) — Motor com anti-spam (cooldown), deduplicação por chave composta (tipo+referência+faixa), gestão de estados, limpeza de alertas expirados, broadcast SSE ao criar/atualizar.
- **Hook React** `use-purchase-alerts.ts` — Conecta ao SSE, atualiza badge de contagem, dispara som ao receber alert, invalida cache do react-query, gerencia preferências do usuário.
- **Sistema de som** (`client/src/lib/purchase-sounds.ts`) — Geração de áudio via Web Audio API (sem arquivos externos), dois sons distintos (crítico: triple-beep square wave; importante: double-beep sine), fila com debounce 300ms, fallback silencioso, respeita preferências do usuário.
- **Central de notificações** (`purchase-notification-center.tsx`) — Sheet drawer no header com badge de contagem não lida, filtros por criticidade/status, ações por alerta (marcar lido, resolver, silenciar), botão "marcar todos como lidos", controle de som e silêncio temporário por duração.
- **Preferências do usuário** (`purchase-alert-preferences.tsx`) — Card de configuração: ativar/desativar notificações, som, modo apenas crítico, silenciar temporariamente (15min/1h/4h/até amanhã).
- **Configuração administrativa** (`purchase-alert-admin-settings.tsx`) — Card admin: habilitar sistema, cooldown, criticidade mínima para som, janela de repetição, política de agrupamento, expiração, retenção.
- **Configurações** — Nova aba "Alertas de Compras" na página `/configuracoes` com preferências do usuário + painel admin.
- **Header** — Bell icon substituído pelo `PurchaseNotificationCenter` com badge vermelho de contagem não lida.

## Recent Changes (April 2026 — Copiloto de Compras)

- **Módulo Copiloto de Compras** — Nova rota `/compras` com dashboard completo e páginas de detalhe por fornecedor (`/compras/fornecedores/:id`) e produto (`/compras/produtos/:id`).
- **KPIs do Dashboard**: 10 cards — fornecedores críticos, produtos críticos, itens zerados em 3/7 dias, abaixo do estoque de segurança, excesso, valor estimado, pedidos sugeridos, pedidos em aberto, fornecedores de maior risco.
- **Alertas em tempo real**: painel com tipo, produto/fornecedor, criticidade, tempo estimado para ruptura, ação sugerida e botões de ação (ver, silenciar).
- **Rankings**: tabelas de fornecedores e produtos críticos com filtros, ordenação e links para páginas de detalhe. Versão mobile em cards.
- **Gráficos Recharts**: cobertura por fornecedor (BarChart), distribuição por criticidade (PieChart), previsão de ruptura por faixa de dias (BarChart).
- **Sugestão consolidada por fornecedor** com urgência e valor estimado.
- **Drawer de simulação rápida**: selecionar produto/fornecedor, informar quantidade, ver cobertura antes × depois, nova criticidade.
- **Página de detalhe por fornecedor**: indicadores, gráfico de cobertura por produto, tabela de produtos.
- **Página de detalhe por produto**: estoque, cobertura, consumo médio (diário/semanal/mensal), histórico de consumo (BarChart), simulação inline.
- **Componentes de criticidade reutilizáveis**: `CriticidadeBadge` e `CriticidadeDot` com paleta padronizada (crítico=vermelho, alto=laranja, moderado=amarelo, atenção=azul, normal=verde).
- **Sidebar**: novo grupo "Compras" com item "Copiloto de Compras" (ShoppingCart icon), visível para todos os roles exceto loja e vendedor.
- **Command palette**: item "Copiloto de Compras" adicionado ao menu de busca admin.
- **DEFAULT_MODULE_PERMISSIONS**: adicionado `Compras: true`.
- **Dados**: API hooks com fallback para mock data (enquanto backend não implementado), com auto-refresh configurável via TanStack Query.
- **Responsividade**: cards de KPI empilhados em 2 colunas no mobile, tabelas convertidas em cards, drawers adaptativos.


## Recent Changes (April 2026 — IAM Module: Usuários & Permissões)

- **Módulo Usuários & Permissões** — Nova página `/usuarios` (admin-only) com 4 abas: Usuários, Perfis, Permissões, Auditoria. Acesso via sidebar e command palette.
- **Schema — 3 novas tabelas**: `roles` (perfis de acesso com seed dos 7 perfis padrão: admin, supervisor, gerente, vendedor, loja, financeiro, marketing), `role_permissions` (permissões granulares por módulo × ação × escopo), `access_audit` (auditoria de todas as operações de acesso).
- **Schema — 10 novas colunas em `users`**: `display_name`, `vendor_code`, `phone`, `cargo`, `company_id`, `supervisor_id`, `status` (ativo/inativo/bloqueado), `last_login_at`, `notes`, `created_by`.
- **Backend `/api/admin/*`**: CRUD completo de usuários, CRUD de perfis, gestão de matriz de permissões (módulo × ação × escopo), log de auditoria. Todas as rotas com `isAuthenticated + isAdmin`.
- **Auth hardened**: Login agora verifica `status` do usuário (bloqueado/inativo recebem 403). `last_login_at` atualizado a cada login bem-sucedido. Falhas de acesso registradas em `access_audit`.
- **Sidebar**: Novo item "Usuários" (ShieldCheck icon) no footer admin, entre Campanhas e Configurações.
- **Permissões granulares**: 11 módulos × 7 ações × 4 escopos (own/team/loja/all). Matriz salva por perfil. Interface de checkbox com escopo por linha.
- **Auditoria completa**: Toda criação/edição/bloqueio/redefinição de senha/alteração de permissão grava `actor_id`, `actor_email`, `target_id`, `target_email`, `action`, `before_val`, `after_val`, `ip`, `created_at`.

## Recent Changes (April 2026 — Data Layer Audit & Hardening)

- **Schema Bootstrap (`server/schema-bootstrap.ts`)** — Single source of truth for ALL PostgreSQL structure. Runs idempotently on every startup. Creates 25 tables (application, campaigns, commissions, sync-control, ERP cache) with indexes and constraints. Validates that every required table exists before the app accepts requests.
- **`pg-client.ts` hardened** — Pool settings for production: `max=10`, `connectionTimeoutMillis=8000`, `idleTimeoutMillis=30000`. New `pgTransaction()` helper: BEGIN → fn → COMMIT, auto-rollback on error, guaranteed client release.
- **Sync control tables** — `sync_state` (watermark per routine), `sync_logs` (append-only audit of every sync run), `job_locks` (advisory lock to prevent concurrent executions).
- **Cache table indexes** — `cache_vendas`: composite indexes on `(DT_MOVIMENTO, IDEMPRESA)`, `(IDVENDEDOR, DT_MOVIMENTO)`, `IDEMPRESA`. `cache_campanhas`: `(DTMOVIMENTO)`, `(IDVENDEDOR, DTMOVIMENTO)`, `(FABRICANTE, DTMOVIMENTO)`, `(IDPRODUTO, DTMOVIMENTO)`. `cache_tubos_conexoes` and `cache_vendas_pendentes` indexed too.
- **`commissions/init.ts` simplified** — Table creation delegated to bootstrap; only seeds default rules.
- **`campaigns/init.ts` simplified** — Column migrations delegated to bootstrap; file kept as no-op.
- **Python ERP sync reference (`sync/erp_sync.py`)** — Complete, production-ready reference implementation of DB2→PostgreSQL sync with: incremental watermark strategy, `WITH UR` (uncommitted read) on all DB2 queries, DB2 connection closed BEFORE PostgreSQL write, named-column SELECT (no SELECT *), batch streaming with `execute_values`, job lock, sync log, watermark updated only after full success, history purge, off-hours schedule guidance.

## Recent Changes (April 2026 — Feature Session)

- **Dashboard padrão: semana atual** — Período inicial do dashboard alterado de "Mês Atual" para "Semana Atual" (usa `getCurrentWeekPeriod()`); label do toggle atualizado de "Mês Atual" → "Semana Atual"
- **Filtro de Equipe no Dashboard** — Novo componente `GroupSelector` no header do dashboard (visível para admin e supervisor); seletor oculto quando não há equipes cadastradas; ao selecionar uma equipe, todos os dados do dashboard (KPIs, rankings, metas, mix, evolução, a faturar) são filtrados para os membros da equipe; backend: novo endpoint `GET /api/vendor-groups` (isAuthenticated), helper `resolveGroupTeamMembers()` que mapeia IDVENDEDOR → NOME_VENDEDOR, e suporte a `?groupId=xxx` em 6 rotas do dashboard
- **"+X outros" expandível** — `AFaturarVendedores` e `GoalsCard`: o texto "+X outros vendedores/metas" virou botão clicável com ícone ChevronDown/Up; ao clicar expande para mostrar todos os itens com opção "Mostrar menos"
- **Metas page — estado de erro** — Adicionado `isError` branch (antes: silenciosa, mostrava estado vazio em caso de falha de API)
- **Indexes cache_campanhas** — Criados 5 índices: DTMOVIMENTO, FABRICANTE, (DTMOVIMENTO, IDVENDEDOR), (DTMOVIMENTO, FABRICANTE), IDPRODUTO; adicionados ao schema SQL

## Recent Changes

- **Premium UI Redesign (April 2026)**: Complete visual overhaul inspired by Model 1 (Shopeers) premium SaaS aesthetic:
  - **Design System (index.css)**: New CSS tokens — refined off-white background (`210 22% 96%`), vivid blue primary (`217 93% 52%`), premium shadow scale (shadow-card, shadow-panel, shadow-modal), border-radius tokens (lg=14px, xl=18px, 2xl=22px), skeleton shimmer animations, fade-up/count-up transitions, consistent color palette for semantic states
  - **Tailwind Config**: Updated `borderRadius` (lg=14px, xl=18px, 2xl=22px, 3xl=28px), new `boxShadow` utilities (card, card-hover, panel, modal) for precise elevation system
  - **Card Component**: Uses new `shadow-card` with hover transition; `rounded-xl` (18px), refined `border-card-border`
  - **Sidebar (app-sidebar.tsx)**: Complete redesign — blue rounded logo icon, `CONECTUBOS` brand text + subtitle, grouped navigation with uppercase labels, clean item height (h-9), shadcn `isActive` state for accent highlight, footer section with Campanhas + Configurações for admin
  - **Topbar (App.tsx)**: Replaced plain header with premium `TopHeader` — dropdown user menu with avatar initials, display name, email, change password, logout with red styling; `ThemeToggle` integrated; compact h-14 design with `bg-card/80 backdrop-blur`
  - **Mobile Bottom Nav**: New `MobileBottomNav` component (md:hidden) with 5-item bottom bar (Dashboard, Vendedores, Metas, Análises, Alertas) with active blue indicator; safe-area padding for iOS
  - **KPI Card (kpi-card.tsx)**: Full redesign — trend badge with colored pill background (emerald/red/muted), skeleton loading with shimmer, icon in rounded container, `animate-count-up` on values, `animate-fade-in` on mount, `shadow-card hover:shadow-card-hover`
  - **Dashboard Header**: Simplified to clean h-14 sticky bar with title, refresh icon button, CompanySelector, and period toggle button

- **Campaigns Module**: Full commercial campaign management system at `/campanhas`:
  - Database: `campaigns`, `campaign_versions`, `campaign_audit_logs`, `campaign_simulations` tables (SQLite, JSON columns for flexible rule storage)
  - Backend engine: `server/campaigns/engine.ts` evaluates condition trees server-side (never client-side); supports nested AND/OR groups, all condition types, reward tiers
  - Service: `server/campaigns/service.ts` handles CRUD, status machine, versioning (snapshot on edits to active campaigns), conflict detection, audit trail, simulation, clone, restore
  - API routes: `GET/POST /api/campaigns`, `GET/PUT /api/campaigns/:id`, `POST /:id/status`, `POST /:id/clone`, `GET /:id/validate`, `GET /:id/conflicts`, `POST /:id/simulate`, `GET /:id/audit`, `GET /:id/versions`, `POST /:id/restore/:version`
  - Frontend: `/campanhas` list with stats/filter/cards, `/campanhas/nova` create, `/campanhas/:id` view/edit, multi-tab form (8 tabs: Dados Gerais, Público-Alvo, Condições, Premiação, Limites, Gatilhos, Simulação, Auditoria)
  - Visual rule builder with nested AND/OR groups, reward form with tiers, simulator, audit log timeline
  - Status machine: rascunho → ativa → pausada/encerrada → cancelada
  - Natural language summary auto-generated on save
  - Sidebar: new "Campanhas" link; Configurações: "Criar Campanhas" shortcut
- **System Hardening Audit (April 2026)**: Comprehensive correctness and stability pass across the entire application:
  - **Invalid Tailwind classes fixed**: `h-4.5`/`w-4.5` → `h-[18px]`/`w-[18px]` in `campaign-status-banner.tsx` and `metric-card.tsx`
  - **Null safety in vendedores.tsx**: `salesperson.email?.toLowerCase()` protected with optional chaining (`?? ""`) to prevent crash when email is null
  - **Division-by-zero protection (frontend)**: Added `safeDiv()` helper in `dtr-amanco.tsx`, `tv-amanco.tsx`, and `tintas-elit.tsx` — all progress bar % calculations now return 0 instead of NaN/Infinity when denominator is 0
  - **Division-by-zero protection (backend)**: Fixed `getMetasAmancoDTR()` and `getMetasAmancoTV()` in `storage.ts` — `faturamento_amanco.percentual` now correctly returns 0 when both `gatilho_individual` and `meta_gatilho` are 0
  - **TypeScript fix in campaign-hero.tsx**: Added `import type { ReactNode }` to replace undeclared `React.ReactNode` type; removed unused `Lock` import
  - **metas-vendedor/index.tsx rewrite**: New clean header with `h1` page title + subtitle; fully-responsive tab bar with icon + short label on mobile / full label on desktop; scrollable on narrow screens; tab trigger style: solid primary background when active
  - **Semantic HTML fix**: Changed `<h1>` inside acompanhamento tab content to `<h2>` to avoid duplicate H1 per page

- **Campaign Pages Premium Redesign (April 2026)**: Complete overhaul of salesperson campaign pages (metas-vendedor):
  - **Shared component library** in `client/src/components/campanhas/`:
    - `campaign-hero.tsx` — Supplier-branded hero card with gradient band; accepts optional `logoUrl` prop — renders real logo image in white box (falling back to initials). Also has `supplierInitials` fallback with brand-colored text.
    - `campaign-status-banner.tsx` — Smart eligibility/requirements block with individual requirement rows (value, progress bar, target, % chip, ok/warn/fail states)
    - `metric-card.tsx` — Premium executive metric card: top accent line, icon pill, large value, target label, progress bar, remaining/note colored pill
    - `calculation-memory.tsx` — "How was this calculated" block with step-by-step audit trail and colored conclusion
    - `campaign-rules.tsx` — Campaign rules in clear language, grouped by category with icons
  - **dtr-amanco.tsx** — Full premium redesign: CampaignHero (Amanco brand blue), 3-requirement StatusBanner (gatilho + mix + trava loja), 4 MetricCards grid, CalculationMemory + CampaignRules side by side
  - **tv-amanco.tsx** — Same premium system: CampaignHero (sorteio type), 4-requirement StatusBanner (crescimento pessoal added), "Encerrada" badge support, full CalculationMemory
  - **tintas-elit.tsx** — Simplified premium layout: CampaignHero (orange Elit brand), payment date strip, single MetricCard, CalculationMemory + CampaignRules
  - **acompanhamento.tsx** — Clean overview: header strip with real-time badge, GoalCard components (varejo/atacado) with full progress anatomy, MixCard with SVG donut chart

- **Settings Hub Reformulation**: Replaced separate admin pages with a unified Configurações module featuring 4 sections via left-sidebar navigation:
  - **Equipes**: Full inline team management (create/edit/delete groups, search members, member checkboxes)
  - **Metas de Venda**: Weekly/monthly goals config per salesperson (unchanged functionality, integrated)
  - **Gatilhos**: Campaign trigger configuration (DTR Amanco, TV Amanco, Elit) with campaign/year/group filters
  - **Relatórios**: Campaign reports with period selection — DTR Amanco supports quarter (Q1-Q4) + year picker
- **Period-based Campaign Reports**: `/api/metas/admin/campaign-report` now accepts `year` and `quarter` params; `getMetasAmancoDTR` accepts optional `targetYear`/`targetQuarter`
- **vendor_groups table**: Created on server startup (was missing from schema)
- **Sidebar simplified**: Removed separate "Gatilhos da Campanha" and "Relatórios de Campanha" links; consolidated to single "Configurações"
- **Team-Based Filtering**: Supervisors now see only their team's data (KPIs, rankings, weekly/monthly views)
  - User `supervisor@conectubos.com` configured with team: ERICK, FABIO, MARCIO, THIAGO MOURA, BRUNO, FABRICIO, CLEDSON, ELISMARIO
  - Admin users (role='admin') see all data
  - Supervisor users (role='supervisor') see only their team_members
- **Value Normalization**: Monetary values from DB2 are now divided by 1,000,000 for correct display in Reais
- **Date Format Fix**: SQL queries use correct DB2 ODBC date format `{d 'YYYY-MM-DD'}`
- **Collapsible Header**: Dashboard header collapses on scroll, showing only icon buttons for company/period selection on mobile
- **Drag-and-Drop Layout**: Users can now reorganize dashboard cards via drag-and-drop with localStorage persistence
- **Authentication**: Custom email/password login with JWT tokens (30-day expiry)
- **KPI Cards**: Simplified to 3 core metrics (Vendas Semanal, Vendas Mensal, A Faturar Total)
- **A Faturar por Vendedor**: New component showing individual salesperson invoice totals
- **Company Selector**: Added "Todas empresas" option for cross-company aggregation
- **Goals System**: Value-based goals (R$) with weekly and monthly targets per salesperson
- **Goals Display**: Goals card shows type badges (Semanal/Mensal) with currency formatting
- **Vendedores Page**: Added % Tubos x Conexões field to salesperson cards
- **Configuration Page**: Tabbed interface for setting weekly/monthly value goals per salesperson

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Charts**: Recharts for data visualization
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules
- **API Style**: REST endpoints under `/api/*` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL dialect (node-postgres `pg`)
- **Schema Validation**: Zod with drizzle-zod integration
- **Authentication**: Custom JWT with bcryptjs password hashing

### Data Layer
- **Database**: PostgreSQL (Replit built-in, accessed via `DATABASE_URL`)
- **pg-client.ts**: `Pool` + `pgGet/pgAll/pgRun` helpers with `?` → `$N` param conversion
- **Auth Schema**: `shared/models/auth.ts` - users table (pgTable/serial from drizzle-orm/pg-core)
- **Business Schema**: `shared/schema.ts` - TypeScript interfaces
- **Data Source**: External DB2 sync populates cache tables in PostgreSQL

### Project Structure
```
├── client/           # React frontend application
│   ├── src/
│   │   ├── components/  # UI and dashboard components
│   │   ├── pages/       # Route page components
│   │   ├── hooks/       # Custom React hooks
│   │   └── lib/         # Utilities and providers
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # In-memory data access layer
│   ├── db.ts         # SQLite database connection (auto-initializes schema)
│   └── auth.ts       # JWT authentication middleware
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Business data TypeScript types
│   └── models/auth.ts # Database schema for auth
├── scripts/          # Scripts utilitários
│   ├── build.ts             # Script de build (esbuild + vite)
│   ├── database-schema.sql  # Schema do banco SQLite
│   ├── query-vendors.js     # Query de consulta de vendedores
│   ├── requirements.txt     # Dependências Python
│   ├── db/                  # Scripts de manutenção do banco
│   │   ├── sync_db2.py      # Sincronizador DB2 → SQLite
│   │   ├── recover_db.py    # Recuperação de banco corrompido
│   │   ├── reset_db.py      # Limpeza de tabelas de cache
│   │   ├── create-user.js   # Criar usuário no banco
│   │   ├── update-user.cjs  # Atualizar dados de usuário
│   │   └── seed-vendor-module-users.cjs  # Seed usuários vendedores
│   ├── seed/                # Scripts de seed de dados
│   │   └── seed_campaign_goals.py  # Seed de metas de campanha
│   └── sql/          # Queries SQL de referência
│       ├── vendas.sql
│       ├── tubos_conexoes.sql
│       ├── tubos_conexoes_amanco.sql
│       ├── vendas_pendentes.sql
│       ├── vendas_produtos_campanhas.sql
│       ├── estoque_geral.sql
│       ├── lista_produtos.sql
│       ├── movimentacoes_vendas.sql
│       └── orcamentos.sql
├── docs/             # Documentação e requisitos
│   ├── API_INTEGRATION.md
│   ├── requisitos-campanhas.md
│   └── requisitos-configuracoes.md
└── database.db       # Banco SQLite (criado automaticamente)
```

### Sincronização DB2 → SQLite

O script `scripts/db/sync_db2.py` coleta dados do DB2 e salva no SQLite local:

```bash
# Sincroniza uma vez
python scripts/db/sync_db2.py

# Sincroniza em loop (a cada 5 minutos)
python scripts/db/sync_db2.py --loop 300

# Sincroniza e inicia o servidor web
python scripts/db/sync_db2.py --serve
```

**Tabelas de cache:**
- `cache_vendas` - Vendas (últimos 3 meses)
- `cache_tubos_conexoes` - Tubos e Conexões
- `cache_vendas_pendentes` - A Faturar

**Normalização automática:**
- Valores divididos por 1.000.000
- Datas em YYYY-MM-DD
- TIPOPRODUTO normalizado para TUBO/CONEXAO

### Key Design Patterns
- **Multi-tenant by Company**: All data queries are scoped by companyId (supports "all" for aggregation)
- **Role-based Access**: Supervisor sees only their team; Manager/Director sees all
- **Period-based Filtering**: Dashboard supports flexible date ranges with "closed weeks" mode
- **Configurable Rankings**: Salesperson rankings support multiple criteria (value, positivação, mix, conexões/tubos)
- **Authentication Required**: All API routes protected with isAuthenticated middleware

### API Endpoints Pattern
- `GET /api/auth/user` - Get authenticated user info
- `GET /api/companies` - List available companies
- `GET /api/kpis/:companyId/:startDate/:endDate` - KPI summary for period
- `GET /api/rankings/:companyId/:startDate/:endDate/:criteria` - Salesperson rankings
- `GET /api/product-mix/:companyId/:startDate/:endDate` - Product mix breakdown
- `GET /api/goals/:companyId/:month/:year` - Goals with progress (by month/year)
- `POST /api/goals` - Create new goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal
- `GET /api/alerts/:companyId` - Alert notifications

## External Dependencies

### Database
- **SQLite**: Local file database (`database.db`) - no server required
- Uses Drizzle ORM with `better-sqlite3` driver for type-safe queries
- Stores user authentication data
- WAL mode enabled for better performance

### Authentication
- **Custom JWT Auth**: Email/password authentication with JWT tokens
- Tokens stored in localStorage with 30-day expiry
- bcryptjs for password hashing
- No external authentication dependencies

### UI Component Libraries
- **Radix UI**: Headless accessible components (dialogs, dropdowns, tooltips, etc.)
- **shadcn/ui**: Pre-styled component system built on Radix
- **Recharts**: Charting library for bar charts, pie charts, line charts

### Development Tools
- **Vite**: Development server with HMR
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner (dev only)

### Key NPM Packages
- `@tanstack/react-query`: Server state management
- `date-fns`: Date manipulation with Portuguese locale support
- `drizzle-orm` + `drizzle-kit` + `pg`: Database ORM and PostgreSQL driver
- `bcryptjs` + `jsonwebtoken`: Password hashing and JWT authentication
- `zod`: Runtime type validation
- `class-variance-authority`: Component variant management
