import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Play, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SimulationInput, SimulationResult } from "../types";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface SimulatorPanelProps {
  campaignId: string;
}

export function SimulatorPanel({ campaignId }: SimulatorPanelProps) {
  const [input, setInput] = useState<SimulationInput>({});
  const [result, setResult] = useState<SimulationResult | null>(null);

  const simulate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/campaigns/${campaignId}/simulate`, input);
      return res.json() as Promise<SimulationResult>;
    },
    onSuccess: (data) => setResult(data),
  });

  function field(label: string, key: keyof SimulationInput, type: "text" | "number" = "text") {
    return (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Input
          type={type}
          className="h-7 text-xs"
          placeholder="—"
          value={(input[key] as any) ?? ""}
          onChange={e => {
            const v = type === "number" ? (e.target.value === "" ? undefined : Number(e.target.value)) : (e.target.value || undefined);
            setInput(prev => ({ ...prev, [key]: v }));
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Input panel */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-1">Cenário de Simulação</h4>
          <p className="text-xs text-muted-foreground">
            Preencha os campos que deseja testar. Campos vazios são ignorados.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {field("ID do Vendedor", "vendedorId")}
          {field("ID do Grupo de Vendedor", "grupoVendedorId")}
          {field("ID da Empresa", "empresaId")}
          {field("Fornecedor", "fornecedor")}
          {field("ID do Produto", "produtoId")}
          {field("Categoria", "categoria")}
          {field("ID do Cliente", "clienteId")}
          {field("Quantidade", "quantidade", "number")}
          {field("Valor da Venda (R$)", "valor", "number")}
          {field("Desconto (%)", "desconto", "number")}
          {field("Margem (%)", "margem", "number")}
          {field("Meta Atingida (%)", "metaPerc", "number")}
          {field("Mix (nº produtos)", "mixCount", "number")}
          {field("Qtd Acumulada no Período", "acumuladoQuantidade", "number")}
          {field("Valor Acumulado no Período (R$)", "acumuladoValor", "number")}
        </div>

        {/* Day of week */}
        <div className="space-y-1.5">
          <Label className="text-xs">Dia da Semana</Label>
          <div className="flex gap-1 flex-wrap">
            {DAY_LABELS.map((d, i) => (
              <button
                key={i}
                onClick={() => setInput(prev => ({ ...prev, diaSemana: prev.diaSemana === i ? undefined : i }))}
                className={cn(
                  "px-2 py-0.5 rounded text-xs border transition-colors",
                  input.diaSemana === i
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-zinc-200 dark:border-zinc-700 hover:bg-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full gap-2"
          onClick={() => simulate.mutate()}
          disabled={simulate.isPending}
        >
          {simulate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Simular
        </Button>
      </div>

      {/* Result panel */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold">Resultado da Simulação</h4>

        {!result && !simulate.isPending && (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Info className="h-8 w-8 opacity-40" />
            <p className="text-xs">Preencha o cenário e clique em Simular.</p>
          </div>
        )}

        {simulate.isPending && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {result && !simulate.isPending && (
          <div className="space-y-4">
            {/* Verdict */}
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              result.aplicaria
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
            )}>
              {result.aplicaria
                ? <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
                : <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />}
              <div>
                <p className={cn(
                  "text-sm font-semibold",
                  result.aplicaria ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300",
                )}>
                  {result.aplicaria ? "Campanha APLICARIA" : "Campanha NÃO aplicaria"}
                </p>
                <p className="text-xs text-muted-foreground">{result.campanha} ({result.codigo})</p>
              </div>
            </div>

            {/* Premiação */}
            {result.premiacao && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Premiação gerada</p>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  {result.premiacao.tipo === "VALOR_FIXO" || result.premiacao.tipo === "PERCENTUAL" || result.premiacao.tipo === "FAIXA" || result.premiacao.tipo === "PROGRESSAO"
                    ? `R$ ${result.premiacao.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : `${result.premiacao.valor} pts`
                  }
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{result.premiacao.descricao}</p>
              </div>
            )}

            {/* Conditions */}
            <div className="space-y-2">
              {result.condicoesAtendidas.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Condições atendidas
                  </p>
                  <ul className="space-y-0.5">
                    {result.condicoesAtendidas.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground pl-4 flex items-center gap-1">
                        <span className="text-green-500">✓</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.condicoesFalharam.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Condições não atendidas
                  </p>
                  <ul className="space-y-0.5">
                    {result.condicoesFalharam.map((c, i) => (
                      <li key={i} className="text-xs text-muted-foreground pl-4 flex items-center gap-1">
                        <span className="text-red-400">✗</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Conflicts */}
            {(result.conflitos?.length ?? 0) > 0 && (
              <div className="p-2 rounded bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
                <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 flex items-center gap-1 mb-1">
                  <AlertTriangle className="h-3 w-3" /> Conflitos detectados
                </p>
                {result.conflitos!.map((c, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-4">{c}</p>
                ))}
              </div>
            )}

            {/* Explanation */}
            <div className="p-2 rounded bg-muted/40 text-xs text-muted-foreground">
              {result.explicacao}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Prioridade aplicada: <strong>{result.prioridadeAplicada}</strong></span>
            </div>
          </div>
        )}

        {simulate.isError && (
          <div className="p-3 rounded bg-destructive/10 text-destructive text-xs">
            Erro ao simular: {(simulate.error as any)?.message}
          </div>
        )}
      </div>
    </div>
  );
}
