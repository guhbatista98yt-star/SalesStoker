import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Rewards, type RewardTier, type RewardType, REWARD_TYPE_LABEL } from "../types";

function newTier(): RewardTier {
  return { id: crypto.randomUUID(), label: "", min: 0, max: null, value: 0, unit: "R$" };
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

  const isTiered = value.type === "FAIXA" || value.type === "PROGRESSAO";

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
              {(Object.entries(REWARD_TYPE_LABEL) as [RewardType, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
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

      {/* Simple types */}
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
        </div>
      )}

      {value.type === "PERCENTUAL" && (
        <div className="space-y-1.5">
          <Label className="text-xs">Percentual (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              className="h-8 text-xs w-28"
              placeholder="0"
              value={value.basePercent ?? ""}
              onChange={e => update({ basePercent: Number(e.target.value) })}
            />
            <span className="text-xs text-muted-foreground">% sobre o valor da venda</span>
          </div>
        </div>
      )}

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

      {/* Tiered types */}
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
