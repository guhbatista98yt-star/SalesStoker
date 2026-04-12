import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Router, Request, Response, NextFunction } from "express";
import { db, sqlite } from "./db";
import { users, DEFAULT_MODULE_PERMISSIONS } from "@shared/models/auth";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.SESSION_SECRET || "sales-dashboard-secret-key";
const TOKEN_EXPIRY = "365d";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  userEmail?: string;
  teamMembers?: string[];
}

function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'admin',
      team_members TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'`);
  } catch { }
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN team_members TEXT`);
  } catch { }
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN module_permissions TEXT`);
  } catch { }

  try {
    sqlite.exec(`
      UPDATE users 
      SET role = 'supervisor', team_members = 'ERICK,FABIO,MARCIO,THIAGO MOURA,BRUNO,FABRICIO,CLEDSON,ELISMARIO'
      WHERE email = 'supervisor@conectubos.com'
    `);
  } catch { }
}

function seedDefaultUsers() {
  try {
    const existing = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("loja") as any;
    if (!existing) {
      const hashedPass = bcrypt.hashSync("loja2024", 10);
      sqlite.prepare(
        "INSERT INTO users (email, password, first_name, role) VALUES (?, ?, ?, ?)"
      ).run("loja", hashedPass, "Loja", "loja");
      console.log("Usuário 'loja' criado automaticamente.");
    }
  } catch (e) {
    console.error("Erro ao criar usuário loja:", e);
  }
}

// Mapeamento: IDVENDEDOR (do cache_vendas) → código de módulo Visão em Loja (C####)
// Deve ser mantido sincronizado com VENDOR_DISPLAY_CODES em visao-em-loja.tsx
const VENDOR_MODULE_CODES: Record<string, string> = {
  "1014115": "C4821", // ALAN
  "14093":   "C3076", // CARLISON
  "1004249": "C1547", // EMILLY
  "10421":   "C7839", // ERIVAN
  "1014938": "C2954", // JANIO
  "10774":   "C6183", // JOANES
  "1004703": "C9247", // LAURA LETICIA
  "11033":   "C5360", // MAGNO
  "11038":   "C8512", // MARCOS
  "1014856": "C4093", // MARCOS FELIPE
  "1012888": "C7428", // MARIANE
  "10965":   "C2671", // NAILTON
  "11704":   "C5834", // REJANE
};

function seedSalespersonUsers() {
  try {
    const rows = sqlite.prepare(`
      SELECT 
        CAST(IDVENDEDOR AS TEXT) as id, 
        MAX(NOME_VENDEDOR) as name
      FROM cache_vendas 
      WHERE IDVENDEDOR IS NOT NULL 
        AND NOME_VENDEDOR IS NOT NULL
        AND NOME_VENDEDOR NOT LIKE '%SEM VENDEDOR%'
      GROUP BY IDVENDEDOR
    `).all() as { id: string; name: string }[];

    const existingUsers = sqlite.prepare("SELECT email FROM users").all() as { email: string }[];
    const existingEmails = new Set(existingUsers.map(u => String(u.email)));

    let addedCount = 0;
    const hashedPass = bcrypt.hashSync("1234", 10);
    const insertStmt = sqlite.prepare(
      "INSERT INTO users (email, password, first_name, role) VALUES (?, ?, ?, ?)"
    );

    for (const row of rows) {
      if (!row.name) continue;

      // Usar código do módulo Visão em Loja (C####) como username principal, se disponível
      const moduleCode = VENDOR_MODULE_CODES[row.id];

      // Se houver código de módulo mapeado, usar ele como username
      if (moduleCode) {
        if (!existingEmails.has(moduleCode)) {
          insertStmt.run(moduleCode, hashedPass, row.name, "vendedor");
          existingEmails.add(moduleCode);
          addedCount++;
        }
        // Independentemente, não criar duplicata por nome se já existe por módulo
        continue;
      }

      // Fallback: criar username pelo primeiro nome (vendedores sem código de módulo)
      let baseUsername = row.name.split(" ")[0];
      baseUsername = baseUsername.charAt(0).toUpperCase() + baseUsername.slice(1).toLowerCase();

      let finalUsername = baseUsername;
      let counter = 1;

      // Tratar duplicatas de nomes
      while (existingEmails.has(finalUsername)) {
        finalUsername = `${baseUsername}${counter}`;
        counter++;
      }

      insertStmt.run(finalUsername, hashedPass, row.name, "vendedor");
      existingEmails.add(finalUsername);
      addedCount++;
    }

    if (addedCount > 0) {
      console.log(`Criados ${addedCount} usuários de vendedores (padrão: ID módulo Visão em Loja).`);
    }
  } catch (e) {
    // Pode falhar se a tabela cache_vendas ainda não existir
    console.error("Erro ao sincronizar vendedores para usuários:", (e as Error).message);
  }
}

initializeDatabase();
seedDefaultUsers();
seedSalespersonUsers();

export function createAuthRouter(): Router {
  const router = Router();

  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const existingUser = db.select().from(users).where(eq(users.email, email)).all();
      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Este email já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = db.insert(users).values({
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
      }).run();

      const newUserId = result.lastInsertRowid as number;
      const [newUser] = db.select().from(users).where(eq(users.id, newUserId)).all();

      const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

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

      // Case-insensitive email comparison
      const userList = db.select().from(users).all();
      const user = userList.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

      let modulePermissions = DEFAULT_MODULE_PERMISSIONS;
      if (user.modulePermissions) {
        try {
          modulePermissions = { ...DEFAULT_MODULE_PERMISSIONS, ...JSON.parse(user.modulePermissions) };
        } catch { }
      }

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role || "admin",
          teamMembers: user.teamMembers ? user.teamMembers.split(",").map((m: string) => m.trim()) : null,
          modulePermissions,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  router.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
    try {
      const [user] = db.select().from(users).where(eq(users.id, req.userId!)).all();
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      let modulePermissions = DEFAULT_MODULE_PERMISSIONS;
      if (user.modulePermissions) {
        try {
          modulePermissions = { ...DEFAULT_MODULE_PERMISSIONS, ...JSON.parse(user.modulePermissions) };
        } catch { }
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role || "admin",
        teamMembers: user.teamMembers ? user.teamMembers.split(",").map((m: string) => m.trim()) : null,
        modulePermissions,
      });
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

      const [user] = db.select().from(users).where(eq(users.id, req.userId!)).all();
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Senha atual incorreta" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id))
        .run();

      res.json({ message: "Senha atualizada com sucesso" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ message: "Erro ao atualizar senha" });
    }
  });

  return router;
}

export function isAuthenticated(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token não fornecido" });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    req.userId = decoded.userId;

    const [user] = db.select().from(users).where(eq(users.id, decoded.userId)).all();
    if (user) {
      req.userRole = user.role || "admin";
      req.userEmail = user.email;
      if (user.teamMembers) {
        req.teamMembers = user.teamMembers.split(",").map(m => m.trim());
      }
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
