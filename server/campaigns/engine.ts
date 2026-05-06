/**
 * Campaign Rule Engine
 * Evaluates condition trees against a simulation context.
 * This is the single source of truth for campaign logic — never duplicated in frontend.
 */

export type ConditionType =
  | "FORNECEDOR" | "PRODUTO" | "GRUPO_PRODUTO" | "SECAO" | "CATEGORIA" | "SUBCATEGORIA"
  | "VENDEDOR" | "GRUPO_VENDEDOR" | "CLIENTE" | "GRUPO_CLIENTE" | "EMPRESA"
  | "QUANTIDADE" | "VALOR" | "META_PERC" | "MIX_MINIMO" | "DIA_SEMANA"
  | "DESCONTO" | "MARGEM" | "ACUM_QUANTIDADE" | "ACUM_VALOR";

export type ConditionOperator =
  | "EQUALS" | "NOT_EQUALS" | "IN" | "NOT_IN"
  | "GTE" | "LTE" | "GT" | "LT" | "BETWEEN";

export type GroupConnector = "AND" | "OR";

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

export interface EvaluationContext {
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

export interface EvaluationResult {
  passed: boolean;
  conditions_passed: string[];
  conditions_failed: string[];
}

const CONDITION_LABELS: Record<ConditionType, string> = {
  FORNECEDOR: "Fornecedor",
  PRODUTO: "Produto",
  GRUPO_PRODUTO: "Grupo de Produto",
  SECAO: "Seção",
  CATEGORIA: "Categoria",
  SUBCATEGORIA: "Subcategoria",
  VENDEDOR: "Vendedor",
  GRUPO_VENDEDOR: "Grupo de Vendedor",
  CLIENTE: "Cliente",
  GRUPO_CLIENTE: "Grupo de Cliente",
  EMPRESA: "Empresa",
  QUANTIDADE: "Quantidade",
  VALOR: "Valor (R$)",
  META_PERC: "Meta (%)",
  MIX_MINIMO: "Mix Mínimo",
  DIA_SEMANA: "Dia da Semana",
  DESCONTO: "Desconto (%)",
  MARGEM: "Margem (%)",
  ACUM_QUANTIDADE: "Qtd Acumulada",
  ACUM_VALOR: "Valor Acumulado",
};

const OP_LABELS: Record<ConditionOperator, string> = {
  EQUALS: "=",
  NOT_EQUALS: "≠",
  IN: "em",
  NOT_IN: "não em",
  GTE: "≥",
  LTE: "≤",
  GT: ">",
  LT: "<",
  BETWEEN: "entre",
};

function getContextValue(type: ConditionType, ctx: EvaluationContext): string | number | undefined {
  switch (type) {
    case "FORNECEDOR": return ctx.fornecedor;
    case "PRODUTO": return ctx.produtoId;
    case "GRUPO_PRODUTO":
    case "CATEGORIA": return ctx.categoria;
    case "VENDEDOR": return ctx.vendedorId;
    case "GRUPO_VENDEDOR": return ctx.grupoVendedorId;
    case "CLIENTE":
    case "GRUPO_CLIENTE": return ctx.clienteId;
    case "EMPRESA": return ctx.empresaId;
    case "QUANTIDADE": return ctx.quantidade;
    case "VALOR": return ctx.valor;
    case "ACUM_QUANTIDADE": return ctx.acumuladoQuantidade;
    case "ACUM_VALOR": return ctx.acumuladoValor;
    case "META_PERC": return ctx.metaPerc;
    case "MIX_MINIMO": return ctx.mixCount;
    case "DIA_SEMANA": return ctx.diaSemana;
    case "DESCONTO": return ctx.desconto;
    case "MARGEM": return ctx.margem;
    default: return undefined;
  }
}

function formatConditionLabel(cond: Condition): string {
  const typeLabel = CONDITION_LABELS[cond.type] || cond.type;
  const opLabel = OP_LABELS[cond.operator] || cond.operator;
  const val = Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value);
  return `${typeLabel} ${opLabel} ${val}`;
}

