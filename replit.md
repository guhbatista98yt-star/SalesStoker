# Stoker Sales Dashboard

A multi-tenant executive sales dashboard providing real-time sales analytics, KPI tracking, salesperson rankings, product mix analysis, and goals tracking for Sales Supervisors and Management/Directors.

## Run & Operate

```bash
# Install dependencies
npm install # or pnpm install, yarn install

# Start the development server
npm run dev

# Build for production
npm run build

# Typecheck the project
npm run typecheck

# Generate Drizzle migrations
drizzle-kit generate:pg

# Push DB schema changes to PostgreSQL
drizzle-kit push:pg
```

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT signing
- `DB2_CONNECTION_STRING`: Connection string for DB2 (for `erp_sync.py`)

## Stack

- **Frontend**: React 18, TypeScript, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Vite
- **Backend**: Node.js, Express 5, TypeScript, ESM
- **Database**: PostgreSQL (main), SQLite (auth only)
- **ORM**: Drizzle ORM (PostgreSQL dialect)
- **Validation**: Zod
- **Build Tool**: Vite
- **Design System**: Berry Purple — font Poppins, primary `hsl(260 54% 45%)` light / `hsl(258 90% 68%)` dark, background `hsl(220 17% 95%)` light / `hsl(229 37% 14%)` dark, Berry wide-spread shadows

## Where things live

- `/client`: React frontend application
  - `/client/src/pages`: Route components
  - `/client/src/components`: Reusable UI components
  - `/client/src/lib/purchase-sounds.ts`: Web Audio API sound generation
- `/server`: Express backend
  - `/server/index.ts`: Server entry point
  - `/server/routes.ts`: API route definitions
  - `/server/campaigns/engine.ts`: Campaign condition evaluation engine
  - `/server/compras/alert-engine.ts`: Purchase alert processing engine
  - `/server/schema-bootstrap.ts`: **Source of truth for all PostgreSQL schema**
- `/shared`: Shared types and models
  - `/shared/schema.ts`: Business data TypeScript types
- `/sync`: Python ERP synchronization scripts
  - `/sync/erp_sync.py`: **Main DB2 to PostgreSQL sync script**
  - `/sync/erp_queries.py`: DB2 query definitions
- `/docs`: Documentation and requirements
  - `/docs/API_INTEGRATION.md`: API integration details

## Architecture decisions

- **Multi-tenant by Company**: All data queries are scoped by `companyId`, with an "all" option for aggregation.
- **Role-based Access Control (RBAC)**: Granular permissions configured per role, module, action, and scope (own/team/store/all). Supervisors see only their team's data, while Managers/Directors see all.
- **Client-side Routing**: Wouter for lightweight client-side routing, enhancing responsiveness.
- **Separate DB for Auth**: SQLite is used for user authentication, while PostgreSQL handles core business data. This allows for a lightweight, self-contained auth system.
- **Idempotent Schema Bootstrap**: `server/schema-bootstrap.ts` ensures the PostgreSQL schema is always up-to-date and correctly structured on every application start, acting as the single source of truth.

## Product

- **Sales Analytics Dashboard**: Real-time KPIs (Weekly Sales, Monthly Sales, Total Outstanding), salesperson rankings, product mix analysis.
- **Goal Tracking**: Value-based weekly and monthly goals per salesperson.
- **Multi-tenant & Period Filtering**: Supports multiple companies and flexible date ranges, including "closed weeks" logic.
- **Campaign Management System**: Full commercial campaign management, including rule builder, simulation, versioning, and audit trails.
- **Purchase Copilot with Notifications**: Real-time purchase alerts, notification center with sound, and administrative/user preferences for alerts.
- **User & Permissions Management**: Admin-only page for managing users, roles, granular permissions, and access audit logs.
- **Financeiro > Contas a Receber**: Accounts receivable module with KPI cards, active filter chips (removable badges), smart pagination, dynamic forma de recebimento from API, tabs (Clientes, Duplicatas, Vendedores, Fila), ERP-style print layout (PrintReport), and XLSX export. Data synced from ERP via `cache_contas_receber`. Cards no longer trigger filters on click — only "Aplicar"/"Buscar" applies filters.
- **Financeiro > Extrato de Cobranças**: Standalone print report page (`/financeiro/extrato-cobrancas`). User fills in parameters (same filters as Contas a Receber), clicks "Visualizar Relatório" to fetch all data (no pagination), sees a live preview + summary, then clicks "Imprimir". Renders ERP-style "150020-Extrato de Cobranças" in A4 landscape with repeating column headers per page.
- **Responsive UI**: Berry Purple design system — Poppins font, violet primary palette, wide-spread shadows, card-hover lift animations, page-enter transitions, dark/light theme, mobile bottom navigation.

## User preferences

- **Communication style**: Simple, everyday language.

## Gotchas

- **DB2 Sync**: Always run `erp_sync.py` to populate `cache_campanhas` before using the "Sincronizar ERP" button for purchase configurations.
- **Windows Setup**: For purchase configuration, ensure `erp_sync.py all` (or `erp_sync.py campanhas`) runs before clicking "Sincronizar ERP" to populate `cache_campanhas`.
- **Monetary Values**: Monetary values from DB2 are divided by 1,000,000 for correct display in Brazilian Real (R$).

## Pointers

- **UI Components**: [shadcn/ui documentation](https://ui.shadcn.com/)
- **Charts**: [Recharts documentation](https://recharts.org/en-US/)
- **ORM**: [Drizzle ORM documentation](https://orm.drizzle.team/)
- **Validation**: [Zod documentation](https://zod.dev/)
- **Server State Management**: [TanStack Query documentation](https://tanstack.com/query/latest)