import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { pgGet, pgAll, pgRun } from "./pg-client";
import { users, DEFAULT_MODULE_PERMISSIONS } from "@shared/models/auth";
import { eq, sql } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}
const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY ?? "30d";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CAN_SEED_DEFAULT_USERS =
  process.env.SEED_DEFAULT_USERS === "true" || (!IS_PRODUCTION && process.env.NODE_ENV === "development");

function getSeedPassword(envName: string, developmentFallback: string): string {
  const configured = process.env[envName];
  if (IS_PRODUCTION) {
    if (!configured || configured.length < 12) {
      throw new Error(`${envName} must be set with at least 12 characters when SEED_DEFAULT_USERS=true in production`);
    }
    return configured;
  }
  return configured ?? developmentFallback;
}

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userEmail?: string;
  userFirstName?: string;
  userVendorCode?: string;
  teamMembers?: string[];
}

async function seedDefaultUsers() {
  if (!CAN_SEED_DEFAULT_USERS) {
    console.warn("[auth] Seed automático de usuários padrão desativado. Configure usuários reais para produção.");
    return;
  }
  const lojaPassword = getSeedPassword("DEFAULT_LOJA_PASSWORD", "loja2024");
  try {
    const existing = await pgGet<{ id: number }>("SELECT id FROM users WHERE email = $1", ["loja"]);
    if (!existing) {
      const hashedPass = await bcrypt.hash(lojaPassword, 10);
      await pgRun(
        "INSERT INTO users (email, password, first_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
        ["loja", hashedPass, "Loja", "loja"]
      );
      console.log("Usuário 'loja' criado automaticamente.");
    }
  } catch (e) {
    console.error("Erro ao criar usuário loja:", e);
  }
}

const VENDOR_MODULE_CODES: Record<string, string> = {
  "1014115": "C4821",
  "14093":   "C3076",
  "1004249": "C1547",
  "10421":   "C7839",
  "1014938": "C2954",
  "10774":   "C6183",
  "1004703": "C9247",
  "11033":   "C5360",
  "11038":   "C8512",
  "1014856": "C4093",
  "1012888": "C7428",
  "10965":   "C2671",
  "11704":   "C5834",
};

async function seedSalespersonUsers() {
  if (!CAN_SEED_DEFAULT_USERS) {
    return;
  }
  const vendorPassword = getSeedPassword("DEFAULT_VENDOR_PASSWORD", "1234");
  try {
    const hashedPass = await bcrypt.hash(vendorPassword, 10);
    let addedCount = 0;

    // Only create users for vendors explicitly listed in VENDOR_MODULE_CODES.
    // Never create name-based users — they accumulate duplicates on every restart.
    for (const [vendorId, moduleCode] of Object.entries(VENDOR_MODULE_CODES)) {
      const nameRow = await pgGet<{ name: string }>(
        `SELECT MAX("NOME_VENDEDOR") as name FROM cache_vendas WHERE CAST("IDVENDEDOR" AS TEXT) = $1`,
        [vendorId]
      );
      if (!nameRow?.name) continue;

      const inserted = await pgRun(
        "INSERT INTO users (email, password, first_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
        [moduleCode, hashedPass, nameRow.name, "vendedor"]
      );
      if ((inserted as any).rowCount > 0) addedCount++;
    }

    if (addedCount > 0) {
      console.log(`Criados ${addedCount} usuários de vendedores.`);
    }
  } catch (e) {
    console.error("Erro ao sincronizar vendedores para usuários:", (e as Error).message);
  }
}

export async function seedAuthUsersIfNeeded(): Promise<void> {
  await seedDefaultUsers();
  await seedSalespersonUsers();
}

// Reverse map: moduleCode (C4821) → vendorId (1014115)
const REVERSE_MODULE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(VENDOR_MODULE_CODES).map(([vid, code]) => [code, vid])
);

function buildUserResponse(user: any, modulePermissions: Record<string, boolean>) {
  const vendorId = REVERSE_MODULE_CODES[user.email] ?? null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role || "admin",
    teamMembers: user.teamMembers ? user.teamMembers.split(",").map((m: string) => m.trim()) : null,
    supervisorGroupId: user.supervisorGroupId ?? user.supervisor_group_id ?? null,
    modulePermissions,
    vendorId,
  };
}

