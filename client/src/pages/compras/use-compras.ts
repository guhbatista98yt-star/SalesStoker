import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth-context";
import {
  mockDashboard, mockAlertas, mockFornecedores, mockProdutos,
  mockSugestoes, mockFornecedorDetalhe, mockProdutoDetalhe,
} from "./mock-data";
import type {
  ComprasDashboard, Alerta, FornecedorRanking, ProdutoCritico,
  SugestaoFornecedor, FornecedorDetalhe, ProdutoDetalhe, Criticidade,
} from "./types";

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ── Backend urgência → frontend Criticidade ──────────────────────── */
function urgenciaToCriticidade(urgencia: string): Criticidade {
  switch (urgencia) {
    case "critica": return "critico";
    case "alta":    return "alto";
    case "media":   return "moderado";
    case "baixa":   return "atencao";
    default:        return "normal";
  }
}

/* ── Backend severidade → frontend Criticidade ────────────────────── */
function severidadeToCriticidade(severidade: string): Criticidade {
  switch (severidade) {
    case "critical": return "critico";
    case "warning":  return "alto";
    case "info":     return "atencao";
    default:         return "normal";
  }
}

/* ── Adapters ─────────────────────────────────────────────────────── */

function adaptDashboard(raw: Record<string, unknown>): ComprasDashboard {
  const dist = (raw.distribuicaoUrgencia as Record<string, number>) ?? {};
  const fornCriticos = Array.isArray(raw.fornecedoresCriticos) ? raw.fornecedoresCriticos : [];
  return {
    fornecedoresCriticos: fornCriticos.length,
    produtosCriticos: (raw.totalProdutosCriticos as number) ?? 0,
    itensZeradosEm3Dias: (raw.produtosRuptura as number) ?? 0,
    itensZeradosEm7Dias: ((raw.produtosRuptura as number) ?? 0) + (dist.alta ?? 0),
    abaixoEstoqueSeguranca: (raw.produtosAbaixoSeguranca as number) ?? 0,
    excessoEstoque: (raw.produtosExcesso as number) ?? 0,
    valorEstimadoCompra: (raw.valorEstimadoCompra as number) ?? 0,
    pedidosSugeridos: (raw.totalSugestoesPendentes as number) ?? 0,
    pedidosEmAberto: (raw.totalAlertasAtivos as number) ?? 0,
    fornecedoresMaiorRisco: fornCriticos.length,
  };
}

interface BackendFornecedorItem {
  fabricante: string;
  totalSkus: number;
  skusCriticos: number;
  skusAlerta: number;
  skusOk: number;
  criticidadeMedia: number;
  urgenciaMaxima: string;
  coberturaMediaDias: number;
  consumoMedioDiario: number;
}

function adaptFornecedorRanking(raw: BackendFornecedorItem): FornecedorRanking {
  return {
    id: encodeURIComponent(raw.fabricante),
    nome: raw.fabricante,
    itensCriticos: raw.skusCriticos,
    coberturaMedia: Math.round(raw.coberturaMediaDias),
    leadTime: 7,
    valorEstimado: raw.skusCriticos * 8000 + raw.skusAlerta * 3000,
    criticidade: urgenciaToCriticidade(raw.urgenciaMaxima),
    status: raw.urgenciaMaxima,
  };
}

interface BackendProdutoItem {
  produtoId: string;
  produtoNome: string;
  fabricante: string;
  urgencia: string;
  criticidade: number;
  coberturaDias: number;
  pontoReposicao: number;
  consumoMedioDiario: number;
  quantidadeSugerida: number;
  estoqueAtual: number;
}

