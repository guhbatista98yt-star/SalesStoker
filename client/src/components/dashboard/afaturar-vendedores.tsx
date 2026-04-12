import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/calendar-utils";
import type { SalespersonAFaturar } from "@shared/schema";

interface AFaturarVendedoresProps {
  data: SalespersonAFaturar[];
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

export function AFaturarVendedores({ data, loading, dragHandle }: AFaturarVendedoresProps) {
  const topItems = data.slice(0, 6);

  return (
    <Card data-testid="afaturar-vendedores-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {dragHandle}
          <Package className="h-5 w-5 text-primary" />
          A Faturar por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum valor a faturar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {topItems.map((item, index) => (
              <div 
                key={item.salesperson.id} 
                className="flex justify-between items-center"
                data-testid={`afaturar-item-${item.salesperson.id}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
                  <span className="text-sm font-medium truncate max-w-[140px]">
                    {item.salesperson.name}
                  </span>
                </div>
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(item.valorAFaturar)}
                </span>
              </div>
            ))}
            {data.length > 6 && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{data.length - 6} outros vendedores
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
