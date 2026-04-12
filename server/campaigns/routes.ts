import { Router } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import * as service from "./service";
import * as apuracao from "./apuracao";
import { sqlite } from "../db";
import { storage } from "../storage";

const router = Router();

// ─── List campaigns ───────────────────────────────────────────────────────────
router.get("/", isAuthenticated, (req: AuthRequest, res) => {
  try {
    const campaigns = service.getCampaigns({
      status: req.query.status as string | undefined,
      campaign_type: req.query.campaign_type as string | undefined,
      search: req.query.search as string | undefined,
      starts_after: req.query.starts_after as string | undefined,
      ends_before: req.query.ends_before as string | undefined,
    });
    res.json(campaigns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get single campaign ──────────────────────────────────────────────────────
router.get("/:id", isAuthenticated, (req, res) => {
  try {
    const campaign = service.getCampaignById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });
    res.json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create campaign ──────────────────────────────────────────────────────────
router.post("/", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const campaign = service.createCampaign(req.body, actor);
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Update campaign ──────────────────────────────────────────────────────────
router.put("/:id", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const { change_reason, ...data } = req.body;
    const campaign = service.updateCampaign(req.params.id, data, actor, change_reason);
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Change campaign status ───────────────────────────────────────────────────
router.post("/:id/status", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const { status, reason } = req.body;
    if (!status) return res.status(400).json({ error: "status é obrigatório" });
    const campaign = service.changeStatus(req.params.id, status, actor, reason);
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Clone campaign ───────────────────────────────────────────────────────────
router.post("/:id/clone", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const campaign = service.cloneCampaign(req.params.id, actor);
    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Validate campaign ────────────────────────────────────────────────────────
router.get("/:id/validate", isAuthenticated, (req, res) => {
  try {
    const result = service.validateCampaign(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Detect conflicts ─────────────────────────────────────────────────────────
router.get("/:id/conflicts", isAuthenticated, (req, res) => {
  try {
    const conflicts = service.detectConflicts(req.params.id);
    res.json(conflicts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Simulate campaign ────────────────────────────────────────────────────────
router.post("/:id/simulate", isAuthenticated, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email;
    const result = service.simulateCampaign(req.params.id, req.body, actor);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Audit log ────────────────────────────────────────────────────────────────
router.get("/:id/audit", isAuthenticated, (req, res) => {
  try {
    const log = service.getAuditLog(req.params.id);
    res.json(log);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Version history ──────────────────────────────────────────────────────────
router.get("/:id/versions", isAuthenticated, (req, res) => {
  try {
    const versions = service.getVersions(req.params.id);
    res.json(versions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Restore version ──────────────────────────────────────────────────────────
router.post("/:id/restore/:version", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const { reason } = req.body;
    const campaign = service.restoreVersion(req.params.id, Number(req.params.version), actor, reason);
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Gatilhos: per-vendedor trigger goals for this campaign ───────────────────
router.get("/:id/gatilhos", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = service.getCampaignById(id);
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));

    const goals = sqlite.prepare(`
      SELECT salespersonId, triggerValue
      FROM campaign_goals
      WHERE campaignName = ? AND year = ?
    `).all(id, year) as { salespersonId: string; triggerValue: number }[];

    const salespersons = await storage.getSalespersons("1");

    const goalsMap = new Map(goals.map(g => [g.salespersonId, g.triggerValue]));

    res.json({
      campaign: { id: campaign.id, name: campaign.name, code: campaign.code },
      year,
      salespersons: salespersons.map(sp => ({
        id: sp.id,
        name: sp.name,
        triggerValue: goalsMap.get(sp.id) ?? null,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:id/gatilhos", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const campaign = service.getCampaignById(id);
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

    const { year, goals } = req.body as {
      year: number;
      goals: { salespersonId: string; triggerValue: number | null }[];
    };

    if (!year || !Array.isArray(goals)) {
      return res.status(400).json({ error: "year e goals são obrigatórios" });
    }

    const upsert = sqlite.prepare(`
      INSERT INTO campaign_goals (id, salespersonId, campaignName, year, triggerValue)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(salespersonId, campaignName, year)
      DO UPDATE SET triggerValue = excluded.triggerValue
    `);
    const del = sqlite.prepare(`
      DELETE FROM campaign_goals
      WHERE salespersonId = ? AND campaignName = ? AND year = ?
    `);

    sqlite.transaction(() => {
      for (const g of goals) {
        if (g.triggerValue === null || g.triggerValue === undefined) {
          del.run(g.salespersonId, id, year);
        } else {
          upsert.run(
            Math.random().toString(36).substring(2, 15),
            g.salespersonId,
            id,
            year,
            g.triggerValue,
          );
        }
      }
    })();

    res.json({ saved: goals.filter(g => g.triggerValue != null).length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Relatório: performance report for this campaign ─────────────────────────
router.get("/:id/relatorio", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = service.getCampaignById(id);
    if (!campaign) return res.status(404).json({ error: "Campanha não encontrada" });

    const year = parseInt((req.query.year as string) || String(new Date().getFullYear()));
    const quarter = req.query.quarter ? parseInt(req.query.quarter as string) : null;

    let startDate: string;
    let endDate: string;

    if (quarter) {
      const qMap: Record<number, [string, string]> = {
        1: [`${year}-01-01`, `${year}-03-31`],
        2: [`${year}-04-01`, `${year}-06-30`],
        3: [`${year}-07-01`, `${year}-09-30`],
        4: [`${year}-10-01`, `${year}-12-31`],
      };
      [startDate, endDate] = qMap[quarter] || [`${year}-01-01`, `${year}-12-31`];
    } else {
      startDate = campaign.starts_at || `${year}-01-01`;
      endDate = campaign.ends_at || `${year}-12-31`;
    }

    const suppliers: string[] = campaign.targets?.produtos?.suppliers || [];

    const goals = sqlite.prepare(`
      SELECT salespersonId, triggerValue
      FROM campaign_goals
      WHERE campaignName = ? AND year = ?
    `).all(id, year) as { salespersonId: string; triggerValue: number }[];
    const goalsMap = new Map(goals.map(g => [g.salespersonId, g.triggerValue]));

    // Get salesperson names from storage
    const allSalespersons = await storage.getSalespersons("1");

    // Calculate sales per salesperson from cache_campanhas (or cache_vendas if no supplier filter)
    let salesRows: { IDVENDEDOR: string; total: number }[];

    if (suppliers.length > 0) {
      const placeholders = suppliers.map(() => "?").join(",");
      salesRows = sqlite.prepare(`
        SELECT IDVENDEDOR,
          COALESCE(SUM(VALOR_LIQUIDO), 0) as total
        FROM cache_campanhas
        WHERE IDVENDEDOR IS NOT NULL AND IDVENDEDOR != ''
          AND DTMOVIMENTO >= ? AND DTMOVIMENTO <= ?
          AND FABRICANTE IN (${placeholders})
        GROUP BY IDVENDEDOR
      `).all(startDate, endDate, ...suppliers) as { IDVENDEDOR: string; total: number }[];
    } else {
      salesRows = sqlite.prepare(`
        SELECT IDVENDEDOR,
          COALESCE(SUM(VALOR_LIQUIDO), 0) as total
        FROM cache_vendas
        WHERE IDVENDEDOR IS NOT NULL AND IDVENDEDOR != ''
          AND DT_MOVIMENTO >= ? AND DT_MOVIMENTO <= ?
        GROUP BY IDVENDEDOR
      `).all(startDate, endDate) as { IDVENDEDOR: string; total: number }[];
    }

    const salesMap = new Map(salesRows.map(r => [r.IDVENDEDOR, r.total]));

    const results = allSalespersons.map(sp => {
      const targetTrigger = goalsMap.get(sp.id) ?? 0;
      const currentSales = salesMap.get(sp.id) ?? 0;
      const percentAchieved = targetTrigger > 0
        ? Math.round((currentSales / targetTrigger) * 10000) / 100
        : null;
      const isEligible = targetTrigger > 0 && currentSales >= targetTrigger;

      return {
        salespersonId: sp.id,
        salespersonName: sp.name,
        targetTrigger,
        currentSales,
        percentAchieved,
        isEligible,
        hasGoal: targetTrigger > 0,
      };
    });

    results.sort((a, b) => {
      if (a.hasGoal && !b.hasGoal) return -1;
      if (!a.hasGoal && b.hasGoal) return 1;
      return (b.percentAchieved ?? -1) - (a.percentAchieved ?? -1);
    });

    const withGoal = results.filter(r => r.hasGoal);
    const summary = {
      total: results.length,
      withGoal: withGoal.length,
      eligible: results.filter(r => r.isEligible).length,
      avgPercent: withGoal.length > 0
        ? Math.round(withGoal.reduce((s, r) => s + (r.percentAchieved ?? 0), 0) / withGoal.length * 10) / 10
        : 0,
      period: { startDate, endDate, year, quarter },
      suppliers,
    };

    res.json({ campaign: { id: campaign.id, name: campaign.name, code: campaign.code }, summary, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Vendor groups (for gatilhos filter) ─────────────────────────────────────
router.get("/:id/groups", isAuthenticated, async (_req, res) => {
  try {
    const groups = await storage.getVendorGroups();
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Apuração: run full calculation against sales data ────────────────────────
router.post("/:id/apurar", isAuthenticated, isAdmin, (req: AuthRequest, res) => {
  try {
    const actor = req.user?.email || "sistema";
    const result = apuracao.apurarCampanha(req.params.id, actor);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Resultados: get latest apuração result ───────────────────────────────────
router.get("/:id/resultados", isAuthenticated, (req, res) => {
  try {
    const result = apuracao.getLatestResult(req.params.id);
    if (!result) return res.status(404).json({ error: "Nenhuma apuração encontrada para esta campanha" });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Resultados histórico ─────────────────────────────────────────────────────
router.get("/:id/resultados/historico", isAuthenticated, (req, res) => {
  try {
    const results = apuracao.listResults(req.params.id);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export: resultados como CSV ──────────────────────────────────────────────
router.get("/:id/resultados/export.csv", isAuthenticated, (req, res) => {
  try {
    const result = apuracao.getLatestResult(req.params.id);
    if (!result) return res.status(404).json({ error: "Nenhuma apuração disponível" });

    const campaign = service.getCampaignById(req.params.id);
    const lines: string[] = [];
    lines.push(`"Campanha";"${result.campaignName}";"${result.campaignCode}"`);
    lines.push(`"Período";"${result.periodoInicio} a ${result.periodoFim}"`);
    lines.push(`"Modo";"${result.campaignMode}"`);
    lines.push(`"Apurado em";"${new Date(result.apuradoEm).toLocaleString("pt-BR")}"`);
    lines.push(`"Apurado por";"${result.apuradoPor}"`);
    lines.push(``);
    lines.push(
      `"Posição";"Vendedor";"ID";"Elegível";"Participou";"Gatilho Atingido";"Atingiu";"Premiado";"Valor Apurado (R$)";"Valor Pagamento (R$)";"Qtd";"Mix (produtos)";"Gatilho Alvo (R$)";"Prêmio Calculado (R$)";"Prêmio Final (R$)";"Fórmula";"Motivos Não Participação"`,
    );

    const sorted = [...result.detalhes].sort((a, b) => {
      if (a.posicao && b.posicao) return a.posicao - b.posicao;
      if (a.posicao) return -1;
      if (b.posicao) return 1;
      return b.valorApuracao - a.valorApuracao;
    });

    for (const d of sorted) {
      const boolStr = (v: boolean) => v ? "Sim" : "Não";
      const numStr = (v: number) => v.toFixed(2).replace(".", ",");
      lines.push(
        `"${d.posicao ?? "-"}";"${d.vendedorNome}";"${d.vendedorId}";` +
        `"${boolStr(d.elegivel)}";"${boolStr(d.participou)}";"${boolStr(d.gatilhoAtingido)}";` +
        `"${boolStr(d.atingiu)}";"${boolStr(d.premiado)}";"${numStr(d.valorApuracao)}";` +
        `"${numStr(d.valorPagamento)}";"${d.qtdTotal.toFixed(0)}";"${d.mixCount}";` +
        `"${numStr(d.gatilhoValor)}";"${numStr(d.premioCalculado)}";"${numStr(d.premioFinal)}";` +
        `"${(d.memoriaCalculo?.formulaPremio || "").replace(/"/g, "'")}";"${(d.motivosNaoParticipacao || []).join("; ").replace(/"/g, "'")}"`,
      );
    }

    lines.push(``);
    lines.push(`"RESUMO"`);
    lines.push(`"Total elegíveis";"${result.totalElegiveis}"`);
    lines.push(`"Total participantes";"${result.totalParticipantes}"`);
    lines.push(`"Total atingidos";"${result.totalAtingidos}"`);
    lines.push(`"Total premiados";"${result.totalPremiados}"`);
    lines.push(`"Valor total apurado (R$)";"${result.valorTotalApuracao.toFixed(2).replace(".", ",")}"`);
    lines.push(`"Valor total premiação (R$)";"${result.valorTotalPremio.toFixed(2).replace(".", ",")}"`);

    const csv = lines.join("\r\n");
    const filename = `apuracao_${campaign?.code || req.params.id}_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
