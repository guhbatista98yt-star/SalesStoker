import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Printer, Eye, FileText, XCircle, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Auth helper ─────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string) {
  const res = await fetch(path, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Erro desconhecido");
  }
  return res.json();
}

// ── Types & defaults ─────────────────────────────────────────────────────────

interface Filters {
  status: string;
  empresa: string;
  busca: string;
  venc_de: string;
  venc_ate: string;
  forma_recebimento: string;
  somente_vencidos: string;
  cod_cliente: string;
  cod_vendedor: string;
  idtitulo: string;
  numnota: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "todos",
  empresa: "all",
  busca: "",
  venc_de: "",
  venc_ate: "",
  forma_recebimento: "",
  somente_vencidos: "0",
  cod_cliente: "",
  cod_vendedor: "",
  idtitulo: "",
  numnota: "",
};

const FORMAS_RECEBIMENTO = [
  "BOLETO", "DUPLICATA", "PIX", "CHEQUE", "TRANSFERÊNCIA",
  "DINHEIRO", "CARTÃO", "DOC", "TED", "DÉBITO AUTOMÁTICO",
];

function buildQS(filters: Filters, extra: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  const mapped: Record<string, string | number> = {
    ...extra,
    status: filters.status,
    empresa: filters.empresa,
    busca: filters.busca,
    venc_de: filters.venc_de,
    venc_ate: filters.venc_ate,
    forma_recebimento: filters.forma_recebimento,
    somente_vencidos: filters.somente_vencidos,
    idclifor: filters.cod_cliente,
    idvendedor: filters.cod_vendedor,
    idtitulo: filters.idtitulo,
    numnota: filters.numnota,
  };
  Object.entries(mapped).forEach(([k, v]) => {
    if (v != null && v !== "" && v !== "todos" && v !== "all" && v !== "0") qs.set(k, String(v));
  });
  return qs.toString() ? `?${qs.toString()}` : "";
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleString("pt-BR");
}

// ── Print Report (ERP style — same as contas-receber) ────────────────────────

