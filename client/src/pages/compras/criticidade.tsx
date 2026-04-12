import { cn } from "@/lib/utils";
import type { Criticidade } from "./types";

export const CRITICIDADE_CONFIG: Record<Criticidade, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critico:  { label: "Crítico",  color: "text-red-600 dark:text-red-400",    bg: "bg-red-50 dark:bg-red-950/40",    border: "border-red-200 dark:border-red-800",    dot: "bg-red-500" },
  alto:     { label: "Alto",     color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-200 dark:border-orange-800", dot: "bg-orange-500" },
  moderado: { label: "Moderado", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40", border: "border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-500" },
  atencao:  { label: "Atenção",  color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50 dark:bg-blue-950/40",   border: "border-blue-200 dark:border-blue-800",   dot: "bg-blue-500" },
  normal:   { label: "Normal",   color: "text-green-600 dark:text-green-400",  bg: "bg-green-50 dark:bg-green-950/40",  border: "border-green-200 dark:border-green-800",  dot: "bg-green-500" },
};

export function CriticidadeBadge({ value, className }: { value: Criticidade; className?: string }) {
  const cfg = CRITICIDADE_CONFIG[value];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border",
      cfg.bg, cfg.color, cfg.border, className
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function CriticidadeDot({ value, size = "md", className }: { value: Criticidade; size?: "sm" | "md" | "lg"; className?: string }) {
  const cfg = CRITICIDADE_CONFIG[value];
  const sizes = { sm: "w-2 h-2", md: "w-3 h-3", lg: "w-4 h-4" };
  return <span className={cn("rounded-full inline-block shrink-0", cfg.dot, sizes[size], className)} />;
}

export function criticidadeOrder(c: Criticidade): number {
  const order: Record<Criticidade, number> = { critico: 0, alto: 1, moderado: 2, atencao: 3, normal: 4 };
  return order[c];
}
