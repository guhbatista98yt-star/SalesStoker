// ─── Enums / literals ─────────────────────────────────────────────────────────

export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "encerrada" | "cancelada";
export type CampaignType = "padrao" | "avancado";
export type CampaignMode =
  | "atingimento"
  | "comissao"
  | "ranking_volume"
  | "ranking_crescimento"
  | "faixa";

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

export type RewardType =
  | "VALOR_FIXO" | "PERCENTUAL" | "COMISSAO_PERCENTUAL"
  | "PONTOS" | "FAIXA" | "PROGRESSAO" | "RANKING";

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

// ─── Bases de Cálculo (separate layers for eligibility, ranking, payment) ────

export interface ProductBase {
  mode: "all" | "supplier" | "category" | "specific";
  suppliers?: string[];
  categories?: string[];
  ids?: string[];
}

export interface Bases {
  elegibilidade?: {
    mix_minimo?: number;
    produtos?: ProductBase | null;
  };
  apuracao?: {
    produtos?: ProductBase | null;
  };
  ranking?: {
    tipo?: "volume" | "crescimento" | "mix";
    tipos?: string[];
    criterio_desempate?: "valor" | "quantidade" | "data";
    periodo_comparativo?: { starts_at: string; ends_at: string } | null;
  };
  pagamento?: {
    produtos?: ProductBase | null;
  };
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

export interface RewardTier {
  id: string;
  label?: string;
  min?: number;
  max?: number | null;
  value: number;
  percent?: number;
  unit?: string;
}

export interface RewardPosition {
  id: string;
  posicao: number;
  label?: string;
  valor: number;
}

export interface Rewards {
  type: RewardType;
  scope: "individual" | "coletivo";
  baseValue?: number;
  basePercent?: number;
  tiers: RewardTier[];
  posicoes?: RewardPosition[];
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
  supplier_name?: string;
  logo_url?: string;
  brand_color?: string;
  campaign_type: CampaignType;
  campaign_mode: CampaignMode;
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
  bases: Bases;
  conditions: ConditionGroup;
  triggers: Trigger[];
  rewards: Rewards;
  limits: CampaignLimits;
  exceptions: CampaignException[];
  natural_language?: string;
  internal_notes?: string;
  cycle_type?: "none" | "monthly" | "quarterly" | "annual";
  auto_renew?: boolean;
  cycle_count?: number;
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

// ─── Apuração result types ────────────────────────────────────────────────────

export interface MemoriaCalculo {
  passos: string[];
  baseApuracao: string;
  basePagamento: string;
  criterioRanking?: string;
  formulaPremio: string;
  periodo: string;
}

export interface VendedorApuracao {
  vendedorId: string;
  vendedorNome: string;
  elegivel: boolean;
  participou: boolean;
  gatilhoAtingido: boolean;
  atingiu: boolean;
  premiado: boolean;
  posicao?: number;
  posicaoCrescimento?: number;
  categoria?: string;
  valorApuracao: number;
  valorPagamento: number;
  qtdTotal: number;
  mixCount: number;
  gatilhoValor: number;
  premioCalculado: number;
  premioFinal: number;
  crescimentoPerc?: number;
  conexoesPerc?: number;
  motivosNaoParticipacao: string[];
  memoriaCalculo: MemoriaCalculo;
}

export interface ApuracaoResult {
  id: string;
  campaignId: string;
  campaignName: string;
  campaignCode: string;
  apuradoEm: string;
  apuradoPor: string;
  periodoInicio: string;
  periodoFim: string;
  campaignMode: string;
  totalElegiveis: number;
  totalParticipantes: number;
  totalAtingidos: number;
  totalPremiados: number;
  valorTotalApuracao: number;
  valorTotalPagamento: number;
  valorTotalPremio: number;
  crescimentoLojaPerc?: number | null;
  detalhes: VendedorApuracao[];
}

// ─── Simulation ───────────────────────────────────────────────────────────────

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

export const CAMPAIGN_MODE_LABEL: Record<CampaignMode, string> = {
  atingimento:        "Atingimento (todos que cumprirem ganham)",
  comissao:           "Comissão (% sobre valor vendido)",
  ranking_volume:     "Ranking por Volume (maior venda)",
  ranking_crescimento:"Ranking por Crescimento (maior % de crescimento)",
  faixa:              "Por Faixa (prêmio escalonado pelo valor)",
};

export const CAMPAIGN_MODE_DESC: Record<CampaignMode, string> = {
  atingimento:        "Todos os vendedores que atingirem as condições recebem o prêmio fixo.",
  comissao:           "Cada vendedor recebe um percentual calculado sobre o valor da base de pagamento.",
  ranking_volume:     "Os vendedores são ranqueados pelo volume apurado. Os primeiros colocados recebem prêmios por posição.",
  ranking_crescimento:"Os vendedores são ranqueados pelo crescimento em relação ao período comparativo. Os primeiros colocados recebem prêmios por posição.",
  faixa:              "O prêmio é determinado por faixas de valor apurado. Cada faixa tem um prêmio correspondente.",
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
  VALOR_FIXO:         "Valor Fixo (R$)",
  PERCENTUAL:         "Percentual sobre transação (%)",
  COMISSAO_PERCENTUAL:"Comissão sobre base de pagamento (%)",
  PONTOS:             "Pontos",
  FAIXA:              "Bonificação por Faixa",
  PROGRESSAO:         "Progressão",
  RANKING:            "Prêmio por Posição no Ranking",
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

export function defaultBases(): Bases {
  return {
    elegibilidade: { mix_minimo: 0, produtos: null },
    apuracao: { produtos: null },
    ranking: { tipo: "volume", criterio_desempate: "valor", periodo_comparativo: null },
    pagamento: { produtos: null },
  };
}

export function defaultRewards(): Rewards {
  return { type: "VALOR_FIXO", scope: "individual", tiers: [], posicoes: [], maxBonus: null, minCutoff: null, rounding: "none" };
}

export function defaultLimits(): CampaignLimits {
  return {};
}

export function defaultCampaign(): Partial<Campaign> {
  return {
    campaign_type: "padrao",
    campaign_mode: "atingimento",
    status: "rascunho",
    priority: 50,
    is_cumulative: true,
    is_exclusive: false,
    targets: defaultTargets(),
    bases: defaultBases(),
    conditions: defaultConditionGroup(),
    triggers: [],
    rewards: defaultRewards(),
    limits: defaultLimits(),
    exceptions: [],
    valid_weekdays: [],
  };
}
