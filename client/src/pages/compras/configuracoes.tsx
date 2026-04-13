import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useComprasCompany } from "./use-company";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertTriangle, Building2, Check, ChevronRight, CircleAlert, Clock,
  Download, EyeOff, Filter, HelpCircle, Info, Layers,
  Loader2, Package, PackageX, RefreshCw, Save, Search, Settings2, ShoppingCart,
  ToggleLeft, TrendingDown, Users, X, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════════════════ */
interface FornecedorConfig {
  id: string | null;
  fabricante_nome: string;
  codigo: string;
  razao_social: string;
  nome_fantasia: string;
  ativo: boolean;
  periodo_compra_dias: number;
  lead_time_dias: number;
  pedido_minimo_valor: number;
  observacoes: string;
  ultimo_movimento: string | null;
  total_skus: number;
  total_excecoes: number;
  configurado: boolean;
}

interface ProdutoConfig {
  id: string | null;
  produto_id: string;
  fornecedor_nome: string;
  descricao: string;
  total_vendido: number;
  estoque_minimo: number;
  estoque_maximo: number;
  lote_minimo: number;
  multiplo_embalagem: number;
  giro_periodo_dias: number;
  ativo: boolean;
  ultima_compra: string | null;
  ultima_qtd: number | null;
  configurado: boolean;
}

type QuickFilter = "todos" | "sem_config" | "com_excecao" | "inativos" | "sem_compra_recente";

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  try { return format(new Date(d), "dd/MM/yy", { locale: ptBR }); } catch { return null; }
}

function fmtNum(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined) return "–";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function daysAgo(d: string | null | undefined): number | null {
  if (!d) return null;
  try { return differenceInDays(new Date(), new Date(d)); } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════════════
   BADGE HELPERS
═══════════════════════════════════════════════════════════════════ */
function BadgeAtivo({ ativo }: { ativo: boolean }) {
  return ativo
    ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 font-medium text-[10px] h-5 px-1.5"><Check className="h-2.5 w-2.5 mr-0.5" />Ativo</Badge>
    : <Badge variant="outline" className="text-muted-foreground border-dashed font-medium text-[10px] h-5 px-1.5"><EyeOff className="h-2.5 w-2.5 mr-0.5" />Inativo</Badge>;
}

function BadgeConfig({ configurado }: { configurado: boolean }) {
  return configurado
    ? <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 font-medium text-[10px] h-5 px-1.5"><Settings2 className="h-2.5 w-2.5 mr-0.5" />Config</Badge>
    : <Badge variant="outline" className="text-muted-foreground text-[10px] h-5 px-1.5 border-dashed">Padrão</Badge>;
}

function BadgePadrao() {
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 font-medium text-[10px] h-5 px-1.5"><Layers className="h-2.5 w-2.5 mr-0.5" />Usa padrão</Badge>;
}

function BadgeExcecao() {
  return <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800 font-medium text-[10px] h-5 px-1.5"><Zap className="h-2.5 w-2.5 mr-0.5" />Exceção</Badge>;
}

/* ═══════════════════════════════════════════════════════════════════
   SUMMARY CARD
═══════════════════════════════════════════════════════════════════ */
interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}

