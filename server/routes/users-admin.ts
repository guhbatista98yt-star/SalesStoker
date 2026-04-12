import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { AuthRequest, isAuthenticated, isAdmin } from "../auth";
import { pgGet, pgAll, pgRun } from "../pg-client";

const router = Router();

// ── Audit helper ────────────────────────────────────────────────────────────

async function writeAudit(opts: {
  actorId?: number;
  actorEmail?: string;
  targetId?: number;
  targetEmail?: string;
  action: string;
  entity: string;
  before?: any;
  after?: any;
  ip?: string;
}) {
  try {
    await pgRun(
      `INSERT INTO access_audit (actor_id, actor_email, target_id, target_email, action, entity, before_val, after_val, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opts.actorId ?? null,
        opts.actorEmail ?? null,
        opts.targetId ?? null,
        opts.targetEmail ?? null,
        opts.action,
        opts.entity,
        opts.before ? JSON.stringify(opts.before) : null,
        opts.after ? JSON.stringify(opts.after) : null,
        opts.ip ?? null,
      ]
    );
  } catch { /* audit must not break requests */ }
}

function onlyAdmin(req: AuthRequest, res: Response): boolean {
  if (req.userRole !== "admin") {
    res.status(403).json({ message: "Acesso restrito a administradores" });
    return false;
  }
  return true;
}

// ── USERS ───────────────────────────────────────────────────────────────────

// List users
router.get("/users", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { search = "", role = "", status = "" } = req.query as Record<string, string>;
    let where = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (search) {
      where += ` AND (LOWER(u.email) LIKE $${idx} OR LOWER(COALESCE(u.first_name,'')) LIKE $${idx} OR LOWER(COALESCE(u.last_name,'')) LIKE $${idx} OR LOWER(COALESCE(u.display_name,'')) LIKE $${idx})`;
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }
    if (role) {
      where += ` AND u.role = $${idx}`;
      params.push(role);
      idx++;
    }
    if (status) {
      where += ` AND COALESCE(u.status, 'ativo') = $${idx}`;
      params.push(status);
      idx++;
    }

    const rows = await pgAll<any>(`
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.display_name,
        u.role, u.vendor_code, u.phone, u.cargo, u.company_id,
        u.supervisor_id, u.team_members, u.module_permissions,
        COALESCE(u.status, 'ativo') AS status,
        u.last_login_at, u.notes, u.created_by,
        u.created_at, u.updated_at,
        s.first_name AS supervisor_first_name, s.last_name AS supervisor_last_name
      FROM users u
      LEFT JOIN users s ON s.id = u.supervisor_id
      ${where}
      ORDER BY u.created_at DESC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error("GET /admin/users error:", err);
    res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

// Get single user
router.get("/users/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const user = await pgGet<any>(
      `SELECT u.*, COALESCE(u.status, 'ativo') AS status,
              s.first_name AS supervisor_first_name, s.last_name AS supervisor_last_name
       FROM users u
       LEFT JOIN users s ON s.id = u.supervisor_id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar usuário" });
  }
});

// Create user
router.post("/users", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const {
      email, password, firstName, lastName, displayName,
      role = "vendedor", vendorCode, phone, cargo,
      companyId, supervisorId, teamMembers, modulePermissions,
      notes, status = "ativo",
    } = req.body;

    if (!email) return res.status(400).json({ message: "Email é obrigatório" });
    if (!password || password.length < 6) return res.status(400).json({ message: "Senha mínima: 6 caracteres" });

    const existing = await pgGet<{ id: number }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [email]);
    if (existing) return res.status(400).json({ message: "Este login já está em uso" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = await pgGet<any>(`
      INSERT INTO users (
        email, password, first_name, last_name, display_name,
        role, vendor_code, phone, cargo, company_id, supervisor_id,
        team_members, module_permissions, notes, status, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id, email, first_name, last_name, display_name, role, status, created_at
    `, [
      email, hashed, firstName || null, lastName || null, displayName || null,
      role, vendorCode || null, phone || null, cargo || null,
      companyId || null, supervisorId || null,
      teamMembers || null,
      modulePermissions ? JSON.stringify(modulePermissions) : null,
      notes || null, status, req.userId,
    ]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      targetId: newUser!.id, targetEmail: email,
      action: "criar_usuario", entity: "users",
      after: { email, role, status },
      ip: req.ip,
    });

    res.status(201).json(newUser);
  } catch (err) {
    console.error("POST /admin/users error:", err);
    res.status(500).json({ message: "Erro ao criar usuário" });
  }
});

// Update user
router.put("/users/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uid = parseInt(req.params.id);
    const before = await pgGet<any>("SELECT * FROM users WHERE id = $1", [uid]);
    if (!before) return res.status(404).json({ message: "Usuário não encontrado" });

    const {
      firstName, lastName, displayName, role,
      vendorCode, phone, cargo, companyId, supervisorId,
      teamMembers, modulePermissions, notes,
    } = req.body;

    await pgRun(`
      UPDATE users SET
        first_name = $1, last_name = $2, display_name = $3, role = $4,
        vendor_code = $5, phone = $6, cargo = $7, company_id = $8,
        supervisor_id = $9, team_members = $10, module_permissions = $11,
        notes = $12, updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
    `, [
      firstName ?? before.first_name,
      lastName ?? before.last_name,
      displayName ?? before.display_name,
      role ?? before.role,
      vendorCode ?? before.vendor_code,
      phone ?? before.phone,
      cargo ?? before.cargo,
      companyId ?? before.company_id,
      supervisorId ?? before.supervisor_id,
      teamMembers ?? before.team_members,
      modulePermissions !== undefined ? JSON.stringify(modulePermissions) : before.module_permissions,
      notes ?? before.notes,
      uid,
    ]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      targetId: uid, targetEmail: before.email,
      action: "editar_usuario", entity: "users",
      before: { role: before.role, cargo: before.cargo },
      after: { role: role ?? before.role, cargo: cargo ?? before.cargo },
      ip: req.ip,
    });

    const updated = await pgGet<any>("SELECT * FROM users WHERE id = $1", [uid]);
    res.json(updated);
  } catch (err) {
    console.error("PUT /admin/users/:id error:", err);
    res.status(500).json({ message: "Erro ao atualizar usuário" });
  }
});

// Change user status (ativo/inativo/bloqueado)
router.patch("/users/:id/status", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uid = parseInt(req.params.id);
    const { status } = req.body;
    const allowed = ["ativo", "inativo", "bloqueado"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Status inválido. Use: ativo, inativo ou bloqueado" });
    }

    const before = await pgGet<any>("SELECT id, email, status FROM users WHERE id = $1", [uid]);
    if (!before) return res.status(404).json({ message: "Usuário não encontrado" });
    if (uid === req.userId) return res.status(400).json({ message: "Não é possível alterar seu próprio status" });

    await pgRun("UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [status, uid]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      targetId: uid, targetEmail: before.email,
      action: `status_${status}`, entity: "users",
      before: { status: before.status },
      after: { status },
      ip: req.ip,
    });

    res.json({ message: `Usuário ${status}` });
  } catch (err) {
    res.status(500).json({ message: "Erro ao alterar status" });
  }
});

// Reset password
router.post("/users/:id/reset-password", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const uid = parseInt(req.params.id);
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Senha mínima: 6 caracteres" });
    }

    const user = await pgGet<any>("SELECT id, email FROM users WHERE id = $1", [uid]);
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pgRun("UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [hashed, uid]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      targetId: uid, targetEmail: user.email,
      action: "resetar_senha", entity: "users",
      ip: req.ip,
    });

    res.json({ message: "Senha redefinida com sucesso" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao redefinir senha" });
  }
});

// ── ROLES ───────────────────────────────────────────────────────────────────

// List roles
router.get("/roles", isAuthenticated, isAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const roles = await pgAll<any>("SELECT * FROM roles ORDER BY is_system DESC, display_name ASC");
    res.json(roles);
  } catch (err) {
    res.status(500).json({ message: "Erro ao listar perfis" });
  }
});

// Create role
router.post("/roles", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { name, displayName, description } = req.body;
    if (!name || !displayName) return res.status(400).json({ message: "Nome e nome de exibição são obrigatórios" });

    const slug = name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const existing = await pgGet<{ id: number }>("SELECT id FROM roles WHERE name = $1", [slug]);
    if (existing) return res.status(400).json({ message: "Já existe um perfil com este identificador" });

    const role = await pgGet<any>(`
      INSERT INTO roles (name, display_name, description, is_system)
      VALUES ($1, $2, $3, FALSE)
      RETURNING *
    `, [slug, displayName, description || null]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      action: "criar_perfil", entity: "roles",
      after: { name: slug, displayName },
      ip: req.ip,
    });

    res.status(201).json(role);
  } catch (err) {
    res.status(500).json({ message: "Erro ao criar perfil" });
  }
});

// Update role
router.put("/roles/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, description } = req.body;
    const role = await pgGet<any>("SELECT * FROM roles WHERE id = $1", [req.params.id]);
    if (!role) return res.status(404).json({ message: "Perfil não encontrado" });

    await pgRun(
      "UPDATE roles SET display_name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [displayName ?? role.display_name, description ?? role.description, req.params.id]
    );

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      action: "editar_perfil", entity: "roles",
      before: { displayName: role.display_name },
      after: { displayName },
      ip: req.ip,
    });

    res.json({ message: "Perfil atualizado" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao atualizar perfil" });
  }
});

// Delete role (only non-system)
router.delete("/roles/:id", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const role = await pgGet<any>("SELECT * FROM roles WHERE id = $1", [req.params.id]);
    if (!role) return res.status(404).json({ message: "Perfil não encontrado" });
    if (role.is_system) return res.status(400).json({ message: "Perfis de sistema não podem ser excluídos" });

    await pgRun("DELETE FROM roles WHERE id = $1", [req.params.id]);

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      action: "excluir_perfil", entity: "roles",
      before: { name: role.name, displayName: role.display_name },
      ip: req.ip,
    });

    res.json({ message: "Perfil excluído" });
  } catch (err) {
    res.status(500).json({ message: "Erro ao excluir perfil" });
  }
});

// ── PERMISSIONS ─────────────────────────────────────────────────────────────

// Get permissions for a role
router.get("/roles/:id/permissions", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const perms = await pgAll<any>(
      "SELECT module, action, scope FROM role_permissions WHERE role_id = $1",
      [req.params.id]
    );
    res.json(perms);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar permissões" });
  }
});

// Set permissions for a role (full replace)
router.put("/roles/:id/permissions", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const roleId = parseInt(req.params.id);
    const role = await pgGet<any>("SELECT id, name FROM roles WHERE id = $1", [roleId]);
    if (!role) return res.status(404).json({ message: "Perfil não encontrado" });

    const { permissions } = req.body as {
      permissions: Array<{ module: string; action: string; scope: string }>;
    };

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "Campo permissions deve ser um array" });
    }

    const before = await pgAll<any>(
      "SELECT module, action, scope FROM role_permissions WHERE role_id = $1",
      [roleId]
    );

    await pgRun("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

    for (const p of permissions) {
      await pgRun(
        "INSERT INTO role_permissions (role_id, module, action, scope) VALUES ($1,$2,$3,$4) ON CONFLICT (role_id, module, action) DO UPDATE SET scope = $4",
        [roleId, p.module, p.action, p.scope || "all"]
      );
    }

    await writeAudit({
      actorId: req.userId, actorEmail: req.userEmail,
      action: "editar_permissoes", entity: "role_permissions",
      before: { roleId, count: before.length },
      after: { roleId, count: permissions.length },
      ip: req.ip,
    });

    res.json({ message: "Permissões salvas" });
  } catch (err) {
    console.error("PUT /roles/:id/permissions error:", err);
    res.status(500).json({ message: "Erro ao salvar permissões" });
  }
});

// ── AUDIT LOG ───────────────────────────────────────────────────────────────

router.get("/audit", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { limit = "100", entity = "", actor = "" } = req.query as Record<string, string>;
    let where = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;
    if (entity) { where += ` AND entity = $${idx}`; params.push(entity); idx++; }
    if (actor) { where += ` AND (LOWER(actor_email) LIKE $${idx})`; params.push(`%${actor.toLowerCase()}%`); idx++; }

    const rows = await pgAll<any>(`
      SELECT * FROM access_audit ${where}
      ORDER BY created_at DESC
      LIMIT $${idx}
    `, [...params, parseInt(limit)]);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Erro ao buscar auditoria" });
  }
});

export default router;
