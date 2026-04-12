import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, Edit2, Calendar, Layers, Zap, Users, Trophy,
  GitBranch, Shield, FileText, Building2, Clock, Hash, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  type Campaign,
  STATUS_COLOR, STATUS_LABEL, CAMPAIGN_MODE_LABEL,
  REWARD_TYPE_LABEL,
} from "./types";
import { Loader2, AlertCircle } from "lucide-react";

function fmtDate(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return d; }
}

function fmtDateTime(d?: string) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return d; }
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className={cn("text-sm text-foreground", mono && "font-mono")}>{value || "—"}</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <Separator />
      {children}
    </div>
  );
}

function TargetSummary({ targets }: { targets: Campaign["targets"] }) {
  const { vendedores, produtos, clientes, empresas } = targets;

  const vendRow = vendedores.mode === "all"
    ? "Todos os vendedores"
    : vendedores.mode === "group"
    ? `${vendedores.groupIds.length} grupo(s) de vendedores`
    : `${vendedores.ids.length} vendedor(es) específico(s)`;

  const prodRow = produtos.mode === "all"
    ? "Todos os produtos"
    : produtos.mode === "supplier"
    ? `Fornecedores: ${produtos.suppliers.join(", ") || "nenhum"}`
    : produtos.mode === "category"
    ? `Categorias: ${produtos.categories.join(", ") || "nenhuma"}`
    : `${produtos.ids.length} produto(s) específico(s)`;

  const cliRow = clientes.mode === "all"
    ? "Todos os clientes"
    : `${clientes.ids.length} cliente(s) específico(s)`;

  const empRow = empresas.mode === "all"
    ? "Todas as empresas"
    : `${empresas.ids.length} empresa(s) específica(s)`;

  const rows = [
    { label: "Vendedores", value: vendRow },
    { label: "Produtos", value: prodRow },
    { label: "Clientes", value: cliRow },
    { label: "Empresas", value: empRow },
  ];

  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.label} className="flex items-start gap-3">
          <span className="text-xs text-muted-foreground w-20 shrink-0 pt-0.5">{r.label}</span>
          <span className="text-xs font-medium">{r.value}</span>
        </div>
      ))}
      {vendedores.exclude.length > 0 && (
        <p className="text-xs text-amber-600">
          Excluídos: {vendedores.exclude.join(", ")}
        </p>
      )}
    </div>
  );
}

