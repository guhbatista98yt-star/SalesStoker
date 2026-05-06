import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, AlertCircle, X, Check } from "lucide-react";
import type { AlertNotification } from "@shared/schema";
import { formatDistanceToNow, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AlertsPanelProps {
  alerts: AlertNotification[];
  onDismiss?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  loading?: boolean;
  dragHandle?: React.ReactNode;
}

function getSeverityIcon(severity: "info" | "warning" | "critical") {
  switch (severity) {
    case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "info": return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getSeverityColor(severity: "info" | "warning" | "critical"): string {
  switch (severity) {
    case "critical": return "border-l-red-500 bg-red-50/50 dark:bg-red-950/20";
    case "warning": return "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20";
    case "info": return "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20";
  }
}

function getSeverityBadge(severity: "info" | "warning" | "critical") {
  switch (severity) {
    case "critical": return <Badge variant="destructive" className="text-xs">Crítico</Badge>;
    case "warning": return <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Atenção</Badge>;
    case "info": return <Badge variant="secondary" className="text-xs">Info</Badge>;
  }
}

function formatAlertTime(value: string): string {
  const date = new Date(value);
  return isValid(date)
    ? formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
    : "data indisponivel";
}

export function AlertsPanel({ alerts, onDismiss, onMarkRead, loading, dragHandle }: AlertsPanelProps) {
  const unreadAlerts = alerts.filter(a => !a.read);

  return (
    <Card data-testid="alerts-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            {dragHandle}
            <Bell className="h-5 w-5 text-primary" />
            Alertas
            {unreadAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {unreadAlerts.length}
              </Badge>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 rounded-md bg-muted/30 animate-pulse">
                <div className="h-4 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p>Nenhum alerta no momento</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-md border-l-4 ${getSeverityColor(alert.severity)} ${
                  alert.read ? "opacity-60" : ""
                }`}
                data-testid={`alert-item-${alert.id}`}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {getSeverityBadge(alert.severity)}
                      <span className="text-xs text-muted-foreground">
                        {formatAlertTime(alert.triggeredAt)}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!alert.read && onMarkRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onMarkRead(alert.id)}
                        data-testid={`button-mark-read-${alert.id}`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDismiss && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDismiss(alert.id)}
                        data-testid={`button-dismiss-${alert.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
