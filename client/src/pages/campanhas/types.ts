// ─── Enums / literals ─────────────────────────────────────────────────────────

export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "encerrada" | "cancelada";
export type CampaignType = "padrao" | "avancado";
export type CampaignSubType =
  | "fornecedor" | "produto" | "mix" | "combo" | "faixa"
  | "meta" | "volume" | "faturamento" | "periodo" | "customizado";

export type ConditionType =
  | "FORNECEDOR" | "PRODUTO" | "GRUPO_PRODUTO" | "SECAO" | "CATEGORIA" | "SUBCATEGORIA"
  | "VENDEDOR" | "GRUPO_VENDEDOR" | "CLIENTE" | "GRUPO_CLIENTE" | "EMPRESA"
  | "QUANTIDADE" | "VALOR" | "META_PERC" | "MIX_MINIMO" | "DIA_SEMANA"
  | "DESCONTO" | "MARGEM" | "ACUM_QUANTIDADE" | "ACUM_VALOR";

export type ConditionOperator =
  | "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN"
  | "GTE" | "LTE" | "GT" | "LT" | "BETWEEN";

export type GroupConnector = "AND" | "OR";

export type RewardType = "VALOR_FIXO" | "PERCENTUAL" | "PONTOS" | "FAIXA" | "PROGRESSAO";

// ─── Rule structures ──────────────────────────────────────────────────────────

export interface Condition {
  id: string;
  type: ConditionType;
  operator: ConditionOperator;
  value: string | number | string[] | [number, number];
}

export interface ConditionGroup {
  id: string;
  connector: GroupConnector;
  conditions: Condition[];
  groups: ConditionGroup[];
}

// ─── Target audience ──────────────────────────────────────────────────────────