function RewardSummary({ rewards }: { rewards: Campaign["rewards"] }) {
  const typeLabel = REWARD_TYPE_LABEL[rewards.type] || rewards.type;

  return (
    <div className="space-y-3">
      <InfoRow label="Tipo de premiação" value={typeLabel} />
      <InfoRow label="Escopo" value={rewards.scope === "individual" ? "Individual" : "Coletivo"} />
      {rewards.baseValue !== undefined && rewards.baseValue > 0 && (
        <InfoRow label="Valor base" value={`R$ ${rewards.baseValue.toFixed(2)}`} />
      )}
      {rewards.basePercent !== undefined && rewards.basePercent > 0 && (
        <InfoRow label="Percentual base" value={`${rewards.basePercent}%`} />
      )}
      {rewards.tiers.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Faixas</span>
          <div className="mt-1 space-y-1">
            {rewards.tiers.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Faixa {i + 1}:</span>
                <span>
                  {t.min !== undefined && t.max !== undefined && t.max !== null
                    ? `${t.min} – ${t.max}`
                    : t.min !== undefined
                    ? `≥ ${t.min}`
                    : ""}
                  {" → "}
                  <strong>R$ {t.value.toFixed(2)}</strong>
                  {t.label && ` (${t.label})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {rewards.posicoes && rewards.posicoes.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Posições do ranking</span>
          <div className="mt-1 space-y-1">
            {rewards.posicoes.map(p => (
              <div key={p.id} className="text-xs flex gap-2">
                <span className="text-muted-foreground">{p.posicao}º lugar:</span>
                <strong>R$ {p.valor.toFixed(2)}</strong>
                {p.label && <span className="text-muted-foreground">({p.label})</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LimitsSummary({ limits }: { limits: Campaign["limits"] }) {
  const entries: [string, number | null | undefined][] = [
    ["Máx. por vendedor", limits.maxPerVendedor],
    ["Máx. por cliente", limits.maxPerCliente],
    ["Máx. por pedido", limits.maxPerPedido],
    ["Máx. diário", limits.maxDiario],
    ["Máx. semanal", limits.maxSemanal],
    ["Máx. mensal", limits.maxMensal],
    ["Máx. total", limits.maxTotal],
    ["Mínimo de corte", limits.minCutoff],
  ].filter(([, v]) => v != null) as [string, number][];

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem limites configurados</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">R$ {value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function CampaignView({ campaignId }: { campaignId: string }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: campaign, isLoading, isError } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${campaignId}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
        <AlertCircle className="h-10 w-10 text-destructive/60" />
        <p>Campanha não encontrada.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/campanhas")}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
      </div>
    );
  }

  const isReadonly = campaign.status === "encerrada" || campaign.status === "cancelada";
  const canEdit = isAdmin && !isReadonly;

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate("/campanhas")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold leading-tight">{campaign.name}</h1>
                <Badge className={cn("text-[10px] py-0 h-4 shrink-0", STATUS_COLOR[campaign.status])}>
                  {STATUS_LABEL[campaign.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-muted-foreground">{campaign.code}</span>
                {campaign.is_exclusive && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 text-orange-600 border-orange-300">Exclusiva</Badge>
                )}
                {!campaign.is_cumulative && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4 text-purple-600 border-purple-300">Não acumulável</Badge>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <Button
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => navigate(`/campanhas/${campaign.id}/editar`)}
            >
              <Edit2 className="h-4 w-4" />
              Editar campanha
            </Button>
          )}
        </div>

        {/* ── Natural language description ── */}
        {campaign.natural_language && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <p className="text-sm leading-relaxed text-foreground italic">
              "{campaign.natural_language}"
            </p>
          </div>
        )}

        {/* ── Dados gerais ── */}
        <SectionCard title="Dados Gerais" icon={Info}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoRow label="Período" value={
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {fmtDate(campaign.starts_at)} → {fmtDate(campaign.ends_at)}
              </span>
            } />
            <InfoRow label="Modalidade" value={CAMPAIGN_MODE_LABEL[campaign.campaign_mode] || campaign.campaign_mode} />
            <InfoRow label="Tipo" value={campaign.campaign_type === "avancado" ? "Avançada" : "Padrão"} />
            <InfoRow label="Prioridade" value={campaign.priority} />
            {campaign.supplier_name && <InfoRow label="Fornecedor" value={campaign.supplier_name} />}
            {campaign.sub_type && <InfoRow label="Sub-tipo" value={campaign.sub_type} />}
            {campaign.recurrence && <InfoRow label="Recorrência" value={campaign.recurrence} />}
            {campaign.time_start && campaign.time_end && (
              <InfoRow label="Horário válido" value={`${campaign.time_start} – ${campaign.time_end}`} />
            )}
          </div>
          {campaign.description && (
            <>
              <Separator />
              <InfoRow label="Descrição" value={campaign.description} />
            </>
          )}
          {campaign.objective && (
            <InfoRow label="Objetivo" value={campaign.objective} />
          )}
        </SectionCard>

        {/* ── Público-alvo + Premiação ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Público-Alvo" icon={Users}>
            <TargetSummary targets={campaign.targets} />
          </SectionCard>

          <SectionCard title="Premiação" icon={Trophy}>
            <RewardSummary rewards={campaign.rewards} />
          </SectionCard>
        </div>

        {/* ── Limites + Condições ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SectionCard title="Limites" icon={Shield}>
            <LimitsSummary limits={campaign.limits} />
          </SectionCard>

          <SectionCard title="Condições" icon={GitBranch}>
            {campaign.conditions.conditions.length === 0 && campaign.conditions.groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem condições configuradas (campanha aberta)</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {campaign.conditions.conditions.length} condição(ões) + {campaign.conditions.groups.length} grupo(s) configurados.
                {canEdit && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 ml-2 text-xs"
                    onClick={() => navigate(`/campanhas/${campaign.id}/editar`)}
                  >
                    Ver no editor →
                  </Button>
                )}
              </p>
            )}
          </SectionCard>
        </div>

        {/* ── Notas internas ── */}
        {campaign.internal_notes && (
          <SectionCard title="Notas Internas" icon={FileText}>
            <p className="text-sm text-muted-foreground whitespace-pre-line">{campaign.internal_notes}</p>
          </SectionCard>
        )}

        {/* ── Metadados ── */}
        <SectionCard title="Histórico" icon={Clock}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoRow label="Criado em" value={fmtDateTime(campaign.created_at)} />
            <InfoRow label="Atualizado em" value={fmtDateTime(campaign.updated_at)} />
            <InfoRow label="Versão" value={`v${campaign.current_version}`} />
            <InfoRow label="Criado por" value={campaign.created_by} mono />
            {campaign.updated_by && <InfoRow label="Atualizado por" value={campaign.updated_by} mono />}
            {campaign.change_reason && <InfoRow label="Último motivo" value={campaign.change_reason} />}
          </div>
        </SectionCard>

        {/* ── Edit CTA (bottom) for admin ── */}
        {canEdit && (
          <div className="flex justify-end pt-2">
            <Button
              className="gap-2"
              onClick={() => navigate(`/campanhas/${campaign.id}/editar`)}
            >
              <Edit2 className="h-4 w-4" />
              Editar campanha completa
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
