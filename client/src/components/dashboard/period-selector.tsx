import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR, getClosedMonthPeriod, getCurrentWeekPeriod } from "@/lib/calendar-utils";
import type { DatePeriod, PeriodMode } from "@shared/schema";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";

interface PeriodSelectorProps {
  value: DatePeriod;
  onChange: (period: DatePeriod) => void;
  compact?: boolean;
}

type PresetType = "semana" | "mes" | "custom";

export function PeriodSelector({ value, onChange, compact = false }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetType>("mes");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(value.startDate),
    to: new Date(value.endDate),
  });

  const handleModeChange = (checked: boolean) => {
    const newMode: PeriodMode = { type: checked ? "fechado_semanas" : "livre" };
    
    if (checked && preset === "mes") {
      const today = new Date();
      const closedMonth = getClosedMonthPeriod(today.getFullYear(), today.getMonth() + 1);
      onChange({
        startDate: closedMonth.periodStart,
        endDate: closedMonth.periodEnd,
        mode: newMode,
      });
    } else {
      onChange({ ...value, mode: newMode });
    }
  };

  const handlePresetChange = (newPreset: PresetType) => {
    setPreset(newPreset);
    const today = new Date();
    
    if (newPreset === "semana") {
      const weekPeriod = getCurrentWeekPeriod();
      onChange({
        startDate: weekPeriod.startDate,
        endDate: weekPeriod.endDate,
        mode: value.mode,
      });
    } else if (newPreset === "mes") {
      if (value.mode.type === "fechado_semanas") {
        const closedMonth = getClosedMonthPeriod(today.getFullYear(), today.getMonth() + 1);
        onChange({
          startDate: closedMonth.periodStart,
          endDate: closedMonth.periodEnd,
          mode: value.mode,
        });
      } else {
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        onChange({
          startDate: format(start, "yyyy-MM-dd"),
          endDate: format(end, "yyyy-MM-dd"),
          mode: value.mode,
        });
      }
    }
  };

  const applyCustomRange = () => {
    onChange({
      startDate: format(dateRange.from, "yyyy-MM-dd"),
      endDate: format(dateRange.to, "yyyy-MM-dd"),
      mode: { type: "livre" },
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size={compact ? "icon" : "default"}
          className={compact ? "" : "w-[140px] xs:w-[200px] sm:w-[240px] justify-start gap-2 h-8 sm:h-9"}
          data-testid="button-period-selector"
        >
          <Calendar className="h-4 w-4" />
          {!compact && (
            <>
              <span className="truncate">
                {formatDateBR(value.startDate)} - {formatDateBR(value.endDate)}
              </span>
              <ChevronDown className="h-4 w-4 ml-auto opacity-50" />
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="closed-weeks"
                checked={value.mode.type === "fechado_semanas"}
                onCheckedChange={handleModeChange}
                data-testid="switch-period-mode"
              />
              <Label htmlFor="closed-weeks" className="text-sm cursor-pointer">
                Semanas fechadas
              </Label>
            </div>
          </div>
          
          <div className="p-2 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              {value.mode.type === "fechado_semanas" 
                ? "Período considera semanas completas (Dom-Sáb)"
                : "Período exato conforme selecionado"}
            </p>
          </div>

          <Tabs value={preset} onValueChange={(v) => handlePresetChange(v as PresetType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="semana" data-testid="tab-period-week">Semana</TabsTrigger>
              <TabsTrigger value="mes" data-testid="tab-period-month">Mês</TabsTrigger>
              <TabsTrigger value="custom" data-testid="tab-period-custom">Período</TabsTrigger>
            </TabsList>
          </Tabs>

          {preset === "custom" && (
            <div className="space-y-3">
              <CalendarComponent
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  } else if (range?.from) {
                    setDateRange({ from: range.from, to: range.from });
                  }
                }}
                numberOfMonths={1}
                className="rounded-md border"
              />
              <Button onClick={applyCustomRange} className="w-full" data-testid="button-apply-period">
                Aplicar
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
