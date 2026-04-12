import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft, Save, Loader2, AlertTriangle, CheckCircle2,
  Info, Plus, Trash2, Layers, ClipboardList, Zap,
  Users, GitBranch, Trophy, Shield, FlaskConical, BarChart3,
  Upload, X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RuleBuilder } from "./components/rule-builder";
import { RewardForm } from "./components/reward-form";
import { SimulatorPanel } from "./components/simulator-panel";
import { AuditLog } from "./components/audit-log";
import { GatilhosTab } from "./components/gatilhos-tab";
import { RelatorioTab } from "./components/relatorio-tab";
import { ResultadosTab } from "./components/resultados-tab";
import {
  type Campaign, type ConditionGroup, type Trigger, type CampaignException,
  type CampaignLimits, type TargetSegment, type Bases, type ProductBase, type CampaignMode,
  defaultConditionGroup, defaultTargets, defaultRewards, defaultLimits, defaultBases,
  TRIGGER_EVENT_LABEL, ACTION_LABEL, STATUS_COLOR, STATUS_LABEL,
  CAMPAIGN_MODE_LABEL, CAMPAIGN_MODE_DESC,
} from "./types";

const TABS = [
  { id: "geral",             label: "Dados Gerais",        Icon: Info },
  { id: "publico",           label: "Público-Alvo",        Icon: Users },
  { id: "bases",             label: "Bases de Cálculo",    Icon: Layers },
  { id: "condicoes",         label: "Condições",           Icon: GitBranch },
  { id: "premiacao",         label: "Premiação",           Icon: Trophy },
  { id: "limites",           label: "Limites",             Icon: Shield },
  { id: "gatilhos",          label: "Gatilhos (Campanha)", Icon: Zap },
  { id: "gatilhos_vendas",   label: "Metas Vendedor",      Icon: Users },
  { id: "relatorio",         label: "Acompanhamento",      Icon: BarChart3 },
  { id: "apuracao",          label: "Apuração",            Icon: Trophy },
  { id: "simulacao",         label: "Simulação",           Icon: FlaskConical },
  { id: "auditoria",         label: "Auditoria",           Icon: ClipboardList },
] as const;

type TabId = typeof TABS[number]["id"];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ─── Section heading ──────────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Target form ──────────────────────────────────────────────────────────────

