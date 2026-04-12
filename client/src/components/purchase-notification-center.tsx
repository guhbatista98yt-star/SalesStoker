import { useState, useMemo } from "react";
import { Bell, BellOff, Check, CheckCheck, ChevronRight, Filter, Loader2, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePurchaseAlerts, type PurchaseAlert } from "@/hooks/use-purchase-alerts";

const SEVERITY_LABELS: Record<string, string> = {
  critico: "Crítico",
  importante: "Importante",
  info: "Info",
};

const SEVERITY_COLORS: Record<string, string> = {
  critico: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800",
  importante: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

const SEVERITY_DOT: Record<string, string> = {
  critico: "bg-red-500",
  importante: "bg-amber-500",
  info: "bg-blue-500",
};

const STATUS_LABELS: Record<string, string> = {
  nao_lido: "Não lido",
  lido: "Lido",
  reconhecido: "Reconhecido",
  adiado: "Adiado",
  silenciado: "Silenciado",
  resolvido: "Resolvido",
  reaberto: "Reaberto",
};

function AlertCard({
  alert,
  onMarkRead,
  onStatusChange,
}: {
  alert: PurchaseAlert;
  onMarkRead: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const isUnread = alert.status === "nao_lido";
  const timeAgo = formatDistanceToNow(new Date(alert.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg border transition-colors",
        isUnread
          ? "bg-primary/5 border-primary/20"
          : "bg-card border-border hover:bg-muted/30"
      )}
    >
      <div className="flex-shrink-0 mt-1">
        <span
          className={cn(
            "inline-block w-2 h-2 rounded-full",
            isUnread ? SEVERITY_DOT[alert.severity] : "bg-muted-foreground/30"
          )}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className={cn("text-sm font-medium leading-tight", isUnread && "font-semibold")}>
            {alert.title}
          </p>
          <span
            className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0",
              SEVERITY_COLORS[alert.severity]
            )}
          >
            {SEVERITY_LABELS[alert.severity]}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug mb-2 line-clamp-2">
          {alert.message}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">{timeAgo}</span>
          <div className="flex items-center gap-1">
            {isUnread && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => onMarkRead(alert.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Lido
              </Button>
            )}
            {alert.status !== "resolvido" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => onStatusChange(alert.id, "resolvido")}
              >
                Resolver
              </Button>
            )}
            {alert.status !== "silenciado" && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => onStatusChange(alert.id, "silenciado")}
              >
                Silenciar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PurchaseNotificationCenter() {
  const [open, setOpen] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("ativos");

  const { alerts, unreadCount, isLoading, prefs, markAsRead, updateStatus, markAllRead, savePreferences } =
    usePurchaseAlerts();

  const filtered = useMemo(() => {
    return alerts.filter(a => {
      if (severityFilter !== "todos" && a.severity !== severityFilter) return false;
      if (statusFilter === "ativos") {
        return !["resolvido", "silenciado"].includes(a.status);
      }
      if (statusFilter === "nao_lido") return a.status === "nao_lido";
      if (statusFilter === "resolvido") return a.status === "resolvido";
      return true;
    });
  }, [alerts, severityFilter, statusFilter]);

  const isMuted = prefs.mutedUntil && new Date(prefs.mutedUntil) > new Date();

  function handleMute(duration: string) {
    const now = new Date();
    let mutedUntil: string | null = null;
    if (duration === "15m") mutedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    else if (duration === "1h") mutedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    else if (duration === "4h") mutedUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    else if (duration === "amanha") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      mutedUntil = tomorrow.toISOString();
    }
    savePreferences({ mutedUntil });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg relative"
          title="Central de Notificações de Compras"
        >
          {isMuted ? (
            <BellOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1",
                "rounded-full text-[9px] font-bold leading-none flex items-center justify-center",
                "bg-red-500 text-white ring-2 ring-background"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">
              Alertas de Compras
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">
                  {unreadCount} novos
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              {prefs.soundEnabled ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Desativar som"
                  onClick={() => savePreferences({ soundEnabled: false })}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Ativar som"
                  onClick={() => savePreferences({ soundEnabled: true })}
                >
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => markAllRead()}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Todos lidos
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="h-7 text-[11px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas severidades</SelectItem>
                <SelectItem value="critico">Críticos</SelectItem>
                <SelectItem value="importante">Importantes</SelectItem>
                <SelectItem value="info">Informativos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 text-[11px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="nao_lido">Não lidos</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isMuted && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg px-3 py-2 text-[11px]">
              <span>
                Sons silenciados até {new Date(prefs.mutedUntil!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => savePreferences({ mutedUntil: null })}
              >
                Reativar
              </Button>
            </div>
          )}

          {!isMuted && prefs.soundEnabled && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground">Silenciar por:</span>
              {["15m", "1h", "4h", "amanha"].map(d => (
                <Button
                  key={d}
                  size="sm"
                  variant="outline"
                  className="h-5 px-1.5 text-[10px]"
                  onClick={() => handleMute(d)}
                >
                  {d === "15m" ? "15min" : d === "amanha" ? "até amanhã" : d}
                </Button>
              ))}
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta encontrado</p>
                <p className="text-xs text-muted-foreground/60">
                  {statusFilter === "nao_lido" ? "Você está em dia!" : "Tente outros filtros"}
                </p>
              </div>
            ) : (
              filtered.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onMarkRead={markAsRead}
                  onStatusChange={updateStatus}
                />
              ))
            )}
          </div>
        </ScrollArea>

        <div className="px-4 py-3 border-t bg-muted/20">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{prefs.enabled ? `${filtered.length} alerta${filtered.length !== 1 ? "s" : ""}` : "Notificações desativadas"}</span>
            {prefs.enabled ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-foreground"
                onClick={() => savePreferences({ enabled: false })}
              >
                <BellOff className="h-3 w-3 mr-1" />
                Desativar
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-primary"
                onClick={() => savePreferences({ enabled: true })}
              >
                <Bell className="h-3 w-3 mr-1" />
                Reativar
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