function PrintReport({ filters, resumo, dupsData }: {
  filters: Filters;
  resumo: any;
  dupsData: any;
}) {
  const now = new Date().toLocaleString("pt-BR");
  const allDups: any[] = dupsData?.data ?? [];

  const byClient = new Map<number, { info: any; rows: any[] }>();
  for (const row of allDups) {
    if (!byClient.has(row.idclifor)) byClient.set(row.idclifor, { info: row, rows: [] });
    byClient.get(row.idclifor)!.rows.push(row);
  }
  const clientGroups = Array.from(byClient.values());

  let grandVencido = 0, grandAVencer = 0, grandJuros = 0, grandPago = 0, grandSaldo = 0;
  for (const row of allDups) {
    if (row.status === "VENCIDO") grandVencido += Number(row.valor_original) || 0;
    else grandAVencer += Number(row.valor_original) || 0;
    grandJuros += Number(row.valor_juros_pendente) || 0;
    grandPago  += Number(row.valor_pago) || 0;
    grandSaldo += Number(row.valor_aberto) || 0;
  }

  function fmtN(v: number | null | undefined) {
    const n = Number(v) || 0;
    if (n === 0) return ",00";
    return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  const MONO = "'Courier New', Courier, monospace";
  const base: React.CSSProperties = { fontFamily: MONO, fontSize: "7.5pt", color: "#000", lineHeight: "1.3" };

  const th = (align: React.CSSProperties["textAlign"]): React.CSSProperties => ({
    ...base, textAlign: align, padding: "2px 3px", fontWeight: "bold",
    borderTop: "1px solid #000", borderBottom: "1px solid #000", whiteSpace: "nowrap",
  });
  const td = (align: React.CSSProperties["textAlign"], extra: React.CSSProperties = {}): React.CSSProperties => ({
    ...base, textAlign: align, padding: "0px 3px", verticalAlign: "top", ...extra,
  });

  const W = ["13%","11%","5%","9%","9%","4%","8%","7%","9%","8%","8%","9%"] as const;

  const filterLines = [
    `Informe a(s) empresa(s) = ( ${filters.empresa === "all" ? "Todas" : filters.empresa} )`,
    `Informe o cliente ou branco para todos = ${filters.cod_cliente || ""}`,
    `Informe a(s) forma(s) de pagto ou branco p/ todas = ${filters.forma_recebimento || ""}`,
    filters.venc_de  ? `Data de vencimento inicial = '${fmtDate(filters.venc_de)}'` : null,
    filters.venc_ate ? `Data de vencimento final = '${fmtDate(filters.venc_ate)}'`   : null,
    filters.busca    ? `Busca = "${filters.busca}"` : null,
    filters.cod_vendedor ? `Vendedor = ${filters.cod_vendedor}` : null,
    filters.somente_vencidos === "1" ? "Somente vencidos = Sim" : null,
    filters.status !== "todos" ? `Status = ${filters.status}` : null,
  ].filter(Boolean) as string[];

  return (
    <div style={{ ...base, backgroundColor: "#fff", padding: "0" }}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm 8mm; }
          .ec-thead { display: table-header-group; }
          .ec-tfoot { display: table-footer-group; }
          .ec-tbody { page-break-inside: avoid; }
          .ec-screen { display: none !important; }
        }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1px", ...base }}>
        <div style={{ fontWeight: "bold" }}>Conectubos Atacarejo da Construção</div>
        <div>{now}</div>
      </div>
      <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "2px", ...base }}>
        150020-Extrato de Cobranças
      </div>
      <div style={{ textAlign: "center", fontSize: "7pt", lineHeight: "1.7", ...base }}>
        {filterLines.map((line, i) => <div key={i}>{line}</div>)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "2px", marginBottom: "3px", ...base, fontSize: "7pt" }}>
        <span>Financeiro</span>
        <span>{allDups.length} título(s) · {clientGroups.length} cliente(s)</span>
        <span>V. 05</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead className="ec-thead">
          <tr>
            <th style={{ ...th("left"),   width: W[0]  }}>Nota / Série</th>
            <th style={{ ...th("left"),   width: W[1]  }}>Titulo / Dígito</th>
            <th style={{ ...th("center"), width: W[2]  }}>Pgto.</th>
            <th style={{ ...th("right"),  width: W[3]  }}>Valor Vencido</th>
            <th style={{ ...th("right"),  width: W[4]  }}>Valor a Vencer</th>
            <th style={{ ...th("center"), width: W[5]  }}>Atraso</th>
            <th style={{ ...th("right"),  width: W[6]  }}>Juros</th>
            <th style={{ ...th("right"),  width: W[7]  }}>Valor Pago</th>
            <th style={{ ...th("right"),  width: W[8]  }}>Saldo a Pagar</th>
            <th style={{ ...th("center"), width: W[9]  }}>Emissão</th>
            <th style={{ ...th("center"), width: W[10] }}>Vencimento</th>
            <th style={{ ...th("left"),   width: W[11] }}>Nota</th>
          </tr>
        </thead>

        <tfoot className="ec-tfoot">
          <tr style={{ borderTop: "2px solid #000" }}>
            <td colSpan={3} style={{ ...td("left"), fontWeight: "bold", padding: "1px 3px" }}>TOTAL GERAL:</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandVencido)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandAVencer)}</td>
            <td></td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandJuros)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandPago)}</td>
            <td style={{ ...td("right"), fontWeight: "bold", padding: "1px 3px" }}>{fmtN(grandSaldo)}</td>
            <td colSpan={3} style={{ ...td("right"), fontSize: "6.5pt", color: "#555", padding: "1px 3px" }}>
              {allDups.length} títulos · {clientGroups.length} clientes · Emitido: {now}
            </td>
          </tr>
        </tfoot>

        {clientGroups.map(({ info, rows }) => {
          let clVencido = 0, clAVencer = 0, clJuros = 0, clPago = 0, clSaldo = 0;
          for (const r of rows) {
            if (r.status === "VENCIDO") clVencido += Number(r.valor_original) || 0;
            else clAVencer += Number(r.valor_original) || 0;
            clJuros += Number(r.valor_juros_pendente) || 0;
            clPago  += Number(r.valor_pago) || 0;
            clSaldo += Number(r.valor_aberto) || 0;
          }
          const locParts = [
            info.endereco_cobranca, info.bairro_cobranca,
            info.cidade_cobranca,   info.uf_cobranca,
          ].filter(Boolean);

          return (
            <tbody key={info.idclifor} className="ec-tbody">
              <tr style={{ borderTop: "1px solid #999" }}>
                <td colSpan={12} style={{ ...td("left"), fontWeight: "bold", paddingTop: "2px" }}>
                  Cliente: {info.idclifor} - {info.nomecliente}
                  {info.nomevendedor && (
                    <span style={{ fontWeight: "normal", marginLeft: "20px" }}>
                      Vendedor: {info.nomevendedor}
                    </span>
                  )}
                </td>
              </tr>
              {locParts.length > 0 && (
                <tr>
                  <td colSpan={12} style={{ ...td("left"), paddingBottom: "1px" }}>
                    Localização:{"\u00A0\u00A0"}{locParts.join("\u00A0\u00A0\u00A0")}
                  </td>
                </tr>
              )}
              {rows.map((row: any) => {
                const isVencido = row.status === "VENCIDO";
                const valVencido = isVencido ? (Number(row.valor_original) || 0) : 0;
                const valAVencer = !isVencido ? (Number(row.valor_original) || 0) : 0;
                const nota  = row.numnota ?? "PRE";
                const serie = row.serienota ? ` - ${row.serienota}` : "";
                const titulo = `${row.idtitulo} - ${String(row.digitotitulo ?? "01").padStart(2, "0")}`;
                return (
                  <tr key={row.id}>
                    <td style={td("left")}>{nota}{serie}</td>
                    <td style={td("left")}>{titulo}</td>
                    <td style={td("center")}>{row.forma_recebimento ?? ""}</td>
                    <td style={td("right")}>{fmtN(valVencido)}</td>
                    <td style={td("right")}>{fmtN(valAVencer)}</td>
                    <td style={td("center")}>{row.dias_atraso > 0 ? row.dias_atraso : ""}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_juros_pendente) || 0)}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_pago) || 0)}</td>
                    <td style={td("right")}>{fmtN(Number(row.valor_aberto) || 0)}</td>
                    <td style={td("center")}>{fmtDate(row.dtmovimento)}</td>
                    <td style={td("center")}>{fmtDate(row.dtvencimento)}</td>
                    <td style={td("left", { fontSize: "6.5pt" })}>{row.numnota ?? ""}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "1px solid #aaa", borderBottom: "1px solid #ccc" }}>
                <td colSpan={3} style={{ ...td("left"), fontWeight: "bold", paddingTop: "1px", paddingBottom: "2px" }}>
                  {"    "}Total do Cliente:
                </td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clVencido)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clAVencer)}</td>
                <td></td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clJuros)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clPago)}</td>
                <td style={{ ...td("right"), fontWeight: "bold" }}>{fmtN(clSaldo)}</td>
                <td colSpan={3}></td>
              </tr>
            </tbody>
          );
        })}
      </table>

      {allDups.length === 0 && (
        <div style={{ ...base, textAlign: "center", padding: "20px" }}>
          Nenhum título encontrado com os filtros informados.
        </div>
      )}
    </div>
  );
}

