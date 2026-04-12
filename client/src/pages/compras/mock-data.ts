import type {
  ComprasDashboard, Alerta, FornecedorRanking, ProdutoCritico,
  SugestaoFornecedor, FornecedorDetalhe, ProdutoDetalhe,
} from "./types";

export const mockDashboard: ComprasDashboard = {
  fornecedoresCriticos: 4,
  produtosCriticos: 23,
  itensZeradosEm3Dias: 7,
  itensZeradosEm7Dias: 14,
  abaixoEstoqueSeguranca: 31,
  excessoEstoque: 12,
  valorEstimadoCompra: 184750.00,
  pedidosSugeridos: 18,
  pedidosEmAberto: 5,
  fornecedoresMaiorRisco: 3,
};

export const mockAlertas: Alerta[] = [
  { id: "a1", tipo: "Ruptura iminente", produto: "Tubo PVC 100mm", produtoId: "p1", fornecedor: "Tigre", fornecedorId: "f1", criticidade: "critico", tempoEstimadoRuptura: 1, acaoSugerida: "Emitir pedido urgente", visto: false, silenciado: false },
  { id: "a2", tipo: "Estoque zerado", produto: "Conexão 90° 50mm", produtoId: "p2", fornecedor: "Amanco", fornecedorId: "f2", criticidade: "critico", tempoEstimadoRuptura: 0, acaoSugerida: "Verificar pedido alternativo", visto: false, silenciado: false },
  { id: "a3", tipo: "Abaixo do mínimo", produto: "Cola PVC 175g", produtoId: "p3", fornecedor: "Tigre", fornecedorId: "f1", criticidade: "alto", tempoEstimadoRuptura: 4, acaoSugerida: "Incluir no próximo pedido", visto: false, silenciado: false },
  { id: "a4", tipo: "Excesso de estoque", produto: "Registro Gaveta 3/4", produtoId: "p5", fornecedor: "Docol", fornecedorId: "f3", criticidade: "atencao", acaoSugerida: "Não repor nas próximas 4 semanas", visto: false, silenciado: false },
  { id: "a5", tipo: "Lead time atrasado", produto: "Tubo CPVC 22mm", produtoId: "p6", fornecedor: "Ipex", fornecedorId: "f4", criticidade: "moderado", tempoEstimadoRuptura: 9, acaoSugerida: "Contatar fornecedor para confirmação", visto: true, silenciado: false },
];

export const mockFornecedores: FornecedorRanking[] = [
  { id: "f1", nome: "Tigre",  itensCriticos: 8,  coberturaMedia: 5,  leadTime: 7,  valorEstimado: 62400, criticidade: "critico",  status: "Crítico" },
  { id: "f2", nome: "Amanco", itensCriticos: 6,  coberturaMedia: 7,  leadTime: 10, valorEstimado: 45200, criticidade: "critico",  status: "Crítico" },
  { id: "f3", nome: "Docol",  itensCriticos: 3,  coberturaMedia: 12, leadTime: 5,  valorEstimado: 28900, criticidade: "alto",     status: "Alto" },
  { id: "f4", nome: "Ipex",   itensCriticos: 2,  coberturaMedia: 18, leadTime: 14, valorEstimado: 21000, criticidade: "moderado", status: "Moderado" },
  { id: "f5", nome: "Schneider", itensCriticos: 1, coberturaMedia: 22, leadTime: 8, valorEstimado: 14600, criticidade: "atencao", status: "Atenção" },
  { id: "f6", nome: "Krona",  itensCriticos: 0,  coberturaMedia: 30, leadTime: 6,  valorEstimado: 12650, criticidade: "normal",   status: "Normal" },
];

export const mockProdutos: ProdutoCritico[] = [
  { id: "p1", codigo: "TIG-100",  descricao: "Tubo PVC 100mm x 6m",     fornecedor: "Tigre",  fornecedorId: "f1", estoqueAtual: 4,   coberturaDias: 1,  dataEstimadaRuptura: "2026-04-13", sugestaoCompra: 50,  criticidade: "critico"  },
  { id: "p2", codigo: "AMA-5090", descricao: "Conexão 90° 50mm",        fornecedor: "Amanco", fornecedorId: "f2", estoqueAtual: 0,   coberturaDias: 0,  dataEstimadaRuptura: "Hoje",       sugestaoCompra: 120, criticidade: "critico"  },
  { id: "p3", codigo: "TIG-COLA", descricao: "Cola PVC 175g",           fornecedor: "Tigre",  fornecedorId: "f1", estoqueAtual: 8,   coberturaDias: 4,  dataEstimadaRuptura: "2026-04-16", sugestaoCompra: 60,  criticidade: "alto"     },
  { id: "p4", codigo: "AMA-3232", descricao: "Luva PVC 32mm",           fornecedor: "Amanco", fornecedorId: "f2", estoqueAtual: 15,  coberturaDias: 5,  dataEstimadaRuptura: "2026-04-17", sugestaoCompra: 80,  criticidade: "alto"     },
  { id: "p5", codigo: "DOC-GAV34",descricao: "Registro Gaveta 3/4",     fornecedor: "Docol",  fornecedorId: "f3", estoqueAtual: 250, coberturaDias: 90, dataEstimadaRuptura: "2026-07-11", sugestaoCompra: 0,   criticidade: "atencao"  },
  { id: "p6", codigo: "IPX-CPVC", descricao: "Tubo CPVC 22mm x 3m",    fornecedor: "Ipex",   fornecedorId: "f4", estoqueAtual: 30,  coberturaDias: 9,  dataEstimadaRuptura: "2026-04-21", sugestaoCompra: 40,  criticidade: "moderado" },
  { id: "p7", codigo: "TIG-4590", descricao: "Curva 45° 90mm",         fornecedor: "Tigre",  fornecedorId: "f1", estoqueAtual: 22,  coberturaDias: 11, dataEstimadaRuptura: "2026-04-23", sugestaoCompra: 30,  criticidade: "moderado" },
  { id: "p8", codigo: "SCH-DIN20",descricao: "Eletroduto Rígido 20mm",  fornecedor: "Schneider", fornecedorId: "f5", estoqueAtual: 60, coberturaDias: 18, dataEstimadaRuptura: "2026-04-30", sugestaoCompra: 20, criticidade: "atencao" },
];

