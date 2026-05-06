export const APP_MODULE_LABELS = [
  "Dashboard",
  "Vendedores",
  "Metas",
  "Alertas",
  "Visão Semanal",
  "Visão Mensal",
  "Visão em Loja",
  "Campanhas",
  "Comissões",
  "Compras",
  "Configurações",
  "Usuários",
] as const;

export type AppModuleLabel = (typeof APP_MODULE_LABELS)[number];

export const DEFAULT_MODULE_PERMISSIONS: Record<AppModuleLabel, boolean> =
  Object.fromEntries(APP_MODULE_LABELS.map((moduleName) => [moduleName, true])) as Record<AppModuleLabel, boolean>;

