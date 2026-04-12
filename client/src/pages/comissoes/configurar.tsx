import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Settings, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Redirect } from "wouter";
import type { CommissionRule } from "@shared/schema";

const RULE_TYPES = [
  { value: "base_monthly",     label: "Comissão Base Mensal" },
  { value: "weekly_bonus",     label: "Bônus por Semana Batida" },
  { value: "weekly_all_bonus", label: "Bônus Todas as Semanas" },
  { value: "strategic",        label: "Bônus Estratégico (Fornecedor/Produto)" },
  { value: "accelerator",      label: "Acelerador por Superação" },
  { value: "mix",              label: "Bônus de Mix" },
  { value: "reducer",          label: "Redutor / Trava" },
];

function typeLabel(type: string) {
  return RULE_TYPES.find(r => r.value === type)?.label ?? type;
}

function typeBadgeColor(type: string) {
  switch (type) {
    case "base_monthly": return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    case "weekly_bonus":
    case "weekly_all_bonus": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "strategic": return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300";
    case "accelerator": return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "reducer": return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

interface RuleFormState {
  name: string;
  description: string;
  type: string;
  is_active: boolean;
  priority: number;
  applies_to: string;
  rate: string;
  triggerFrom: string;
  targetType: string;
  target: string;
  condition: string;
  reduceRate: string;
  thresholds: { from: string; to: string; rate: string }[];
}

function emptyForm(): RuleFormState {
  return {
    name: "",
    description: "",
    type: "base_monthly",
    is_active: true,
    priority: 10,
    applies_to: "all",
    rate: "",
    triggerFrom: "110",
    targetType: "supplier",
    target: "",
    condition: "",
    reduceRate: "",
    thresholds: [
      { from: "0",   to: "84.99", rate: "0" },
      { from: "85",  to: "94.99", rate: "0.35" },
      { from: "95",  to: "99.99", rate: "0.60" },
      { from: "100", to: "109.99", rate: "1.00" },
      { from: "110", to: "119.99", rate: "1.20" },
      { from: "120", to: "9999",   rate: "1.50" },
    ],
  };
}

function ruleToForm(rule: CommissionRule): RuleFormState {
  const cfg = rule.config;
  return {
    name: rule.name,
    description: rule.description ?? "",
    type: rule.type,
    is_active: rule.is_active === 1,
    priority: rule.priority,
    applies_to: rule.applies_to,
    rate: String(cfg.rate ?? ""),
    triggerFrom: String(cfg.triggerFrom ?? "110"),
    targetType: cfg.targetType ?? "supplier",
    target: cfg.target ?? "",
    condition: cfg.condition ?? "",
    reduceRate: String(cfg.reduceRate ?? ""),
    thresholds: (cfg.thresholds ?? []).map(t => ({
      from: String(t.from), to: String(t.to), rate: String(t.rate),
    })),
  };
}

function formToPayload(form: RuleFormState) {
  let config: any = {};
  if (form.type === "base_monthly") {
    config.thresholds = form.thresholds.map(t => ({
      from: parseFloat(t.from) || 0,
      to: parseFloat(t.to) || 0,
      rate: parseFloat(t.rate) || 0,
    }));
  } else if (["weekly_bonus", "weekly_all_bonus"].includes(form.type)) {
    config.rate = parseFloat(form.rate) || 0;
  } else if (form.type === "strategic") {
    config.rate = parseFloat(form.rate) || 0;
    config.targetType = form.targetType;
    config.target = form.target;
  } else if (form.type === "accelerator") {
    config.rate = parseFloat(form.rate) || 0;
    config.triggerFrom = parseFloat(form.triggerFrom) || 110;
  } else if (form.type === "reducer") {
    config.condition = form.condition;
    config.reduceRate = parseFloat(form.reduceRate) || 0;
  }
  return {
    name: form.name,
    description: form.description,
    type: form.type,
    is_active: form.is_active,
    priority: form.priority,
    applies_to: form.applies_to,
    config,
  };
}

export default function ConfigurarComissoes() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Redirect to="/comissoes" />;

  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RuleFormState>(emptyForm());

  const { data: rules = [], isLoading } = useQuery<CommissionRule[]>({
    queryKey: ["/api/commissions/rules"],
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingId
        ? `/api/admin/commissions/rules/${editingId}`
        : "/api/admin/commissions/rules";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao salvar regra");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/commissions/rules"] });
      setDialogOpen(false);
      toast({ title: editingId ? "Regra atualizada" : "Regra criada" });
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/commissions/rules/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/commissions/rules"] });
      setDeleteId(null);
      toast({ title: "Regra excluída" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ rule, val }: { rule: CommissionRule; val: boolean }) => {
      const res = await fetch(`/api/admin/commissions/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        body: JSON.stringify({ ...formToPayload(ruleToForm(rule)), name: rule.name, is_active: val }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/commissions/rules"] }),
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setEditingId(rule.id);
    setForm(ruleToForm(rule));
    setDialogOpen(true);
  }

  function setThreshold(idx: number, field: "from" | "to" | "rate", val: string) {
    setForm(f => {
      const thresholds = [...f.thresholds];
      thresholds[idx] = { ...thresholds[idx], [field]: val };
      return { ...f, thresholds };
    });
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/comissoes">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight">Regras de Comissão</h1>
              <span className="hidden sm:inline text-xs text-muted-foreground">Configuração</span>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" />
            Nova Regra
          </Button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-3 max-w-3xl mx-auto">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-xl animate-pulse border border-border" />
          ))
        ) : rules.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Settings className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma regra configurada</p>
          </div>
        ) : (
          rules.map(rule => (
            <Card key={rule.id} className={rule.is_active ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-center gap-3">
                <Switch
                  checked={rule.is_active === 1}
                  onCheckedChange={val => toggleActive.mutate({ rule, val })}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{rule.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeBadgeColor(rule.type)}`}>
                      {typeLabel(rule.type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Prioridade {rule.priority}</span>
                  </div>
                  {rule.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Regra" : "Nova Regra de Comissão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Nome da Regra</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Comissão Base Mensal" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Descrição</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Descreva o propósito desta regra..." />
              </div>
              <div className="space-y-1">
                <Label>Tipo de Regra</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Prioridade</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            {form.type === "base_monthly" && (
              <div className="space-y-2">
                <Label>Faixas de Comissão por Atingimento de Meta (%)</Label>
                {form.thresholds.map((t, i) => (
                  <div key={i} className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">De (%)</Label>
                      <Input size={5} value={t.from} onChange={e => setThreshold(i, "from", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Até (%)</Label>
                      <Input size={5} value={t.to} onChange={e => setThreshold(i, "to", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Taxa (%)</Label>
                      <Input size={5} value={t.rate} onChange={e => setThreshold(i, "rate", e.target.value)} />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline" size="sm" type="button"
                  onClick={() => setForm(f => ({ ...f, thresholds: [...f.thresholds, { from: "", to: "", rate: "" }] }))}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Faixa
                </Button>
              </div>
            )}

            {["weekly_bonus", "weekly_all_bonus"].includes(form.type) && (
              <div className="space-y-1">
                <Label>Taxa de Comissão (%)</Label>
                <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="Ex: 0.05" />
                <p className="text-xs text-muted-foreground">
                  {form.type === "weekly_bonus"
                    ? "Percentual aplicado sobre vendas líquidas para cada semana batida"
                    : "Percentual adicional quando todas as semanas do mês forem batidas"}
                </p>
              </div>
            )}

            {form.type === "strategic" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Tipo de Alvo</Label>
                    <Select value={form.targetType} onValueChange={v => setForm(f => ({ ...f, targetType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="supplier">Fornecedor</SelectItem>
                        <SelectItem value="product">Produto</SelectItem>
                        <SelectItem value="segment">Segmento</SelectItem>
                        <SelectItem value="category">Categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Nome / Código</Label>
                    <Input value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="Ex: AMANCO" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Taxa de Bônus (%)</Label>
                  <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="Ex: 0.50" />
                </div>
              </div>
            )}

            {form.type === "accelerator" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ativa a partir de (% da meta)</Label>
                  <Input type="number" value={form.triggerFrom} onChange={e => setForm(f => ({ ...f, triggerFrom: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Taxa sobre excedente (%)</Label>
                  <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} />
                </div>
              </div>
            )}

            {form.type === "reducer" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Condição (descrição)</Label>
                  <Input value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} placeholder="Ex: Margem abaixo de 10%" />
                </div>
                <div className="space-y-1">
                  <Label>Taxa de Redução (%)</Label>
                  <Input type="number" step="0.01" value={form.reduceRate} onChange={e => setForm(f => ({ ...f, reduceRate: e.target.value }))} placeholder="Ex: 0.20" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 border-t border-border">
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Regra ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate(formToPayload(form))} disabled={!form.name || saveMutation.isPending}>
              {editingId ? "Salvar Alterações" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
