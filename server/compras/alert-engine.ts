/**
 * Copiloto de Compras — Motor de Alertas de Compras
 *
 * Avalia periodicamente o estoque e gera alertas de compras com:
 *   - Deduplicação por hash
 *   - Cooldown configurável por tipo de alerta
 *   - Controle de estado: novo, lido, reconhecido, adiado, resolvido, reaberto
 *   - Silenciamento é por-usuário (alert_delivery_state.silenciado_em), não muda status global
 *
 * Regras implementadas:
 *   - ruptura_iminente: cobertura <= lead time
 *   - abaixo_seguranca: estoque < estoque de segurança
 *   - lead_time_maior_cobertura: lead time supera cobertura atual
 *   - fornecedor_critico: fornecedor com múltiplos SKUs críticos
 *   - excesso_estoque: cobertura > 3x a cobertura alvo (sem giro)
 *   - pedido_insuficiente: pedidos abertos não cobrem ponto de reposição
 *
 * Campos ausentes que viriam do ERP (documentados):
 *   - ESTOQUE_ATUAL: cache_estoque.QTDESTOQUE (tabela ainda não sincronizada)
 *   - LEAD_TIME_DIAS: cache_fornecedores.LEAD_TIME (tabela ainda não sincronizada)
 *   - ESTOQUE_SEGURANCA: purchase_settings.estoque_seguranca_padrao ou por produto
 */

import { pgGet, pgAll, pgRun } from "../pg-client";
import { randomUUID, createHash } from "crypto";
import { calcularTodasSugestoes, type SuggestionEngineConfig } from "./suggestion-engine";

const EVAL_INTERVAL_MS = 30 * 60 * 1000;
let engineStarted = false;

type AlertStatus =
  | "novo"
  | "lido"
  | "reconhecido"
  | "adiado"
  | "silenciado"
  | "resolvido"
  | "reaberto";

type AlertType =
  | "ruptura_iminente"
  | "abaixo_seguranca"
  | "lead_time_maior_cobertura"
  | "fornecedor_critico"
  | "excesso_estoque"
  | "pedido_insuficiente";