function SummaryCard({ label, value, icon: Icon, color = "text-muted-foreground", active, onClick }: SummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all",
        "hover:shadow-sm hover:border-border/80",
        active
          ? "bg-primary/5 border-primary/30 shadow-sm"
          : "bg-card border-border/50",
        onClick ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className={cn("rounded-lg p-2 shrink-0", active ? "bg-primary/10" : "bg-muted/60")}>
        <Icon className={cn("h-4 w-4", active ? "text-primary" : color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FORNECEDOR DRAWER
═══════════════════════════════════════════════════════════════════ */
function FornecedorDrawer({
  fornecedor, onClose, onSave,
}: {
  fornecedor: FornecedorConfig | null;
  onClose: () => void;
  onSave: (data: Partial<FornecedorConfig>) => void;
}) {
  const [form, setForm] = useState<Partial<FornecedorConfig>>({});
  const merged = fornecedor ? { ...fornecedor, ...form } : null;

  function handleSave() {
    if (!merged) return;
    onSave(merged);
  }

  function handleOpen(open: boolean) {
    if (!open) { onClose(); setForm({}); }
  }

  if (!merged) return null;

  const diasSemMovimento = daysAgo(merged.ultimo_movimento);

  return (
    <Sheet open={!!fornecedor} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0" side="right">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base leading-tight">{merged.nome_fantasia || merged.fabricante_nome}</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">{merged.razao_social || "Razão social não informada"}</SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <BadgeAtivo ativo={merged.ativo} />
              {merged.configurado && <BadgeConfig configurado />}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "SKUs", value: merged.total_skus },
                { label: "Exceções", value: merged.total_excecoes },
                { label: diasSemMovimento !== null ? `${diasSemMovimento}d sem mov.` : "Sem mov.", value: fmtDate(merged.ultimo_movimento) ?? "–" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-center">
                  <p className="text-sm font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Identificação */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome Fantasia</Label>
                  <Input className="h-9 text-sm" value={merged.nome_fantasia}
                    onChange={e => setForm(p => ({ ...p, nome_fantasia: e.target.value }))}
                    placeholder={merged.fabricante_nome} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Razão Social</Label>
                    <Input className="h-9 text-sm" value={merged.razao_social}
                      onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))}
                      placeholder="Razão social..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Código ERP</Label>
                    <Input className="h-9 text-sm" value={merged.codigo}
                      onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                      placeholder="Código..." />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Parâmetros de compra */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parâmetros de Compra (padrão)</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Esses valores são herdados por todos os produtos deste fornecedor que não têm exceção configurada.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Cobertura alvo (dias)</Label>
                  <Input type="number" className="h-9 text-sm" min={1}
                    value={merged.periodo_compra_dias}
                    onChange={e => setForm(p => ({ ...p, periodo_compra_dias: Number(e.target.value) }))} />
                  <p className="text-[10px] text-muted-foreground">Estoque-alvo em dias de venda</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lead time (dias)</Label>
                  <Input type="number" className="h-9 text-sm" min={0}
                    value={merged.lead_time_dias}
                    onChange={e => setForm(p => ({ ...p, lead_time_dias: Number(e.target.value) }))} />
                  <p className="text-[10px] text-muted-foreground">Prazo de entrega esperado</p>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Pedido mínimo (R$)</Label>
                  <Input type="number" className="h-9 text-sm" min={0}
                    value={merged.pedido_minimo_valor}
                    onChange={e => setForm(p => ({ ...p, pedido_minimo_valor: Number(e.target.value) }))} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Input className="h-9 text-sm" value={merged.observacoes}
                onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                placeholder="Anotações internas sobre este fornecedor..." />
            </div>

            <Separator />

            {/* Ativo toggle */}
            <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Incluir nas sugestões de compra</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Se inativo, nenhum produto deste fornecedor gerará sugestões.
                </p>
              </div>
              <Switch
                checked={merged.ativo}
                onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
              />
            </div>

          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={() => { onClose(); setForm({}); }}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUTO DRAWER
═══════════════════════════════════════════════════════════════════ */
function ProdutoDrawer({
  produto, fornecedor, onClose, onSave,
}: {
  produto: ProdutoConfig | null;
  fornecedor: FornecedorConfig | undefined;
  onClose: () => void;
  onSave: (data: Partial<ProdutoConfig>) => void;
}) {
  const [form, setForm] = useState<Partial<ProdutoConfig>>({});
  const [usaPadrao, setUsaPadrao] = useState(!produto?.configurado);
  const merged = produto ? { ...produto, ...form } : null;

  function handleOpen(open: boolean) {
    if (!open) { onClose(); setForm({}); }
  }

  function handleUsaPadraoChange(val: boolean) {
    setUsaPadrao(val);
    if (val) {
      setForm(p => ({ ...p, ativo: true }));
    }
  }

  function handleSave() {
    if (!merged) return;
    onSave({ ...merged, configurado: !usaPadrao });
  }

  if (!merged) return null;

  const diasSemCompra = daysAgo(merged.ultima_compra);
  const compraAntiga = diasSemCompra !== null && diasSemCompra > 90;

  return (
    <Sheet open={!!produto} onOpenChange={handleOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col gap-0 p-0" side="right">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-base leading-tight font-mono">{merged.produto_id}</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">{merged.fornecedor_nome}</SheetDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {merged.configurado && !usaPadrao ? <BadgeExcecao /> : <BadgePadrao />}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* Stats: última compra */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Última compra</p>
                <p className={cn("text-sm font-semibold mt-0.5", compraAntiga && "text-amber-600 dark:text-amber-400")}>
                  {fmtDate(merged.ultima_compra) ?? "–"}
                </p>
                {compraAntiga && <p className="text-[10px] text-amber-600 dark:text-amber-400">{diasSemCompra}d atrás</p>}
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Últ. qtd comprada</p>
                <p className="text-sm font-semibold mt-0.5">{fmtNum(merged.ultima_qtd)}</p>
                <p className="text-[10px] text-muted-foreground">Total vendido: {fmtNum(merged.total_vendido)}</p>
              </div>
            </div>

            {/* Herança */}
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Usar padrão do fornecedor</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {usaPadrao ? "Herdando regras de" : "Sobrescrevendo regras de"} {merged.fornecedor_nome}
                  </p>
                </div>
                <Switch checked={usaPadrao} onCheckedChange={handleUsaPadraoChange} />
              </div>

              {usaPadrao && fornecedor && (
                <div className="px-4 pb-3 pt-1 bg-muted/10 space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide pt-1.5">Regras herdadas do fornecedor</p>
                  {[
                    { label: "Cobertura alvo", value: `${fornecedor.periodo_compra_dias} dias` },
                    { label: "Lead time", value: `${fornecedor.lead_time_dias} dias` },
                    { label: "Pedido mínimo", value: fornecedor.pedido_minimo_valor > 0 ? `R$ ${fmtNum(fornecedor.pedido_minimo_valor, 2)}` : "–" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exceção do produto (somente quando usa_padrao = false) */}
            {!usaPadrao && (
              <>
                <div className="space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Exceção do produto
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Esses valores substituem o padrão do fornecedor somente para este produto.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estoque mínimo (seg.)</Label>
                      <Input type="number" className="h-9 text-sm" min={0}
                        value={merged.estoque_minimo}
                        onChange={e => setForm(p => ({ ...p, estoque_minimo: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estoque máximo</Label>
                      <Input type="number" className="h-9 text-sm" min={0}
                        value={merged.estoque_maximo}
                        onChange={e => setForm(p => ({ ...p, estoque_maximo: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Lote mínimo</Label>
                      <Input type="number" className="h-9 text-sm" min={1}
                        value={merged.lote_minimo}
                        onChange={e => setForm(p => ({ ...p, lote_minimo: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Múltiplo embalagem</Label>
                      <Input type="number" className="h-9 text-sm" min={1}
                        value={merged.multiplo_embalagem}
                        onChange={e => setForm(p => ({ ...p, multiplo_embalagem: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Período de giro (dias)</Label>
                      <Input type="number" className="h-9 text-sm" min={7}
                        value={merged.giro_periodo_dias}
                        onChange={e => setForm(p => ({ ...p, giro_periodo_dias: Number(e.target.value) }))} />
                      <p className="text-[10px] text-muted-foreground">
                        Janela de análise de vendas para cálculo da média diária
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Incluir nas sugestões</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Se desativado, este produto não gera sugestões.
                    </p>
                  </div>
                  <Switch
                    checked={merged.ativo}
                    onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
                  />
                </div>
              </>
            )}

          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1" onClick={() => { onClose(); setForm({}); }}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            <Save className="h-3.5 w-3.5 mr-1.5" />
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ABA FORNECEDORES
═══════════════════════════════════════════════════════════════════ */
function AbaFornecedores({
  fornecedores, onEdit, isLoading,
}: {
  fornecedores: FornecedorConfig[];
  onEdit: (f: FornecedorConfig) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showInativos, setShowInativos] = useState(false);

  const filtered = useMemo(() => {
    return fornecedores.filter(f => {
      const matchSearch = !search ||
        f.fabricante_nome.toLowerCase().includes(search.toLowerCase()) ||
        f.nome_fantasia.toLowerCase().includes(search.toLowerCase()) ||
        f.razao_social.toLowerCase().includes(search.toLowerCase()) ||
        f.codigo.toLowerCase().includes(search.toLowerCase());
      return matchSearch && (showInativos || f.ativo);
    });
  }, [fornecedores, search, showInativos]);

  if (isLoading) return <LoadingState label="Carregando fornecedores..." />;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Buscar fornecedor..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Button
          variant={showInativos ? "secondary" : "outline"}
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowInativos(v => !v)}
        >
          <EyeOff className="h-3.5 w-3.5" />
          {showInativos ? "Ocultando ativos" : "Ver inativos"}
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        {/* Header */}
        <div className="grid items-center bg-muted/40 border-b border-border/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: "1fr 72px 64px 64px 72px 80px 28px" }}>
          <span>Fornecedor</span>
          <span className="text-center hidden sm:block">Lead</span>
          <span className="text-center hidden sm:block">Cobertura</span>
          <span className="text-center hidden md:block">SKUs</span>
          <span className="text-center hidden md:block">Exceções</span>
          <span className="text-center hidden sm:block">Últ. mov.</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {fornecedores.length === 0
              ? "Nenhum fornecedor encontrado. Execute o sync do ERP e clique em \"Sincronizar ERP\" no cabeçalho."
              : "Nenhum fornecedor corresponde aos filtros."}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(f => (
              <button
                key={f.fabricante_nome}
                onClick={() => onEdit(f)}
                className={cn(
                  "w-full grid items-center px-4 py-3 text-left transition-colors",
                  "hover:bg-muted/40 group",
                  !f.ativo && "opacity-60",
                )}
                style={{ gridTemplateColumns: "1fr 72px 64px 64px 72px 80px 28px" }}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{f.nome_fantasia || f.fabricante_nome}</span>
                    <BadgeAtivo ativo={f.ativo} />
                    {f.configurado && <BadgeConfig configurado />}
                  </div>
                  {f.razao_social && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{f.razao_social}</p>
                  )}
                </div>
                <span className="text-xs text-center hidden sm:block text-muted-foreground">{f.lead_time_dias}d</span>
                <span className="text-xs text-center hidden sm:block text-muted-foreground">{f.periodo_compra_dias}d</span>
                <span className="text-xs text-center hidden md:block font-mono">{f.total_skus}</span>
                <span className={cn("text-xs text-center hidden md:block font-mono", f.total_excecoes > 0 && "text-violet-600 dark:text-violet-400 font-semibold")}>
                  {f.total_excecoes || "–"}
                </span>
                <span className={cn("text-xs text-center hidden sm:block", !f.ultimo_movimento && "text-muted-foreground")}>
                  {fmtDate(f.ultimo_movimento) ?? "–"}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ABA PRODUTOS / EXCEÇÕES
═══════════════════════════════════════════════════════════════════ */
function AbaProdutos({
  produtos, fornecedores, onEdit, isLoading,
}: {
  produtos: ProdutoConfig[];
  fornecedores: FornecedorConfig[];
  onEdit: (p: ProdutoConfig) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState("");
  const [filterForn, setFilterForn] = useState("__todos");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");

  const filtered = useMemo(() => {
    return produtos.filter(p => {
      const matchSearch = !search ||
        p.produto_id.toLowerCase().includes(search.toLowerCase()) ||
        p.fornecedor_nome.toLowerCase().includes(search.toLowerCase());
      const matchForn = filterForn === "__todos" || p.fornecedor_nome === filterForn;
      const diasSemCompra = daysAgo(p.ultima_compra);
      const matchQuick =
        quickFilter === "todos" ? true :
        quickFilter === "sem_config" ? !p.configurado :
        quickFilter === "com_excecao" ? p.configurado :
        quickFilter === "inativos" ? !p.ativo :
        quickFilter === "sem_compra_recente" ? (diasSemCompra === null || diasSemCompra > 90) :
        true;
      return matchSearch && matchForn && matchQuick;
    });
  }, [produtos, search, filterForn, quickFilter]);

  if (isLoading) return <LoadingState label="Carregando produtos..." />;

  const qfOptions: { key: QuickFilter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: produtos.length },
    { key: "com_excecao", label: "Com exceção", count: produtos.filter(p => p.configurado).length },
    { key: "sem_config", label: "Usando padrão", count: produtos.filter(p => !p.configurado).length },
    { key: "inativos", label: "Inativos", count: produtos.filter(p => !p.ativo).length },
    { key: "sem_compra_recente", label: "Sem compra +90d", count: produtos.filter(p => { const d = daysAgo(p.ultima_compra); return d === null || d > 90; }).length },
  ];

  return (
    <div className="space-y-3">
      {/* Quick filters */}
      <div className="flex gap-1.5 flex-wrap">
        {qfOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setQuickFilter(opt.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
              quickFilter === opt.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {opt.label}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
              quickFilter === opt.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              {opt.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-9 h-8 text-sm" placeholder="Buscar produto..." value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterForn} onValueChange={setFilterForn}>
          <SelectTrigger className="h-8 text-sm w-44">
            <SelectValue placeholder="Todos os fornecedores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__todos">Todos os fornecedores</SelectItem>
            {fornecedores.map(f => (
              <SelectItem key={f.fabricante_nome} value={f.fabricante_nome}>
                {f.nome_fantasia || f.fabricante_nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <div className="grid items-center bg-muted/40 border-b border-border/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ gridTemplateColumns: "1fr 100px 88px 80px 28px" }}>
          <span>Produto</span>
          <span className="hidden sm:block">Fornecedor</span>
          <span className="text-center hidden sm:block">Última compra</span>
          <span className="text-center">Config</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {produtos.length === 0
              ? "Nenhum produto encontrado. Sincronize o ERP primeiro."
              : "Nenhum produto corresponde aos filtros."}
          </div>
        ) : (
          <ScrollArea className="h-[480px]">
            <div className="divide-y divide-border/40">
              {filtered.map(p => {
                const diasSemCompra = daysAgo(p.ultima_compra);
                const compraAntiga = diasSemCompra !== null && diasSemCompra > 90;
                return (
                  <button
                    key={`${p.produto_id}::${p.fornecedor_nome}`}
                    onClick={() => onEdit(p)}
                    className={cn(
                      "w-full grid items-center px-4 py-3 text-left transition-colors",
                      "hover:bg-muted/40 group",
                      !p.ativo && "opacity-60",
                    )}
                    style={{ gridTemplateColumns: "1fr 100px 88px 80px 28px" }}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium truncate">{p.produto_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.configurado ? <BadgeExcecao /> : <BadgePadrao />}
                        {!p.ativo && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground border-dashed">Inativo</Badge>}
                        {compraAntiga && (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] h-4 px-1">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />{diasSemCompra}d
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">{p.fornecedor_nome}</span>
                    <span className={cn("text-xs text-center hidden sm:block", compraAntiga && "text-amber-600 dark:text-amber-400 font-medium")}>
                      {fmtDate(p.ultima_compra) ?? "–"}
                    </span>
                    <div className="flex justify-center">
                      {p.configurado
                        ? <div className="w-4 h-4 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center"><Zap className="h-2.5 w-2.5 text-violet-600 dark:text-violet-400" /></div>
                        : <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center"><Layers className="h-2.5 w-2.5 text-muted-foreground" /></div>
                      }
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ABA VISÃO OPERACIONAL
═══════════════════════════════════════════════════════════════════ */
function AbaVisaoOperacional({
  fornecedores, produtos,
}: {
  fornecedores: FornecedorConfig[];
  produtos: ProdutoConfig[];
}) {
  const ativos = fornecedores.filter(f => f.ativo);
  const inativos = fornecedores.filter(f => !f.ativo);
  const fornSemConfig = fornecedores.filter(f => !f.configurado);
  const prodComExcecao = produtos.filter(p => p.configurado);
  const prodUsandoPadrao = produtos.filter(p => !p.configurado);
  const prodSemCompra = produtos.filter(p => { const d = daysAgo(p.ultima_compra); return d === null || d > 90; });
  const prodBloqueados = produtos.filter(p => {
    const forn = fornecedores.find(f => f.fabricante_nome === p.fornecedor_nome);
    return forn && !forn.ativo;
  });

  return (
    <div className="space-y-6">
      {/* Fornecedores */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Building2 className="h-4 w-4" /> Fornecedores
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OperationalCard
            title="Ativos para compra"
            items={ativos}
            renderItem={f => (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-medium">{f.nome_fantasia || f.fabricante_nome}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{f.total_skus} SKUs</span>
                  {f.total_excecoes > 0 && <span className="text-violet-600 dark:text-violet-400">{f.total_excecoes} exc.</span>}
                </div>
              </div>
            )}
            emptyMsg="Nenhum fornecedor ativo"
            color="emerald"
            icon={Check}
          />
          <OperationalCard
            title="Inativos (sugestões bloqueadas)"
            items={inativos}
            renderItem={f => (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-medium text-muted-foreground">{f.nome_fantasia || f.fabricante_nome}</span>
                <span className="text-xs text-muted-foreground">{f.total_skus} SKUs bloqueados</span>
              </div>
            )}
            emptyMsg="Nenhum fornecedor inativo"
            color="muted"
            icon={EyeOff}
          />
        </div>
      </div>

      {/* Configuração */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Cobertura de Configuração
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ConfigCoverageCard
            label="Fornecedores sem config"
            count={fornSemConfig.length}
            total={fornecedores.length}
            description="Usando valores padrão do sistema"
            color="amber"
          />
          <ConfigCoverageCard
            label="Produtos com exceção"
            count={prodComExcecao.length}
            total={produtos.length}
            description="Têm configuração própria"
            color="violet"
          />
          <ConfigCoverageCard
            label="Produtos usando padrão"
            count={prodUsandoPadrao.length}
            total={produtos.length}
            description="Herdam regras do fornecedor"
            color="blue"
          />
        </div>
      </div>

      {/* Alertas operacionais */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Situações que requerem atenção
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <OperationalCard
            title={`Produtos sem compra recente (+90d) — ${prodSemCompra.length}`}
            items={prodSemCompra.slice(0, 8)}
            renderItem={p => (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-mono">{p.produto_id}</span>
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {p.ultima_compra ? `${daysAgo(p.ultima_compra)}d atrás` : "Nunca"}
                </div>
              </div>
            )}
            emptyMsg="Todos os produtos foram comprados recentemente"
            color="amber"
            icon={Clock}
          />
          <OperationalCard
            title={`Produtos com fornecedor inativo — ${prodBloqueados.length}`}
            items={prodBloqueados.slice(0, 8)}
            renderItem={p => (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-sm font-mono">{p.produto_id}</span>
                <span className="text-xs text-muted-foreground">{p.fornecedor_nome}</span>
              </div>
            )}
            emptyMsg="Nenhum produto bloqueado por fornecedor inativo"
            color="muted"
            icon={PackageX}
          />
        </div>
      </div>
    </div>
  );
}

function OperationalCard<T>({
  title, items, renderItem, emptyMsg, color, icon: Icon,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyMsg: string;
  color: "emerald" | "amber" | "muted" | "violet";
  icon: React.ElementType;
}) {
  const colors = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20",
    muted: "text-muted-foreground bg-muted/50",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20",
  };

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className={cn("flex items-center gap-2 px-4 py-2.5 border-b border-border/40", colors[color])}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="px-4 divide-y divide-border/30">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">{emptyMsg}</p>
        ) : (
          items.map((item, i) => <div key={i}>{renderItem(item)}</div>)
        )}
      </div>
    </div>
  );
}

function ConfigCoverageCard({
  label, count, total, description, color,
}: {
  label: string; count: number; total: number; description: string; color: "amber" | "violet" | "blue";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const colors = {
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    blue: "bg-blue-500",
  };
  return (
    <div className="rounded-xl border border-border/60 px-4 py-3 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{count}<span className="text-sm font-normal text-muted-foreground ml-1">/ {total}</span></p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colors[color])} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOADING STATE
═══════════════════════════════════════════════════════════════════ */
function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════ */
export default function ComprasConfiguracoes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { companyId, setCompanyId, companies, companiesLoading } = useComprasCompany();

  const cParam = companyId && companyId !== "all" ? `?company_id=${encodeURIComponent(companyId)}` : "";

  const [fornecedorEditando, setFornecedorEditando] = useState<FornecedorConfig | null>(null);
  const [produtoEditando, setProdutoEditando] = useState<ProdutoConfig | null>(null);
  const [activeTab, setActiveTab] = useState("fornecedores");
  const [cardFilter, setCardFilter] = useState<string | null>(null);

  /* ── Queries ──────────────────────────────────────────────────── */
  const { data: fornecedores = [], isLoading: loadingF } = useQuery<FornecedorConfig[]>({
    queryKey: ["/api/compras/fornecedores-config", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/compras/fornecedores-config${cParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar fornecedores");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: produtos = [], isLoading: loadingP } = useQuery<ProdutoConfig[]>({
    queryKey: ["/api/compras/produtos-config", companyId],
    queryFn: async () => {
      const res = await fetch(`/api/compras/produtos-config${cParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      return res.json();
    },
    staleTime: 60_000,
  });

  /* ── Sync ERP mutation ─────────────────────────────────────────── */
  const syncFornecedores = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/compras/fornecedores-config/sync${cParam}`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || "Erro ao sincronizar fornecedores");
      }
      return res.json() as Promise<{ created: number; updated: number; total: number }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/compras/fornecedores-config"] });
      qc.invalidateQueries({ queryKey: ["/api/compras/produtos-config"] });
      toast({
        title: "Fornecedores sincronizados",
        description: `${data.created} criados, ${data.updated} atualizados (total: ${data.total})`,
      });
    },
    onError: (e: Error) =>
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" }),
  });

  /* ── Mutations ─────────────────────────────────────────────────── */
  const saveFornecedor = useMutation({
    mutationFn: async (data: FornecedorConfig) => {
      const res = await fetch(
        `/api/compras/fornecedores-config/${encodeURIComponent(data.fabricante_nome)}${cParam}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) }
      );
      if (!res.ok) throw new Error("Erro ao salvar fornecedor");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compras/fornecedores-config"] });
      toast({ title: "Fornecedor salvo com sucesso" });
      setFornecedorEditando(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const saveProduto = useMutation({
    mutationFn: async (data: ProdutoConfig) => {
      const res = await fetch(
        `/api/compras/produtos-config/${encodeURIComponent(data.produto_id)}/${encodeURIComponent(data.fornecedor_nome)}${cParam}`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) }
      );
      if (!res.ok) throw new Error("Erro ao salvar produto");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compras/produtos-config"] });
      toast({ title: "Produto salvo com sucesso" });
      setProdutoEditando(null);
    },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  /* ── Computed stats ────────────────────────────────────────────── */
  const stats = useMemo(() => ({
    fornAtivos: fornecedores.filter(f => f.ativo).length,
    fornInativos: fornecedores.filter(f => !f.ativo).length,
    prodComExcecao: produtos.filter(p => p.configurado).length,
    prodUsandoPadrao: produtos.filter(p => !p.configurado).length,
    prodSemCompra: produtos.filter(p => { const d = daysAgo(p.ultima_compra); return d === null || d > 90; }).length,
    prodBloqueados: produtos.filter(p => {
      const forn = fornecedores.find(f => f.fabricante_nome === p.fornecedor_nome);
      return forn && !forn.ativo;
    }).length,
  }), [fornecedores, produtos]);

  const fornecedorDoEditando = produtoEditando
    ? fornecedores.find(f => f.fabricante_nome === produtoEditando.fornecedor_nome)
    : undefined;

  return (
    <div className="h-full overflow-auto">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-5 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight leading-tight">
                  Configuração de Compras
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed hidden sm:block">
                  Defina regras padrão por fornecedor e exceções por produto para melhorar as sugestões do Copiloto.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={setCompanyId}
                loading={companiesLoading}
                compact
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    onClick={() => syncFornecedores.mutate()}
                    disabled={syncFornecedores.isPending}
                  >
                    {syncFornecedores.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Sincronizar ERP</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs" side="left">
                  Importa todos os fabricantes do cache do ERP para a configuração.
                  Execute após rodar o sync do ERP (erp_sync.py campanhas).
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs" side="left">
                  Fornecedor define a regra padrão. Produto só foge do padrão quando necessário.
                  Fornecedores inativos não geram sugestões de compra.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        {/* ── Summary Cards ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <SummaryCard label="Fornec. ativos" value={stats.fornAtivos} icon={Building2} color="text-emerald-600"
            active={cardFilter === "forn_ativos"}
            onClick={() => { setCardFilter(c => c === "forn_ativos" ? null : "forn_ativos"); setActiveTab("fornecedores"); }} />
          <SummaryCard label="Fornec. inativos" value={stats.fornInativos} icon={EyeOff} color="text-muted-foreground"
            active={cardFilter === "forn_inativos"}
            onClick={() => { setCardFilter(c => c === "forn_inativos" ? null : "forn_inativos"); setActiveTab("fornecedores"); }} />
          <SummaryCard label="Com exceção" value={stats.prodComExcecao} icon={Zap} color="text-violet-600"
            active={cardFilter === "com_excecao"}
            onClick={() => { setCardFilter(c => c === "com_excecao" ? null : "com_excecao"); setActiveTab("produtos"); }} />
          <SummaryCard label="Usando padrão" value={stats.prodUsandoPadrao} icon={Layers} color="text-blue-500"
            active={cardFilter === "usando_padrao"}
            onClick={() => { setCardFilter(c => c === "usando_padrao" ? null : "usando_padrao"); setActiveTab("produtos"); }} />
          <SummaryCard label="Sem compra +90d" value={stats.prodSemCompra} icon={Clock} color="text-amber-500"
            active={cardFilter === "sem_compra"}
            onClick={() => { setCardFilter(c => c === "sem_compra" ? null : "sem_compra"); setActiveTab("produtos"); }} />
          <SummaryCard label="Bloqueados" value={stats.prodBloqueados} icon={PackageX} color="text-red-500"
            active={cardFilter === "bloqueados"}
            onClick={() => { setCardFilter(c => c === "bloqueados" ? null : "bloqueados"); setActiveTab("operacional"); }} />
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-9">
            <TabsTrigger value="fornecedores" className="text-xs gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Fornecedores
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-semibold">
                {fornecedores.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="produtos" className="text-xs gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Produtos
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-semibold">
                {produtos.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="operacional" className="text-xs gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Visão Operacional
            </TabsTrigger>
          </TabsList>

          <TabsContent value="fornecedores" className="mt-4">
            <AbaFornecedores
              fornecedores={fornecedores}
              onEdit={setFornecedorEditando}
              isLoading={loadingF}
            />
          </TabsContent>

          <TabsContent value="produtos" className="mt-4">
            <AbaProdutos
              produtos={produtos}
              fornecedores={fornecedores}
              onEdit={setProdutoEditando}
              isLoading={loadingP}
            />
          </TabsContent>

          <TabsContent value="operacional" className="mt-4">
            {loadingF || loadingP
              ? <LoadingState label="Carregando visão operacional..." />
              : <AbaVisaoOperacional fornecedores={fornecedores} produtos={produtos} />
            }
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Drawers ───────────────────────────────────────────────── */}
      <FornecedorDrawer
        fornecedor={fornecedorEditando}
        onClose={() => setFornecedorEditando(null)}
        onSave={data => saveFornecedor.mutate(data as FornecedorConfig)}
      />
      <ProdutoDrawer
        produto={produtoEditando}
        fornecedor={fornecedorDoEditando}
        onClose={() => setProdutoEditando(null)}
        onSave={data => saveProduto.mutate(data as ProdutoConfig)}
      />
    </div>
  );
}
