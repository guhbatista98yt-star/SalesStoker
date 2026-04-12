import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, User, Edit2, Play, Pause, StopCircle, XCircle, Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignAuditEntry } from "../types";

const ACTION_META: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  criado:        { label: "Criado",      color: "text-blue-600",   Icon: Edit2 },
  atualizado:    { label: "Atualizado",  color: "text-zinc-600",   Icon: Edit2 },
  ativado:       { label: "Ativado",     color: "text-green-600",  Icon: Play },
  pausado:       { label: "Pausado",     color: "text-yellow-600", Icon: Pause },
  encerrado:     { label: "Encerrado",   color: "text-blue-600",   Icon: StopCircle },
  cancelado:     { label: "Cancelado",   color: "text-red-600",    Icon: XCircle },
  clonado:       { label: "Clonado",     color: "text-violet-600", Icon: Copy },
  versionado:    { label: "Versionado",  color: "text-indigo-600", Icon: Edit2 },
  restaurado:    { label: "Restaurado",  color: "text-teal-600",   Icon: RotateCcw },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function DiffView({ prev, next }: { prev: any; next: any }) {
  if (!prev && !next) return null;
  const keys = Array.from(new Set([
    ...Object.keys(prev || {}),
    ...Object.keys(next || {}),
  ])).filter(k => !["targets", "conditions", "triggers", "rewards", "limits", "exceptions"].includes(k));

  const changed = keys.filter(k => JSON.stringify((prev || {})[k]) !== JSON.stringify((next || {})[k]));
  if (changed.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground pl-2 border-l border-zinc-200 dark:border-zinc-700">
      {changed.map(k => (
        <div key={k}>
          <span className="font-medium">{k}:</span>{" "}
          <span className="line-through text-red-400">{JSON.stringify((prev || {})[k])}</span>
          {" → "}
          <span className="text-green-500">{JSON.stringify((next || {})[k])}</span>
        </div>
      ))}
    </div>
  );
}

interface AuditLogProps {
  campaignId: string;
}

export function AuditLog({ campaignId }: AuditLogProps) {
  const { data, isLoading } = useQuery<CampaignAuditEntry[]>({
    queryKey: [`/api/campaigns/${campaignId}/audit`],
    enabled: Boolean(campaignId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma entrada no histórico.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((entry, idx) => {
        const meta = ACTION_META[entry.action] || { label: entry.action, color: "text-muted-foreground", Icon: Edit2 };
        const { Icon } = meta;
        const prev = entry.prev_values ? (typeof entry.prev_values === "string" ? JSON.parse(entry.prev_values) : entry.prev_values) : null;
        const next = entry.new_values ? (typeof entry.new_values === "string" ? JSON.parse(entry.new_values) : entry.new_values) : null;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={cn("rounded-full p-1.5 bg-muted border", meta.color)}>
                <Icon className="h-3 w-3" />
              </div>
              {idx < data.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
            </div>

            <div className="pb-4 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("text-xs font-semibold", meta.color)}>{meta.label}</span>
                <Badge variant="outline" className="text-[10px] py-0 h-4 gap-1">
                  <User className="h-2.5 w-2.5" /> {entry.actor}
                </Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDate(entry.created_at)}
                </span>
              </div>

              {entry.change_reason && (
                <p className="text-xs text-muted-foreground mt-0.5 italic">
                  Motivo: {entry.change_reason}
                </p>
              )}

              <DiffView prev={prev} next={next} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