function estimateRupturaDate(coberturaDias: number): string {
  if (coberturaDias <= 0) return "Hoje";
  const d = new Date();
  d.setDate(d.getDate() + coberturaDias);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function adaptProdutoCritico(raw: BackendProdutoItem): ProdutoCritico {
  return {
    id: raw.produtoId,
    codigo: raw.produtoId,
    descricao: raw.produtoNome,
    fornecedor: raw.fabricante,
    fornecedorId: encodeURIComponent(raw.fabricante),
    estoqueAtual: raw.estoqueAtual,
    coberturaDias: Math.round(raw.coberturaDias),
    dataEstimadaRuptura: estimateRupturaDate(raw.coberturaDias),
    sugestaoCompra: raw.quantidadeSugerida,
    criticidade: urgenciaToCriticidade(raw.urgencia),
  };
}

interface BackendAlerta {
  id: string;
  tipo: string;
  produto_id: string | null;
  fabricante: string | null;
  severidade: string;
  titulo: string;
  mensagem: string;
  status: string;
  dados: Record<string, unknown>;
}

function adaptAlerta(raw: BackendAlerta): Alerta {
  return {
    id: raw.id,
    tipo: raw.titulo ?? raw.tipo,
    produto: raw.dados?.produtoNome as string | undefined ?? raw.produto_id ?? undefined,
    produtoId: raw.produto_id ?? undefined,
    fornecedor: raw.fabricante ?? undefined,
    fornecedorId: raw.fabricante ? encodeURIComponent(raw.fabricante) : undefined,
    criticidade: severidadeToCriticidade(raw.severidade),
    tempoEstimadoRuptura: typeof raw.dados?.coberturaDias === "number" ? Math.round(raw.dados.coberturaDias as number) : undefined,
    acaoSugerida: raw.mensagem ?? "",
    visto: raw.status === "lido" || raw.status === "reconhecido",
    silenciado: raw.status === "silenciado",
  };
}

/* ── Generic API fetch with fallback ─────────────────────────────── */
async function fetchApi<T>(url: string): Promise<{ data: T; fromApi: boolean }> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    throw err;
  }
  const data = await res.json() as T;
  return { data, fromApi: true };
}

/* ── Hooks ────────────────────────────────────────────────────────── */

