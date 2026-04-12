/**
 * Campaign Service
 * All campaign business logic lives here. Backend is the single source of truth.
 */

import { sqlite } from "../db";
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
  objective: string | null; campaign_type: string; sub_type: string | null;
  status: string; priority: number; is_cumulative: number; is_exclusive: number;
  parent_id: string | null; current_version: number;
  starts_at: string; ends_at: string; time_start: string | null; time_end: string | null;
  valid_weekdays: string; recurrence: string | null;
  targets: string; conditions: string; triggers: string;
  rewards: string; limits: string; exceptions: string;
  natural_language: string | null; internal_notes: string | null;
  created_by: string; updated_by: string | null; change_reason: string | null;
  created_at: string; updated_at: string;
}

function parseCampaign(row: RawCampaign) {
  return {
    ...row,
    is_cumulative: Boolean(row.is_cumulative),
    is_exclusive: Boolean(row.is_exclusive),
    targets: safeJson(row.targets, {}),
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

function audit(
  campaignId: string,
  action: string,
  actor: string,
  prevValues?: any,
  newValues?: any,
  reason?: string,
) {
  sqlite.prepare(`
    INSERT INTO campaign_audit_logs (id, campaign_id, action, actor, prev_values, new_values, change_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), campaignId, action, actor,
    prevValues ? JSON.stringify(prevValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason || null,
  );
}

// ─── Version snapshot ─────────────────────────────────────────────────────────

function snapshotVersion(campaign: any, actor: string, reason?: string) {
  sqlite.prepare(`
    INSERT INTO campaign_versions (id, campaign_id, version, snapshot, created_by, change_reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(), campaign.id, campaign.current_version,
    JSON.stringify(campaign), actor, reason || null,
  );
}

// ─── Service methods ──────────────────────────────────────────────────────────

export function getCampaigns(filters: CampaignFilters = {}) {
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

  const rows = sqlite.prepare(sql).all(...params) as RawCampaign[];
  return rows.map(parseCampaign);
}

export function getCampaignById(id: string) {
  const row = sqlite.prepare(`SELECT * FROM campaigns WHERE id = ?`).get(id) as RawCampaign | undefined;
  if (!row) return null;
  return parseCampaign(row);
}

export function createCampaign(data: any, actor: string) {
  const id = randomUUID();
  let code = data.code || generateCode();

  // Ensure code uniqueness
  const exists = sqlite.prepare(`SELECT id FROM campaigns WHERE code = ?`).get(code);
  if (exists) code = generateCode() + "-" + Date.now().toString().slice(-4);

  const naturalLang = generateNaturalLanguage({ ...data, id });

  sqlite.prepare(`
    INSERT INTO campaigns (
      id, code, name, description, objective, campaign_type, sub_type,
      status, priority, is_cumulative, is_exclusive, parent_id, current_version,
      starts_at, ends_at, time_start, time_end, valid_weekdays, recurrence,
      targets, conditions, triggers, rewards, limits, exceptions,
      natural_language, internal_notes, created_by, updated_by, change_reason
    ) VALUES (
      ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
    )
  `).run(
    id, code, data.name, data.description || null, data.objective || null,
    data.campaign_type || "padrao", data.sub_type || null,
    "rascunho", data.priority ?? 50,
    data.is_cumulative !== false ? 1 : 0,
    data.is_exclusive ? 1 : 0,
    data.parent_id || null, 1,
    data.starts_at, data.ends_at,
    data.time_start || null, data.time_end || null,
    JSON.stringify(data.valid_weekdays || []),
    data.recurrence || null,
    JSON.stringify(data.targets || {}),
    JSON.stringify(data.conditions || {}),
    JSON.stringify(data.triggers || []),
    JSON.stringify(data.rewards || {}),
    JSON.stringify(data.limits || {}),
    JSON.stringify(data.exceptions || []),
    naturalLang, data.internal_notes || null,
    actor, null, null,
  );

  const campaign = getCampaignById(id)!;
  snapshotVersion(campaign, actor, "Criação inicial");
  audit(id, "criado", actor, null, { name: data.name, code }, "Criação inicial");
  return campaign;
}

export function updateCampaign(id: string, data: any, actor: string, reason?: string) {
  const existing = getCampaignById(id);
  if (!existing) throw new Error("Campanha não encontrada");

  const isActive = existing.status === "ativa";
  const newVersion = isActive ? existing.current_version + 1 : existing.current_version;
  const naturalLang = generateNaturalLanguage({ ...data, id });

  const prev = { ...existing };

  sqlite.prepare(`
    UPDATE campaigns SET
      name=?, description=?, objective=?, campaign_type=?, sub_type=?,
      priority=?, is_cumulative=?, is_exclusive=?,
      starts_at=?, ends_at=?, time_start=?, time_end=?, valid_weekdays=?, recurrence=?,
      targets=?, conditions=?, triggers=?, rewards=?, limits=?, exceptions=?,
      natural_language=?, internal_notes=?,
      current_version=?, updated_by=?, change_reason=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    data.name, data.description || null, data.objective || null,
    data.campaign_type || existing.campaign_type, data.sub_type || null,
    data.priority ?? existing.priority,
    data.is_cumulative !== false ? 1 : 0, data.is_exclusive ? 1 : 0,
    data.starts_at || existing.starts_at, data.ends_at || existing.ends_at,
    data.time_start || null, data.time_end || null,
    JSON.stringify(data.valid_weekdays || []),
    data.recurrence || null,
    JSON.stringify(data.targets || {}),
    JSON.stringify(data.conditions || {}),
    JSON.stringify(data.triggers || []),
    JSON.stringify(data.rewards || {}),
    JSON.stringify(data.limits || {}),
    JSON.stringify(data.exceptions || []),
    naturalLang, data.internal_notes || null,
    newVersion, actor, reason || null,
    id,
  );

  const updated = getCampaignById(id)!;

  if (isActive) {
    snapshotVersion(updated, actor, reason || "Atualização em campanha ativa");
    audit(id, "versionado", actor, prev, updated, reason);
  } else {
    audit(id, "atualizado", actor, prev, updated, reason);
  }

  return updated;
}

export function changeStatus(id: string, newStatus: CampaignStatus, actor: string, reason?: string) {
  const campaign = getCampaignById(id);
  if (!campaign) throw new Error("Campanha não encontrada");

  assertTransition(campaign.status as CampaignStatus, newStatus);

  if (newStatus === "ativa") {
    const errors = validateCampaignStructure(campaign);
    if (errors.length > 0) throw new Error(`Campanha inválida: ${errors.join("; ")}`);
  }

  const prev = { status: campaign.status };
  sqlite.prepare(`
    UPDATE campaigns SET status=?, updated_by=?, change_reason=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(newStatus, actor, reason || null, id);

  const actionMap: Record<CampaignStatus, string> = {
    ativa: "ativado", pausada: "pausado", encerrada: "encerrado",
    cancelada: "cancelado", rascunho: "revertido_rascunho",
  };
  audit(id, actionMap[newStatus] || newStatus, actor, prev, { status: newStatus }, reason);

  return getCampaignById(id)!;
}

export function cloneCampaign(id: string, actor: string) {
  const orig = getCampaignById(id);
  if (!orig) throw new Error("Campanha não encontrada");

  const cloneData = {
    ...orig,
    name: `${orig.name} (cópia)`,
    code: undefined,
    parent_id: orig.id,
    is_cumulative: orig.is_cumulative,
    is_exclusive: orig.is_exclusive,
  };

  const cloned = createCampaign(cloneData, actor);
  audit(cloned.id, "clonado", actor, { source_id: id }, { name: cloned.name }, `Clonado de ${orig.code}`);
  return cloned;
}

export function validateCampaign(id: string) {
  const campaign = getCampaignById(id);
  if (!campaign) throw new Error("Campanha não encontrada");
  const errors = validateCampaignStructure(campaign);
  const conflicts = detectConflicts(id);
  return { valid: errors.length === 0 && conflicts.length === 0, errors, conflicts };
}

export function detectConflicts(id: string): Array<{ id: string; code: string; name: string; reason: string }> {
  const campaign = getCampaignById(id);
  if (!campaign) return [];

  const actives = sqlite.prepare(`
    SELECT id, code, name, starts_at, ends_at, targets, is_exclusive, priority
    FROM campaigns
    WHERE status = 'ativa' AND id != ?
      AND starts_at <= ? AND ends_at >= ?
  `).all(id, campaign.ends_at, campaign.starts_at) as any[];

  const conflicts: Array<{ id: string; code: string; name: string; reason: string }> = [];

  for (const other of actives) {
    const otherTargets = safeJson(other.targets, {});
    const myTargets = (campaign.targets as any);

    // Check if they share vendedores scope
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

export function simulateCampaign(campaignId: string, input: EvaluationContext, actor?: string) {
  const campaign = getCampaignById(campaignId);
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
  let limitReason = "";

  // Check period validity
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

      // Check maxBonus
      if (limits.maxPerVendedor && rewardResult.value > limits.maxPerVendedor) {
        premiacao.valor = limits.maxPerVendedor;
        premiacao.descricao += ` (limitado a R$ ${limits.maxPerVendedor})`;
      }
    }
  }

  const conflicts = detectConflicts(campaignId);
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

  // Persist simulation
  if (actor) {
    sqlite.prepare(`
      INSERT INTO campaign_simulations (id, campaign_id, input_data, result, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(randomUUID(), campaignId, JSON.stringify(input), JSON.stringify(result), actor);
  }

  return result;
}

export function getAuditLog(campaignId: string) {
  return sqlite.prepare(`
    SELECT * FROM campaign_audit_logs
    WHERE campaign_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(campaignId) as any[];
}

export function getVersions(campaignId: string) {
  const rows = sqlite.prepare(`
    SELECT * FROM campaign_versions
    WHERE campaign_id = ?
    ORDER BY version DESC
  `).all(campaignId) as any[];

  return rows.map(r => ({ ...r, snapshot: safeJson(r.snapshot, {}) }));
}

export function restoreVersion(campaignId: string, version: number, actor: string, reason?: string) {
  const vRow = sqlite.prepare(`
    SELECT * FROM campaign_versions WHERE campaign_id = ? AND version = ?
  `).get(campaignId, version) as any;
  if (!vRow) throw new Error("Versão não encontrada");

  const snapshot = safeJson(vRow.snapshot, null);
  if (!snapshot) throw new Error("Snapshot inválido");

  const existing = getCampaignById(campaignId);
  if (!existing) throw new Error("Campanha não encontrada");
  if (existing.status === "encerrada" || existing.status === "cancelada") {
    throw new Error("Não é possível restaurar versão de campanha encerrada ou cancelada");
  }

  // Apply snapshot but keep current id and status
  const restored = updateCampaign(
    campaignId,
    { ...snapshot, id: campaignId },
    actor,
    reason || `Restauração da versão ${version}`,
  );

  audit(campaignId, "restaurado", actor, { version: existing.current_version }, { version }, reason);
  return restored;
}
