import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Redirect } from "wouter";
import {
  Users, ShieldCheck, ClipboardList, Key, Plus, Search,
  MoreHorizontal, Lock, Unlock, UserX, RefreshCw, Pencil,
  Trash2, Check, X, ChevronDown, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpButton, HelpDrawer } from "@/components/help";
import { HELP_CONTENT } from "@/components/help/help-content";

// ── Constants ────────────────────────────────────────────────────────────────

const MODULES = [
  { key: "dashboard",     label: "Dashboard" },
  { key: "metas",         label: "Metas" },
  { key: "alertas",       label: "Alertas" },
  { key: "semanal",       label: "Visão Semanal" },
  { key: "mensal",        label: "Visão Mensal" },
  { key: "vendedores",    label: "Vendedores" },
  { key: "comissoes",     label: "Comissões" },
  { key: "campanhas",     label: "Campanhas" },
  { key: "configuracoes", label: "Configurações" },
  { key: "usuarios",      label: "Usuários & Permissões" },
  { key: "relatorios",    label: "Relatórios & Exportações" },
];

const ACTIONS = [
  { key: "view",      label: "Ver" },
  { key: "create",    label: "Criar" },
  { key: "edit",      label: "Editar" },
  { key: "delete",    label: "Excluir" },
  { key: "approve",   label: "Aprovar" },
  { key: "export",    label: "Exportar" },
  { key: "configure", label: "Config." },
];

const SCOPES = [
  { key: "own",  label: "Próprios" },
  { key: "team", label: "Equipe" },
  { key: "loja", label: "Loja" },
  { key: "all",  label: "Todos" },
];

const SYSTEM_ROLES = ["admin", "supervisor", "gerente", "vendedor", "loja"];

const ROLE_LABELS: Record<string, string> = {
  admin:      "Administrador",
  supervisor: "Supervisor",
  gerente:    "Gerente",
  vendedor:   "Vendedor",
  loja:       "Display Loja",
  financeiro: "Financeiro",
  marketing:  "Marketing",
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ativo:     { label: "Ativo",     variant: "default" },
  inativo:   { label: "Inativo",   variant: "secondary" },
  bloqueado: { label: "Bloqueado", variant: "destructive" },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface AppUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  role: string;
  vendor_code: string | null;
  phone: string | null;
  cargo: string | null;
  company_id: string | null;
  supervisor_id: number | null;
  supervisor_first_name: string | null;
  supervisor_last_name: string | null;
  team_members: string | null;
  status: string;
  last_login_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
}

interface RolePermission {
  module: string;
  action: string;
  scope: string;
}

interface AuditEntry {
  id: number;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  entity: string;
  before_val: string | null;
  after_val: string | null;
  created_at: string;
}

// ── Empty form helpers ───────────────────────────────────────────────────────

function emptyUser() {
  return {
    email: "", password: "", firstName: "", lastName: "", displayName: "",
    role: "vendedor", vendorCode: "", phone: "", cargo: "",
    companyId: "", supervisorId: "", teamMembers: "", notes: "", status: "ativo",
  };
}

function emptyRole() {
  return { name: "", displayName: "", description: "" };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function UserStatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant} className="text-[10px] py-0 h-5">{s.label}</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className="text-[10px] py-0 h-5 font-medium">
      {ROLE_LABELS[role] ?? role}
    </Badge>
  );
}

function fmtDate(str: string | null) {
  if (!str) return "—";
  try { return format(new Date(str), "dd/MM/yyyy HH:mm", { locale: ptBR }); }
  catch { return str; }
}

// ── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState(emptyUser());
  const [resetDialog, setResetDialog] = useState<{ userId: number; email: string } | null>(null);
  const [newPass, setNewPass] = useState("");
  const [statusDialog, setStatusDialog] = useState<{ user: AppUser; newStatus: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/admin/users", search, filterRole, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterRole !== "all") params.set("role", filterRole);
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await apiRequest("GET", `/api/admin/users?${params}`);
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/admin/users", "", "", ""],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      return res.json();
    },
  });

  const supervisors = useMemo(
    () => allUsers.filter(u => u.role === "admin" || u.role === "supervisor"),
    [allUsers]
  );

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDialogOpen(false);
      toast({ title: "Usuário criado com sucesso" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDialogOpen(false);
      toast({ title: "Usuário atualizado" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${id}/status`, { status });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setStatusDialog(null);
      toast({ title: "Status atualizado" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: number; newPassword: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${id}/reset-password`, { newPassword });
      return res.json();
    },
    onSuccess: () => {
      setResetDialog(null);
      setNewPass("");
      toast({ title: "Senha redefinida com sucesso" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingUser(null);
    setForm(emptyUser());
    setDialogOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setForm({
      email: user.email,
      password: "",
      firstName: user.first_name ?? "",
      lastName: user.last_name ?? "",
      displayName: user.display_name ?? "",
      role: user.role,
      vendorCode: user.vendor_code ?? "",
      phone: user.phone ?? "",
      cargo: user.cargo ?? "",
      companyId: user.company_id ?? "",
      supervisorId: user.supervisor_id ? String(user.supervisor_id) : "",
      teamMembers: user.team_members ?? "",
      notes: user.notes ?? "",
      status: user.status,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    const payload: any = {
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      displayName: form.displayName || null,
      role: form.role,
      vendorCode: form.vendorCode || null,
      phone: form.phone || null,
      cargo: form.cargo || null,
      companyId: form.companyId || null,
      supervisorId: form.supervisorId ? parseInt(form.supervisorId) : null,
      teamMembers: form.teamMembers || null,
      notes: form.notes || null,
    };

    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: payload });
    } else {
      createMutation.mutate({ ...payload, email: form.email, password: form.password });
    }
  }

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Perfil" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os perfis</SelectItem>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-32"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Nenhum usuário encontrado</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Usuário</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden sm:table-cell">Login</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Perfil</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Cargo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">Último acesso</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-sm">
                          {user.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}
                        </div>
                        {user.cargo && <div className="text-xs text-muted-foreground">{user.cargo}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-muted-foreground">{user.cargo || "—"}</td>
                    <td className="px-4 py-3"><UserStatusBadge status={user.status} /></td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{fmtDate(user.last_login_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetDialog({ userId: user.id, email: user.email })}>
                            <Key className="h-3.5 w-3.5 mr-2" /> Redefinir senha
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {user.status !== "ativo" && (
                            <DropdownMenuItem onClick={() => setStatusDialog({ user, newStatus: "ativo" })}>
                              <Unlock className="h-3.5 w-3.5 mr-2 text-green-600" /> Ativar
                            </DropdownMenuItem>
                          )}
                          {user.status !== "inativo" && (
                            <DropdownMenuItem onClick={() => setStatusDialog({ user, newStatus: "inativo" })}>
                              <UserX className="h-3.5 w-3.5 mr-2 text-amber-600" /> Inativar
                            </DropdownMenuItem>
                          )}
                          {user.status !== "bloqueado" && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setStatusDialog({ user, newStatus: "bloqueado" })}
                            >
                              <Lock className="h-3.5 w-3.5 mr-2" /> Bloquear
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser ? `Editando: ${editingUser.email}` : "Preencha os dados do novo usuário"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            {!editingUser && (
              <>
                <div className="col-span-2">
                  <Label className="text-xs">Login *</Label>
                  <Input className="h-8 mt-1" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email ou código" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Senha *</Label>
                  <Input type="password" className="h-8 mt-1" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="mín. 6 caracteres" />
                </div>
              </>
            )}
            <div>
              <Label className="text-xs">Nome</Label>
              <Input className="h-8 mt-1" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <Input className="h-8 mt-1" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Nome de exibição</Label>
              <Input className="h-8 mt-1" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="Como aparece no sistema" />
            </div>
            <div>
              <Label className="text-xs">Perfil *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Código do vendedor</Label>
              <Input className="h-8 mt-1" value={form.vendorCode} onChange={e => setForm(f => ({ ...f, vendorCode: e.target.value }))} placeholder="ID no ERP" />
            </div>
            <div>
              <Label className="text-xs">Cargo / Função</Label>
              <Input className="h-8 mt-1" value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input className="h-8 mt-1" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Loja / Empresa</Label>
              <Input className="h-8 mt-1" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} placeholder="ID da loja" />
            </div>
            <div>
              <Label className="text-xs">Supervisor</Label>
              <Select value={form.supervisorId || "none"} onValueChange={v => setForm(f => ({ ...f, supervisorId: v === "none" ? "" : v }))}>
                <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {supervisors.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.first_name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.role === "supervisor") && (
              <div className="col-span-2">
                <Label className="text-xs">Membros da equipe (separados por vírgula)</Label>
                <Input className="h-8 mt-1" value={form.teamMembers} onChange={e => setForm(f => ({ ...f, teamMembers: e.target.value }))} placeholder="João, Maria, Pedro..." />
              </div>
            )}
            <div className="col-span-2">
              <Label className="text-xs">Observações internas</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={isBusy}>
              {isBusy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialog} onOpenChange={() => { setResetDialog(null); setNewPass(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>{resetDialog?.email}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label className="text-xs">Nova senha</Label>
            <Input type="password" className="h-8 mt-1" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="mín. 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setResetDialog(null); setNewPass(""); }}>Cancelar</Button>
            <Button size="sm" disabled={newPass.length < 6 || resetMutation.isPending}
              onClick={() => resetDialog && resetMutation.mutate({ id: resetDialog.userId, newPassword: newPass })}>
              {resetMutation.isPending ? "Salvando..." : "Redefinir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar alteração de status</DialogTitle>
            <DialogDescription>
              {statusDialog && `Alterar status de "${statusDialog.user.email}" para "${statusDialog.newStatus}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setStatusDialog(null)}>Cancelar</Button>
            <Button
              size="sm"
              variant={statusDialog?.newStatus === "bloqueado" ? "destructive" : "default"}
              disabled={statusMutation.isPending}
              onClick={() => statusDialog && statusMutation.mutate({ id: statusDialog.user.id, status: statusDialog.newStatus })}
            >
              {statusMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyRole());
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/roles");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/roles", data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/roles"] }); setDialogOpen(false); toast({ title: "Perfil criado" }); },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/admin/roles/${id}`, data);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/roles"] }); setDialogOpen(false); toast({ title: "Perfil atualizado" }); },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/roles/${id}`);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/roles"] }); setDeleteConfirm(null); toast({ title: "Perfil excluído" }); },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  function openCreate() { setEditingRole(null); setForm(emptyRole()); setDialogOpen(true); }
  function openEdit(r: Role) { setEditingRole(r); setForm({ name: r.name, displayName: r.display_name, description: r.description ?? "" }); setDialogOpen(true); }

  function handleSave() {
    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: { displayName: form.displayName, description: form.description } });
    } else {
      createMutation.mutate({ name: form.name, displayName: form.displayName, description: form.description });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Perfis de acesso que podem ser atribuídos aos usuários</p>
        <Button size="sm" className="gap-1.5 h-9" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Novo Perfil
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map(role => (
            <div key={role.id} className="border rounded-lg p-4 flex flex-col gap-2 bg-card">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{role.display_name}</span>
                    {role.is_system && (
                      <Badge variant="secondary" className="text-[10px] py-0 h-4">Sistema</Badge>
                    )}
                  </div>
                  <code className="text-[10px] text-muted-foreground">{role.name}</code>
                </div>
                {!role.is_system && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(role)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteConfirm(role)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {role.description && (
                <p className="text-xs text-muted-foreground">{role.description}</p>
              )}
              <div className="text-[10px] text-muted-foreground mt-auto pt-1">
                Criado em {fmtDate(role.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Role Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar Perfil" : "Novo Perfil"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingRole && (
              <div>
                <Label className="text-xs">Identificador (slug)</Label>
                <Input className="h-8 mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: financeiro_externo" />
                <p className="text-[10px] text-muted-foreground mt-0.5">Letras, números e underline. Será normalizado.</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Nome de exibição *</Label>
              <Input className="h-8 mt-1" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={!form.displayName || createMutation.isPending || updateMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir perfil?</DialogTitle>
            <DialogDescription>"{deleteConfirm?.display_name}" será removido permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Permissions Matrix Tab ───────────────────────────────────────────────────

function PermissionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/roles");
      return res.json();
    },
  });

  const { data: perms = [], isLoading: loadingPerms } = useQuery<RolePermission[]>({
    queryKey: ["/api/admin/roles", selectedRoleId, "permissions"],
    enabled: !!selectedRoleId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/roles/${selectedRoleId}/permissions`);
      return res.json();
    },
  });

  // Build a map: module+action -> scope
  const permMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of perms) {
      m[`${p.module}::${p.action}`] = p.scope;
    }
    return m;
  }, [perms]);

  const [localPerms, setLocalPerms] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  // Sync local state when perms load
  useMemo(() => {
    setLocalPerms({ ...permMap });
    setDirty(false);
  }, [perms]);

  function toggle(module: string, action: string) {
    const key = `${module}::${action}`;
    setLocalPerms(prev => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = "all";
      }
      return next;
    });
    setDirty(true);
  }

  function setScope(module: string, action: string, scope: string) {
    const key = `${module}::${action}`;
    setLocalPerms(prev => ({ ...prev, [key]: scope }));
    setDirty(true);
  }

  function hasAll(module: string) {
    return ACTIONS.every(a => localPerms[`${module}::${a.key}`]);
  }

  function toggleAll(module: string) {
    const all = hasAll(module);
    setLocalPerms(prev => {
      const next = { ...prev };
      for (const a of ACTIONS) {
        if (all) delete next[`${module}::${a.key}`];
        else next[`${module}::${a.key}`] = next[`${module}::${a.key}`] ?? "all";
      }
      return next;
    });
    setDirty(true);
  }

  function getModuleScope(module: string): string {
    const scopes = ACTIONS
      .map(a => localPerms[`${module}::${a.key}`])
      .filter(Boolean);
    if (!scopes.length) return "all";
    const unique = [...new Set(scopes)];
    return unique.length === 1 ? unique[0] : scopes[0];
  }

  function setModuleScope(module: string, scope: string) {
    setLocalPerms(prev => {
      const next = { ...prev };
      for (const a of ACTIONS) {
        if (next[`${module}::${a.key}`]) {
          next[`${module}::${a.key}`] = scope;
        }
      }
      return next;
    });
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions = Object.entries(localPerms).map(([key, scope]) => {
        const [module, action] = key.split("::");
        return { module, action, scope };
      });
      const res = await apiRequest("PUT", `/api/admin/roles/${selectedRoleId}/permissions`, { permissions });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/roles", selectedRoleId, "permissions"] });
      setDirty(false);
      toast({ title: "Permissões salvas" });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const selectedRole = roles.find(r => String(r.id) === selectedRoleId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Role selector */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium shrink-0">Perfil:</Label>
          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
            <SelectTrigger className="h-9 w-52">
              <SelectValue placeholder="Selecione um perfil..." />
            </SelectTrigger>
            <SelectContent>
              {roles.map(r => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.display_name}
                  {r.is_system && " (sistema)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {dirty && selectedRoleId && (
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        )}
      </div>

      {!selectedRoleId ? (
        <div className="text-center text-muted-foreground py-12 text-sm">
          Selecione um perfil para configurar as permissões
        </div>
      ) : loadingPerms ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Carregando...</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground w-40">Módulo</th>
                  {ACTIONS.map(a => (
                    <th key={a.key} className="px-2 py-2.5 text-center font-semibold text-muted-foreground w-16">{a.label}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground w-28">Escopo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MODULES.map(mod => {
                  const allChecked = hasAll(mod.key);
                  const someChecked = ACTIONS.some(a => localPerms[`${mod.key}::${a.key}`]);
                  return (
                    <tr key={mod.key} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={allChecked}
                            className="h-3.5 w-3.5"
                            onCheckedChange={() => toggleAll(mod.key)}
                          />
                          <span className={someChecked ? "font-medium" : "text-muted-foreground"}>{mod.label}</span>
                        </div>
                      </td>
                      {ACTIONS.map(act => {
                        const key = `${mod.key}::${act.key}`;
                        return (
                          <td key={act.key} className="px-2 py-2.5 text-center">
                            <Checkbox
                              checked={!!localPerms[key]}
                              className="h-3.5 w-3.5"
                              onCheckedChange={() => toggle(mod.key, act.key)}
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        {someChecked ? (
                          <Select
                            value={getModuleScope(mod.key)}
                            onValueChange={v => setModuleScope(mod.key, v)}
                          >
                            <SelectTrigger className="h-6 text-[10px] px-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SCOPES.map(s => (
                                <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {dirty && selectedRoleId && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Audit Tab ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  criar_usuario:    "Criou usuário",
  editar_usuario:   "Editou usuário",
  status_ativo:     "Ativou usuário",
  status_inativo:   "Inativou usuário",
  status_bloqueado: "Bloqueou usuário",
  resetar_senha:    "Redefiniu senha",
  criar_perfil:     "Criou perfil",
  editar_perfil:    "Editou perfil",
  excluir_perfil:   "Excluiu perfil",
  editar_permissoes:"Editou permissões",
};

function AuditTab() {
  const [filterActor, setFilterActor] = useState("");
  const [filterEntity, setFilterEntity] = useState("all");
  const [limitRows, setLimitRows] = useState("50");

  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/admin/audit", filterActor, filterEntity, limitRows],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: limitRows });
      if (filterActor) params.set("actor", filterActor);
      if (filterEntity !== "all") params.set("entity", filterEntity);
      const res = await apiRequest("GET", `/api/admin/audit?${params}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por ator..."
            value={filterActor}
            onChange={e => setFilterActor(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={filterEntity} onValueChange={setFilterEntity}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas entidades</SelectItem>
            <SelectItem value="users">Usuários</SelectItem>
            <SelectItem value="roles">Perfis</SelectItem>
            <SelectItem value="role_permissions">Permissões</SelectItem>
          </SelectContent>
        </Select>
        <Select value={limitRows} onValueChange={setLimitRows}>
          <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50">50 linhas</SelectItem>
            <SelectItem value="100">100 linhas</SelectItem>
            <SelectItem value="200">200 linhas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Carregando...</div>
      ) : entries.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 text-sm">Nenhum registro encontrado</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Data/Hora</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs">Ação</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden sm:table-cell">Executor</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden md:table-cell">Alvo</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs hidden lg:table-cell">Antes / Depois</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-[10px] py-0 h-5">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell text-xs font-mono text-muted-foreground">
                      {entry.actor_email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-xs font-mono text-muted-foreground">
                      {entry.target_email ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {entry.before_val && (
                          <span className="text-[10px] text-muted-foreground">
                            <span className="text-red-500">antes:</span> {entry.before_val}
                          </span>
                        )}
                        {entry.after_val && (
                          <span className="text-[10px] text-muted-foreground">
                            <span className="text-green-600">depois:</span> {entry.after_val}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Usuarios() {
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);

  if (user?.role !== "admin") return <Redirect to="/" />;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-3 flex items-baseline gap-3">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Usuários & Permissões</h1>
        <HelpButton onClick={() => setHelpOpen(true)} />
        <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
          Gestão de acesso e controle de permissões
        </span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="usuarios" className="flex flex-col flex-1 overflow-hidden">
        <div className="shrink-0 border-b border-border bg-background px-4 sm:px-6">
          <TabsList className="h-10 rounded-none bg-transparent p-0 gap-1">
            <TabsTrigger
              value="usuarios"
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5 text-sm"
            >
              <Users className="h-3.5 w-3.5" /> Usuários
            </TabsTrigger>
            <TabsTrigger
              value="perfis"
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5 text-sm"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Perfis
            </TabsTrigger>
            <TabsTrigger
              value="permissoes"
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5 text-sm"
            >
              <Key className="h-3.5 w-3.5" /> Permissões
            </TabsTrigger>
            <TabsTrigger
              value="auditoria"
              className="h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 gap-1.5 text-sm"
            >
              <ClipboardList className="h-3.5 w-3.5" /> Auditoria
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="usuarios" className="m-0 h-full"><UsersTab /></TabsContent>
          <TabsContent value="perfis" className="m-0 h-full"><RolesTab /></TabsContent>
          <TabsContent value="permissoes" className="m-0 h-full"><PermissionsTab /></TabsContent>
          <TabsContent value="auditoria" className="m-0 h-full"><AuditTab /></TabsContent>
        </div>
      </Tabs>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.configuracoes} />
    </div>
  );
}
