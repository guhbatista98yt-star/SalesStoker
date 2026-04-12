import { useState } from "react";
import { Check, ChevronDown, CalendarDays, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ptBR } from "date-fns/locale";
import {
  formatDateBR,
  getClosedMonthPeriod,
  getCurrentWeekPeriod,
  getCurrentMonthPeriod,
} from "@/lib/calendar-utils";
import type { DatePeriod } from "@shared/schema";
import type { DateRange } from "react-day-picker";

interface PeriodSelectorProps {
  value: DatePeriod;
  onChange: (period: DatePeriod) => void;
  compact?: boolean;
}

type PresetKey = "semana" | "mes" | "fechado" | "custom";

export function PeriodSelector({ value, onChange, compact = false }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState<DateRange | undefined>();

  const today = new Date();
  const currentWeek = getCurrentWeekPeriod();
  const monthPeriod = getCurrentMonthPeriod();
  const closedMonth = getClosedMonthPeriod(today.getFullYear(), today.getMonth() + 1);

  const activeMode = value.mode?.type;
  const activePreset: PresetKey =
    activeMode === "fechado_semanas" ? "fechado" :
    value.startDate === currentWeek.startDate && value.endDate === currentWeek.endDate ? "semana" :
    value.startDate === monthPeriod.startDate && value.endDate === monthPeriod.endDate ? "mes" :
    "custom";

  const presets = [
    {
      key: "semana" as const,
      label: "Semana Atual",
      sub: `${formatDateBR(currentWeek.startDate)} – ${formatDateBR(currentWeek.endDate)}`,
      onSelect: () => {
        onChange({ startDate: currentWeek.startDate, endDate: currentWeek.endDate, mode: { type: "livre" } });
        setOpen(false);
      },
    },
    {
      key: "mes" as const,
      label: "Mês Atual",
      sub: `${formatDateBR(monthPeriod.startDate)} – ${formatDateBR(monthPeriod.endDate)}`,
      onSelect: () => {
        onChange({ startDate: monthPeriod.startDate, endDate: monthPeriod.endDate, mode: { type: "livre" } });
        setOpen(false);
      },
    },
    {
      key: "fechado" as const,
      label: "Semanas Fechadas",
      sub: `${formatDateBR(closedMonth.periodStart)} – ${formatDateBR(closedMonth.periodEnd)}`,
      onSelect: () => {
        onChange({ startDate: closedMonth.periodStart, endDate: closedMonth.periodEnd, mode: { type: "fechado_semanas" } });
        setOpen(false);
      },
    },
  ] as const;

  const triggerLabel = (() => {
    if (activePreset === "semana") return `Semana · ${formatDateBR(value.startDate).slice(0, 5)}–${formatDateBR(value.endDate).slice(0, 5)}`;
    if (activePreset === "mes") return `Mês · ${monthPeriod.label}`;
    if (activePreset === "fechado") return `Fechado · ${formatDateBR(value.startDate).slice(0, 5)}–${formatDateBR(value.endDate).slice(0, 5)}`;
    return `${formatDateBR(value.startDate).slice(0, 5)}–${formatDateBR(value.endDate).slice(0, 5)}`;
  })();

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o) {
        setCustomDraft({
          from: value.startDate ? new Date(value.startDate + "T00:00:00") : undefined,
          to: value.endDate ? new Date(value.endDate + "T00:00:00") : undefined,
        });
      }
    }}>
      <PopoverTrigger asChild>
        <Button
          variant={activePreset !== "semana" ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs font-medium rounded-lg"
          data-testid="button-period-selector"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {!compact && <span>{triggerLabel}</span>}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 p-0" sideOffset={6}>
        {/* Presets */}
        <div className="p-2 space-y-0.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1">
            Períodos rápidos
          </p>
          {presets.map((opt) => (
            <button
              key={opt.key}
              className={cn(
                "w-full flex items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted transition-colors",
                activePreset === opt.key && "bg-primary/8 text-primary"
              )}
              onClick={opt.onSelect}
            >
              <Check
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  activePreset === opt.key ? "opacity-100 text-primary" : "opacity-0"
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-none">{opt.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>

        <Separator />

        {/* Custom Range */}
        <div className="p-2 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Período personalizado
            </p>
          </div>
          {customDraft?.from && (
            <p className="text-[11px] text-center text-muted-foreground px-1">
              {customDraft.from.toLocaleDateString("pt-BR")}
              {customDraft.to
                ? ` – ${customDraft.to.toLocaleDateString("pt-BR")}`
                : " → selecione o fim"}
            </p>
          )}
          <CalendarComponent
            mode="range"
            selected={customDraft}
            onSelect={setCustomDraft}
            locale={ptBR}
            className="rounded-md p-0"
            numberOfMonths={1}
            disabled={{ after: new Date() }}
            classNames={{
              months: "flex flex-col",
              caption_label: "text-xs font-medium",
              head_cell: "text-muted-foreground w-8 font-normal text-[0.7rem]",
              cell: "h-8 w-8 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
              day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 text-xs",
            }}
          />
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            disabled={!customDraft?.from || !customDraft?.to}
            data-testid="button-apply-period"
            onClick={() => {
              if (!customDraft?.from || !customDraft?.to) return;
              const start = customDraft.from.toISOString().slice(0, 10);
              const end = customDraft.to.toISOString().slice(0, 10);
              onChange({ startDate: start, endDate: end, mode: { type: "livre" } });
              setOpen(false);
            }}
          >
            Aplicar período
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