function evaluateSingleCondition(cond: Condition, ctx: EvaluationContext): boolean {
  const ctxValue = getContextValue(cond.type, ctx);

  if (ctxValue === undefined || ctxValue === null) {
    return false;
  }

  switch (cond.operator) {
    case "EQUALS":
      return String(ctxValue) === String(cond.value);
    case "NOT_EQUALS":
      return String(ctxValue) !== String(cond.value);
    case "IN":
      return Array.isArray(cond.value) && (cond.value as string[]).map(String).includes(String(ctxValue));
    case "NOT_IN":
      return Array.isArray(cond.value) && !(cond.value as string[]).map(String).includes(String(ctxValue));
    case "GTE":
      return Number(ctxValue) >= Number(cond.value);
    case "LTE":
      return Number(ctxValue) <= Number(cond.value);
    case "GT":
      return Number(ctxValue) > Number(cond.value);
    case "LT":
      return Number(ctxValue) < Number(cond.value);
    case "BETWEEN": {
      const [min, max] = cond.value as [number, number];
      return Number(ctxValue) >= min && Number(ctxValue) <= max;
    }
    default:
      return false;
  }
}

export function evaluateGroup(group: ConditionGroup, ctx: EvaluationContext): EvaluationResult {
  const passed_list: string[] = [];
  const failed_list: string[] = [];
  const results: boolean[] = [];

  for (const cond of (group.conditions || [])) {
    const ok = evaluateSingleCondition(cond, ctx);
    const label = formatConditionLabel(cond);
    if (ok) passed_list.push(label);
    else failed_list.push(label);
    results.push(ok);
  }

  for (const subGroup of (group.groups || [])) {
    const r = evaluateGroup(subGroup, ctx);
    passed_list.push(...r.conditions_passed);
    failed_list.push(...r.conditions_failed);
    results.push(r.passed);
  }

  let passed: boolean;
  if (results.length === 0) {
    passed = true;
  } else if (group.connector === "AND") {
    passed = results.every(Boolean);
  } else {
    passed = results.some(Boolean);
  }

  return { passed, conditions_passed: passed_list, conditions_failed: failed_list };
}

export interface RewardResult {
  value: number;
  description: string;
  tier?: string;
}