async function resolveSupervisorGroupMembers(groupId: string | null | undefined): Promise<string[]> {
  const normalized = String(groupId ?? "").trim();
  if (!normalized) return [];
  const rows = await pgAll<{ salesperson_id: string }>(
    `SELECT DISTINCT TRIM(CAST(salesperson_id AS TEXT)) AS salesperson_id
     FROM vendor_group_members
     WHERE group_id = $1 AND TRIM(CAST(salesperson_id AS TEXT)) <> ''
     ORDER BY salesperson_id`,
    [normalized]
  );
  return rows.map(row => String(row.salesperson_id ?? "").trim()).filter(Boolean);
}

function mergeModulePermissions(raw: string | null): Record<string, boolean> {
  if (!raw) return DEFAULT_MODULE_PERMISSIONS;
  try {
    return { ...DEFAULT_MODULE_PERMISSIONS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MODULE_PERMISSIONS;
  }
}

export function createAuthRouter(): Router {
  const router = Router();

  router.post("/register", isAuthenticated, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);
      if (existing.length > 0) {
        return res.status(400).json({ message: "Este login já está em uso" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [newUser] = await db.insert(users).values({
        email: normalizedEmail,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
      }).returning();

      const token = jwt.sign({ userId: newUser.id }, JWT_SECRET!, { expiresIn: TOKEN_EXPIRY as any });

      res.json({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [user] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const userStatus = (user as any).status ?? "ativo";
      if (userStatus === "bloqueado") {
        return res.status(403).json({ message: "Usuário bloqueado. Contate o administrador." });
      }
      if (userStatus === "inativo") {
        return res.status(403).json({ message: "Usuário inativo. Contate o administrador." });
      }

      // Record last login
      await pgRun("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

      const token = jwt.sign({ userId: user.id }, JWT_SECRET!, { expiresIn: TOKEN_EXPIRY as any });
      const modulePermissions = mergeModulePermissions(user.modulePermissions);

      res.json({ token, user: buildUserResponse(user, modulePermissions) });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  router.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const modulePermissions = mergeModulePermissions(user.modulePermissions);
      res.json(buildUserResponse(user, modulePermissions));
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  router.post("/change-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Senha atual e nova senha são obrigatórias" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ message: "A nova senha deve ter pelo menos 6 caracteres" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, req.userId!));
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Senha atual incorreta" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

      res.json({ message: "Senha atualizada com sucesso" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Erro ao atualizar senha" });
    }
  });

  return router;
}

export async function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: number };
    req.userId = decoded.userId;

    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    if (!user) {
      return res.status(401).json({ message: "Usuário não encontrado" });
    }

    // Real-time status enforcement — catches users blocked after token was issued
    const status = user.status ?? "ativo";
    if (status === "bloqueado") {
      return res.status(403).json({ message: "Conta bloqueada. Contate o administrador." });
    }
    if (status === "inativo") {
      return res.status(403).json({ message: "Conta inativa. Contate o administrador." });
    }

    req.userRole = user.role || "admin";
    req.userEmail = user.email;
    req.userFirstName = user.firstName ?? undefined;
    req.userVendorCode = (user as any).vendorCode ?? undefined;
    const supervisorGroupId = (user as any).supervisorGroupId ?? (user as any).supervisor_group_id;
    if (user.role === "supervisor" && supervisorGroupId) {
      req.teamMembers = await resolveSupervisorGroupMembers(supervisorGroupId);
    } else if (user.teamMembers) {
      req.teamMembers = user.teamMembers.split(",").map(m => m.trim()).filter(Boolean);
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}

export function isAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "admin" && req.userRole !== "supervisor") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  next();
}

/** Permite apenas administrador (admin/supervisor) e comprador */
export function isCompradorOuAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const role = req.userRole;
  if (role !== "admin" && role !== "supervisor" && role !== "gerente" && role !== "diretor" && role !== "comprador") {
    return res.status(403).json({ message: "Acesso restrito ao módulo de compras" });
  }
  next();
}

/**
 * requirePermission(module, action) — middleware factory
 * Admins bypass all checks. For all other roles, the role must have an explicit
 * entry in the role_permissions table for the given module+action.
 */
export function requirePermission(module: string, action: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.userRole === "admin") return next();

    try {
      const perm = await pgGet<{ scope: string }>(
        `SELECT rp.scope
         FROM role_permissions rp
         JOIN roles r ON r.id = rp.role_id
         WHERE r.name = $1 AND rp.module = $2 AND rp.action = $3`,
        [req.userRole, module, action]
      );

      if (!perm) {
        return res.status(403).json({ message: `Permissão insuficiente: ${module}/${action}` });
      }

      next();
    } catch (err) {
      console.error("[requirePermission] Erro ao verificar permissão:", err);
      return res.status(500).json({ message: "Erro ao verificar permissões" });
    }
  };
}