export const mockSugestoes: SugestaoFornecedor[] = [
  { fornecedorId: "f1", fornecedor: "Tigre",     itens: 8,  valorEstimado: 62400, urgencia: "critico"  },
  { fornecedorId: "f2", fornecedor: "Amanco",    itens: 6,  valorEstimado: 45200, urgencia: "critico"  },
  { fornecedorId: "f3", fornecedor: "Docol",     itens: 3,  valorEstimado: 28900, urgencia: "alto"     },
  { fornecedorId: "f4", fornecedor: "Ipex",      itens: 2,  valorEstimado: 21000, urgencia: "moderado" },
  { fornecedorId: "f5", fornecedor: "Schneider", itens: 1,  valorEstimado: 14600, urgencia: "atencao"  },
];

export const mockFornecedorDetalhe: Record<string, FornecedorDetalhe> = {
  f1: {
    id: "f1", nome: "Tigre", itensCriticos: 8, coberturaMedia: 5, leadTime: 7, valorEstimado: 62400, criticidade: "critico", totalProdutos: 32,
    produtos: mockProdutos.filter(p => p.fornecedorId === "f1"),
    coberturaPorProduto: [
      { produto: "Tubo 100mm", dias: 1 }, { produto: "Cola PVC", dias: 4 }, { produto: "Curva 45°", dias: 11 }, { produto: "Tubo 50mm", dias: 18 }, { produto: "Joelho 90°", dias: 22 },
    ],
  },
  f2: {
    id: "f2", nome: "Amanco", itensCriticos: 6, coberturaMedia: 7, leadTime: 10, valorEstimado: 45200, criticidade: "critico", totalProdutos: 28,
    produtos: mockProdutos.filter(p => p.fornecedorId === "f2"),
    coberturaPorProduto: [
      { produto: "Conexão 90°", dias: 0 }, { produto: "Luva 32mm", dias: 5 }, { produto: "Tubo 25mm", dias: 12 }, { produto: "Curva 90°", dias: 20 },
    ],
  },
  f3: {
    id: "f3", nome: "Docol", itensCriticos: 3, coberturaMedia: 12, leadTime: 5, valorEstimado: 28900, criticidade: "alto", totalProdutos: 15,
    produtos: mockProdutos.filter(p => p.fornecedorId === "f3"),
    coberturaPorProduto: [
      { produto: "Registro Gav", dias: 90 }, { produto: "Torneira", dias: 25 }, { produto: "Misturador", dias: 14 },
    ],
  },
};

export const mockProdutoDetalhe: Record<string, ProdutoDetalhe> = {
  p1: {
    id: "p1", codigo: "TIG-100", descricao: "Tubo PVC 100mm x 6m", fornecedor: "Tigre", fornecedorId: "f1",
    estoqueAtual: 4, estoqueSeguranca: 20, coberturaDias: 1, dataEstimadaRuptura: "2026-04-13",
    sugestaoCompra: 50, criticidade: "critico", consumoDiario: 4, consumoSemanal: 28, consumoMensal: 120,
    ultimaCompra: "2026-03-15",
    historico: [
      { data: "Mar/26", consumo: 124 }, { data: "Fev/26", consumo: 115 }, { data: "Jan/26", consumo: 98 },
      { data: "Dez/25", consumo: 131 }, { data: "Nov/25", consumo: 109 }, { data: "Out/25", consumo: 118 },
    ],
  },
  p2: {
    id: "p2", codigo: "AMA-5090", descricao: "Conexão 90° 50mm", fornecedor: "Amanco", fornecedorId: "f2",
    estoqueAtual: 0, estoqueSeguranca: 30, coberturaDias: 0, dataEstimadaRuptura: "Hoje",
    sugestaoCompra: 120, criticidade: "critico", consumoDiario: 8, consumoSemanal: 56, consumoMensal: 240,
    historico: [
      { data: "Mar/26", consumo: 245 }, { data: "Fev/26", consumo: 220 }, { data: "Jan/26", consumo: 198 },
      { data: "Dez/25", consumo: 260 }, { data: "Nov/25", consumo: 215 }, { data: "Out/25", consumo: 230 },
    ],
  },
  p3: {
    id: "p3", codigo: "TIG-COLA", descricao: "Cola PVC 175g", fornecedor: "Tigre", fornecedorId: "f1",
    estoqueAtual: 8, estoqueSeguranca: 15, coberturaDias: 4, dataEstimadaRuptura: "2026-04-16",
    sugestaoCompra: 60, criticidade: "alto", consumoDiario: 2, consumoSemanal: 14, consumoMensal: 60,
    historico: [
      { data: "Mar/26", consumo: 62 }, { data: "Fev/26", consumo: 55 }, { data: "Jan/26", consumo: 48 },
      { data: "Dez/25", consumo: 71 }, { data: "Nov/25", consumo: 58 }, { data: "Out/25", consumo: 63 },
    ],
  },
};
