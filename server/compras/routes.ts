/**
 * Copiloto de Compras — API Routes
 *
 * Todos os endpoints /api/compras/* estão aqui.
 * Todos protegidos por isAuthenticated.
 */

import { Router } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import * as service from "./service";

const router = Router();

router.get("/dashboard", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const kpis = await service.getDashboardKPIs();
    res.json(kpis);
  } catch (err: any) {
    console.error("[compras/dashboard]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/alertas", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const alertas = await service.getAlertas({
      status: req.query.status as string | undefined,
      tipo: req.query.tipo as string | undefined,
      fabricante: req.query.fabricante as string | undefined,
      severidade: req.query.severidade as string | undefined,
    });
    res.json(alertas);
  } catch (err: any) {
    console.error("[compras/alertas]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fornecedores", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const ranking = await service.getRankingFornecedores();
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/fornecedores]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/fornecedores/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(req.params.id);
    const detalhe = await service.getDetalheFornecedor(fabricante);
    res.json(detalhe);
  } catch (err: any) {
    console.error("[compras/fornecedores/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/produtos", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const ranking = await service.getRankingProdutos({
      urgencia: req.query.urgencia as string | undefined,
      fabricante: req.query.fabricante as string | undefined,
    });
    res.json(ranking);
  } catch (err: any) {
    console.error("[compras/produtos]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/produtos/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const produtoId = decodeURIComponent(req.params.id);
    const detalhe = await service.getDetalheProduto(produtoId);
    res.json(detalhe);
  } catch (err: any) {
    console.error("[compras/produtos/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/sugestoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const sugestoes = await service.getSugestoes({
      urgencia: req.query.urgencia as string | undefined,
      fabricante: req.query.fabricante as string | undefined,
    });
    res.json(sugestoes);
  } catch (err: any) {
    console.error("[compras/sugestoes]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/sugestoes/fornecedor/:id", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const fabricante = decodeURIComponent(req.params.id);
    const sugestoes = await service.getSugestoesPorFornecedor(fabricante);
    res.json(sugestoes);
  } catch (err: any) {
    console.error("[compras/sugestoes/fornecedor/:id]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/simulacao", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { produtoIds, quantidades } = req.body as {
      produtoIds: string[];
      quantidades: Record<string, number>;
    };

    if (!Array.isArray(produtoIds) || produtoIds.length === 0) {
      return res.status(400).json({ error: "produtoIds é obrigatório e deve ser um array não vazio" });
    }
    if (!quantidades || typeof quantidades !== "object") {
      return res.status(400).json({ error: "quantidades é obrigatório e deve ser um objeto" });
    }

    const resultado = await service.runSimulacao(produtoIds, quantidades);
    res.json(resultado);
  } catch (err: any) {
    console.error("[compras/simulacao]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/notificacoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const notificacoes = await service.getNotificacoesUsuario(userId);
    res.json(notificacoes);
  } catch (err: any) {
    console.error("[compras/notificacoes]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/notificacoes/:id/read", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const alertId = req.params.id;
    const userId = req.userId!;
    const ok = await service.marcarNotificacaoLida(alertId, userId);
    if (!ok) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/notificacoes/:id/read]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/notificacoes/:id/reconhecer", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const alertId = req.params.id;
    const userId = req.userId!;
    const ok = await service.reconhecerAlerta(alertId, userId);
    if (!ok) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/notificacoes/:id/reconhecer]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/notificacoes/:id/adiar", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const alertId = req.params.id;
    const userId = req.userId!;
    const { snoozeAte } = req.body as { snoozeAte: string };
    if (!snoozeAte) return res.status(400).json({ error: "snoozeAte é obrigatório" });
    const ok = await service.adiarAlerta(alertId, userId, snoozeAte);
    if (!ok) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/notificacoes/:id/adiar]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/notificacoes/silenciar", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { alertId, motivo } = req.body as { alertId: string; motivo?: string };
    if (!alertId) return res.status(400).json({ error: "alertId é obrigatório" });
    const userId = req.userId!;
    const ok = await service.silenciarAlerta(alertId, userId, motivo);
    if (!ok) return res.status(404).json({ error: "Alerta não encontrado" });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/notificacoes/silenciar]", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/configuracoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const configuracoes = await service.getConfiguracoes(userId);
    res.json(configuracoes);
  } catch (err: any) {
    console.error("[compras/configuracoes]", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/configuracoes", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { alertas, som } = req.body as {
      alertas?: Record<string, unknown>;
      som?: Record<string, unknown>;
    };
    await service.salvarPreferenciasUsuario(userId, { alertas, som });
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/configuracoes PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/configuracoes/global", isAuthenticated, isAdmin, async (req: AuthRequest, res) => {
  try {
    const config = req.body as Record<string, unknown>;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return res.status(400).json({ error: "Body deve ser um objeto de configurações" });
    }
    await service.salvarConfiguracoesGlobais(config);
    res.json({ success: true });
  } catch (err: any) {
    console.error("[compras/configuracoes/global PUT]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
