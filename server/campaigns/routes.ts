import { Router } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import * as service from "./service";

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

export default router;
