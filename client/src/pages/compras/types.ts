export type Criticidade = "critico" | "alto" | "moderado" | "atencao" | "normal";

export interface ComprasDashboard {
  fornecedoresCriticos: number;
  produtosCriticos: number;
  itensZeradosEm3Dias: number;
  itensZeradosEm7Dias: number;
  abaixoEstoqueSeguranca: number;
  excessoEstoque: number;
  valorEstimadoCompra: number;
  pedidosSugeridos: number;
  pedidosEmAberto: number;
  fornecedoresMaiorRisco: number;
}

export interface Alerta {
  id: string;
  tipo: string;
  produto?: string;
  produtoId?: string;
  fornecedor?: string;
  fornecedorId?: string;
  criticidade: Criticidade;
  tempoEstimadoRuptura?: number;
  acaoSugerida: string;
  visto?: boolean;
  silenciado?: boolean;
}

export interface FornecedorRanking {
  id: string;
  nome: string;
  itensCriticos: number;
  coberturaMedia: number;
  leadTime: number;
  valorEstimado: number;
  criticidade: Criticidade;
  status: string;
}

export interface ProdutoCritico {
  id: string;
  codigo: string;
  descricao: string;
  fornecedor: string;
  fornecedorId: string;
  estoqueAtual: number;
  coberturaDias: number;
  dataEstimadaRuptura: string;
  sugestaoCompra: number;
  criticidade: Criticidade;
}

export interface SugestaoFornecedor {
  fornecedorId: string;
  fornecedor: string;
  itens: number;
  valorEstimado: number;
  urgencia: Criticidade;
}

export interface FornecedorDetalhe {
  id: string;
  nome: string;
  itensCriticos: number;
  coberturaMedia: number;
  leadTime: number;
  valorEstimado: number;
  criticidade: Criticidade;
  totalProdutos: number;
  produtos: ProdutoCritico[];
  coberturaPorProduto: { produto: string; dias: number }[];
}

export interface ProdutoDetalhe {
  id: string;
  codigo: string;
  descricao: string;
  fornecedor: string;
  fornecedorId: string;
  estoqueAtual: number;
  /** Quantidade reservada para pedidos de venda existentes (ESTOQUE_ANALITICO_TMP) */
  qtdReserva: number;
  /** Estoque disponível = estoqueAtual − qtdReserva (fonte ERP quando sincronizado) */
  saldoDisponivel: number;
  estoqueSeguranca: number;
  /** Pedidos de compra abertos não atendidos (PEDIDO_COMPRA_PROD) */
  pedidosAbertos: number;
  coberturaDias: number;
  dataEstimadaRuptura: string;
  sugestaoCompra: number;
  criticidade: Criticidade;
  consumoDiario: number;
  consumoSemanal: number;
  consumoMensal: number;
  /** True quando estoqueAtual/pedidosAbertos vêm do ERP real (cache_estoque_sugestao) */
  estoqueErpDisponivel: boolean;
  ultimaCompra?: string;
  ultimaQtdComprada?: number;
  /** Valor unitário da última compra (R$/un, fonte ERP) */
  ultimaValorCompra?: number;
  historico: { data: string; consumo: number }[];
}

export interface SimulacaoResult {
  produtoId: string;
  produto: string;
  fornecedor: string;
  quantidade: number;
  coberturaAntes: number;
  coberturaDepois: number;
  criticidadeAntes: Criticidade;
  criticidadeDepois: Criticidade;
  dataRupturaAntes: string;
  dataRupturaDepois: string;
}
