import { pgTable, text, integer, serial } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default("admin"),
  teamMembers: text("team_members"),
  modulePermissions: text("module_permissions"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),

  // IAM extended profile
  displayName: text("display_name"),
  vendorCode: text("vendor_code"),
  phone: text("phone"),
  cargo: text("cargo"),
  companyId: text("company_id"),
  supervisorId: integer("supervisor_id"),
  status: text("status").default("ativo"),
  lastLoginAt: text("last_login_at"),
  notes: text("notes"),
  createdBy: integer("created_by"),
});

export type InsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const DEFAULT_MODULE_PERMISSIONS: Record<string, boolean> = {
  Dashboard: true,
  Vendedores: true,
  Metas: true,
  Alertas: true,
  "Visão Semanal": true,
  "Visão Mensal": true,
  "Visão em Loja": true,
  Campanhas: true,
  Comissões: true,
};