export function useComprasDashboard() {
  return useQuery<ComprasDashboard>({
    queryKey: ["compras", "dashboard"],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<Record<string, unknown>>("/api/compras/dashboard");
        return adaptDashboard(data);
      } catch {
        return mockDashboard;
      }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useComprasAlertas() {
  return useQuery<Alerta[]>({
    queryKey: ["compras", "alertas"],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<{ alerts: BackendAlerta[]; total: number; unreadCount: number }>("/api/compras/alertas");
        return data.alerts.map(adaptAlerta);
      } catch {
        return mockAlertas;
      }
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useComprasFornecedores() {
  return useQuery<FornecedorRanking[]>({
    queryKey: ["compras", "fornecedores"],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<BackendFornecedorItem[]>("/api/compras/fornecedores");
        return data.map(adaptFornecedorRanking);
      } catch {
        return mockFornecedores;
      }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useComprasProdutos() {
  return useQuery<ProdutoCritico[]>({
    queryKey: ["compras", "produtos"],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<BackendProdutoItem[]>("/api/compras/produtos");
        return data.map(adaptProdutoCritico);
      } catch {
        return mockProdutos;
      }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

interface BackendProductSuggestion {
  produtoId: string;
  produtoNome: string;
  fabricante: string;
  urgencia: string;
  criticidade: number;
  quantidadeSugerida: number;
  coberturaDias: number;
  consumoMedioDiario: number;
}

export function useComprasSugestoes() {
  return useQuery<SugestaoFornecedor[]>({
    queryKey: ["compras", "sugestoes"],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<BackendProductSuggestion[]>("/api/compras/sugestoes");
        const urgenciaOrder: Record<string, number> = { critica: 0, alta: 1, media: 2, baixa: 3, ok: 4 };
        const fabricantesMap = new Map<string, { itens: number; urgenciaMaxima: string; criticidade: number }>();
        for (const s of data) {
          if (!fabricantesMap.has(s.fabricante)) {
            fabricantesMap.set(s.fabricante, { itens: 0, urgenciaMaxima: "ok", criticidade: 0 });
          }
          const fab = fabricantesMap.get(s.fabricante)!;
          if (s.quantidadeSugerida > 0) fab.itens++;
          if ((urgenciaOrder[s.urgencia] ?? 5) < (urgenciaOrder[fab.urgenciaMaxima] ?? 5)) {
            fab.urgenciaMaxima = s.urgencia;
          }
          if (s.criticidade > fab.criticidade) fab.criticidade = s.criticidade;
        }
        return Array.from(fabricantesMap.entries())
          .filter(([, v]) => v.itens > 0)
          .sort(([, a], [, b]) => b.criticidade - a.criticidade)
          .slice(0, 8)
          .map(([fabricante, v]) => ({
            fornecedorId: encodeURIComponent(fabricante),
            fornecedor: fabricante,
            itens: v.itens,
            valorEstimado: v.itens * 5000,
            urgencia: urgenciaToCriticidade(v.urgenciaMaxima),
          }));
      } catch {
        return mockSugestoes;
      }
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useComprasFornecedorDetalhe(id: string) {
  return useQuery<FornecedorDetalhe>({
    queryKey: ["compras", "fornecedores", id],
    queryFn: async () => {
      try {
        const fabricante = decodeURIComponent(id);
        const { data } = await fetchApi<{
          fabricante: string;
          ranking: BackendFornecedorItem | null;
          produtos: BackendProdutoItem[];
          alertas: unknown[];
        }>(`/api/compras/fornecedores/${encodeURIComponent(fabricante)}`);

        const rank = data.ranking;
        const produtos = (data.produtos ?? []).map(adaptProdutoCritico);

        const coberturaMediaDias = rank?.coberturaMediaDias ?? 0;
        const coberturaPorProduto = (data.produtos ?? []).slice(0, 8).map(p => ({
          produto: p.produtoNome.substring(0, 20),
          dias: Math.round(p.coberturaDias),
        }));

        return {
          id,
          nome: data.fabricante,
          itensCriticos: rank?.skusCriticos ?? 0,
          coberturaMedia: Math.round(coberturaMediaDias),
          leadTime: 7,
          valorEstimado: (rank?.skusCriticos ?? 0) * 8000 + (rank?.skusAlerta ?? 0) * 3000,
          criticidade: urgenciaToCriticidade(rank?.urgenciaMaxima ?? "ok"),
          totalProdutos: data.produtos?.length ?? 0,
          produtos,
          coberturaPorProduto,
        };
      } catch {
        return mockFornecedorDetalhe[id] ?? {
          id, nome: "Fornecedor", itensCriticos: 0, coberturaMedia: 0, leadTime: 0,
          valorEstimado: 0, criticidade: "normal" as Criticidade, totalProdutos: 0, produtos: [], coberturaPorProduto: [],
        };
      }
    },
    staleTime: 60_000,
    enabled: !!id,
  });
}

export function useComprasProdutoDetalhe(id: string) {
  return useQuery<ProdutoDetalhe>({
    queryKey: ["compras", "produtos", id],
    queryFn: async () => {
      try {
        const { data } = await fetchApi<{
          sugestao: {
            produtoId: string;
            produtoNome: string;
            fabricante: string;
            urgencia: string;
            coberturaDias: number;
            estoqueAtual: number;
            estoqueSeguranca: number;
            consumoMedioDiario: number;
            quantidadeSugerida: number;
            leadTimeDias: number;
          } | null;
          historico: { periodo: string; total_vendido: number }[];
          alertas: unknown[];
        }>(`/api/compras/produtos/${encodeURIComponent(id)}`);

        const s = data.sugestao;
        if (!s) throw new Error("Produto não encontrado");

        const historico = (data.historico ?? []).map(h => ({
          data: h.periodo,
          consumo: Number(h.total_vendido) || 0,
        }));

        return {
          id: s.produtoId,
          codigo: s.produtoId,
          descricao: s.produtoNome,
          fornecedor: s.fabricante,
          fornecedorId: encodeURIComponent(s.fabricante),
          estoqueAtual: s.estoqueAtual,
          estoqueSeguranca: s.estoqueSeguranca,
          coberturaDias: Math.round(s.coberturaDias),
          dataEstimadaRuptura: estimateRupturaDate(s.coberturaDias),
          sugestaoCompra: s.quantidadeSugerida,
          criticidade: urgenciaToCriticidade(s.urgencia),
          consumoDiario: Math.round(s.consumoMedioDiario * 10) / 10,
          consumoSemanal: Math.round(s.consumoMedioDiario * 7 * 10) / 10,
          consumoMensal: Math.round(s.consumoMedioDiario * 30 * 10) / 10,
          historico,
        };
      } catch {
        return mockProdutoDetalhe[id] ?? {
          id, codigo: id, descricao: "Produto", fornecedor: "", fornecedorId: "",
          estoqueAtual: 0, estoqueSeguranca: 0, coberturaDias: 0, dataEstimadaRuptura: "-",
          sugestaoCompra: 0, criticidade: "normal" as Criticidade,
          consumoDiario: 0, consumoSemanal: 0, consumoMensal: 0, historico: [],
        };
      }
    },
    staleTime: 60_000,
    enabled: !!id,
  });
}