// ── DatePicker ────────────────────────────────────────────────────────────────

function DatePicker({ value, onChange, placeholder = "Qualquer data" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-8 text-sm mt-1 w-full justify-start font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
          {date ? format(date, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={d => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }}
          locale={ptBR}
          initialFocus
        />
        {value && (
          <div className="border-t p-2">
            <Button
              variant="ghost" size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => { onChange(""); setOpen(false); }}
            >
              Limpar data
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ExtratoCobracas() {
  const [draft, setDraft] = useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = useState<Filters | null>(null);

  // Only fetch when user clicks "Visualizar"
  const printQS  = applied ? buildQS(applied, { sort: "nomecliente", dir: "asc" }) : "";
  const resumoQS = applied ? buildQS(applied) : "";

  const printQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/duplicatas/all", printQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/duplicatas/all${printQS}`),
    enabled: !!applied,
    staleTime: 60_000,
  });

  const resumoQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/resumo", resumoQS],
    queryFn: () => apiFetch(`/api/financeiro/contas-receber/resumo${resumoQS}`),
    enabled: !!applied,
    staleTime: 60_000,
  });

  const formasQ = useQuery({
    queryKey: ["/api/financeiro/contas-receber/formas-recebimento"],
    queryFn: () => apiFetch("/api/financeiro/contas-receber/formas-recebimento"),
    staleTime: 300_000,
  });
  const formasList: string[] = formasQ.data?.formas ?? FORMAS_RECEBIMENTO;

  function setField(key: keyof Filters, value: string) {
    setDraft(f => ({ ...f, [key]: value }));
  }

  function handleVisualizar() {
    setApplied({ ...draft });
  }

  function handleImprimir() {
    window.print();
  }

  function handleLimpar() {
    setDraft(DEFAULT_FILTERS);
    setApplied(null);
  }

  const hasResults = !!applied && printQ.isSuccess;
  const isLoading  = printQ.isFetching || resumoQ.isFetching;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* Print-only area: only visible when printing */}
      <div className="hidden print:block">
        {hasResults && (
          <PrintReport filters={applied!} resumo={resumoQ.data} dupsData={printQ.data} />
        )}
      </div>

      {/* Screen content: hidden when printing */}
      <div className="ec-screen flex flex-col h-full overflow-hidden print:hidden">

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 shrink-0 border-b border-border">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Extrato de Cobranças</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Relatório 150020 — Informe os parâmetros e clique em Visualizar
            </p>
          </div>
          {hasResults && (
            <Button onClick={handleImprimir} size="sm">
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir
            </Button>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 pb-10">

          {/* ── Parameter form card ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Parâmetros do Relatório — 150020-Extrato de Cobranças
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                {/* Empresa */}
                <div>
                  <Label className="text-xs">Informe a(s) empresa(s)</Label>
                  <Select value={draft.empresa} onValueChange={v => setField("empresa", v)}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="1">Empresa 1</SelectItem>
                      <SelectItem value="2">Empresa 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cód. Cliente */}
                <div>
                  <Label className="text-xs">Informe o cliente (ou branco para todos)</Label>
                  <Input
                    type="number"
                    placeholder="Cód. do cliente"
                    className="h-8 text-sm mt-1"
                    value={draft.cod_cliente}
                    onChange={e => setField("cod_cliente", e.target.value)}
                  />
                </div>

                {/* Forma de pagamento */}
                <div>
                  <Label className="text-xs">Informe a(s) forma(s) de pagto (ou branco p/ todas)</Label>
                  <Select
                    value={draft.forma_recebimento || "__all__"}
                    onValueChange={v => setField("forma_recebimento", v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas</SelectItem>
                      {formasList.map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vencimento de */}
                <div>
                  <Label className="text-xs">Data de vencimento inicial</Label>
                  <DatePicker
                    value={draft.venc_de}
                    onChange={v => setField("venc_de", v)}
                    placeholder="Qualquer data"
                  />
                </div>

                {/* Vencimento até */}
                <div>
                  <Label className="text-xs">Data de vencimento final</Label>
                  <DatePicker
                    value={draft.venc_ate}
                    onChange={v => setField("venc_ate", v)}
                    placeholder="Qualquer data"
                  />
                </div>

                {/* Status */}
                <div>
                  <Label className="text-xs">Informe o status</Label>
                  <Select value={draft.status} onValueChange={v => setField("status", v)}>
                    <SelectTrigger className="h-8 text-sm mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="VENCIDO">Vencido</SelectItem>
                      <SelectItem value="VENCE_HOJE">Vence hoje</SelectItem>
                      <SelectItem value="A_VENCER">A vencer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Cód. Vendedor */}
                <div>
                  <Label className="text-xs">Cód. Vendedor (ou branco para todos)</Label>
                  <Input
                    type="number"
                    placeholder="Cód. do vendedor"
                    className="h-8 text-sm mt-1"
                    value={draft.cod_vendedor}
                    onChange={e => setField("cod_vendedor", e.target.value)}
                  />
                </div>

                {/* Nº Título */}
                <div>
                  <Label className="text-xs">Nº Título</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 2335879"
                    className="h-8 text-sm mt-1"
                    value={draft.idtitulo}
                    onChange={e => setField("idtitulo", e.target.value)}
                  />
                </div>

                {/* Nota Fiscal */}
                <div>
                  <Label className="text-xs">Nota Fiscal</Label>
                  <Input
                    placeholder="Nº da nota"
                    className="h-8 text-sm mt-1"
                    value={draft.numnota}
                    onChange={e => setField("numnota", e.target.value)}
                  />
                </div>

                {/* Somente vencidos */}
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm select-none">
                    <input
                      type="checkbox"
                      checked={draft.somente_vencidos === "1"}
                      onChange={e => setField("somente_vencidos", e.target.checked ? "1" : "0")}
                      className="rounded"
                    />
                    Exibir somente vencidos
                  </label>
                </div>

              </div>

              <Separator />

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleVisualizar} disabled={isLoading}>
                  {isLoading
                    ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    : <Eye className="h-3.5 w-3.5 mr-1.5" />}
                  Visualizar Relatório
                </Button>
                {hasResults && (
                  <Button variant="outline" onClick={handleImprimir}>
                    <Printer className="h-3.5 w-3.5 mr-1.5" />
                    Imprimir
                  </Button>
                )}
                <Button variant="ghost" onClick={handleLimpar} className="text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Limpar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Results summary ─────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Carregando dados...</span>
            </div>
          )}

          {hasResults && !isLoading && (
            <Card>
              <CardContent className="pt-5 pb-5">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block mb-0.5">Clientes</span>
                    <span className="font-bold text-lg">
                      {(() => {
                        const ids = new Set((printQ.data?.data ?? []).map((r: any) => r.idclifor));
                        return ids.size;
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block mb-0.5">Títulos</span>
                    <span className="font-bold text-lg">{printQ.data?.total ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block mb-0.5">Total Vencido</span>
                    <span className="font-bold text-lg text-red-600">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        (printQ.data?.data ?? []).filter((r: any) => r.status === "VENCIDO")
                          .reduce((s: number, r: any) => s + (Number(r.valor_original) || 0), 0)
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block mb-0.5">Saldo Total</span>
                    <span className="font-bold text-lg">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        (printQ.data?.data ?? []).reduce((s: number, r: any) => s + (Number(r.valor_aberto) || 0), 0)
                      )}
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <p className="text-xs text-muted-foreground">
                  Relatório pronto. Clique em <strong>Imprimir</strong> para abrir a caixa de impressão,
                  ou use <strong>Ctrl+P</strong>. O documento será impresso em A4 paisagem.
                </p>

                {/* Inline preview of the report (screen only, scaled down) */}
                <div className="mt-4 border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 px-3 py-1.5 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Pré-visualização</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleImprimir}>
                      <Printer className="h-3 w-3 mr-1" />Imprimir
                    </Button>
                  </div>
                  <div className="overflow-auto bg-white p-4" style={{ maxHeight: "70vh" }}>
                    <div style={{ transform: "scale(1)", transformOrigin: "top left", width: "100%" }}>
                      <PrintReport filters={applied!} resumo={resumoQ.data} dupsData={printQ.data} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {applied && printQ.isError && (
            <Card className="border-destructive/30">
              <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
                <XCircle className="h-8 w-8 text-destructive/60" />
                <p className="text-sm font-medium">Erro ao carregar dados</p>
                <p className="text-xs text-muted-foreground">{String(printQ.error)}</p>
                <Button variant="outline" size="sm" onClick={handleVisualizar} className="mt-2">
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
