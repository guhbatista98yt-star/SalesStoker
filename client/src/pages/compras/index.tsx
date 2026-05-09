import { useState } from "react";
import { Link } from "wouter";
import { useComprasDashboard, useComprasAlertas, useComprasFornecedores, useComprasProdutos, useComprasSugestoes, updateCompraAlertaStatus } from "./use-compras";
import { useToast } from "@/hooks/use-toast";
import { useComprasCompany } from "./use-company";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { CriticidadeBadge, CriticidadeDot, CRITICIDADE_CONFIG } from "./criticidade";
import type { Alerta, ProdutoCritico, Criticidade } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle, Package, ShoppingCart, Clock, TrendingDown, TrendingUp,
  DollarSign, FileText, Building2, ChevronRight, Eye, BellOff,
  BarChart3, Filter, ArrowUpDown, HelpCircle, CheckCircle2, Info, Download,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv-export";
import { SyncStatusBar } from "@/components/sync-status-bar";
/* ── KPI Card ─────────────────────────────────────────────────────── */
function KPICard({
  title, value, icon: Icon, color, subtitle, loading,
}: {
  title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string; loading?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-4">
        {loading ? (
          <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /></div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium leading-tight mb-1">{title}</p>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            <div className={cn("p-2 rounded-xl shrink-0", color)}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Alert Row ─────────────────────────────────────────────────────── */
function AlertRow({
  alerta,
  onAcao,
  pending,
}: {
  alerta: Alerta;
  onAcao: (id: string, acao: "ver" | "silenciar" | "detalhe") => void;
  pending?: boolean;
}) {
  const cfg = CRITICIDADE_CONFIG[alerta.criticidade];
  const detalheHref = alerta.produtoId
    ? `/compras/produtos/${alerta.produtoId}`
    : alerta.fornecedorId
    ? `/compras/fornecedores/${alerta.fornecedorId}`
    : null;
  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border transition-all",
      alerta.visto ? "opacity-60" : "",
      cfg.bg, cfg.border,
    )}>
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <CriticidadeDot value={alerta.criticidade} size="md" className="mt-1 shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className={cn("text-xs font-semibold", cfg.color)}>{alerta.tipo}</span>
            {alerta.tempoEstimadoRuptura !== undefined && (
              <span className="text-xs text-muted-foreground">
                • Ruptura em {alerta.tempoEstimadoRuptura === 0 ? "hoje" : `${alerta.tempoEstimadoRuptura}d`}
              </span>
            )}
          </div>
          <p className="text-xs font-medium truncate">{alerta.produto}{alerta.fornecedor ? ` · ${alerta.fornecedor}` : ""}</p>
          <p className="text-xs text-muted-foreground">{alerta.acaoSugerida}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending} onClick={() => onAcao(alerta.id, "ver")}>
          <Eye className="h-3 w-3 mr-1" /> Marcar como visto
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending} onClick={() => onAcao(alerta.id, "silenciar")}>
          <BellOff className="h-3 w-3 mr-1" /> Silenciar
        </Button>
        {detalheHref && (
          <Link href={detalheHref}>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={pending} onClick={() => onAcao(alerta.id, "detalhe")}>
              <ChevronRight className="h-3 w-3 mr-1" /> Detalhe
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Simulação Drawer ──────────────────────────────────────────────── */
function SimulacaoDrawer({
  open, onClose, produtos,
}: {
  open: boolean; onClose: () => void; produtos: ProdutoCritico[];
}) {
  const [produtoId, setProdutoId] = useState("");
  const [quantidade, setQuantidade] = useState("");

  const produto = produtos.find(p => p.id === produtoId);

  const coberturaAntes = produto?.coberturaDias ?? 0;
  const consumoDiario = produto ? Math.max(1, produto.estoqueAtual / Math.max(1, produto.coberturaDias)) : 1;
  const quantidadeNumerica = Number.isFinite(Number(quantidade)) ? Math.max(0, Number(quantidade)) : 0;
  const coberturaDepois = produto && quantidadeNumerica > 0
    ? Math.round((produto.estoqueAtual + quantidadeNumerica) / consumoDiario)
    : coberturaAntes;

  function getCriticidadeFromDias(dias: number): Criticidade {
    if (dias <= 0) return "critico";
    if (dias <= 3) return "critico";
    if (dias <= 7) return "alto";
    if (dias <= 14) return "moderado";
    if (dias <= 30) return "atencao";
    return "normal";
  }

  const criticidadeAntes = produto?.criticidade ?? "normal";
  const criticidadeDepois = getCriticidadeFromDias(coberturaDepois);

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Simulação Rápida de Compra</SheetTitle>
          <SheetDescription>Veja o impacto de uma compra antes de confirmar.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Produto</label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um produto..." />
              </SelectTrigger>
              <SelectContent>
                {produtos.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descricao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {produto && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantidade a comprar</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Ex: 50"
                  value={quantidade}
                  onChange={e => setQuantidade(e.target.value)}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Antes</p>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Cobertura</p>
                      <p className="text-xl font-bold tabular-nums">{coberturaAntes}d</p>
                    </div>
                    <CriticidadeBadge value={criticidadeAntes} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Depois</p>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Cobertura</p>
                      <p className="text-xl font-bold tabular-nums">{coberturaDepois}d</p>
                    </div>
                    <CriticidadeBadge value={criticidadeDepois} />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border bg-muted/20 text-sm space-y-1">
                <p className="font-medium">Resumo</p>
                <p className="text-muted-foreground">
                  Comprar <strong>{quantidade || "—"}</strong> unidades de <strong>{produto.descricao}</strong>
                  {" "}aumenta a cobertura de <strong>{coberturaAntes}d</strong> para <strong>{coberturaDepois}d</strong>.
                </p>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────────────── */
export default function ComprasDashboard() {
  const { companyId, setCompanyId, companies, companiesLoading } = useComprasCompany();
  const { toast } = useToast();
  const { data: dashboard, isLoading: loadingDash, isError: erroDashboard, error: dashboardError, refetch: refetchDash } = useComprasDashboard(companyId);
  const { data: alertas = [], isLoading: loadingAlertas, isError: erroAlertas, refetch: refetchAlertas } = useComprasAlertas();
  const { data: fornecedoresData, isLoading: loadingFornecedores, isError: erroFornecedores, refetch: refetchFornecedores } = useComprasFornecedores(companyId);
  const { data: produtosData, isLoading: loadingProdutos, isError: erroProdutos, refetch: refetchProdutos } = useComprasProdutos(companyId);
  const { data: sugestoes = [], isError: erroSugestoes, refetch: refetchSugestoes } = useComprasSugestoes(companyId);

  const fornecedores = fornecedoresData?.items || [];
  const produtos = produtosData?.items || [];


  const [simulacaoOpen, setSimulacaoOpen] = useState(false);
  const [filtroFornecedor, setFiltroFornecedor] = useState("");
  const [filtroProduto, setFiltroProduto] = useState("");
  const [filtroCriticidade, setFiltroCriticidade] = useState<string>("todos");
  const [sortFornecedor, setSortFornecedor] = useState<"criticidade" | "valor" | "itens">("criticidade");
  const [sortProduto, setSortProduto] = useState<"criticidade" | "cobertura" | "sugestao">("criticidade");
  const [showTodosAlertas, setShowTodosAlertas] = useState(false);
  const [showInstrucoes, setShowInstrucoes] = useState(false);
  const [pendingAlertaIds, setPendingAlertaIds] = useState<Set<string>>(() => new Set());

  async function handleAlertaAcao(id: string, acao: "ver" | "silenciar" | "detalhe") {
    if (acao === "detalhe") return;
    if (pendingAlertaIds.has(id)) return;
    const status = acao === "ver" ? "lido" : "silenciado";
    setPendingAlertaIds(prev => new Set(prev).add(id));
    try {
      await updateCompraAlertaStatus(id, status);
      await refetchAlertas();
      toast({ title: acao === "ver" ? "Alerta marcado como visto" : "Alerta silenciado" });
    } catch (err) {
      toast({
        title: "Erro ao atualizar alerta",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setPendingAlertaIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleExportCompras() {
    if (produtosFiltrados.length === 0) {
      toast({ title: "Nenhum produto para exportar" });
      return;
    }

    const now = new Date();
    const empresa = companyId === "all" ? "Todas" : companies.find(c => c.id === companyId)?.name || companyId;

    const rows = [
      ["CONECTUBOS — Relatório de Compras"],
      ["Gerado em", now.toLocaleString("pt-BR")],
      ["Empresa", empresa],
      [],
      ["Código", "Descrição", "Fornecedor", "Criticidade", "Estoque Atual", "Cobertura (dias)", "Data Est. Ruptura", "Sugestão Compra"],
      ...produtosFiltrados.map(p => [
        p.codigo,
        p.descricao,
        p.fornecedor,
        p.criticidade.toUpperCase(),
        p.estoqueAtual,
        p.coberturaDias,
        p.dataEstimadaRuptura,
        p.sugestaoCompra,
      ]),
    ];
    downloadCsv(`compras-relatorio-${now.toISOString().slice(0,10)}.csv`, rows);

    toast({ title: "Relatório exportado com sucesso!" });
  }

  const alertasFiltrados = alertas
    .filter(a => !a.silenciado);

  const alertasExibidos = showTodosAlertas ? alertasFiltrados : alertasFiltrados.slice(0, 4);

  const fornecedoresFiltrados = fornecedores
    .filter(f =>
      (!filtroFornecedor || f.nome.toLowerCase().includes(filtroFornecedor.toLowerCase())) &&
      (filtroCriticidade === "todos" || f.criticidade === filtroCriticidade)
    )
    .sort((a, b) => {
      if (sortFornecedor === "valor") return b.valorEstimado - a.valorEstimado;
      if (sortFornecedor === "itens") return b.itensCriticos - a.itensCriticos;
      const o: Record<string, number> = { critico: 0, alto: 1, moderado: 2, atencao: 3, normal: 4 };
      return (o[a.criticidade] ?? 5) - (o[b.criticidade] ?? 5);
    });

  const produtosFiltrados = produtos
    .filter(p =>
      (!filtroProduto || p.descricao.toLowerCase().includes(filtroProduto.toLowerCase()) || p.codigo.toLowerCase().includes(filtroProduto.toLowerCase())) &&
      (filtroCriticidade === "todos" || p.criticidade === filtroCriticidade)
    )
    .sort((a, b) => {
      if (sortProduto === "cobertura") return a.coberturaDias - b.coberturaDias;
      if (sortProduto === "sugestao") return b.sugestaoCompra - a.sugestaoCompra;
      const o: Record<string, number> = { critico: 0, alto: 1, moderado: 2, atencao: 3, normal: 4 };
      return (o[a.criticidade] ?? 5) - (o[b.criticidade] ?? 5);
    });

  /* Charts */
  const criticidadeData = [
    { name: "Crítico",  value: produtos.filter(p => p.criticidade === "critico").length,  fill: "#ef4444" },
    { name: "Alto",     value: produtos.filter(p => p.criticidade === "alto").length,      fill: "#f97316" },
    { name: "Moderado", value: produtos.filter(p => p.criticidade === "moderado").length,  fill: "#eab308" },
    { name: "Atenção",  value: produtos.filter(p => p.criticidade === "atencao").length,   fill: "#3b82f6" },
    { name: "Normal",   value: produtos.filter(p => p.criticidade === "normal").length,    fill: "#22c55e" },
  ].filter(d => d.value > 0);

  const rupturaFaixaData = [
    { name: "Hoje",  value: produtos.filter(p => p.coberturaDias === 0).length },
    { name: "1-3d",  value: produtos.filter(p => p.coberturaDias > 0 && p.coberturaDias <= 3).length },
    { name: "4-7d",  value: produtos.filter(p => p.coberturaDias > 3 && p.coberturaDias <= 7).length },
    { name: "8-14d", value: produtos.filter(p => p.coberturaDias > 7 && p.coberturaDias <= 14).length },
    { name: ">14d",  value: produtos.filter(p => p.coberturaDias > 14).length },
  ];

  const hasComprasError = erroDashboard || erroAlertas || erroFornecedores || erroProdutos || erroSugestoes;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Análise de Compras</h1>
            <p className="text-sm text-muted-foreground">Visão em tempo real do estoque crítico e sugestões de compra</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SyncStatusBar routine="estoque_sugestao" label="Estoque" />
            <CompanySelector
              companies={companies}
              selectedId={companyId}
              onChange={setCompanyId}
              loading={companiesLoading}
            />
            <Button size="sm" variant="outline" onClick={() => setShowInstrucoes(true)} className="gap-2">
              <HelpCircle className="h-3.5 w-3.5" /> Instruções
            </Button>
            <Button size="sm" onClick={() => setSimulacaoOpen(true)} disabled={produtos.length === 0} className="gap-2">
              <BarChart3 className="h-3.5 w-3.5" /> Simular Compra
            </Button>
          </div>
        </div>

        {hasComprasError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Falha ao carregar dados reais de compras. {dashboardError instanceof Error ? dashboardError.message : "Verifique a API e tente atualizar."}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard title="Fornecedores Críticos" value={dashboard?.fornecedoresCriticos ?? "—"} icon={Building2} color="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" loading={loadingDash} />
          <KPICard title="Produtos Críticos" value={dashboard?.produtosCriticos ?? "—"} icon={Package} color="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" loading={loadingDash} />
          <KPICard title="Zerados em 3 dias" value={dashboard?.itensZeradosEm3Dias ?? "—"} icon={AlertTriangle} color="bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400" loading={loadingDash} />
          <KPICard title="Valor Est. de Compra" value={dashboard ? `R$ ${(dashboard.valorEstimadoCompra / 1000).toFixed(0)}k` : "—"} icon={DollarSign} color="bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400" loading={loadingDash} />
          <KPICard title="Abaixo do Mínimo" value={dashboard?.abaixoEstoqueSeguranca ?? "—"} icon={TrendingDown} color="bg-yellow-100 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400" loading={loadingDash} />
        </div>

        {/* Alertas + Sugestões */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Alertas */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Alertas em Tempo Real
                <Badge variant="destructive" className="text-xs">{alertasFiltrados.filter(a => !a.visto).length}</Badge>
              </h2>
            </div>
            {loadingAlertas ? (
              <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
            ) : alertasFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Nenhum alerta ativo</div>
            ) : (
              <div className="space-y-2">
                {alertasExibidos.map(a => (
                  <AlertRow key={a.id} alerta={a} onAcao={handleAlertaAcao} pending={pendingAlertaIds.has(a.id)} />
                ))}
                {alertasFiltrados.length > 4 && (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowTodosAlertas(v => !v)}>
                    {showTodosAlertas ? "Mostrar menos" : `Ver todos (${alertasFiltrados.length})`}
                    <ChevronRight className={cn("h-3 w-3 ml-1 transition-transform", showTodosAlertas && "rotate-90")} />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Sugestão por Fornecedor */}
          <div className="space-y-3">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              Sugestão por Fornecedor
            </h2>
            <div className="space-y-2">
              {sugestoes.length === 0 ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                  Nenhuma sugestao de compra para os filtros atuais.
                </div>
              ) : sugestoes.map(s => (
                <div key={s.fornecedorId} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                  <CriticidadeDot value={s.urgencia} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.fornecedor}</p>
                    <p className="text-xs text-muted-foreground">{s.itens} itens · R$ {s.valorEstimado.toLocaleString("pt-BR")}</p>
                  </div>
                  <Link href={`/compras/fornecedores/${s.fornecedorId}`}>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs shrink-0">
                      Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribuição por Criticidade</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={criticidadeData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" isAnimationActive={false}>
                    {criticidadeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number | string, name: string) => [v, name]} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Previsão de Ruptura por Faixa de Dias</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rupturaFaixaData} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v: number | string) => [v, "Produtos"]} />
                  <Bar dataKey="value" fill="#ef4444" radius={[4,4,0,0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filtros globais */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={filtroCriticidade} onValueChange={setFiltroCriticidade}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Criticidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="moderado">Moderado</SelectItem>
              <SelectItem value="atencao">Atenção</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 gap-2 ml-auto"
            onClick={handleExportCompras}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        {/* Ranking Fornecedores */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Ranking de Fornecedores
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Filtrar fornecedor..."
                  value={filtroFornecedor}
                  onChange={e => setFiltroFornecedor(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
                <Select value={sortFornecedor} onValueChange={(v) => setSortFornecedor(v as typeof sortFornecedor)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="criticidade">Criticidade</SelectItem>
                    <SelectItem value="valor">Valor est.</SelectItem>
                    <SelectItem value="itens">Itens críticos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingFornecedores ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : fornecedoresFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum fornecedor encontrado para os filtros atuais.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Fornecedor</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Itens Críticos</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cobertura Méd.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Lead Time</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground">Valor Est.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Criticidade</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {fornecedoresFiltrados.map(f => (
                        <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-medium">{f.nome}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn("font-bold", f.itensCriticos > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                              {f.itensCriticos}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">{f.coberturaMedia}d</td>
                          <td className="px-3 py-3 text-center">{f.leadTime}d</td>
                          <td className="px-3 py-3 text-right font-medium">R$ {f.valorEstimado.toLocaleString("pt-BR")}</td>
                          <td className="px-3 py-3 text-center"><CriticidadeBadge value={f.criticidade} /></td>
                          <td className="px-4 py-3">
                            <Link href={`/compras/fornecedores/${f.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y">
                  {fornecedoresFiltrados.map(f => (
                    <div key={f.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{f.nome}</span>
                        <CriticidadeBadge value={f.criticidade} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div><p className="font-semibold text-foreground">{f.itensCriticos}</p>Itens críticos</div>
                        <div><p className="font-semibold text-foreground">{f.coberturaMedia}d</p>Cobertura</div>
                        <div><p className="font-semibold text-foreground">{f.leadTime}d</p>Lead time</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">R$ {f.valorEstimado.toLocaleString("pt-BR")}</span>
                        <Link href={`/compras/fornecedores/${f.id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Detalhe</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Ranking Produtos */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" /> Ranking de Produtos Críticos
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Filtrar produto..."
                  value={filtroProduto}
                  onChange={e => setFiltroProduto(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
                <Select value={sortProduto} onValueChange={(v) => setSortProduto(v as typeof sortProduto)}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="criticidade">Criticidade</SelectItem>
                    <SelectItem value="cobertura">Cobertura</SelectItem>
                    <SelectItem value="sugestao">Sugestão qtd</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loadingProdutos ? (
              <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhum produto encontrado para os filtros atuais.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Código</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Descrição</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Fornecedor</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Estoque</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Cobertura</th>
                        <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground">Ruptura Est.</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Sugestão</th>
                        <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Criticidade</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {produtosFiltrados.map(p => (
                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs">{p.codigo}</td>
                          <td className="px-3 py-3 font-medium max-w-[200px] truncate">{p.descricao}</td>
                          <td className="px-3 py-3 text-muted-foreground">{p.fornecedor}</td>
                          <td className="px-3 py-3 text-center tabular-nums">{p.estoqueAtual}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn("font-medium tabular-nums", p.coberturaDias <= 3 ? "text-red-600 dark:text-red-400" : p.coberturaDias <= 7 ? "text-orange-600" : "")}>
                              {p.coberturaDias}d
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{p.dataEstimadaRuptura}</td>
                          <td className="px-3 py-3 text-center">
                            {p.sugestaoCompra > 0 ? (
                              <Badge variant="outline" className="text-xs">{p.sugestaoCompra} un</Badge>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center"><CriticidadeBadge value={p.criticidade} /></td>
                          <td className="px-4 py-3">
                            <Link href={`/compras/produtos/${p.id}`}>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                                Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden divide-y">
                  {produtosFiltrados.map(p => (
                    <div key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-sm">{p.descricao}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.codigo} · {p.fornecedor}</p>
                        </div>
                        <CriticidadeBadge value={p.criticidade} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div><p className="font-semibold text-foreground">{p.estoqueAtual}</p>Estoque</div>
                        <div><p className={cn("font-semibold", p.coberturaDias <= 3 ? "text-red-600" : "text-foreground")}>{p.coberturaDias}d</p>Cobertura</div>
                        <div><p className="font-semibold text-foreground">{p.sugestaoCompra > 0 ? `${p.sugestaoCompra} un` : "—"}</p>Sugestão</div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Ruptura: {p.dataEstimadaRuptura}</span>
                        <Link href={`/compras/produtos/${p.id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Detalhe</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      <SimulacaoDrawer
        open={simulacaoOpen}
        onClose={() => setSimulacaoOpen(false)}
        produtos={produtos}
      />

      {/* Dialog de Instruções */}
      <Dialog open={showInstrucoes} onOpenChange={setShowInstrucoes}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Como funciona a Análise de Compras
            </DialogTitle>
            <DialogDescription>
              Guia rápido para entender os indicadores e tomar decisões de compra com mais segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 mt-2">

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0" /> O que é a Análise de Compras?
              </h3>
              <p className="text-sm text-muted-foreground">
                A análise cruza automaticamente as vendas dos últimos meses com o estoque atual para indicar quais produtos precisam ser comprados e em qual quantidade — antes que faltem na prateleira.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" /> Alertas em tempo real
              </h3>
              <p className="text-sm text-muted-foreground">
                Os alertas aparecem automaticamente quando um produto está prestes a zerar o estoque ou já está abaixo do mínimo de segurança. Clique em <strong>Detalhe</strong> para ver o produto específico, ou <strong>Silenciar</strong> para ocultar um alerta já tratado.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-orange-500 shrink-0" /> Criticidade dos produtos
              </h3>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p><span className="font-medium text-red-600">Crítico</span> — cobertura menor ou igual ao prazo de entrega do fornecedor. Compre imediatamente.</p>
                <p><span className="font-medium text-orange-500">Alto</span> — cobertura próxima do ponto de reposição. Compre em breve.</p>
                <p><span className="font-medium text-yellow-600">Moderado</span> — atenção, mas ainda há margem de alguns dias.</p>
                <p><span className="font-medium text-blue-500">Atenção</span> — monitorar de perto.</p>
                <p><span className="font-medium text-green-600">Normal</span> — estoque saudável, sem necessidade imediata de compra.</p>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-500 shrink-0" /> Ranking de fornecedores
              </h3>
              <p className="text-sm text-muted-foreground">
                Mostra quais fornecedores têm mais produtos em situação crítica. Clique em <strong>Ver</strong> para abrir o detalhe do fornecedor e ver todos os produtos dele com sugestão de quantidade e data estimada de ruptura.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-green-600 shrink-0" /> Simular Compra
              </h3>
              <p className="text-sm text-muted-foreground">
                Antes de fechar um pedido, use o botão <strong>Simular Compra</strong> para ver o impacto de uma quantidade específica na cobertura do produto — sem precisar comprar de verdade para descobrir se vale a pena.
              </p>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Cobertura em dias
              </h3>
              <p className="text-sm text-muted-foreground">
                Indica por quantos dias o estoque atual aguenta, com base no consumo médio dos últimos 90 dias. Por exemplo, <strong>15d</strong> significa que em 15 dias o produto vai zerar se não houver reposição.
              </p>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