export interface TargetSegment {
  vendedores: {
    mode: "all" | "specific" | "group";
    ids: string[];
    groupIds: string[];
    exclude: string[];
  };
  produtos: {
    mode: "all" | "specific" | "category" | "supplier";
    ids: string[];
    suppliers: string[];
    categories: string[];
    exclude: string[];
  };
  clientes: {
    mode: "all" | "specific";
    ids: string[];
    exclude: string[];
  };
  empresas: {
    mode: "all" | "specific";
    ids: string[];
  };
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export interface RewardTier {
  id: string;
  label?: string;
  min?: number;
  max?: number | null;
  value: number;
  unit?: string;
}

export interface Rewards {
  type: RewardType;
  scope: "individual" | "coletivo";
  baseValue?: number;
  basePercent?: number;
  tiers: RewardTier[];
  maxBonus?: number | null;
  minCutoff?: number | null;
  rounding?: "none" | "up" | "down";
}

// ─── Triggers ─────────────────────────────────────────────────────────────────

export type TriggerEvent =
  | "ATINGIR_QUANTIDADE" | "ATINGIR_VALOR" | "ATINGIR_META"
  | "FECHAR_COMBO" | "INICIO_PERIODO" | "FIM_PERIODO";

export interface Trigger {
  id: string;
  event: TriggerEvent;
  threshold?: number;
  actions: Array<{ type: "LIBERAR_PREMIACAO" | "REGISTRAR" | "NOTIFICAR" | "PROXIMA_FAIXA" }>;
}

// ─── Limits & Exceptions ──────────────────────────────────────────────────────

export interface CampaignLimits {
  maxPerVendedor?: number | null;
  maxPerCliente?: number | null;
  maxPerPedido?: number | null;
  maxDiario?: number | null;
  maxSemanal?: number | null;
  maxMensal?: number | null;
  maxTotal?: number | null;
  minCutoff?: number | null;
}

export interface CampaignException {
  id: string;
  type: "VENDEDOR" | "PRODUTO" | "CLIENTE" | "DIA" | "EMPRESA";
  value: string;
  reason?: string;
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  code: string;
  name: string;
  description?: string;
  objective?: string;
  campaign_type: CampaignType;
  sub_type?: CampaignSubType;
  status: CampaignStatus;
  priority: number;
  is_cumulative: boolean;
  is_exclusive: boolean;
  parent_id?: string;
  current_version: number;
  starts_at: string;
  ends_at: string;
  time_start?: string;
  time_end?: string;
  valid_weekdays?: number[];
  recurrence?: string;
  targets: TargetSegment;
  conditions: ConditionGroup;
  triggers: Trigger[];
  rewards: Rewards;
  limits: CampaignLimits;
  exceptions: CampaignException[];
  natural_language?: string;
  internal_notes?: string;
  created_by: string;
  updated_by?: string;
  change_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignVersion {
  id: string;
  campaign_id: string;
  version: number;
  snapshot: Campaign;
  created_by: string;
  change_reason?: string;
  created_at: string;
}

export interface CampaignAuditEntry {
  id: string;
  campaign_id: string;
  action: string;
  actor: string;
  prev_values?: any;
  new_values?: any;
  change_reason?: string;
  created_at: string;
}

export interface SimulationInput {
  vendedorId?: string;
  grupoVendedorId?: string;
  empresaId?: string;
  fornecedor?: string;
  produtoId?: string;
  categoria?: string;
  clienteId?: string;
  quantidade?: number;
  valor?: number;
  desconto?: number;
  margem?: number;
  diaSemana?: number;
  acumuladoQuantidade?: number;
  acumuladoValor?: number;
  metaPerc?: number;
  mixCount?: number;
}

export interface SimulationResult {
  campanha: string;
  codigo: string;
  aplicaria: boolean;
  condicoesAtendidas: string[];
  condicoesFalharam: string[];
  prioridadeAplicada?: number;
  conflitos?: string[];
  bloqueadoPorLimite?: boolean;
  premiacao?: { tipo: string; valor: number; descricao: string } | null;
  explicacao: string;
}

// ─── Display labels ───────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: "Rascunho", ativa: "Ativa", pausada: "Pausada",
  encerrada: "Encerrada", cancelada: "Cancelada",
};

export const STATUS_COLOR: Record<CampaignStatus, string> = {
  rascunho: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  ativa:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  pausada:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  encerrada:"bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cancelada:"bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export const CONDITION_TYPE_LABEL: Record<ConditionType, string> = {
  FORNECEDOR: "Fornecedor", PRODUTO: "Produto", GRUPO_PRODUTO: "Grupo de Produto",
  SECAO: "Seção", CATEGORIA: "Categoria", SUBCATEGORIA: "Subcategoria",
  VENDEDOR: "Vendedor", GRUPO_VENDEDOR: "Grupo de Vendedor",
  CLIENTE: "Cliente", GRUPO_CLIENTE: "Grupo de Cliente", EMPRESA: "Empresa",
  QUANTIDADE: "Quantidade", VALOR: "Valor (R$)", META_PERC: "Meta (%)",
  MIX_MINIMO: "Mix Mínimo (itens)", DIA_SEMANA: "Dia da Semana",
  DESCONTO: "Desconto (%)", MARGEM: "Margem (%)",
  ACUM_QUANTIDADE: "Qtd Acumulada no Período", ACUM_VALOR: "Valor Acumulado no Período",
};

export const CONDITION_NUMERIC_TYPES = new Set<ConditionType>([
  "QUANTIDADE", "VALOR", "META_PERC", "MIX_MINIMO", "DIA_SEMANA",
  "DESCONTO", "MARGEM", "ACUM_QUANTIDADE", "ACUM_VALOR",
]);

export const OPERATOR_LABEL: Record<ConditionOperator, string> = {
  EQUALS: "é igual a", NOT_EQUALS: "é diferente de", IN: "está em",
  NOT_IN: "não está em", GTE: "≥", LTE: "≤", GT: ">", LT: "<", BETWEEN: "entre",
};

export const REWARD_TYPE_LABEL: Record<RewardType, string> = {
  VALOR_FIXO: "Valor Fixo (R$)", PERCENTUAL: "Percentual (%)",
  PONTOS: "Pontos", FAIXA: "Bonificação por Faixa", PROGRESSAO: "Progressão",
};

export const TRIGGER_EVENT_LABEL: Record<TriggerEvent, string> = {
  ATINGIR_QUANTIDADE: "Ao atingir quantidade",
  ATINGIR_VALOR: "Ao atingir valor (R$)",
  ATINGIR_META: "Ao atingir meta (%)",
  FECHAR_COMBO: "Ao fechar combo",
  INICIO_PERIODO: "No início do período",
  FIM_PERIODO: "No encerramento do período",
};

export const ACTION_LABEL: Record<string, string> = {
  LIBERAR_PREMIACAO: "Liberar premiação",
  REGISTRAR: "Registrar ocorrência",
  NOTIFICAR: "Enviar notificação interna",
  PROXIMA_FAIXA: "Avançar para próxima faixa",
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function defaultConditionGroup(): ConditionGroup {
  return { id: crypto.randomUUID(), connector: "AND", conditions: [], groups: [] };
}

export function defaultTargets(): TargetSegment {
  return {
    vendedores: { mode: "all", ids: [], groupIds: [], exclude: [] },
    produtos: { mode: "all", ids: [], suppliers: [], categories: [], exclude: [] },
    clientes: { mode: "all", ids: [], exclude: [] },
    empresas: { mode: "all", ids: [] },
  };
}

export function defaultRewards(): Rewards {
  return { type: "VALOR_FIXO", scope: "individual", tiers: [], maxBonus: null, minCutoff: null, rounding: "none" };
}

export function defaultLimits(): CampaignLimits {
  return {};
}

export function defaultCampaign(): Partial<Campaign> {
  return {
    campaign_type: "padrao",
    status: "rascunho",
    priority: 50,
    is_cumulative: true,
    is_exclusive: false,
    targets: defaultTargets(),
    conditions: defaultConditionGroup(),
    triggers: [],
    rewards: defaultRewards(),
    limits: defaultLimits(),
    exceptions: [],
    valid_weekdays: [],
  };
}
