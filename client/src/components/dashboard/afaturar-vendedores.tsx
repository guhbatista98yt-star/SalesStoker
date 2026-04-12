import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/calendar-utils";
import type { SalespersonAFaturar } from "@shared/schema";

interface AFaturarVendedoresProps {
  data: SalespersonAFaturar[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

export function AFaturarVendedores({ data, loading, dragHandle }: AFaturarVendedoresProps) {
  const topItems = data.slice(0, 7);
  const maxVal = topItems.reduce((m, d) => Math.max(m, d.valorAFaturar), 0);

  return (
    <Card data-testid="afaturar-vendedores-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {dragHandle}
          <Package className="h-4 w-4 text-amber-500" />
          A Faturar por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="skeleton h-3.5 w-28 rounded" />
                  <div className="skeleton h-3.5 w-20 rounded" />
                </div>
                <div className="skeleton h-1.5 rounded-full" style={{ width: `${60 + i * 10}%` }} />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">Nenhum valor a faturar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, index) => {
              const pct = maxVal > 0 ? (item.valorAFaturar / maxVal) * 100 : 0;
              return (
                <div key={item.salesperson.id} data-testid={`afaturar-item-${item.salesperson.id}`}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">{index + 1}</span>
                      <span className="text-sm font-medium truncate">{item.salesperson.name}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground shrink-0 ml-2">
                      {formatCurrency(item.valorAFaturar)}
                    </span>
                  </div>
                  <div className="ml-6 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {data.length > 7 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{data.length - 7} outros vendedores
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
