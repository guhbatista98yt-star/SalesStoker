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

## Recent Changes

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
- **Database ORM**: Drizzle ORM with SQLite dialect (using better-sqlite3)
- **Schema Validation**: Zod with drizzle-zod integration
- **Authentication**: Custom JWT with bcryptjs password hashing

### Data Layer
- **Database**: SQLite (file: `database.db` in project root)
- **Auth Schema**: `shared/models/auth.ts` - users table
- **Business Schema**: `shared/schema.ts` - TypeScript interfaces for in-memory data
- **Data Source**: External API fetches data from DB2 and populates SQLite

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
├── scripts/          # Scripts de sincronização
│   ├── sync_db2.py   # Sincronizador DB2 → SQLite
│   ├── database-schema.sql  # Schema do banco
│   ├── requirements.txt     # Dependências Python
│   └── sql/          # Queries SQL
│       ├── vendas.sql
│       ├── tubos_conexoes.sql
│       └── vendas_pendentes.sql
├── docs/             # Documentação
│   └── API_INTEGRATION.md   # Guia de integração
└── database.db       # Banco SQLite (criado automaticamente)
```

### Sincronização DB2 → SQLite

O script `scripts/sync_db2.py` coleta dados do DB2 e salva no SQLite local:

```bash
# Sincroniza uma vez
python scripts/sync_db2.py

# Sincroniza em loop (a cada 5 minutos)
python scripts/sync_db2.py --loop 300

# Sincroniza e inicia o servidor web
python scripts/sync_db2.py --serve
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
