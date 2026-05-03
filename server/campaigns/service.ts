/**
 * Campaign Service
 * All campaign business logic lives here. Backend is the single source of truth.
 */

import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID } from "crypto";
import {
  evaluateGroup,
  calculateReward,
  generateNaturalLanguage,
  validateCampaignStructure,
  type EvaluationContext,
} from "./engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus = "rascunho" | "ativa" | "pausada" | "encerrada" | "cancelada";

export interface CampaignFilters {
  status?: string;
  campaign_type?: string;
  search?: string;
  starts_after?: string;
  ends_before?: string;
}

interface RawCampaign {
  id: string; code: string; name: string; description: string | null;
  objective: string | null; campaign_type: string; campaign_mode: string; sub_type: string | null;
  status: string; priority: number; is_cumulative: number; is_exclusive: number;
  parent_id: string | null; current_version: number;
  starts_at: string; ends_at: string; time_start: string | null; time_end: string | null;
  valid_weekdays: string; recurrence: string | null;
  targets: string; bases: string; conditions: string; triggers: string;
  rewards: string; limits: string; exceptions: string;
  natural_language: string | null; internal_notes: string | null;
  cycle_type: string | null; auto_renew: number; cycle_count: number;
  created_by: string; updated_by: string | null; change_reason: string | null;
  created_at: string; updated_at: string;
}

function parseCampaign(row: RawCampaign) {
  return {
    ...row,
    is_cumulative: Boolean(row.is_cumulative),
    is_exclusive: Boolean(row.is_exclusive),
    auto_renew: Boolean(row.auto_renew),
    cycle_type: (row.cycle_type as any) || "none",
    cycle_count: row.cycle_count ?? 0,
    campaign_mode: row.campaign_mode || "atingimento",
    targets: safeJson(row.targets, {}),
    bases: safeJson(row.bases, {}),
    conditions: safeJson(row.conditions, {}),
    triggers: safeJson(row.triggers, []),
    rewards: safeJson(row.rewards, {}),
    limits: safeJson(row.limits, {}),
    exceptions: safeJson(row.exceptions, []),
    valid_weekdays: safeJson(row.valid_weekdays, []),
  };
}

function safeJson(str: string | null, fallback: any) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function generateCode(): string {
  const yr = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `CMP-${yr}-${rand}`;
}

// ─── State Machine ────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  rascunho:  ["ativa", "cancelada"],
  ativa:     ["pausada", "encerrada", "cancelada"],
  pausada:   ["ativa", "encerrada", "cancelada"],
  encerrada: [],
  cancelada: [],
};

function assertTransition(from: CampaignStatus, to: CampaignStatus) {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new Error(`Transição inválida: ${from} → ${to}`);
  }
}

// ─── Audit ────────────────────────────────────────────────────────────────────

async function audit(
  campaignId: string,
  action: string,
  actor: string,
  prevValues?: any,
  newValues?: any,
  reason?: string,
) {
  await pgRun(`
    INSERT INTO campaign_audit_logs (id, campaign_id, action, actor, prev_values, new_values, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    randomUUID(), campaignId, action, actor,
    prevValues ? JSON.stringify(prevValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason || null,
  ]);
}

// ─── Version snapshot ─────────────────────────────────────────────────────────

async function snapshotVersion(campaign: any, actor: string, reason?: string) {
  await pgRun(`
    INSERT INTO campaign_versions (id, campaign_id, version, snapshot, created_by, change_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    randomUUID(), campaign.id, campaign.current_version,
    JSON.stringify(campaign), actor, reason || null,
  ]);
}

// ─── Service methods ──────────────────────────────────────────────────────────

