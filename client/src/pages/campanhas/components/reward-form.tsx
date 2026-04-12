import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Rewards, type RewardTier, type RewardPosition, type RewardType, REWARD_TYPE_LABEL } from "../types";

function newTier(): RewardTier {
  return { id: crypto.randomUUID(), label: "", min: 0, max: null, value: 0, unit: "R$" };
}

function newPosition(posicao: number): RewardPosition {
  return { id: crypto.randomUUID(), posicao, label: `${posicao}º lugar`, valor: 0 };
}

interface RewardFormProps {
  value: Rewards;
  onChange: (updated: Rewards) => void;
}

export function RewardForm({ value, onChange }: RewardFormProps) {
  const update = (patch: Partial<Rewards>) => onChange({ ...value, ...patch });

  function addTier() {
    update({ tiers: [...(value.tiers || []), newTier()] });
  }

  function updateTier(idx: number, patch: Partial<RewardTier>) {
    const tiers = [...(value.tiers || [])];
    tiers[idx] = { ...tiers[idx], ...patch };
    update({ tiers });
  }

  function removeTier(idx: number) {
    update({ tiers: value.tiers.filter((_, i) => i !== idx) });
  }

  function addPosition() {
    const posicoes = value.posicoes || [];
    const nextPos = posicoes.length > 0 ? Math.max(...posicoes.map(p => p.posicao)) + 1 : 1;
    update({ posicoes: [...posicoes, newPosition(nextPos)] });
  }

  function updatePosition(idx: number, patch: Partial<RewardPosition>) {
    const posicoes = [...(value.posicoes || [])];
    posicoes[idx] = { ...posicoes[idx], ...patch };
    update({ posicoes });
  }

  function removePosition(idx: number) {
    update({ posicoes: (value.posicoes || []).filter((_, i) => i !== idx) });
  }

  const isTiered = value.type === "FAIXA" || value.type === "PROGRESSAO";
  const isRanking = value.type === "RANKING";
  const isPercentual = value.type === "PERCENTUAL" || value.type === "COMISSAO_PERCENTUAL";

  return (
    <div className="space-y-5">
      {/* Type + Scope */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo de Premiação</Label>
          <Select value={value.type} onValueChange={v => update({ type: v as RewardType })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(REWARD_TYPE_LABEL) as [RewardType, string][]).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Escopo</Label>
          <Select value={value.scope} onValueChange={v => update({ scope: v as "individual" | "coletivo" })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual" className="text-xs">Individual por vendedor</SelectItem>
              <SelectItem value="coletivo" className="text-xs">Coletivo (equipe)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dica contextual */}
      {value.type === "COMISSAO_PERCENTUAL" && (
        <div className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 rounded px-3 py-2 border border-blue-200 dark:border-blue-800">
          A comissão será calculada sobre o valor total da <strong>base de pagamento</strong> acumulada no período.
          Configure a base de pagamento na aba "Bases de Cálculo".
        </div>
      )}
      {isRanking && (
        <div className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded px-3 py-2 border border-amber-200 dark:border-amber-800">
          Configure abaixo o prêmio para cada posição no ranking. O critério de ranking é definido na aba "Bases de Cálculo".
        </div>
      )}

      {/* Valor fixo */}
      {value.type === "VALOR_FIXO" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Valor Fixo (R$)</Label>
          <Input
            type="number"
            className="h-8 text-xs w-44"
            placeholder="0,00"
            value={value.baseValue ?? ""}
            onChange={e => update({ baseValue: Number(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground">Todos os elegíveis que cumprirem as condições recebem este valor.</p>
        </div>
      )}

      {/* Percentual / Comissão */}
      {isPercentual && (
        <div className="space-y-1.5">
          <Label className="text-xs">
            {value.type === "COMISSAO_PERCENTUAL" ? "Percentual de comissão (%)" : "Percentual (%)"}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="h-8 text-xs w-28"
              placeholder="0"
              step="0.1"
              value={value.basePercent ?? ""}
              onChange={e => update({ basePercent: Number(e.target.value) })}
            />
            <span className="text-xs text-muted-foreground">
              {value.type === "COMISSAO_PERCENTUAL"
                ? "% sobre base de pagamento acumulada"
                : "% sobre o valor da venda"}
            </span>
          </div>
        </div>
      )}

      {/* Pontos */}
      {value.type === "PONTOS" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Pontos por ocorrência</Label>
          <Input
            type="number"
            className="h-8 text-xs w-28"
            placeholder="0"
            value={value.baseValue ?? ""}
            onChange={e => update({ baseValue: Number(e.target.value) })}
          />
        </div>
      )}

      {/* Ranking: prêmio por posição */}
      {isRanking && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Prêmio por Posição
            </Label>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={addPosition}>
              <Plus className="h-3 w-3" /> Adicionar Posição
            </Button>
          </div>

          {(!value.posicoes || value.posicoes.length === 0) && (
            <p className="text-xs text-muted-foreground italic">Nenhuma posição definida. Clique em "Adicionar Posição".</p>
          )}

          <div className="space-y-2">
            {(value.posicoes || [])
              .sort((a, b) => a.posicao - b.posicao)
              .map((pos, idx) => (
                <div key={pos.id} className="flex flex-wrap gap-2 items-center p-2 rounded-md bg-muted/40 border">
                  <Badge
                    className={cn(
                      "text-[10px] h-5 shrink-0",
                      pos.posicao === 1 ? "bg-amber-500 text-white" :
                      pos.posicao === 2 ? "bg-zinc-400 text-white" :
                      pos.posicao === 3 ? "bg-amber-700 text-white" : "",
                    )}
                    variant={pos.posicao <= 3 ? "default" : "outline"}
                  >
                    {pos.posicao}º
                  </Badge>

                  <Input
                    type="text"
                    className="h-7 text-xs w-32"
                    placeholder="Rótulo (ex: 1º lugar)"
                    value={pos.label ?? ""}
                    onChange={e => updatePosition(idx, { label: e.target.value })}
                  />

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">→ R$</span>
                    <Input
                      type="number"
                      className="h-7 text-xs w-28"
                      placeholder="0,00"
                      value={pos.valor ?? ""}
                      onChange={e => updatePosition(idx, { valor: Number(e.target.value) })}
                    />
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-red-400 hover:text-red-600"
                    onClick={() => removePosition(idx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Faixas / Progressão */}
      {isTiered && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              {value.type === "FAIXA" ? "Faixas de Premiação" : "Faixas de Progressão"}
            </Label>
            <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={addTier}>
              <Plus className="h-3 w-3" /> Adicionar Faixa
            </Button>
          </div>

          {value.tiers.length === 0 && (
            <p className="text-xs text-muted-foreground italic">Nenhuma faixa definida. Clique em "Adicionar Faixa".</p>
          )}

          <div className="space-y-2">
            {value.tiers.map((tier, idx) => (
              <div key={tier.id} className="flex flex-wrap gap-2 items-center p-2 rounded-md bg-muted/40 border">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                <Badge variant="outline" className="text-[10px] h-4 shrink-0">#{idx + 1}</Badge>

                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    className="h-7 text-xs w-28"
                    placeholder="Rótulo (ex: Bronze)"
                    value={tier.label ?? ""}
                    onChange={e => updateTier(idx, { label: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">De</span>
                  <Input
                    type="number"
                    className="h-7 text-xs w-20"
                    placeholder="0"
                    value={tier.min ?? ""}
                    onChange={e => updateTier(idx, { min: Number(e.target.value) })}
                  />
                  <span className="text-[10px] text-muted-foreground">até</span>
                  <Input
                    type="number"
                    className="h-7 text-xs w-20"
                    placeholder="∞"
                    value={tier.max ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      updateTier(idx, { max: v === "" ? null : Number(v) });
                    }}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">→</span>
                  <Input
                    type="number"
                    className="h-7 text-xs w-20"
                    placeholder="Valor"
                    value={tier.value ?? ""}
                    onChange={e => updateTier(idx, { value: Number(e.target.value) })}
                  />
                  <Select value={tier.unit ?? "R$"} onValueChange={v => updateTier(idx, { unit: v })}>
                    <SelectTrigger className="h-7 text-xs w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R$" className="text-xs">R$</SelectItem>
                      <SelectItem value="%" className="text-xs">%</SelectItem>
                      <SelectItem value="pts" className="text-xs">pts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-red-400 hover:text-red-600"
                  onClick={() => removeTier(idx)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Limits within reward */}
      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
        <div className="space-y-1.5">
          <Label className="text-xs">Teto máximo de bonificação (R$)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            placeholder="Sem limite"
            value={value.maxBonus ?? ""}
            onChange={e => update({ maxBonus: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Corte mínimo para premiação (R$)</Label>
          <Input
            type="number"
            className="h-8 text-xs"
            placeholder="Sem mínimo"
            value={value.minCutoff ?? ""}
            onChange={e => update({ minCutoff: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}
