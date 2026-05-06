import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Filter, MoreVertical, Eye, Edit2, Copy, Play,
  Pause, StopCircle, XCircle, AlertTriangle, Layers, Zap,
  Calendar, ArrowUpDown, ChevronLeft, Trophy, Clock, Check, RefreshCw, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Campaign, type CampaignStatus,
  STATUS_LABEL, STATUS_COLOR,
} from "./types";

// ─── Status action helpers ────────────────────────────────────────────────────

const STATUS_ACTIONS: Record<CampaignStatus, { label: string; nextStatus: CampaignStatus; Icon: React.ElementType; variant: string }[]> = {
  rascunho:  [{ label: "Ativar",     nextStatus: "ativa",     Icon: Play,        variant: "success" }],
  ativa:     [{ label: "Pausar",     nextStatus: "pausada",   Icon: Pause,       variant: "warning" },
               { label: "Encerrar",  nextStatus: "encerrada", Icon: StopCircle,  variant: "info" }],
  pausada:   [{ label: "Reativar",   nextStatus: "ativa",     Icon: Play,        variant: "success" },
               { label: "Encerrar",  nextStatus: "encerrada", Icon: StopCircle,  variant: "info" }],
  encerrada: [],
  cancelada: [],
};

function fmtDate(d: string) {
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

// ─── Campaign card ────────────────────────────────────────────────────────────

interface CampaignCardProps {
  campaign: Campaign;
  isAdmin: boolean;
  onClone: (id: string) => void;
  onStatus: (id: string, status: CampaignStatus) => void;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onRenew: (id: string) => void;
  onDelete?: (id: string) => void;
}

function CampaignCard({ campaign: c, isAdmin, onClone, onStatus, onView, onEdit, onRenew, onDelete, cloning, renewing }: CampaignCardProps & { cloning?: boolean; renewing?: boolean }) {
  const actions = STATUS_ACTIONS[c.status] || [];
  const isActive = c.status === "ativa";
  const isPast = c.status === "encerrada" || c.status === "cancelada";

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      isActive && "ring-1 ring-green-400/40 dark:ring-green-600/30",
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge className={cn("text-[10px] py-0 h-4", STATUS_COLOR[c.status])}>
                {STATUS_LABEL[c.status]}
              </Badge>
              <span className="text-[10px] font-mono text-muted-foreground">{c.code}</span>
              {c.is_exclusive && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 text-orange-600 border-orange-300">
                  Exclusiva
                </Badge>
              )}
              {!c.is_cumulative && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 text-purple-600 border-purple-300">
                  Não acumulável
                </Badge>
              )}
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold leading-tight">{c.name}</h3>
            {c.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}
              </span>
              <span className="flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
                Prioridade {c.priority}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="h-3 w-3" />
                v{c.current_version}
              </span>
              {c.campaign_type === "avancado" && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 text-blue-600 border-blue-300">
                  <Zap className="h-2.5 w-2.5 mr-0.5" /> Avançada
                </Badge>
              )}
              {c.cycle_type && c.cycle_type !== "none" && (
                <Badge variant="outline" className="text-[10px] py-0 h-4 text-cyan-600 border-cyan-300">
                  <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                  {c.cycle_type === "monthly" ? "Mensal" : c.cycle_type === "quarterly" ? "Trimestral" : "Anual"}
                  {c.auto_renew && " · Auto"}
                </Badge>
              )}
            </div>

            {/* Natural language */}
            {c.natural_language && (
              <p className="text-xs text-muted-foreground mt-2 italic line-clamp-2 leading-relaxed">
                {c.natural_language}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* View button — always visible */}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Visualizar campanha"
              onClick={() => onView(c.id)}
            >
              <Eye className="h-4 w-4" />
            </Button>

            {/* Edit button — admins only, non-past */}
            {isAdmin && !isPast && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Editar campanha"
                onClick={() => onEdit(c.id)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}

            {/* More actions dropdown — admins only */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-xs">
                  <DropdownMenuItem className="text-xs gap-2" onClick={() => onClone(c.id)} disabled={cloning}>
                    <Copy className="h-3.5 w-3.5" /> Clonar
                  </DropdownMenuItem>
                  {c.status === "encerrada" && c.cycle_type && c.cycle_type !== "none" && c.auto_renew && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs gap-2 text-cyan-700 focus:text-cyan-700" onClick={() => onRenew(c.id)} disabled={renewing}>
                        <RefreshCw className="h-3.5 w-3.5" /> Renovar Ciclo
                      </DropdownMenuItem>
                    </>
                  )}
                  {!isPast && (
                    <>
                      <DropdownMenuSeparator />
                      {actions.map(act => (
                        <DropdownMenuItem
                          key={act.nextStatus}
                          className="text-xs gap-2"
                          onClick={() => onStatus(c.id, act.nextStatus)}
                        >
                          <act.Icon className="h-3.5 w-3.5" /> {act.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-xs gap-2 text-red-600 focus:text-red-600"
                        onClick={() => onStatus(c.id, "cancelada")}
                      >
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </DropdownMenuItem>
                    </>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-xs gap-2 text-red-600 focus:text-red-600"
                        onClick={() => onDelete(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir campanha
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ campaigns }: { campaigns: Campaign[] }) {
  const byStatus = campaigns.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const stats = [
    { label: "Total", value: campaigns.length, icon: Layers, color: "text-zinc-600" },
    { label: "Ativas", value: byStatus.ativa || 0, icon: Check, color: "text-green-600" },
    { label: "Rascunhos", value: byStatus.rascunho || 0, icon: Clock, color: "text-zinc-500" },
    { label: "Pausadas", value: byStatus.pausada || 0, icon: Pause, color: "text-yellow-600" },
    { label: "Encerradas", value: byStatus.encerrada || 0, icon: Trophy, color: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map(s => (
        <div key={s.label} className="flex flex-col items-center p-2 rounded-lg bg-muted/40 border">
          <s.icon className={cn("h-4 w-4 mb-0.5", s.color)} />
          <span className="text-lg font-bold">{s.value}</span>
          <span className="text-[10px] text-muted-foreground">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Status change dialog ─────────────────────────────────────────────────────

interface StatusDialogState {
  campaignId: string;
  campaignName: string;
  targetStatus: CampaignStatus;
  reason: string;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CampanhasList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isVendedor = user?.role === "vendedor";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [statusReason, setStatusReason] = useState("");

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/campaigns/${id}/clone`, {});
      return res.json();
    },
    onSuccess: (cloned: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campanha clonada!", description: `${cloned.name} criada como rascunho.` });
    },
    onError: (e: any) => toast({ title: "Erro ao clonar", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/campaigns/${id}/status`, { status, reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Status atualizado!" });
      setStatusDialog(null);
      setStatusReason("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const renewMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/campaigns/${id}/renovar`, {});
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao renovar"); }
      return res.json();
    },
    onSuccess: (renewed: Campaign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Ciclo renovado!", description: `Próximo ciclo "${renewed.name}" criado como rascunho.` });
    },
    onError: (e: any) => toast({ title: "Erro ao renovar ciclo", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/campaigns/${id}`);
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Erro ao excluir"); }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: "Campanha excluída!" });
    },
    onError: (e: any) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const deleteCampaign = campaigns.find(c => c.id === deleteDialogId);

  function handleStatus(id: string, targetStatus: CampaignStatus) {
    const campaign = campaigns.find(c => c.id === id);
    if (!campaign) return;
    setStatusDialog({ campaignId: id, campaignName: campaign.name, targetStatus, reason: "" });
    setStatusReason("");
  }

  // Vendors only see active and paused campaigns
  const visibleCampaigns = isVendedor
    ? campaigns.filter(c => c.status === "ativa" || c.status === "pausada")
    : campaigns;

  // Filter
  const filtered = visibleCampaigns.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (filterType !== "all" && c.campaign_type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.code.toLowerCase().includes(q) && !(c.description || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {!isVendedor && (
              <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                <Link href="/"><ChevronLeft className="h-4 w-4" /></Link>
              </Button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">Campanhas Comerciais</h1>
                <HelpButton onClick={() => setHelpOpen(true)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {isVendedor ? "Campanhas disponíveis para você" : "Gerencie e monitore campanhas de incentivo de vendas"}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button className="gap-2 shrink-0" onClick={() => navigate("/campanhas/nova")}>
              <Plus className="h-4 w-4" />
              Criar Campanha
            </Button>
          )}
        </div>

        {/* Stats */}
        {!isVendedor && campaigns.length > 0 && <StatsBar campaigns={campaigns} />}

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-8 pl-8 text-xs"
              placeholder="Buscar por nome, código..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {!isVendedor && (
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-36">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                {(["rascunho", "ativa", "pausada", "encerrada", "cancelada"] as CampaignStatus[]).map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
              <SelectItem value="padrao" className="text-xs">Padrão</SelectItem>
              <SelectItem value="avancado" className="text-xs">Avançada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground">
            <Trophy className="h-12 w-12 opacity-20" />
            <div className="text-center">
              <p className="font-medium">
                {campaigns.length === 0 ? "Nenhuma campanha criada ainda" : "Nenhuma campanha encontrada"}
              </p>
              <p className="text-sm mt-1">
                {campaigns.length === 0
                  ? 'Clique em "Criar Campanha" para começar.'
                  : "Tente ajustar os filtros de busca."}
              </p>
            </div>
            {isAdmin && campaigns.length === 0 && (
              <Button onClick={() => navigate("/campanhas/nova")} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeira campanha
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <CampaignCard
                key={c.id}
                campaign={c}
                isAdmin={isAdmin}
                onView={id => navigate(`/campanhas/${id}`)}
                onEdit={id => navigate(`/campanhas/${id}/editar`)}
                onClone={id => cloneMutation.mutate(id)}
                onStatus={handleStatus}
                onRenew={id => renewMutation.mutate(id)}
                onDelete={isAdmin ? id => setDeleteDialogId(id) : undefined}
                cloning={cloneMutation.isPending}
                renewing={renewMutation.isPending}
              />
            ))}
            <p className="text-xs text-center text-muted-foreground pt-2">
              {filtered.length} de {campaigns.length} campanhas
            </p>
          </div>
        )}
      </div>

      {/* Status change dialog */}
      <AlertDialog open={Boolean(statusDialog)} onOpenChange={open => !open && setStatusDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog && STATUS_LABEL[statusDialog.targetStatus]} campanha?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog?.campaignName}
              {statusDialog?.targetStatus === "ativa" && (
                <span className="block mt-1 text-yellow-600">
                  ⚠️ A campanha será validada antes de ser ativada.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <label className="text-xs font-medium">Motivo (opcional)</label>
            <Input
              className="text-xs h-8"
              placeholder="Ex: campanha aprovada pela gerência"
              value={statusReason}
              onChange={e => setStatusReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => statusDialog && statusMutation.mutate({
                id: statusDialog.campaignId,
                status: statusDialog.targetStatus,
                reason: statusReason,
              })}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete campaign dialog */}
      <AlertDialog open={Boolean(deleteDialogId)} onOpenChange={open => !open && setDeleteDialogId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Excluir campanha?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {deleteCampaign ? (
                  <>
                    Você está prestes a apagar <strong>{deleteCampaign.name}</strong>
                    {" "}({STATUS_LABEL[deleteCampaign.status]}).
                  </>
                ) : (
                  "Você está prestes a apagar esta campanha."
                )}
              </span>
              <span className="block">
                Esta campanha será excluída permanentemente. Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteDialogId) deleteMutation.mutate(deleteDialogId);
                setDeleteDialogId(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.campanhas} />
    </div>
  );
}