export async function getCampaigns(filters: CampaignFilters = {}) {
  let sql = `SELECT * FROM campaigns WHERE 1=1`;
  const params: any[] = [];

  if (filters.status) { sql += ` AND status = ?`; params.push(filters.status); }
  if (filters.campaign_type) { sql += ` AND campaign_type = ?`; params.push(filters.campaign_type); }
  if (filters.search) {
    sql += ` AND (name LIKE ? OR code LIKE ? OR description LIKE ?)`;
    const like = `%${filters.search}%`;
    params.push(like, like, like);
  }
  if (filters.starts_after) { sql += ` AND starts_at >= ?`; params.push(filters.starts_after); }
  if (filters.ends_before) { sql += ` AND ends_at <= ?`; params.push(filters.ends_before); }

  sql += ` ORDER BY priority DESC, updated_at DESC`;

  const rows = await pgAll<RawCampaign>(sql, params);
  return rows.map(parseCampaign);
}

export async function getCampaignById(id: string) {
  const row = await pgGet<RawCampaign>(`SELECT * FROM campaigns WHERE id = ?`, [id]);
  if (!row) return null;
  return parseCampaign(row);
}

export async function createCampaign(data: any, actor: string) {
  const id = randomUUID();
  let code = data.code || generateCode();

  const exists = await pgGet<{ id: string }>(`SELECT id FROM campaigns WHERE code = ?`, [code]);
  if (exists) code = generateCode() + "-" + Date.now().toString().slice(-4);

  const naturalLang = generateNaturalLanguage({ ...data, id });

  await pgRun(`
    INSERT INTO campaigns (
      id, code, name, description, objective, supplier_name, logo_url, brand_color,
      campaign_type, campaign_mode, sub_type,
      status, priority, is_cumulative, is_exclusive, parent_id, current_version,
      starts_at, ends_at, time_start, time_end, valid_weekdays, recurrence,
      targets, bases, conditions, triggers, rewards, limits, exceptions,
      natural_language, internal_notes, cycle_type, auto_renew, cycle_count,
      created_by, updated_by, change_reason
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `, [
    id, code, data.name, data.description || null, data.objective || null,
    data.supplier_name || null, data.logo_url || null, data.brand_color || null,
    data.campaign_type || "padrao", data.campaign_mode || "atingimento", data.sub_type || null,
    "rascunho", data.priority ?? 50,
    data.is_cumulative !== false ? 1 : 0,
    data.is_exclusive ? 1 : 0,
    data.parent_id || null, 1,
    data.starts_at, data.ends_at,
    data.time_start || null, data.time_end || null,
    JSON.stringify(data.valid_weekdays || []),
    data.recurrence || null,
    JSON.stringify(data.targets || {}),
    JSON.stringify(data.bases || {}),
    JSON.stringify(data.conditions || {}),
    JSON.stringify(data.triggers || []),
    JSON.stringify(data.rewards || {}),
    JSON.stringify(data.limits || {}),
    JSON.stringify(data.exceptions || []),
    naturalLang, data.internal_notes || null,
    data.cycle_type || "none", data.auto_renew ? 1 : 0, data.cycle_count ?? 0,
    actor, null, null,
  ]);

  const campaign = (await getCampaignById(id))!;
  await snapshotVersion(campaign, actor, "Criação inicial");
  await audit(id, "criado", actor, null, { name: data.name, code }, "Criação inicial");
  return campaign;
}