function TargetForm({ value, onChange }: { value: TargetSegment; onChange: (v: TargetSegment) => void }) {
  function updateVendedores(patch: Partial<TargetSegment["vendedores"]>) {
    onChange({ ...value, vendedores: { ...value.vendedores, ...patch } });
  }
  function updateProdutos(patch: Partial<TargetSegment["produtos"]>) {
    onChange({ ...value, produtos: { ...value.produtos, ...patch } });
  }
  function updateClientes(patch: Partial<TargetSegment["clientes"]>) {
    onChange({ ...value, clientes: { ...value.clientes, ...patch } });
  }
  function updateEmpresas(patch: Partial<TargetSegment["empresas"]>) {
    onChange({ ...value, empresas: { ...value.empresas, ...patch } });
  }

  function ExcludeList({
    list,
    onChange,
    placeholder,
  }: { list: string[]; onChange: (v: string[]) => void; placeholder: string }) {
    const [input, setInput] = useState("");
    return (
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            className="h-7 text-xs flex-1"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && input.trim()) {
                onChange([...list, input.trim()]);
                setInput("");
              }
            }}
          />
          <Button
            size="sm" variant="outline" className="h-7 text-xs"
            onClick={() => { if (input.trim()) { onChange([...list, input.trim()]); setInput(""); } }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {list.map((item, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
              {item}
              <button onClick={() => onChange(list.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  function MultiIdList({
    list,
    onChange,
    placeholder,
  }: { list: string[]; onChange: (v: string[]) => void; placeholder: string }) {
    return <ExcludeList list={list} onChange={onChange} placeholder={placeholder} />;
  }

  return (
    <div className="space-y-6">
      {/* Vendedores */}
      <Section title="Vendedores" description="Quem será elegível a esta campanha?">
        <div className="space-y-2">
          <Select value={value.vendedores.mode} onValueChange={v => updateVendedores({ mode: v as any })}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os vendedores</SelectItem>
              <SelectItem value="specific" className="text-xs">Vendedores específicos (IDs)</SelectItem>
              <SelectItem value="group" className="text-xs">Por grupo de vendedores</SelectItem>
            </SelectContent>
          </Select>
          {value.vendedores.mode === "specific" && (
            <div className="space-y-1.5">
              <Label className="text-xs">IDs dos vendedores incluídos</Label>
              <MultiIdList list={value.vendedores.ids} onChange={ids => updateVendedores({ ids })} placeholder="ID do vendedor, Enter para adicionar" />
            </div>
          )}
          {value.vendedores.mode === "group" && (
            <div className="space-y-1.5">
              <Label className="text-xs">IDs dos grupos incluídos</Label>
              <MultiIdList list={value.vendedores.groupIds} onChange={groupIds => updateVendedores({ groupIds })} placeholder="ID do grupo, Enter para adicionar" />
            </div>
          )}
          {value.vendedores.mode !== "all" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Excluir especificamente (IDs)</Label>
              <ExcludeList list={value.vendedores.exclude} onChange={exclude => updateVendedores({ exclude })} placeholder="ID a excluir..." />
            </div>
          )}
        </div>
      </Section>

      <Separator />

      {/* Produtos */}
      <Section title="Produtos / Fornecedores" description="Quais produtos ou fornecedores são elegíveis?">
        <div className="space-y-2">
          <Select value={value.produtos.mode} onValueChange={v => updateProdutos({ mode: v as any })}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os produtos</SelectItem>
              <SelectItem value="supplier" className="text-xs">Por fornecedor</SelectItem>
              <SelectItem value="category" className="text-xs">Por categoria</SelectItem>
              <SelectItem value="specific" className="text-xs">Produtos específicos (IDs)</SelectItem>
            </SelectContent>
          </Select>
          {value.produtos.mode === "supplier" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Fornecedores</Label>
              <MultiIdList list={value.produtos.suppliers} onChange={suppliers => updateProdutos({ suppliers })} placeholder="Nome do fornecedor..." />
            </div>
          )}
          {value.produtos.mode === "category" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Categorias</Label>
              <MultiIdList list={value.produtos.categories} onChange={categories => updateProdutos({ categories })} placeholder="Nome da categoria..." />
            </div>
          )}
          {value.produtos.mode === "specific" && (
            <div className="space-y-1.5">
              <Label className="text-xs">IDs dos produtos</Label>
              <MultiIdList list={value.produtos.ids} onChange={ids => updateProdutos({ ids })} placeholder="ID do produto..." />
            </div>
          )}
          {value.produtos.mode !== "all" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Excluir produtos específicos (IDs)</Label>
              <ExcludeList list={value.produtos.exclude} onChange={exclude => updateProdutos({ exclude })} placeholder="ID do produto a excluir..." />
            </div>
          )}
        </div>
      </Section>

      <Separator />

      {/* Clientes */}
      <Section title="Clientes">
        <div className="space-y-2">
          <Select value={value.clientes.mode} onValueChange={v => updateClientes({ mode: v as any })}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos os clientes</SelectItem>
              <SelectItem value="specific" className="text-xs">Clientes específicos (IDs)</SelectItem>
            </SelectContent>
          </Select>
          {value.clientes.mode === "specific" && (
            <MultiIdList list={value.clientes.ids} onChange={ids => updateClientes({ ids })} placeholder="ID do cliente..." />
          )}
        </div>
      </Section>

      <Separator />

      {/* Empresas */}
      <Section title="Empresas / Filiais">
        <div className="space-y-2">
          <Select value={value.empresas.mode} onValueChange={v => updateEmpresas({ mode: v as any })}>
            <SelectTrigger className="h-8 text-xs w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todas as empresas</SelectItem>
              <SelectItem value="specific" className="text-xs">Empresas específicas (IDs)</SelectItem>
            </SelectContent>
          </Select>
          {value.empresas.mode === "specific" && (
            <MultiIdList list={value.empresas.ids} onChange={ids => updateEmpresas({ ids })} placeholder="ID da empresa..." />
          )}
        </div>
      </Section>
    </div>
  );
}

// ─── Limits form ──────────────────────────────────────────────────────────────

function LimitsForm({
  limits, onChangeLimits,
  exceptions, onChangeExceptions,
}: {
  limits: CampaignLimits; onChangeLimits: (v: CampaignLimits) => void;
  exceptions: CampaignException[]; onChangeExceptions: (v: CampaignException[]) => void;
}) {
  const LimitField = ({ label, field }: { label: string; field: keyof CampaignLimits }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="h-7 text-xs"
        placeholder="Sem limite"
        value={(limits[field] as number | null | undefined) ?? ""}
        onChange={e => onChangeLimits({ ...limits, [field]: e.target.value === "" ? null : Number(e.target.value) })}
      />
    </div>
  );

  function addException() {
    onChangeExceptions([...exceptions, { id: crypto.randomUUID(), type: "VENDEDOR", value: "" }]);
  }

  function updateException(idx: number, patch: Partial<CampaignException>) {
    const ex = [...exceptions];
    ex[idx] = { ...ex[idx], ...patch };
    onChangeExceptions(ex);
  }

  function removeException(idx: number) {
    onChangeExceptions(exceptions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-6">
      <Section title="Limites de Premiação" description="Estabelece tetos para evitar excessos.">
        <div className="grid grid-cols-2 gap-3">
          <LimitField label="Máximo por vendedor (R$)" field="maxPerVendedor" />
          <LimitField label="Máximo por cliente (R$)" field="maxPerCliente" />
          <LimitField label="Máximo por pedido (R$)" field="maxPerPedido" />
          <LimitField label="Máximo diário (R$)" field="maxDiario" />
          <LimitField label="Máximo semanal (R$)" field="maxSemanal" />
          <LimitField label="Máximo mensal (R$)" field="maxMensal" />
          <LimitField label="Máximo total da campanha (R$)" field="maxTotal" />
          <LimitField label="Mínimo para premiação (R$)" field="minCutoff" />
        </div>
      </Section>

      <Separator />

      <Section title="Exceções" description="Regras de exclusão específicas dentro da campanha.">
        <div className="space-y-2">
          {exceptions.map((ex, idx) => (
            <div key={ex.id} className="flex gap-2 items-start p-2 rounded-md border bg-muted/30">
              <Select value={ex.type} onValueChange={v => updateException(idx, { type: v as any })}>
                <SelectTrigger className="h-7 text-xs w-32 shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["VENDEDOR", "Vendedor"], ["PRODUTO", "Produto"], ["CLIENTE", "Cliente"], ["EMPRESA", "Empresa"], ["DIA", "Dia"]]
                    .map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="h-7 text-xs flex-1"
                placeholder={`ID ou valor a excluir`}
                value={ex.value}
                onChange={e => updateException(idx, { value: e.target.value })}
              />
              <Input
                className="h-7 text-xs flex-1"
                placeholder="Motivo (opcional)"
                value={ex.reason ?? ""}
                onChange={e => updateException(idx, { reason: e.target.value })}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 shrink-0" onClick={() => removeException(idx)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addException}>
            <Plus className="h-3 w-3" /> Adicionar Exceção
          </Button>
        </div>
      </Section>
    </div>
  );
}

// ─── Trigger form ─────────────────────────────────────────────────────────────

function TriggerForm({ value, onChange }: { value: Trigger[]; onChange: (v: Trigger[]) => void }) {
  function addTrigger() {
    onChange([...value, { id: crypto.randomUUID(), event: "ATINGIR_VALOR", threshold: undefined, actions: [] }]);
  }

  function updateTrigger(idx: number, patch: Partial<Trigger>) {
    const triggers = [...value];
    triggers[idx] = { ...triggers[idx], ...patch };
    onChange(triggers);
  }

  function removeTrigger(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function toggleAction(idx: number, type: string) {
    const trigger = value[idx];
    const exists = trigger.actions.some(a => a.type === type);
    const actions = exists
      ? trigger.actions.filter(a => a.type !== type)
      : [...trigger.actions, { type: type as any }];
    updateTrigger(idx, { actions });
  }

  const hasThreshold = (event: string) =>
    ["ATINGIR_QUANTIDADE", "ATINGIR_VALOR", "ATINGIR_META"].includes(event);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gatilhos disparam ações automaticamente quando condições específicas são atingidas.
      </p>

      {value.length === 0 && (
        <p className="text-xs italic text-muted-foreground">Nenhum gatilho definido.</p>
      )}

      <div className="space-y-3">
        {value.map((trigger, idx) => (
          <div key={trigger.id} className="p-3 rounded-lg border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2">
              <Select
                value={trigger.event}
                onValueChange={v => updateTrigger(idx, { event: v as any, threshold: undefined })}
              >
                <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TRIGGER_EVENT_LABEL) as [string, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasThreshold(trigger.event) && (
                <Input
                  type="number"
                  className="h-7 text-xs w-28"
                  placeholder="Limite"
                  value={trigger.threshold ?? ""}
                  onChange={e => updateTrigger(idx, { threshold: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 shrink-0" onClick={() => removeTrigger(idx)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>

            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1">Ações:</p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.entries(ACTION_LABEL) as [string, string][]).map(([key, label]) => {
                  const active = trigger.actions.some(a => a.type === key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleAction(idx, key)}
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-zinc-200 dark:border-zinc-700 hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addTrigger}>
        <Plus className="h-3 w-3" /> Adicionar Gatilho
      </Button>
    </div>
  );
}

// ─── Bases de Cálculo form ────────────────────────────────────────────────────

function ProductBaseSelector({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: ProductBase | null | undefined;
  onChange: (v: ProductBase | null) => void;
}) {
  const [input, setInput] = useState("");
  const cur: ProductBase = value || { mode: "all", suppliers: [], categories: [], ids: [] };

  function update(patch: Partial<ProductBase>) {
    onChange({ ...cur, ...patch });
  }

  function addItem(field: "suppliers" | "categories" | "ids") {
    if (!input.trim()) return;
    update({ [field]: [...(cur[field] || []), input.trim()] });
    setInput("");
  }

  function removeItem(field: "suppliers" | "categories" | "ids", i: number) {
    update({ [field]: (cur[field] || []).filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
      <div>
        <p className="text-xs font-medium">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(null)}
          className={cn(
            "text-[10px] px-2 py-0.5 rounded border transition-colors",
            value === null ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted",
          )}
        >
          Igual ao público-alvo
        </button>
        {(["all", "supplier", "category", "specific"] as const).map(m => (
          <button
            key={m}
            onClick={() => onChange({ ...cur, mode: m })}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded border transition-colors",
              value !== null && cur.mode === m ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted",
            )}
          >
            {m === "all" ? "Todos" : m === "supplier" ? "Fornecedor" : m === "category" ? "Categoria" : "Produtos específicos"}
          </button>
        ))}
      </div>

      {value !== null && cur.mode !== "all" && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input
              className="h-7 text-xs flex-1"
              placeholder={cur.mode === "supplier" ? "Nome do fornecedor..." : cur.mode === "category" ? "Categoria..." : "ID do produto..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const f = cur.mode === "supplier" ? "suppliers" : cur.mode === "category" ? "categories" : "ids";
                  addItem(f as any);
                }
              }}
            />
            <Button
              size="sm" variant="outline" className="h-7 text-xs"
              onClick={() => {
                const f = cur.mode === "supplier" ? "suppliers" : cur.mode === "category" ? "categories" : "ids";
                addItem(f as any);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {(cur.mode === "supplier" ? (cur.suppliers || []) : cur.mode === "category" ? (cur.categories || []) : (cur.ids || []))
              .map((item, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] gap-1 pr-1">
                  {item}
                  <button
                    onClick={() => {
                      const f = cur.mode === "supplier" ? "suppliers" : cur.mode === "category" ? "categories" : "ids";
                      removeItem(f as any, i);
                    }}
                    className="hover:text-red-500"
                  >×</button>
                </Badge>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BasesForm({ value, onChange, campaignMode }: {
  value: Bases;
  onChange: (v: Bases) => void;
  campaignMode: CampaignMode;
}) {
  const update = (patch: Partial<Bases>) => onChange({ ...value, ...patch });

  const isRanking = campaignMode === "ranking_volume" || campaignMode === "ranking_crescimento";

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
        <strong>O que são Bases de Cálculo?</strong> Cada base define <em>quais produtos/fornecedores</em> são considerados
        em cada etapa do cálculo. Você pode usar filtros diferentes para apuração, ranking e pagamento,
        permitindo campanhas como "rankear por crescimento geral mas pagar apenas sobre conexões".
        "Igual ao público-alvo" usa os mesmos produtos configurados no Público-Alvo.
      </div>

      <Section title="Base de Elegibilidade" description="Produtos considerados para verificar participação e mix mínimo.">
        <ProductBaseSelector
          label="Filtro de produtos"
          value={value.elegibilidade?.produtos}
          onChange={p => update({ elegibilidade: { ...value.elegibilidade, produtos: p } })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">Mix mínimo (mínimo de produtos distintos para participar)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="h-7 text-xs w-24"
              min={0}
              placeholder="0"
              value={value.elegibilidade?.mix_minimo ?? 0}
              onChange={e => update({ elegibilidade: { ...value.elegibilidade, mix_minimo: Number(e.target.value) } })}
            />
            <span className="text-[10px] text-muted-foreground">produto(s) distintos (0 = sem exigência de mix)</span>
          </div>
        </div>
      </Section>

      <Separator />

      <Section title="Base de Apuração" description="Produtos usados para medir a performance (base do ranking, quando aplicável).">
        <ProductBaseSelector
          label="Filtro de produtos para apuração"
          value={value.apuracao?.produtos}
          onChange={p => update({ apuracao: { ...value.apuracao, produtos: p } })}
        />
      </Section>

      <Separator />

      {isRanking && (
        <>
          <Section title="Critério de Ranking" description="Como os vendedores serão ordenados para o ranking.">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de ranking</Label>
                <Select
                  value={value.ranking?.tipo || "volume"}
                  onValueChange={v => update({ ranking: { ...value.ranking, tipo: v as any } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume" className="text-xs">Por volume (maior valor apurado)</SelectItem>
                    <SelectItem value="crescimento" className="text-xs">Por crescimento (% em relação ao período anterior)</SelectItem>
                    <SelectItem value="mix" className="text-xs">Por mix (mais produtos distintos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Critério de desempate</Label>
                <Select
                  value={value.ranking?.criterio_desempate || "valor"}
                  onValueChange={v => update({ ranking: { ...value.ranking, criterio_desempate: v as any } })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valor" className="text-xs">Maior valor apurado</SelectItem>
                    <SelectItem value="quantidade" className="text-xs">Maior quantidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(value.ranking?.tipo === "crescimento" || campaignMode === "ranking_crescimento") && (
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Período comparativo (base para cálculo do crescimento)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Início</Label>
                    <Input
                      type="date"
                      className="h-7 text-xs"
                      value={value.ranking?.periodo_comparativo?.starts_at || ""}
                      onChange={e => update({
                        ranking: {
                          ...value.ranking,
                          periodo_comparativo: {
                            starts_at: e.target.value,
                            ends_at: value.ranking?.periodo_comparativo?.ends_at || "",
                          },
                        },
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Fim</Label>
                    <Input
                      type="date"
                      className="h-7 text-xs"
                      value={value.ranking?.periodo_comparativo?.ends_at || ""}
                      onChange={e => update({
                        ranking: {
                          ...value.ranking,
                          periodo_comparativo: {
                            starts_at: value.ranking?.periodo_comparativo?.starts_at || "",
                            ends_at: e.target.value,
                          },
                        },
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Separator />
        </>
      )}

      <Section title="Base de Pagamento" description="Produtos usados para calcular o valor do prêmio (pode ser diferente da base de apuração).">
        <ProductBaseSelector
          label="Filtro de produtos para pagamento"
          description='Ex: "rankear por crescimento geral, pagar sobre conexões" → apuração = todos, pagamento = fornecedor Conexões'
          value={value.pagamento?.produtos}
          onChange={p => update({ pagamento: { ...value.pagamento, produtos: p } })}
        />
      </Section>
    </div>
  );
}

// ─── Validation badge ─────────────────────────────────────────────────────────

function ValidationBar({ errors, conflicts }: { errors: string[]; conflicts: any[] }) {
  if (!errors.length && !conflicts.length) return null;
  return (
    <div className="space-y-1.5">
      {errors.map((e, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-3 py-1.5 border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {e}
        </div>
      ))}
      {conflicts.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded px-3 py-1.5 border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Conflito com "{c.name}" ({c.reason})
        </div>
      ))}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

interface CampaignFormProps {
  campaignId?: string;
}

export default function CampaignForm({ campaignId }: CampaignFormProps) {
  const isEditing = Boolean(campaignId);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [form, setForm] = useState<Partial<Campaign>>({
    name: "", description: "", objective: "", campaign_type: "padrao", campaign_mode: "atingimento",
    priority: 50, is_cumulative: true, is_exclusive: false,
    targets: defaultTargets(), bases: defaultBases(), conditions: defaultConditionGroup(),
    triggers: [], rewards: defaultRewards(), limits: defaultLimits(), exceptions: [],
    valid_weekdays: [],
  });
  const [changeReason, setChangeReason] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [validation, setValidation] = useState<{ errors: string[]; conflicts: any[] } | null>(null);

  // Load existing campaign
  const { data: existing, isLoading: loadingExisting } = useQuery<Campaign>({
    queryKey: [`/api/campaigns/${campaignId}`],
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const body = { ...form, change_reason: reason };
      let res;
      if (isEditing) {
        res = await apiRequest("PUT", `/api/campaigns/${campaignId}`, body);
      } else {
        res = await apiRequest("POST", `/api/campaigns`, body);
      }
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao salvar");
      }
      return res.json() as Promise<Campaign>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({ title: isEditing ? "Campanha atualizada!" : "Campanha criada!", description: saved.name });
      navigate(`/campanhas/${saved.id}`);
    },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  // Validate before save
  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!campaignId) return { valid: true, errors: [], conflicts: [] };
      const res = await apiRequest("GET", `/api/campaigns/${campaignId}/validate`);
      return res.json();
    },
    onSuccess: (data) => {
      setValidation(data);
    },
  });

  function handleSave() {
    if (isEditing && existing?.status === "ativa") {
      setShowReasonDialog(true);
    } else {
      saveMutation.mutate(undefined);
    }
  }

  function confirmSave() {
    setShowReasonDialog(false);
    saveMutation.mutate(changeReason);
    setChangeReason("");
  }

  const update = (patch: Partial<Campaign>) => setForm(prev => ({ ...prev, ...patch }));

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isReadonly = existing?.status === "encerrada" || existing?.status === "cancelada";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navigate("/campanhas")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold">
                {isEditing ? (existing?.name || "Editar Campanha") : "Nova Campanha"}
              </h1>
              <HelpButton onClick={() => setHelpOpen(true)} />
            </div>
            <div className="flex items-center gap-2">
              {existing && (
                <Badge className={cn("text-[10px] py-0 h-4", STATUS_COLOR[existing.status])}>
                  {STATUS_LABEL[existing.status]}
                </Badge>
              )}
              {existing && <span className="text-[10px] font-mono text-muted-foreground">{existing.code}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {existing && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={() => validateMutation.mutate()}
              disabled={validateMutation.isPending}
            >
              {validateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Validar
            </Button>
          )}
          {!isReadonly && (
            <Button
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          )}
        </div>
      </div>

      {/* Validation bar */}
      {validation && (validation.errors.length > 0 || validation.conflicts.length > 0) && (
        <div className="px-4 sm:px-6 py-2 border-b bg-yellow-50/50 dark:bg-yellow-950/10 space-y-1 shrink-0">
          <ValidationBar errors={validation.errors} conflicts={validation.conflicts} />
        </div>
      )}

      {/* Readonly notice */}
      {isReadonly && (
        <div className="px-4 sm:px-6 py-2 bg-blue-50 dark:bg-blue-950/20 border-b text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2 shrink-0">
          <Info className="h-3.5 w-3.5" />
          Esta campanha está {STATUS_LABEL[existing!.status].toLowerCase()} e não pode ser editada.
        </div>
      )}

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabId)} className="h-full flex flex-col">
          <div className="shrink-0 px-4 sm:px-6 pt-2 border-b overflow-x-auto">
            <TabsList className="h-8 gap-0.5 bg-transparent p-0 w-max">
              {TABS.map(tab => {
                const showTab = tab.id !== "auditoria" || isEditing;
                const showSim = tab.id !== "simulacao" || isEditing;
                if (!showTab || !showSim) return null;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="h-8 text-xs gap-1 px-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-transparent"
                  >
                    <tab.Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="px-4 sm:px-6 py-5 max-w-4xl">

              {/* ── Dados Gerais ── */}
              <TabsContent value="geral" className="mt-0 space-y-5">
                <Section title="Identificação">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Nome da Campanha <span className="text-red-500">*</span></Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ex: Campanha Amanco Q2 2026"
                        value={form.name ?? ""}
                        onChange={e => update({ name: e.target.value })}
                        disabled={isReadonly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={form.campaign_type ?? "padrao"}
                        onValueChange={v => update({ campaign_type: v as any })}
                        disabled={isReadonly}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="padrao" className="text-xs">Padrão</SelectItem>
                          <SelectItem value="avancado" className="text-xs">Avançada (com construtor de regras)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Subtipo</Label>
                      <Select
                        value={form.sub_type ?? ""}
                        onValueChange={v => update({ sub_type: v as any })}
                        disabled={isReadonly}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {[
                            ["fornecedor", "Por Fornecedor"], ["produto", "Por Produto"], ["mix", "Por Mix"],
                            ["combo", "Por Combo"], ["faixa", "Por Faixa"], ["meta", "Por Meta"],
                            ["volume", "Por Volume"], ["faturamento", "Por Faturamento"],
                            ["periodo", "Por Período"], ["customizado", "Customizado"],
                          ].map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Descrição</Label>
                      <Textarea
                        className="text-xs resize-none h-16"
                        placeholder="Descreva o objetivo e contexto da campanha..."
                        value={form.description ?? ""}
                        onChange={e => update({ description: e.target.value })}
                        disabled={isReadonly}
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Objetivo comercial</Label>
                      <Input
                        className="h-8 text-xs"
                        placeholder="Ex: Aumentar volume de vendas de tubos em 15%"
                        value={form.objective ?? ""}
                        onChange={e => update({ objective: e.target.value })}
                        disabled={isReadonly}
                      />
                    </div>

                    {/* ── Branding ── */}
                    <div className="col-span-2 border-t pt-3 mt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identidade Visual</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nome do Fornecedor</Label>
                          <Input
                            className="h-8 text-xs"
                            placeholder="Ex: Amanco Wavin"
                            value={form.supplier_name ?? ""}
                            onChange={e => update({ supplier_name: e.target.value })}
                            disabled={isReadonly}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Cor da Campanha</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              className="h-8 w-12 rounded border border-input cursor-pointer p-0.5"
                              value={form.brand_color ?? "#0057A8"}
                              onChange={e => update({ brand_color: e.target.value })}
                              disabled={isReadonly}
                            />
                            <Input
                              className="h-8 text-xs flex-1"
                              placeholder="#0057A8"
                              value={form.brand_color ?? ""}
                              onChange={e => update({ brand_color: e.target.value })}
                              disabled={isReadonly}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-xs">Logo do Fornecedor</Label>
                          {form.logo_url ? (
                            <div className="flex items-center gap-3 p-2 border rounded-lg bg-muted/30">
                              <div className="h-12 w-12 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0">
                                <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain p-1" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground truncate">Logo carregada</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {Math.round(form.logo_url.length * 0.75 / 1024)} KB
                                </p>
                              </div>
                              {!isReadonly && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => update({ logo_url: undefined })}
                                >
                                  <XIcon className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <label className={cn(
                              "flex flex-col items-center justify-center gap-1.5 h-20 border-2 border-dashed rounded-lg cursor-pointer",
                              "text-muted-foreground hover:border-primary hover:text-primary transition-colors",
                              isReadonly && "opacity-50 cursor-not-allowed"
                            )}>
                              <Upload className="h-5 w-5" />
                              <span className="text-xs font-medium">Clique para enviar logo</span>
                              <span className="text-[10px]">PNG, JPG, SVG · máx. 500 KB</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                className="sr-only"
                                disabled={isReadonly}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  if (file.size > 512 * 1024) {
                                    alert("Imagem muito grande. Use até 500 KB.");
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onload = ev => update({ logo_url: ev.target?.result as string });
                                  reader.readAsDataURL(file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section title="Período de Vigência">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de início <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={form.starts_at ? form.starts_at.slice(0, 10) : ""}
                        onChange={e => update({ starts_at: e.target.value })}
                        disabled={isReadonly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de encerramento <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={form.ends_at ? form.ends_at.slice(0, 10) : ""}
                        onChange={e => update({ ends_at: e.target.value })}
                        disabled={isReadonly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Horário de início (opcional)</Label>
                      <Input
                        type="time"
                        className="h-8 text-xs"
                        value={form.time_start ?? ""}
                        onChange={e => update({ time_start: e.target.value || undefined })}
                        disabled={isReadonly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Horário de encerramento (opcional)</Label>
                      <Input
                        type="time"
                        className="h-8 text-xs"
                        value={form.time_end ?? ""}
                        onChange={e => update({ time_end: e.target.value || undefined })}
                        disabled={isReadonly}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Dias da semana válidos (vazio = todos)</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {WEEKDAY_LABELS.map((d, i) => {
                        const active = (form.valid_weekdays || []).includes(i);
                        return (
                          <button
                            key={i}
                            disabled={isReadonly}
                            onClick={() => {
                              const days = form.valid_weekdays || [];
                              update({ valid_weekdays: active ? days.filter(x => x !== i) : [...days, i] });
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded text-xs border transition-colors",
                              active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-zinc-200 dark:border-zinc-700 hover:bg-muted",
                            )}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section title="Modo de Apuração">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Como esta campanha funciona? <span className="text-red-500">*</span></Label>
                      <Select
                        value={form.campaign_mode ?? "atingimento"}
                        onValueChange={v => update({ campaign_mode: v as CampaignMode })}
                        disabled={isReadonly}
                      >
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.entries(CAMPAIGN_MODE_LABEL) as [CampaignMode, string][]).map(([k, label]) => (
                            <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.campaign_mode && (
                      <p className="text-[10px] text-muted-foreground bg-muted/40 px-3 py-2 rounded border">
                        {CAMPAIGN_MODE_DESC[form.campaign_mode]}
                      </p>
                    )}
                  </div>
                </Section>

                <Separator />

                <Section title="Configurações de Campanha">
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prioridade (1–100)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        className="h-8 text-xs w-24"
                        value={form.priority ?? 50}
                        onChange={e => update({ priority: Number(e.target.value) })}
                        disabled={isReadonly}
                      />
                      <p className="text-[10px] text-muted-foreground">Maior valor = maior prioridade em caso de conflito.</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={form.is_cumulative !== false}
                          onCheckedChange={v => update({ is_cumulative: v })}
                          disabled={isReadonly}
                        />
                        <div>
                          <Label className="text-xs">Acumulável</Label>
                          <p className="text-[10px] text-muted-foreground">Pode se somar com outras campanhas ativas.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={form.is_exclusive === true}
                          onCheckedChange={v => update({ is_exclusive: v })}
                          disabled={isReadonly}
                        />
                        <div>
                          <Label className="text-xs">Exclusiva</Label>
                          <p className="text-[10px] text-muted-foreground">Bloqueia outras campanhas no mesmo escopo.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                <Separator />

                <Section title="Observações Internas">
                  <Textarea
                    className="text-xs resize-none h-20"
                    placeholder="Anotações internas, contexto de criação, aprovações..."
                    value={form.internal_notes ?? ""}
                    onChange={e => update({ internal_notes: e.target.value })}
                    disabled={isReadonly}
                  />
                </Section>

                {/* Natural language preview */}
                {existing?.natural_language && (
                  <>
                    <Separator />
                    <div className="p-3 rounded-lg bg-muted/40 border">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Resumo em linguagem natural</p>
                      <p className="text-xs italic text-foreground/70">{existing.natural_language}</p>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ── Público-Alvo ── */}
              <TabsContent value="publico" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <TargetForm value={form.targets || defaultTargets()} onChange={targets => update({ targets })} />
                }
              </TabsContent>

              {/* ── Bases de Cálculo ── */}
              <TabsContent value="bases" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <BasesForm
                      value={form.bases || defaultBases()}
                      onChange={bases => update({ bases })}
                      campaignMode={(form.campaign_mode ?? "atingimento") as CampaignMode}
                    />
                }
              </TabsContent>

              {/* ── Condições ── */}
              <TabsContent value="condicoes" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <RuleBuilder
                      value={form.conditions || defaultConditionGroup()}
                      onChange={conditions => update({ conditions })}
                    />
                }
              </TabsContent>

              {/* ── Premiação ── */}
              <TabsContent value="premiacao" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <RewardForm value={form.rewards || defaultRewards()} onChange={rewards => update({ rewards })} />
                }
              </TabsContent>

              {/* ── Limites ── */}
              <TabsContent value="limites" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <LimitsForm
                      limits={form.limits || defaultLimits()}
                      onChangeLimits={limits => update({ limits })}
                      exceptions={(form.exceptions as CampaignException[]) || []}
                      onChangeExceptions={exceptions => update({ exceptions })}
                    />
                }
              </TabsContent>

              {/* ── Gatilhos ── */}
              <TabsContent value="gatilhos" className="mt-0">
                {isReadonly
                  ? <div className="text-xs text-muted-foreground">Campanha somente leitura.</div>
                  : <TriggerForm
                      value={(form.triggers as Trigger[]) || []}
                      onChange={triggers => update({ triggers })}
                    />
                }
              </TabsContent>

              {/* ── Metas por Vendedor (Gatilhos) ── */}
              {isEditing && (
                <TabsContent value="gatilhos_vendas" className="mt-0">
                  <GatilhosTab campaignId={campaignId!} />
                </TabsContent>
              )}

              {/* ── Relatório de Performance ── */}
              {isEditing && (
                <TabsContent value="relatorio" className="mt-0">
                  <RelatorioTab campaignId={campaignId!} />
                </TabsContent>
              )}

              {/* ── Apuração ── */}
              {isEditing && (
                <TabsContent value="apuracao" className="mt-0">
                  <ResultadosTab campaignId={campaignId!} />
                </TabsContent>
              )}

              {/* ── Simulação ── */}
              {isEditing && (
                <TabsContent value="simulacao" className="mt-0">
                  <SimulatorPanel campaignId={campaignId!} />
                </TabsContent>
              )}

              {/* ── Auditoria ── */}
              {isEditing && (
                <TabsContent value="auditoria" className="mt-0">
                  <AuditLog campaignId={campaignId!} />
                </TabsContent>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </div>

      {/* Change reason dialog (for editing active campaigns) */}
      <AlertDialog open={showReasonDialog} onOpenChange={setShowReasonDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar campanha ativa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta campanha está ativa. Uma nova versão será gerada automaticamente.
              Informe o motivo da alteração para fins de auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 px-1">
            <label className="text-xs font-medium">Motivo da alteração <span className="text-red-500">*</span></label>
            <Input
              className="text-xs h-8"
              placeholder="Ex: Ajuste de período aprovado pela gerência"
              value={changeReason}
              onChange={e => setChangeReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!changeReason.trim()} onClick={confirmSave}>
              Salvar e versionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.campanhasForm} />
    </div>
  );
}