export function calculateReward(rewards: any, ctx: EvaluationContext): RewardResult | null {
  if (!rewards || !rewards.type) return null;

  switch (rewards.type) {
    case "VALOR_FIXO": {
      const v = rewards.baseValue || 0;
      return { value: v, description: `Valor fixo: R$ ${v.toFixed(2)}` };
    }
    case "PERCENTUAL": {
      const base = ctx.valor || 0;
      const pct = rewards.basePercent || 0;
      const result = (base * pct) / 100;
      return { value: result, description: `${pct}% sobre R$ ${base.toFixed(2)} = R$ ${result.toFixed(2)}` };
    }
    case "PONTOS": {
      const pts = rewards.baseValue || 0;
      return { value: pts, description: `${pts} pontos` };
    }
    case "COMISSAO_PERCENTUAL": {
      const base = ctx.acumuladoValor ?? ctx.valor ?? 0;
      const pct = rewards.basePercent || 0;
      const result = (base * pct) / 100;
      return { value: result, description: `Comissão ${pct}% sobre R$ ${base.toFixed(2)} = R$ ${result.toFixed(2)}` };
    }
    case "RANKING": {
      return { value: 0, description: "Prêmio por posição — calculado na apuração" };
    }
    case "FAIXA":
    case "PROGRESSAO": {
      const ref = ctx.valor ?? ctx.quantidade ?? 0;
      const tiers = ((rewards.tiers || []) as any[]).sort((a, b) => (a.min || 0) - (b.min || 0));
      for (const tier of tiers) {
        const min = tier.min ?? 0;
        const max = tier.max !== null && tier.max !== undefined ? tier.max : Infinity;
        if (ref >= min && ref <= max) {
          const label = tier.label || `${min} – ${max === Infinity ? "∞" : max}`;
          return {
            value: tier.value,
            description: `Faixa "${label}": ${tier.value}`,
            tier: label,
          };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Generates a human-readable summary of a campaign.
 */
export function generateNaturalLanguage(campaign: any): string {
  const parts: string[] = [];

  const start = campaign.starts_at ? new Date(campaign.starts_at).toLocaleDateString("pt-BR") : "?";
  const end = campaign.ends_at ? new Date(campaign.ends_at).toLocaleDateString("pt-BR") : "?";
  parts.push(`Campanha válida de ${start} a ${end}`);

  const targets = campaign.targets || {};

  if (targets.vendedores) {
    const v = targets.vendedores;
    if (v.mode === "all") parts.push("para todos os vendedores");
    else if (v.mode === "group" && v.groupIds?.length) parts.push(`para o grupo de vendedores selecionado`);
    else if (v.mode === "specific" && v.ids?.length) parts.push(`para ${v.ids.length} vendedor(es) específico(s)`);
    if (v.exclude?.length) parts.push(`(exceto ${v.exclude.length} vendedor(es))`);
  }

  if (targets.produtos) {
    const p = targets.produtos;
    if (p.mode === "supplier" && p.suppliers?.length) parts.push(`considerando produtos do fornecedor ${p.suppliers.join(", ")}`);
    else if (p.mode === "category" && p.categories?.length) parts.push(`na categoria ${p.categories.join(", ")}`);
    else if (p.mode === "specific" && p.ids?.length) parts.push(`para ${p.ids.length} produto(s) específico(s)`);
  }

  const rewards = campaign.rewards || {};
  if (rewards.type === "PERCENTUAL" && rewards.basePercent) {
    parts.push(`com bonificação de ${rewards.basePercent}% sobre o valor`);
  } else if (rewards.type === "VALOR_FIXO" && rewards.baseValue) {
    parts.push(`com premiação fixa de R$ ${Number(rewards.baseValue).toFixed(2)}`);
  } else if (rewards.type === "FAIXA" && rewards.tiers?.length) {
    parts.push(`com bonificação progressiva por faixas (${rewards.tiers.length} faixas)`);
  }

  if (campaign.is_cumulative === 0 || campaign.is_cumulative === false) {
    parts.push("sem acúmulo com outras campanhas");
  }
  if (campaign.is_exclusive === 1 || campaign.is_exclusive === true) {
    parts.push("de caráter exclusivo");
  }

  return parts.join(", ") + ".";
}

/**
 * Validates campaign structure for activation.
 * Returns list of validation errors. Empty = valid.
 */
export function validateCampaignStructure(campaign: any): string[] {
  const errors: string[] = [];

  if (!campaign.name?.trim()) errors.push("Nome da campanha é obrigatório.");
  if (!campaign.starts_at) errors.push("Data de início é obrigatória.");
  if (!campaign.ends_at) errors.push("Data de encerramento é obrigatória.");
  if (campaign.starts_at && campaign.ends_at && campaign.starts_at >= campaign.ends_at) {
    errors.push("Data de encerramento deve ser posterior ao início.");
  }
  if (campaign.priority < 1 || campaign.priority > 100) {
    errors.push("Prioridade deve estar entre 1 e 100.");
  }

  const rewards = campaign.rewards;
  if (!rewards?.type) {
    errors.push("Tipo de premiação é obrigatório.");
  } else if (rewards.type === "PERCENTUAL" && !rewards.basePercent) {
    errors.push("Percentual de premiação é obrigatório.");
  } else if (rewards.type === "VALOR_FIXO" && !rewards.baseValue) {
    errors.push("Valor fixo de premiação é obrigatório.");
  } else if ((rewards.type === "FAIXA" || rewards.type === "PROGRESSAO") && !rewards.tiers?.length) {
    errors.push("Ao menos uma faixa de premiação é obrigatória.");
  }

  // Validate conditions are not empty — a campaign without conditions does nothing
  const conds = campaign.conditions;
  if (!conds || (typeof conds === "object" && Object.keys(conds).length === 0)) {
    errors.push("Condições da campanha são obrigatórias. Defina ao menos uma regra.");
  } else if (conds.conditions && Array.isArray(conds.conditions) && conds.conditions.length === 0
    && (!conds.groups || (Array.isArray(conds.groups) && conds.groups.length === 0))) {
    errors.push("Condições da campanha estão vazias. Defina ao menos uma regra.");
  }

  return errors;
}
