import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2, ChevronDown, ChevronRight, Loader2,
  Package, Save, Search, Settings2, ShoppingCart, ToggleLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Types ───────────────────────────────────────────────────────── */
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

/* ── Helpers ─────────────────────────────────────────────────────── */
function fmtDate(d: string | null) {
  if (!d) return "–";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
}

function fmtNum(n: number | null, digits = 0) {
  if (n === null || n === undefined) return "–";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/* ── Fornecedor Edit Row ─────────────────────────────────────────── */
function FornecedorRow({ f, onSave }: { f: FornecedorConfig; onSave: (data: Partial<FornecedorConfig>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<FornecedorConfig>>({});
  const merged = { ...f, ...form };

  function handleSave() {
    onSave({ ...merged });
    setOpen(false);
    setForm({});
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className={cn("cursor-pointer hover:bg-muted/40 transition-colors", !merged.ativo && "opacity-60")}>
          <TableCell className="w-8 py-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </TableCell>
          <TableCell className="py-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{merged.nome_fantasia || merged.fabricante_nome}</span>
              {merged.configurado && <Badge variant="secondary" className="text-[10px] h-4 px-1">Config</Badge>}
              {!merged.ativo && <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground">Inativo</Badge>}
            </div>
            {merged.razao_social && <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{merged.razao_social}</p>}
          </TableCell>
          <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell">{merged.codigo || "–"}</TableCell>
          <TableCell className="py-2 text-xs text-center hidden lg:table-cell">{merged.total_skus}</TableCell>
          <TableCell className="py-2 text-xs text-center hidden lg:table-cell">{merged.periodo_compra_dias}d</TableCell>
          <TableCell className="py-2 text-xs text-center hidden lg:table-cell">{merged.lead_time_dias}d</TableCell>
          <TableCell className="py-2 text-xs text-center hidden md:table-cell">{fmtDate(merged.ultimo_movimento)}</TableCell>
          <TableCell className="py-2 text-center">
            <div className={cn("inline-block w-2.5 h-2.5 rounded-full", merged.ativo ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={8} className="p-0">
            <div className="border-t border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Fantasia</Label>
                  <Input
                    className="h-8 text-sm"
                    value={merged.nome_fantasia}
                    onChange={e => setForm(p => ({ ...p, nome_fantasia: e.target.value }))}
                    placeholder={merged.fabricante_nome}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Razão Social</Label>
                  <Input
                    className="h-8 text-sm"
                    value={merged.razao_social}
                    onChange={e => setForm(p => ({ ...p, razao_social: e.target.value }))}
                    placeholder="Razão social..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Código ERP</Label>
                  <Input
                    className="h-8 text-sm"
                    value={merged.codigo}
                    onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))}
                    placeholder="Cód. fornecedor..."
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período de Compra (dias)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={1}
                    value={merged.periodo_compra_dias}
                    onChange={e => setForm(p => ({ ...p, periodo_compra_dias: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lead Time (dias)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={0}
                    value={merged.lead_time_dias}
                    onChange={e => setForm(p => ({ ...p, lead_time_dias: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pedido Mínimo (R$)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={0}
                    value={merged.pedido_minimo_valor}
                    onChange={e => setForm(p => ({ ...p, pedido_minimo_valor: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Input
                    className="h-8 text-sm"
                    value={merged.observacoes}
                    onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))}
                    placeholder="Observações..."
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <Label className="text-xs">Ativo (realizar compras)</Label>
                  <div className="flex items-center gap-2 h-8">
                    <Switch
                      checked={merged.ativo}
                      onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
                    />
                    <span className="text-sm text-muted-foreground">{merged.ativo ? "Sim" : "Não"}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-3 gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setForm({}); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Salvar
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Produto Edit Row ────────────────────────────────────────────── */
function ProdutoRow({ p, onSave }: { p: ProdutoConfig; onSave: (data: Partial<ProdutoConfig>) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ProdutoConfig>>({});
  const merged = { ...p, ...form };

  function handleSave() {
    onSave({ ...merged });
    setOpen(false);
    setForm({});
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className={cn("cursor-pointer hover:bg-muted/40 transition-colors", !merged.ativo && "opacity-60")}>
          <TableCell className="w-8 py-2">
            {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </TableCell>
          <TableCell className="py-2">
            <span className="font-mono text-xs font-medium">{merged.produto_id}</span>
            {merged.configurado && <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">Config</Badge>}
          </TableCell>
          <TableCell className="py-2 text-xs text-muted-foreground hidden md:table-cell truncate max-w-[120px]">{merged.fornecedor_nome}</TableCell>
          <TableCell className="py-2 text-xs text-right hidden lg:table-cell">{fmtNum(merged.total_vendido)}</TableCell>
          <TableCell className="py-2 text-xs text-center hidden lg:table-cell">{fmtDate(merged.ultima_compra)}</TableCell>
          <TableCell className="py-2 text-xs text-right hidden lg:table-cell">{fmtNum(merged.ultima_qtd)}</TableCell>
          <TableCell className="py-2 text-xs text-center hidden md:table-cell">{merged.estoque_minimo > 0 ? fmtNum(merged.estoque_minimo) : "–"}</TableCell>
          <TableCell className="py-2 text-xs text-center hidden md:table-cell">{merged.estoque_maximo > 0 ? fmtNum(merged.estoque_maximo) : "–"}</TableCell>
          <TableCell className="py-2 text-center">
            <div className={cn("inline-block w-2.5 h-2.5 rounded-full", merged.ativo ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={9} className="p-0">
            <div className="border-t border-border bg-muted/30 p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Estoque Mínimo (Seg.)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={0}
                    value={merged.estoque_minimo}
                    onChange={e => setForm(p => ({ ...p, estoque_minimo: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estoque Máximo</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={0}
                    value={merged.estoque_maximo}
                    onChange={e => setForm(p => ({ ...p, estoque_maximo: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lote Mínimo</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={1}
                    value={merged.lote_minimo}
                    onChange={e => setForm(p => ({ ...p, lote_minimo: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Múltiplo Embalagem</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={1}
                    value={merged.multiplo_embalagem}
                    onChange={e => setForm(p => ({ ...p, multiplo_embalagem: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Período Giro (dias)</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    min={7}
                    value={merged.giro_periodo_dias}
                    onChange={e => setForm(p => ({ ...p, giro_periodo_dias: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={merged.ativo}
                    onCheckedChange={v => setForm(p => ({ ...p, ativo: v }))}
                  />
                  <span className="text-sm text-muted-foreground">Incluir nas sugestões</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setForm({}); }}>Cancelar</Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function ComprasConfiguracoes() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchF, setSearchF] = useState("");
  const [searchP, setSearchP] = useState("");
  const [filterFornecedor, setFilterFornecedor] = useState<string>("__todos");
  const [showInativos, setShowInativos] = useState(false);

  /* ── Data ─────────────────────────────────────────────────────── */
  const { data: fornecedores = [], isLoading: loadingF } = useQuery<FornecedorConfig[]>({
    queryKey: ["/api/compras/fornecedores-config"],
    queryFn: async () => {
      const res = await fetch("/api/compras/fornecedores-config", { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar fornecedores");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: produtos = [], isLoading: loadingP } = useQuery<ProdutoConfig[]>({
    queryKey: ["/api/compras/produtos-config", filterFornecedor],
    queryFn: async () => {
      const url = filterFornecedor !== "__todos"
        ? `/api/compras/produtos-config?fabricante=${encodeURIComponent(filterFornecedor)}`
        : "/api/compras/produtos-config";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao carregar produtos");
      return res.json();
    },
    staleTime: 60_000,
    enabled: true,
  });

  /* ── Mutations ────────────────────────────────────────────────── */
  const saveFornecedor = useMutation({
    mutationFn: async (data: FornecedorConfig) => {
      const res = await fetch(
        `/api/compras/fornecedores-config/${encodeURIComponent(data.fabricante_nome)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Erro ao salvar fornecedor");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compras/fornecedores-config"] });
      toast({ title: "Fornecedor salvo com sucesso" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const saveProduto = useMutation({
    mutationFn: async (data: ProdutoConfig) => {
      const res = await fetch(
        `/api/compras/produtos-config/${encodeURIComponent(data.produto_id)}/${encodeURIComponent(data.fornecedor_nome)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) throw new Error("Erro ao salvar produto");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/compras/produtos-config"] });
      toast({ title: "Produto salvo com sucesso" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  /* ── Filtered lists ───────────────────────────────────────────── */
  const filteredF = fornecedores.filter(f => {
    const matchSearch = searchF === "" ||
      f.fabricante_nome.toLowerCase().includes(searchF.toLowerCase()) ||
      f.nome_fantasia.toLowerCase().includes(searchF.toLowerCase()) ||
      f.razao_social.toLowerCase().includes(searchF.toLowerCase()) ||
      f.codigo.toLowerCase().includes(searchF.toLowerCase());
    const matchAtivo = showInativos || f.ativo;
    return matchSearch && matchAtivo;
  });

  const filteredP = produtos.filter(p => {
    return searchP === "" ||
      p.produto_id.toLowerCase().includes(searchP.toLowerCase()) ||
      p.fornecedor_nome.toLowerCase().includes(searchP.toLowerCase());
  });

  const totalConfig = fornecedores.filter(f => f.configurado).length;
  const totalInativos = fornecedores.filter(f => !f.ativo).length;
  const totalProdutoConfig = produtos.filter(p => p.configurado).length;

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-3">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-bold tracking-tight">Configuração de Compras</h1>
            <p className="text-xs text-muted-foreground">Fornecedores, produtos, períodos e parâmetros de estoque</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <Tabs defaultValue="fornecedores">
          <TabsList className="mb-4">
            <TabsTrigger value="fornecedores" className="gap-2">
              <Building2 className="h-4 w-4" />
              Fornecedores
              {totalInativos > 0 && (
                <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">{totalInativos} inativos</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="produtos" className="gap-2">
              <Package className="h-4 w-4" />
              Produtos
            </TabsTrigger>
          </TabsList>

          {/* ── Fornecedores Tab ──────────────────────────────────── */}
          <TabsContent value="fornecedores">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Fornecedores</CardTitle>
                    <CardDescription>
                      Configure razão social, código, período de compra, lead time e ativo por fornecedor.
                      Fornecedores inativos são excluídos das sugestões.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4" />
                    <span>{totalConfig} configurados · {fornecedores.length} total</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-9 h-8 text-sm"
                      placeholder="Buscar fornecedor..."
                      value={searchF}
                      onChange={e => setSearchF(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="show-inativos" checked={showInativos} onCheckedChange={setShowInativos} />
                    <Label htmlFor="show-inativos" className="text-sm cursor-pointer">Mostrar inativos</Label>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingF ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Carregando fornecedores...</span>
                  </div>
                ) : filteredF.length === 0 ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">
                    {fornecedores.length === 0
                      ? "Nenhum fornecedor encontrado. Sincronize os dados do ERP primeiro."
                      : "Nenhum fornecedor encontrado para o filtro aplicado."}
                  </p>
                ) : (
                  <ScrollArea className="h-[560px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead className="text-xs">Fornecedor</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Código</TableHead>
                          <TableHead className="text-xs text-center hidden lg:table-cell">SKUs</TableHead>
                          <TableHead className="text-xs text-center hidden lg:table-cell">Período</TableHead>
                          <TableHead className="text-xs text-center hidden lg:table-cell">Lead Time</TableHead>
                          <TableHead className="text-xs text-center hidden md:table-cell">Últ. Mov.</TableHead>
                          <TableHead className="text-xs text-center">Ativo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredF.map(f => (
                          <FornecedorRow
                            key={f.fabricante_nome}
                            f={f}
                            onSave={data => saveFornecedor.mutate(data as FornecedorConfig)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Produtos Tab ──────────────────────────────────────── */}
          <TabsContent value="produtos">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <CardTitle className="text-base">Produtos</CardTitle>
                    <CardDescription>
                      Configure estoque mínimo/máximo, lote mínimo, múltiplo de embalagem e período de giro por produto.
                      Veja data e quantidade da última compra.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Settings2 className="h-4 w-4" />
                    <span>{totalProdutoConfig} configurados · {produtos.length} total</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap pt-1">
                  <div className="relative flex-1 min-w-[200px] max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-9 h-8 text-sm"
                      placeholder="Buscar produto..."
                      value={searchP}
                      onChange={e => setSearchP(e.target.value)}
                    />
                  </div>
                  <Select value={filterFornecedor} onValueChange={setFilterFornecedor}>
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
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingP ? (
                  <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Carregando produtos...</span>
                  </div>
                ) : filteredP.length === 0 ? (
                  <p className="text-center py-12 text-sm text-muted-foreground">
                    {produtos.length === 0
                      ? "Nenhum produto encontrado. Sincronize os dados do ERP primeiro."
                      : "Nenhum produto encontrado para o filtro aplicado."}
                  </p>
                ) : (
                  <ScrollArea className="h-[560px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead className="text-xs">Produto ID</TableHead>
                          <TableHead className="text-xs hidden md:table-cell">Fornecedor</TableHead>
                          <TableHead className="text-xs text-right hidden lg:table-cell">Qtd Vendida</TableHead>
                          <TableHead className="text-xs text-center hidden lg:table-cell">Últ. Compra</TableHead>
                          <TableHead className="text-xs text-right hidden lg:table-cell">Últ. Qtd</TableHead>
                          <TableHead className="text-xs text-center hidden md:table-cell">Est. Mín</TableHead>
                          <TableHead className="text-xs text-center hidden md:table-cell">Est. Máx</TableHead>
                          <TableHead className="text-xs text-center">Ativo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredP.map(p => (
                          <ProdutoRow
                            key={`${p.produto_id}::${p.fornecedor_nome}`}
                            p={p}
                            onSave={data => saveProduto.mutate(data as ProdutoConfig)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