interface PurchaseAlertRow {
  id: string;
  tipo: AlertType;
  produto_id: string | null;
  fabricante: string | null;
  hash: string;
  status: AlertStatus;
  severidade: string;
  titulo: string;
  mensagem: string;
  dados: string;
  cooldown_ate: string | null;
  snooze_ate: string | null;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

const COOLDOWN_BY_TYPE: Record<AlertType, number> = {
  ruptura_iminente: 4 * 60 * 60 * 1000,
  abaixo_seguranca: 24 * 60 * 60 * 1000,
  lead_time_maior_cobertura: 24 * 60 * 60 * 1000,
  fornecedor_critico: 12 * 60 * 60 * 1000,
  excesso_estoque: 48 * 60 * 60 * 1000,
  pedido_insuficiente: 8 * 60 * 60 * 1000,
};

function makeHash(tipo: string, produtoId: string | null, fabricante: string | null): string {
  return createHash("sha256")
    .update(`${tipo}|${produtoId ?? ""}|${fabricante ?? ""}`)
    .digest("hex")
    .substring(0, 32);
}

async function alertaJaAtivo(hash: string): Promise<boolean> {
  try {
    const row = await pgGet<{ id: string; status: string; cooldown_ate: string | null }>(
      `SELECT id, status, cooldown_ate FROM purchase_alerts WHERE hash = ? AND status NOT IN ('resolvido')`,
      [hash],
    );
    if (!row) return false;

    if (row.cooldown_ate) {
      const cooldownExpiry = new Date(row.cooldown_ate).getTime();
      if (Date.now() < cooldownExpiry) return true;
    }

    if (row.status === "adiado") {
      const snoozed = await pgGet<{ snooze_ate: string | null }>(
        `SELECT snooze_ate FROM alert_snoozes WHERE alert_id = ? ORDER BY created_at DESC LIMIT 1`,
        [row.id],
      );
      if (snoozed?.snooze_ate) {
        const snoozeExpiry = new Date(snoozed.snooze_ate).getTime();
        if (Date.now() < snoozeExpiry) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

async function criarOuReabrirAlerta(
  tipo: AlertType,
  produtoId: string | null,
  fabricante: string | null,
  titulo: string,
  mensagem: string,
  severidade: string,
  dados: Record<string, unknown>,
): Promise<void> {
  const hash = makeHash(tipo, produtoId, fabricante);
  const now = new Date().toISOString();
  const cooldownMs = COOLDOWN_BY_TYPE[tipo] ?? 24 * 60 * 60 * 1000;
  const cooldownAte = new Date(Date.now() + cooldownMs).toISOString();

  const existing = await pgGet<{ id: string; status: string }>(
    `SELECT id, status FROM purchase_alerts WHERE hash = ?`,
    [hash],
  );

  if (existing) {
    if (existing.status === "resolvido" || existing.status === "silenciado") {
      // Condição resolvida/silenciada anteriormente — reabrir e reiniciar cooldown
      await pgRun(
        `UPDATE purchase_alerts
         SET status = 'reaberto', titulo = ?, mensagem = ?, dados = ?,
             cooldown_ate = ?, updated_at = ?
         WHERE id = ?`,
        [titulo, mensagem, JSON.stringify(dados), cooldownAte, now, existing.id],
      );
      await pgRun(
        `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
         VALUES (?, ?, 'reaberto', ?, ?)`,
        [randomUUID(), existing.id, JSON.stringify({ motivo: "reavaliação automática" }), now],
      );
    } else {
      // Alerta ativo mas cooldown expirou — atualizar dados e reiniciar cooldown
      // (permite nova notificação ao usuário após período de cooldown)
      await pgRun(
        `UPDATE purchase_alerts
         SET titulo = ?, mensagem = ?, dados = ?, cooldown_ate = ?, updated_at = ?
         WHERE id = ?`,
        [titulo, mensagem, JSON.stringify(dados), cooldownAte, now, existing.id],
      );
      await pgRun(
        `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
         VALUES (?, ?, 'atualizado', ?, ?)`,
        [randomUUID(), existing.id, JSON.stringify({ motivo: "cooldown expirado, reagendado" }), now],
      );
    }
  } else {
    const id = randomUUID();
    await pgRun(
      `INSERT INTO purchase_alerts
         (id, tipo, produto_id, fabricante, hash, status, severidade, titulo, mensagem,
          dados, cooldown_ate, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'novo', ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tipo, produtoId, fabricante, hash, severidade, titulo, mensagem,
        JSON.stringify(dados), cooldownAte, now, now,
      ],
    );
    await pgRun(
      `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
       VALUES (?, ?, 'criado', ?, ?)`,
      [randomUUID(), id, JSON.stringify({ tipo, produtoId, fabricante }), now],
    );
  }
}

async function resolverAlertasObsoletos(hashesAtivos: Set<string>): Promise<void> {
  try {
    const ativos = await pgAll<{ id: string; hash: string }>(
      `SELECT id, hash FROM purchase_alerts WHERE status NOT IN ('resolvido')`,
    );

    const now = new Date().toISOString();
    for (const row of ativos) {
      if (!hashesAtivos.has(row.hash)) {
        await pgRun(
          `UPDATE purchase_alerts SET status = 'resolvido', updated_at = ? WHERE id = ?`,
          [now, row.id],
        );
        await pgRun(
          `INSERT INTO purchase_alert_events (id, alert_id, evento, dados, created_at)
           VALUES (?, ?, 'resolvido', ?, ?)`,
          [randomUUID(), row.id, JSON.stringify({ motivo: "condição normalizada" }), now],
        );
      }
    }
  } catch (err) {
    console.error("[ComprasAlertEngine] Erro ao resolver alertas obsoletos:", err);
  }
}

async function runEvaluationCycle(): Promise<void> {
  console.log("[ComprasAlertEngine] Iniciando ciclo de avaliação...");

  try {
    const config = await pgGet<{ valor: string }>(
      `SELECT valor FROM purchase_settings WHERE chave = 'engine_config'`,
    );

    let engineCfg: Partial<SuggestionEngineConfig> = {};
    if (config?.valor) {
      try {
        engineCfg = JSON.parse(config.valor);
      } catch {
        /* usa padrão */
      }
    }

    const sugestoes = await calcularTodasSugestoes(engineCfg);

    if (sugestoes.length === 0) {
      console.log("[ComprasAlertEngine] Sem dados de produtos para avaliar.");
      return;
    }

    const hashesAtivos = new Set<string>();

    for (const s of sugestoes) {
      if (s.coberturaDias <= 0 || (s.leadTimeDias > 0 && s.coberturaDias <= s.leadTimeDias)) {
        const hash = makeHash("ruptura_iminente", s.produtoId, s.fabricante);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "ruptura_iminente",
            s.produtoId,
            s.fabricante,
            `Ruptura iminente: ${s.produtoId}`,
            `Produto ${s.produtoId} (${s.fabricante}) tem cobertura de ${s.coberturaDias.toFixed(1)} dias, menor ou igual ao lead time de ${s.leadTimeDias} dias.`,
            "critical",
            { coberturaDias: s.coberturaDias, leadTimeDias: s.leadTimeDias },
          );
        }
      }

      if (s.estoqueAtual < s.estoqueSeguranca && s.estoqueSeguranca > 0) {
        const hash = makeHash("abaixo_seguranca", s.produtoId, s.fabricante);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "abaixo_seguranca",
            s.produtoId,
            s.fabricante,
            `Abaixo do estoque de segurança: ${s.produtoId}`,
            `Estoque atual (${s.estoqueAtual}) abaixo do estoque de segurança (${s.estoqueSeguranca}) para o produto ${s.produtoId}.`,
            "warning",
            { estoqueAtual: s.estoqueAtual, estoqueSeguranca: s.estoqueSeguranca },
          );
        }
      }

      if (s.leadTimeDias > s.coberturaDias && s.coberturaDias > 0) {
        const hash = makeHash("lead_time_maior_cobertura", s.produtoId, s.fabricante);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "lead_time_maior_cobertura",
            s.produtoId,
            s.fabricante,
            `Lead time maior que cobertura: ${s.produtoId}`,
            `Lead time (${s.leadTimeDias} dias) é maior que a cobertura atual (${s.coberturaDias.toFixed(1)} dias) para ${s.produtoId}.`,
            "warning",
            { leadTimeDias: s.leadTimeDias, coberturaDias: s.coberturaDias },
          );
        }
      }

      const coberturaExcesso = s.coberturaAlvoDias * 3;
      if (s.coberturaDias > coberturaExcesso && s.consumoMedioDiario > 0) {
        const hash = makeHash("excesso_estoque", s.produtoId, s.fabricante);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "excesso_estoque",
            s.produtoId,
            s.fabricante,
            `Excesso de estoque: ${s.produtoId}`,
            `Produto ${s.produtoId} tem cobertura de ${s.coberturaDias.toFixed(0)} dias (${(s.coberturaDias / s.coberturaAlvoDias).toFixed(1)}x acima do alvo).`,
            "info",
            { coberturaDias: s.coberturaDias, coberturaAlvoDias: s.coberturaAlvoDias },
          );
        }
      }

      const pontoReposicao = s.pontoReposicao;
      if (
        s.pedidosAbertos > 0 &&
        s.pedidosAbertos < pontoReposicao &&
        s.urgencia !== "ok"
      ) {
        const hash = makeHash("pedido_insuficiente", s.produtoId, s.fabricante);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "pedido_insuficiente",
            s.produtoId,
            s.fabricante,
            `Pedido em aberto insuficiente: ${s.produtoId}`,
            `Pedidos em aberto (${s.pedidosAbertos}) insuficientes para atingir ponto de reposição (${pontoReposicao.toFixed(0)}) do produto ${s.produtoId}.`,
            "warning",
            { pedidosAbertos: s.pedidosAbertos, pontoReposicao },
          );
        }
      }
    }

    const fabricantesCriticos = new Map<string, number>();
    for (const s of sugestoes) {
      if (s.urgencia === "critica" || s.urgencia === "alta") {
        fabricantesCriticos.set(
          s.fabricante,
          (fabricantesCriticos.get(s.fabricante) ?? 0) + 1,
        );
      }
    }

    for (const [fab, count] of fabricantesCriticos.entries()) {
      if (count >= 3) {
        const hash = makeHash("fornecedor_critico", null, fab);
        hashesAtivos.add(hash);
        if (!(await alertaJaAtivo(hash))) {
          await criarOuReabrirAlerta(
            "fornecedor_critico",
            null,
            fab,
            `Fornecedor crítico: ${fab}`,
            `Fornecedor ${fab} tem ${count} SKUs com urgência crítica ou alta.`,
            "critical",
            { fabricante: fab, skusCriticos: count },
          );
        }
      }
    }

    await resolverAlertasObsoletos(hashesAtivos);

    console.log(
      `[ComprasAlertEngine] Ciclo completo. ${sugestoes.length} produtos avaliados, ${hashesAtivos.size} alertas ativos.`,
    );
  } catch (err) {
    console.error("[ComprasAlertEngine] Erro no ciclo de avaliação:", err);
  }
}

export function startComprasAlertEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  runEvaluationCycle().catch(console.error);
  setInterval(() => runEvaluationCycle().catch(console.error), EVAL_INTERVAL_MS);
  console.log(
    `[ComprasAlertEngine] Iniciado. Avaliando a cada ${EVAL_INTERVAL_MS / 60000} minutos.`,
  );
}
