/**
 * Visual Rule Builder
 * Constructs a tree of ConditionGroups and Conditions.
 * The resulting JSON is what gets sent to the backend engine.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Condition, type ConditionGroup, type ConditionOperator, type ConditionType,
  type GroupConnector,
  CONDITION_TYPE_LABEL, CONDITION_NUMERIC_TYPES, OPERATOR_LABEL,
} from "../types";

// ─── Operator options per type ────────────────────────────────────────────────

const TEXT_OPS: ConditionOperator[] = ["EQUALS", "NOT_EQUALS", "IN", "NOT_IN"];
const NUM_OPS: ConditionOperator[] = ["GTE", "LTE", "GT", "LT", "BETWEEN", "EQUALS", "NOT_EQUALS"];

function getOpsForType(type: ConditionType): ConditionOperator[] {
  return CONDITION_NUMERIC_TYPES.has(type) ? NUM_OPS : TEXT_OPS;
}

// ─── Single Condition row ─────────────────────────────────────────────────────

interface ConditionRowProps {
  cond: Condition;
  onChange: (updated: Condition) => void;
  onRemove: () => void;
  depth: number;
}

function ConditionRow({ cond, onChange, onRemove, depth }: ConditionRowProps) {
  const ops = getOpsForType(cond.type);
  const isNumeric = CONDITION_NUMERIC_TYPES.has(cond.type);
  const isBetween = cond.operator === "BETWEEN";
  const isMulti = cond.operator === "IN" || cond.operator === "NOT_IN";

  function updateType(type: ConditionType) {
    const newOps = getOpsForType(type);
    const op: ConditionOperator = newOps.includes(cond.operator) ? cond.operator : newOps[0];
    onChange({ ...cond, type, operator: op, value: "" });
  }

  function updateOp(operator: ConditionOperator) {
    let value: any = cond.value;
    if (operator === "BETWEEN") value = [0, 0];
    else if (operator === "IN" || operator === "NOT_IN") value = [];
    else if (Array.isArray(value)) value = "";
    onChange({ ...cond, operator, value });
  }

  function updateValue(val: any) {
    onChange({ ...cond, value: val });
  }

  const betweenVal = Array.isArray(cond.value) && isBetween ? cond.value as [number, number] : [0, 0];
  const multiVal = Array.isArray(cond.value) && isMulti ? (cond.value as string[]).join(", ") : "";
  const simpleVal = !Array.isArray(cond.value) ? String(cond.value ?? "") : "";

  return (
    <div className="flex flex-wrap gap-2 items-center py-1.5 px-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* Type */}
      <Select value={cond.type} onValueChange={v => updateType(v as ConditionType)}>
        <SelectTrigger className="h-7 text-xs w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(CONDITION_TYPE_LABEL) as [ConditionType, string][]).map(([k, v]) => (
            <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select value={cond.operator} onValueChange={v => updateOp(v as ConditionOperator)}>
        <SelectTrigger className="h-7 text-xs w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ops.map(op => (
            <SelectItem key={op} value={op} className="text-xs">{OPERATOR_LABEL[op]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {isBetween ? (
        <div className="flex gap-1 items-center">
          <Input
            className="h-7 text-xs w-20"
            type="number"
            placeholder="Mín"
            value={betweenVal[0]}
            onChange={e => updateValue([Number(e.target.value), betweenVal[1]])}
          />
          <span className="text-xs text-muted-foreground">e</span>
          <Input
            className="h-7 text-xs w-20"
            type="number"
            placeholder="Máx"
            value={betweenVal[1]}
            onChange={e => updateValue([betweenVal[0], Number(e.target.value)])}
          />
        </div>
      ) : isMulti ? (
        <div className="flex flex-col gap-0.5">
          <Input
            className="h-7 text-xs w-48"
            placeholder="valor1, valor2, ..."
            value={multiVal}
            onChange={e => updateValue(e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
          />
          <span className="text-[10px] text-muted-foreground px-1">Separados por vírgula</span>
        </div>
      ) : (
        <Input
          className="h-7 text-xs w-36"
          type={isNumeric ? "number" : "text"}
          placeholder="Valor"
          value={simpleVal}
          onChange={e => updateValue(isNumeric ? Number(e.target.value) : e.target.value)}
        />
      )}

      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={onRemove}>
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

// ─── Group Block ──────────────────────────────────────────────────────────────

interface GroupBlockProps {
  group: ConditionGroup;
  onChange: (updated: ConditionGroup) => void;
  onRemove?: () => void;
  depth?: number;
}

function GroupBlock({ group, onChange, onRemove, depth = 0 }: GroupBlockProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isRoot = depth === 0;

  const borderColors = [
    "border-blue-300 dark:border-blue-700",
    "border-violet-300 dark:border-violet-700",
    "border-emerald-300 dark:border-emerald-700",
    "border-amber-300 dark:border-amber-700",
  ];
  const bgColors = [
    "bg-blue-50/50 dark:bg-blue-950/20",
    "bg-violet-50/50 dark:bg-violet-950/20",
    "bg-emerald-50/50 dark:bg-emerald-950/20",
    "bg-amber-50/50 dark:bg-amber-950/20",
  ];
  const borderColor = borderColors[depth % borderColors.length];
  const bgColor = bgColors[depth % bgColors.length];

  function addCondition() {
    const newCond: Condition = {
      id: crypto.randomUUID(),
      type: "VALOR",
      operator: "GTE",
      value: 0,
    };
    onChange({ ...group, conditions: [...group.conditions, newCond] });
  }

  function addSubGroup() {
    const newGroup: ConditionGroup = {
      id: crypto.randomUUID(),
      connector: "OR",
      conditions: [],
      groups: [],
    };
    onChange({ ...group, groups: [...group.groups, newGroup] });
  }

  function updateCondition(idx: number, updated: Condition) {
    const conditions = [...group.conditions];
    conditions[idx] = updated;
    onChange({ ...group, conditions });
  }

  function removeCondition(idx: number) {
    onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== idx) });
  }

  function updateSubGroup(idx: number, updated: ConditionGroup) {
    const groups = [...group.groups];
    groups[idx] = updated;
    onChange({ ...group, groups });
  }

  function removeSubGroup(idx: number) {
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) });
  }

  const totalItems = group.conditions.length + group.groups.length;

  return (
    <div className={cn("rounded-lg border-2 p-3 space-y-2", borderColor, bgColor)}>
      {/* Group header */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {!isRoot && <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-xs font-medium text-muted-foreground">
          {isRoot ? "Regras" : "Grupo"} {depth > 0 ? `(nível ${depth})` : ""}
        </span>

        {/* Connector toggle */}
        <div className="flex rounded-md overflow-hidden border text-xs">
          {(["AND", "OR"] as GroupConnector[]).map(c => (
            <button
              key={c}
              onClick={() => onChange({ ...group, connector: c })}
              className={cn(
                "px-2 py-0.5 font-semibold transition-colors",
                group.connector === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <Badge variant="outline" className="text-[10px] py-0 h-4">
          {totalItems} {totalItems === 1 ? "item" : "itens"}
        </Badge>

        {!isRoot && onRemove && (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 ml-auto text-red-400 hover:text-red-600"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Conditions */}
          <div className="space-y-1.5 pl-4">
            {group.conditions.map((cond, idx) => (
              <ConditionRow
                key={cond.id}
                cond={cond}
                depth={depth}
                onChange={updated => updateCondition(idx, updated)}
                onRemove={() => removeCondition(idx)}
              />
            ))}

            {/* Nested groups */}
            {group.groups.map((sub, idx) => (
              <GroupBlock
                key={sub.id}
                group={sub}
                depth={depth + 1}
                onChange={updated => updateSubGroup(idx, updated)}
                onRemove={() => removeSubGroup(idx)}
              />
            ))}

            {totalItems === 0 && (
              <p className="text-xs text-muted-foreground italic py-2 pl-2">
                Nenhuma condição adicionada. Clique em "Condição" para começar.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pl-4 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={addCondition}
            >
              <Plus className="h-3 w-3" /> Condição
            </Button>
            {depth < 3 && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs gap-1"
                onClick={addSubGroup}
              >
                <GitBranch className="h-3 w-3" /> Grupo
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface RuleBuilderProps {
  value: ConditionGroup;
  onChange: (updated: ConditionGroup) => void;
}

export function RuleBuilder({ value, onChange }: RuleBuilderProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Defina as condições que devem ser satisfeitas para a campanha ser aplicada.
        Use grupos para combinar regras com lógica <strong>E</strong> / <strong>OU</strong>.
        Sem condições, a campanha aplica para todos.
      </p>
      <GroupBlock group={value} onChange={onChange} depth={0} />
    </div>
  );
}