export async function updateCampaign(id: string, data: any, actor: string, reason?: string) {
  const existing = await getCampaignById(id);
  if (!existing) throw new Error("Campanha não encontrada");

  const isActive = existing.status === "ativa";
  const newVersion = isActive ? existing.current_version + 1 : existing.current_version;
  const naturalLang = generateNaturalLanguage({ ...data, id });

  const prev = { ...existing };

  await pgRun(`
    UPDATE campaigns SET
      name=?, description=?, objective=?, supplier_name=?, logo_url=?, brand_color=?,
      campaign_type=?, campaign_mode=?, sub_type=?,
      priority=?, is_cumulative=?, is_exclusive=?,
      starts_at=?, ends_at=?, time_start=?, time_end=?, valid_weekdays=?, recurrence=?,
      targets=?, bases=?, conditions=?, triggers=?, rewards=?, limits=?, exceptions=?,
      natural_language=?, internal_notes=?,
      cycle_type=?, auto_renew=?,
      current_version=?, updated_by=?, change_reason=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [
    data.name, data.description || null, data.objective || null,
    data.supplier_name !== undefined ? (data.supplier_name || null) : ((existing as any).supplier_name || null),
    data.logo_url !== undefined ? (data.logo_url || null) : ((existing as any).logo_url || null),
    data.brand_color !== undefined ? (data.brand_color || null) : ((existing as any).brand_color || null),
    data.campaign_type || (existing as any).campaign_type,
    data.campaign_mode || (existing as any).campaign_mode || "atingimento",
    data.sub_type || null,
    data.priority ?? existing.priority,
    data.is_cumulative !== false ? 1 : 0, data.is_exclusive ? 1 : 0,
    data.starts_at || existing.starts_at, data.ends_at || existing.ends_at,
    data.time_start || null, data.time_end || null,
    JSON.stringify(data.valid_weekdays || []),
    data.recurrence || null,
    JSON.stringify(data.targets || {}),
    JSON.stringify(data.bases || {}),
    JSON.stringify(data.conditions || {}),
    JSON.stringify(data.triggers || []),
    JSON.stringify(data.rewards || {}),
    JSON.stringify(data.limits || {}),
    JSON.stringify(data.exceptions || []),
    naturalLang, data.internal_notes || null,
    data.cycle_type !== undefined ? (data.cycle_type || "none") : ((existing as any).cycle_type || "none"),
    data.auto_renew !== undefined ? (data.auto_renew ? 1 : 0) : ((existing as any).auto_renew ? 1 : 0),
    newVersion, actor, reason || null,
    id,
  ]);

  const updated = (await getCampaignById(id))!;

  if (isActive) {
    await snapshotVersion(updated, actor, reason || "Atualização em campanha ativa");
    await audit(id, "versionado", actor, prev, updated, reason);
  } else {
    await audit(id, "atualizado", actor, prev, updated, reason);
  }

  return updated;
}

export async function changeStatus(id: string, newStatus: CampaignStatus, actor: string, reason?: string) {
  const campaign = await getCampaignById(id);
  if (!campaign) throw new Error("Campanha não encontrada");

  assertTransition(campaign.status as CampaignStatus, newStatus);

  if (newStatus === "ativa") {
    const errors = validateCampaignStructure(campaign);
    if (errors.length > 0) throw new Error(`Campanha inválida: ${errors.join("; ")}`);
  }

  const prev = { status: campaign.status };
  await pgRun(`
    UPDATE campaigns SET status=?, updated_by=?, change_reason=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `, [newStatus, actor, reason || null, id]);

  const actionMap: Record<CampaignStatus, string> = {
    ativa: "ativado", pausada: "pausado", encerrada: "encerrado",
    cancelada: "cancelado", rascunho: "revertido_rascunho",
  };
  await audit(id, actionMap[newStatus] || newStatus, actor, prev, { status: newStatus }, reason);

  return (await getCampaignById(id))!;
}

export async function cloneCampaign(id: string, actor: string) {
  const orig = await getCampaignById(id);
  if (!orig) throw new Error("Campanha não encontrada");

  const cloneData = {
    ...orig,
    name: `${orig.name} (cópia)`,
    code: undefined,
    parent_id: orig.id,
    is_cumulative: orig.is_cumulative,
    is_exclusive: orig.is_exclusive,
  };

  const cloned = await createCampaign(cloneData, actor);
  await audit(cloned.id, "clonado", actor, { source_id: id }, { name: cloned.name }, `Clonado de ${orig.code}`);
  return cloned;
}

export async function validateCampaign(id: string) {
  const campaign = await getCampaignById(id);
  if (!campaign) throw new Error("Campanha não encontrada");
  const errors = validateCampaignStructure(campaign);
  const conflicts = await detectConflicts(id);
  return { valid: errors.length === 0 && conflicts.length === 0, errors, conflicts };
}

export async function detectConflicts(id: string): Promise<Array<{ id: string; code: string; name: string; reason: string }>> {
  const campaign = await getCampaignById(id);
  if (!campaign) return [];

  const actives = await pgAll<any>(`
    SELECT id, code, name, starts_at, ends_at, targets, is_exclusive, priority
    FROM campaigns
    WHERE status = 'ativa' AND id != ?
      AND starts_at <= ? AND ends_at >= ?
  `, [id, campaign.ends_at, campaign.starts_at]);

  const conflicts: Array<{ id: string; code: string; name: string; reason: string }> = [];

  for (const other of actives) {
    const otherTargets = safeJson(other.targets, {});
    const myTargets = (campaign.targets as any);

    const myVMode = myTargets?.vendedores?.mode || "all";
    const otherVMode = otherTargets?.vendedores?.mode || "all";

    if (myVMode === "all" || otherVMode === "all") {
      if (other.is_exclusive || campaign.is_exclusive) {
        conflicts.push({
          id: other.id, code: other.code, name: other.name,
          reason: `Sobreposição de período com campanha exclusiva`,
        });
      } else {
        conflicts.push({
          id: other.id, code: other.code, name: other.name,
          reason: `Sobreposição de período e público-alvo`,
        });
      }
    }
  }

  return conflicts;
}

export async function simulateCampaign(campaignId: string, input: EvaluationContext, actor?: string) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) throw new Error("Campanha não encontrada");

  const conditionGroup = campaign.conditions as any;
  const hasConditions = conditionGroup && (
    (conditionGroup.conditions?.length > 0) || (conditionGroup.groups?.length > 0)
  );

  let evalResult = { passed: true, conditions_passed: [] as string[], conditions_failed: [] as string[] };

  if (hasConditions) {
    evalResult = evaluateGroup(conditionGroup, input);
  }

  const limits = campaign.limits as any || {};
  let blockedByLimit = false;
  const limitReason = "";

  const now = input.diaSemana !== undefined ? input.diaSemana : new Date().getDay();
  const validDays = (campaign.valid_weekdays as any[]) || [];
  if (validDays.length > 0 && !validDays.includes(now)) {
    evalResult.passed = false;
    evalResult.conditions_failed.push(`Dia da semana não permitido para esta campanha`);
  }

  let premiacao = null;
  if (evalResult.passed && !blockedByLimit) {
    const rewardResult = calculateReward(campaign.rewards, input);
    if (rewardResult) {
      premiacao = {
        tipo: (campaign.rewards as any).type,
        valor: rewardResult.value,
        descricao: rewardResult.description,
      };

      if (limits.maxPerVendedor && rewardResult.value > limits.maxPerVendedor) {
        premiacao.valor = limits.maxPerVendedor;
        premiacao.descricao += ` (limitado a R$ ${limits.maxPerVendedor})`;
      }
    }
  }

  const conflicts = await detectConflicts(campaignId);
  const conflictNames = conflicts.map(c => c.name);

  const parts: string[] = [];
  if (evalResult.passed && !blockedByLimit) {
    parts.push("✅ A campanha APLICARIA neste cenário.");
    if (premiacao) parts.push(`Premiação: ${premiacao.descricao}`);
  } else {
    parts.push("❌ A campanha NÃO aplicaria neste cenário.");
    if (blockedByLimit) parts.push(`Motivo: ${limitReason}`);
    if (evalResult.conditions_failed.length) {
      parts.push(`Condições não atendidas: ${evalResult.conditions_failed.join("; ")}`);
    }
  }
  if (conflictNames.length) {
    parts.push(`⚠️ Conflitos detectados com: ${conflictNames.join(", ")}`);
  }

  const result = {
    campanha: campaign.name,
    codigo: campaign.code,
    aplicaria: evalResult.passed && !blockedByLimit,
    condicoesAtendidas: evalResult.conditions_passed,
    condicoesFalharam: evalResult.conditions_failed,
    prioridadeAplicada: campaign.priority,
    conflitos: conflictNames,
    bloqueadoPorLimite: blockedByLimit,
    premiacao,
    explicacao: parts.join(" "),
  };

  if (actor) {
    await pgRun(`
      INSERT INTO campaign_simulations (id, campaign_id, input_data, result, created_by)
      VALUES (?, ?, ?, ?, ?)
    `, [randomUUID(), campaignId, JSON.stringify(input), JSON.stringify(result), actor]);
  }

  return result;
}

export async function getAuditLog(campaignId: string) {
  return pgAll<any>(`
    SELECT * FROM campaign_audit_logs
    WHERE campaign_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `, [campaignId]);
}

export async function getVersions(campaignId: string) {
  const rows = await pgAll<any>(`
    SELECT * FROM campaign_versions
    WHERE campaign_id = ?
    ORDER BY version DESC
  `, [campaignId]);

  return rows.map(r => ({ ...r, snapshot: safeJson(r.snapshot, {}) }));
}

export async function restoreVersion(campaignId: string, version: number, actor: string, reason?: string) {
  const vRow = await pgGet<any>(`
    SELECT * FROM campaign_versions WHERE campaign_id = ? AND version = ?
  `, [campaignId, version]);
  if (!vRow) throw new Error("Versão não encontrada");

  const snapshot = safeJson(vRow.snapshot, null);
  if (!snapshot) throw new Error("Snapshot inválido");

  const existing = await getCampaignById(campaignId);
  if (!existing) throw new Error("Campanha não encontrada");
  if (existing.status === "encerrada" || existing.status === "cancelada") {
    throw new Error("Não é possível restaurar versão de campanha encerrada ou cancelada");
  }

  const restored = await updateCampaign(
    campaignId,
    { ...snapshot, id: campaignId },
    actor,
    reason || `Restauração da versão ${version}`,
  );

  await audit(campaignId, "restaurado", actor, { version: existing.current_version }, { version }, reason);
  return restored;
}

// ─── Cycle renewal ────────────────────────────────────────────────────────────

function advanceDateByCycle(dateStr: string, cycleType: string): string {
  const d = new Date(dateStr);
  if (cycleType === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else if (cycleType === "quarterly") {
    d.setMonth(d.getMonth() + 3);
  } else if (cycleType === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split("T")[0];
}

export async function renewCampaignCycle(campaignId: string, actor: string) {
  const orig = await getCampaignById(campaignId);
  if (!orig) throw new Error("Campanha não encontrada");

  const cycleType = (orig as any).cycle_type;
  if (!cycleType || cycleType === "none") throw new Error("Campanha sem ciclo definido");
  if (!(orig as any).auto_renew) throw new Error("Renovação automática não habilitada");

  const newStart = advanceDateByCycle(orig.starts_at, cycleType);
  const newEnd = advanceDateByCycle(orig.ends_at, cycleType);

  const cycleCount = ((orig as any).cycle_count ?? 0) + 1;

  const cloneData = {
    ...orig,
    name: orig.name,
    code: undefined,
    parent_id: orig.id,
    starts_at: newStart,
    ends_at: newEnd,
    status: "rascunho",
    cycle_count: cycleCount,
    cycle_type: cycleType,
    auto_renew: true,
    is_cumulative: orig.is_cumulative,
    is_exclusive: orig.is_exclusive,
  };

  const renewed = await createCampaign(cloneData, actor);
  await audit(renewed.id, "ciclo_renovado", actor, { source_id: orig.id }, { cycle: cycleCount, starts_at: newStart, ends_at: newEnd }, `Ciclo ${cycleCount} — renovação automática de ${orig.code}`);
  return renewed;
}

export async function checkAndRenewCampaigns(actor = "sistema") {
  const rows = await pgAll<RawCampaign>(`
    SELECT * FROM campaigns
    WHERE status = 'encerrada'
      AND auto_renew = 1
      AND (cycle_type IS NOT NULL AND cycle_type != 'none')
      AND ends_at < CURRENT_DATE
  `);

  const renewed: string[] = [];
  for (const row of rows) {
    const orig = parseCampaign(row);
    const childExists = await pgGet<{ id: string }>(
      `SELECT id FROM campaigns WHERE parent_id = ? AND status != 'cancelada' ORDER BY created_at DESC LIMIT 1`,
      [orig.id]
    );
    if (childExists) continue;
    try {
      const next = await renewCampaignCycle(orig.id, actor);
      renewed.push(next.id);
    } catch (e: any) {
      console.error(`[cycle] Erro ao renovar campanha ${orig.id}:`, e.message);
    }
  }
  return renewed;
}
