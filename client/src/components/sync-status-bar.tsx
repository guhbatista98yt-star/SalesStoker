/**
 * SyncStatusBar — indicador de sincronização com ERP.
 *
 * Idle:   ✓ Atualizado às 19:18 (5 min)   [↻]
 * Sync:   ⟳ Processando… 8:18 · ~2 min restantes
 *            [████████████░░░░] 78%
 *
 * O tempo decorrido usa updated_at do servidor — correto mesmo após
 * navegação ou reload da página. A previsão vem do histórico real
 * de duração das últimas execuções (sync_logs) retornado pela API.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/* ── Mapeamentos ────────────────────────────────────────────────────────────── */

const STATE_NAME: Record<string, string> = {
  vendas:           "cache_vendas",
  campanhas:        "cache_campanhas",
  tubos:            "cache_tubos_conexoes",
  contas_receber:   "contas_receber",
  pendentes:        "cache_vendas_pendentes",
  estoque_sugestao: "cache_estoque_sugestao",
};

// Fallback de duração estimada (segundos) se não houver histórico no banco
const FALLBACK_ETA: Record<string, number> = {
  vendas: 300, campanhas: 180, tubos: 180,
  contas_receber: 60, pendentes: 30, estoque_sugestao: 90,
};

// Fases baseadas na FRAÇÃO do tempo estimado total (0–1)
const PHASES: Array<{ upTo: number; msg: string }> = [
  { upTo: 0.08, msg: "Conectando ao ERP"  },
  { upTo: 0.30, msg: "Lendo dados"        },
  { upTo: 0.65, msg: "Processando"        },
  { upTo: 0.88, msg: "Gravando cache"     },
  { upTo: 1.00, msg: "Finalizando"        },
  { upTo: Infinity, msg: "Aguarde…"       },
];

/* ── Types ─────────────────────────────────────────────────────────────────── */

type SyncState = {
  routine_name: string;
  status: string;
  last_success_at: string | null;
  last_error: string | null;
  updated_at: string | null;
};

type AvgDuration = {
  routine_name: string;
  avg_ms: number;
  sample_count: number;
};

type SyncStatusResponse = {
  syncState: SyncState[];
  avgDurations?: AvgDuration[];
};

interface SyncStatusBarProps {
  routine: string;
  label?: string;
  className?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRemaining(sec: number) {
  if (sec <= 0) return null;
  if (sec < 60) return `~${sec}s`;
  const m = Math.ceil(sec / 60);
  return `~${m} min`;
}

function getPhase(fraction: number) {
  return PHASES.find(p => fraction < p.upTo)?.msg ?? "Aguarde…";
}

function formatTimeAgo(isoDate: string | null): { label: string; ageMin: number } {
  if (!isoDate) return { label: "Nunca sincronizado", ageMin: Infinity };
  const diff = Date.now() - new Date(isoDate).getTime();
  const min  = Math.floor(diff / 60_000);
  const h    = Math.floor(min / 60);
  const time = new Date(isoDate).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
  if (min < 1)  return { label: `Atualizado agora (${time})`, ageMin: 0 };
  if (min < 60) return { label: `Atualizado às ${time} (${min} min)`, ageMin: min };
  return {
    label: `Atualizado às ${time} (${h}h${min % 60 > 0 ? ` ${min % 60}min` : ""})`,
    ageMin: min,
  };
}

function FreshnessIcon({ ageMin }: { ageMin: number }) {
  if (ageMin <= 10) return <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />;
  if (ageMin <= 30) return <Clock        className="h-3 w-3 text-amber-500 shrink-0"   />;
  return               <AlertTriangle  className="h-3 w-3 text-red-500 shrink-0"     />;
}

/* ── Component ──────────────────────────────────────────────────────────────── */

export function SyncStatusBar({ routine, label, className }: SyncStatusBarProps) {
  const { user }    = useAuth();
  const isAdmin     = user?.role === "admin";
  const { toast }   = useToast();
  const queryClient = useQueryClient();

  const triggerTimeRef  = useRef<number | null>(null);
  const safetyTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks previous serverRunning to detect true→false transition after navigation
  const prevRunningRef  = useRef<boolean>(false);

  const [waitingForSync, setWaitingForSync] = useState(false);
  const [elapsedSec,     setElapsedSec]     = useState(0);

  const stateName = STATE_NAME[routine] ?? routine;

  /* ── Polling ──────────────────────────────────────────────────────────────── */
  // NOTE: refetchInterval is computed AFTER the query declaration, so we use a
  // function form so React Query evaluates it on each render.
  const [fastPollOverride, setFastPollOverride] = useState(false);

  const { data, refetch } = useQuery<SyncStatusResponse>({
    queryKey:        ["/api/sync/status"],
    // Drive interval from server state — survives page navigation
    refetchInterval: fastPollOverride ? 4_000 : 30_000,
    staleTime:       0,
  });

  const routineState  = data?.syncState?.find(s => s.routine_name === stateName);
  const serverRunning = routineState?.status === "running";
  const lastSuccess   = routineState?.last_success_at ?? null;

  // Duração média em segundos baseada no histórico real do banco
  const avgEntry = data?.avgDurations?.find(d => d.routine_name === stateName);
  const etaSec   = avgEntry && avgEntry.avg_ms > 0
    ? Math.round(avgEntry.avg_ms / 1000)
    : FALLBACK_ETA[routine] ?? 300;

  const isSyncing = waitingForSync || serverRunning;

  // Keep fast polling alive whenever sync is active (even after navigation)
  useEffect(() => {
    setFastPollOverride(isSyncing);
  }, [isSyncing]);

  /* ── Contador de tempo decorrido (baseado no servidor) ─────────────────────── */
  useEffect(() => {
    if (!isSyncing) { setElapsedSec(0); return; }

    // Tempo de início: clique do usuário OU updated_at do servidor (quando o sync
    // já estava rodando ao carregar a página ou após navegação)
    const serverStart = routineState?.updated_at
      ? new Date(routineState.updated_at).getTime()
      : null;
    const startTime = triggerTimeRef.current ?? serverStart ?? Date.now();

    // Inicializa já com o tempo real decorrido
    setElapsedSec(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));

    const interval = setInterval(() => setElapsedSec(s => s + 1), 1_000);
    return () => clearInterval(interval);
  }, [isSyncing]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Detecção de conclusão via transição serverRunning: true → false ──────── */
  // Usando transição de estado do servidor em vez de comparação de timestamps.
  // Isso sobrevive à navegação entre páginas porque não depende de estado local.
  useEffect(() => {
    const wasRunning = prevRunningRef.current;
    prevRunningRef.current = serverRunning;

    if (wasRunning && !serverRunning) {
      // Sync acabou de terminar — limpar tudo
      setWaitingForSync(false);
      triggerTimeRef.current = null;
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      queryClient.invalidateQueries({});
      toast({
        title: `${label ?? routine} sincronizado`,
        description: `Concluído em ${formatElapsed(elapsedSec)}. Dados atualizados.`,
      });
    }
  }, [serverRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!waitingForSync || serverRunning || !lastSuccess || !triggerTimeRef.current) return;

    const lastSuccessAt = new Date(lastSuccess).getTime();
    if (lastSuccessAt + 1_000 < triggerTimeRef.current) return;

    setWaitingForSync(false);
    triggerTimeRef.current = null;
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    queryClient.invalidateQueries({});
    toast({
      title: `${label ?? routine} sincronizado`,
      description: "Dados atualizados.",
    });
  }, [waitingForSync, serverRunning, lastSuccess, label, routine, queryClient, toast]);

  /* ── Limpar ao desmontar ─────────────────────────────────────────────────── */
  useEffect(() => () => {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
  }, []);

  /* ── Ação do botão ───────────────────────────────────────────────────────── */
  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    triggerTimeRef.current = Date.now();
    setWaitingForSync(true);
    setElapsedSec(0);

    // Safety: se demorar mais de 15 min sem o servidor confirmar, aborta a espera
    safetyTimerRef.current = setTimeout(() => {
      setWaitingForSync(false);
      toast({
        title: "Sync demorou demais",
        description: "Verifique os logs em Configurações → Sincronização ERP.",
        variant: "destructive",
      });
    }, 15 * 60_000);

    try {
      await apiRequest("POST", "/api/sync/trigger", { rotina: routine, force: true });
      setTimeout(() => refetch(), 1_000);
      setTimeout(() => refetch(), 3_000);
    } catch {
      setWaitingForSync(false);
      triggerTimeRef.current = null;
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
      toast({
        title: "Erro ao iniciar sync",
        description: "Verifique se você tem permissão de administrador.",
        variant: "destructive",
      });
    }
  }, [isSyncing, routine, toast, refetch]);

  /* ── Cálculos de progresso ───────────────────────────────────────────────── */
  const rawFraction  = etaSec > 0 ? elapsedSec / etaSec : 0;
  const isPastEta    = rawFraction >= 1.0;
  // Barra congela em 95% — avança para 100% só quando o servidor confirmar
  const fraction     = Math.min(rawFraction, 0.95);
  const progressPct  = Math.round(fraction * 100);
  const remainSec    = Math.max(0, etaSec - elapsedSec);
  const phase        = isPastEta ? "Aguardando servidor" : getPhase(fraction);
  const hasHistory   = !!avgEntry && avgEntry.sample_count >= 1;

  const { label: timeLabel, ageMin } = formatTimeAgo(lastSuccess);

  /* ── Render: sincronizando ───────────────────────────────────────────────── */
  if (isSyncing) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Loader2 className="h-3 w-3 animate-spin shrink-0 text-primary" />

        <div className="hidden sm:flex flex-col gap-1 min-w-[180px] max-w-[240px]">
          {/* Linha 1: fase + cronômetro + previsão */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-xs font-medium leading-none truncate",
              isPastEta ? "text-amber-500" : "text-primary",
            )}>
              {phase}…
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground leading-none shrink-0 font-mono">
              {formatElapsed(elapsedSec)}
              {!isPastEta && remainSec > 5 && (
                <span className="text-muted-foreground/70 font-sans">
                  · {formatRemaining(remainSec)} restantes{!hasHistory ? " (est.)" : ""}
                </span>
              )}
              {isPastEta && (
                <span className="text-amber-500/80 font-sans text-[10px]">
                  · além do estimado
                </span>
              )}
            </span>
          </div>

          {/* Linha 2: barra de progresso — pulsa quando passa do ETA */}
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            {isPastEta ? (
              /* Indeterminate — pulsa de ponta a ponta */
              <div className="h-full w-full relative overflow-hidden rounded-full bg-amber-500/20">
                <div className="absolute inset-y-0 w-1/3 bg-amber-500 rounded-full animate-[slide_1.4s_ease-in-out_infinite]" />
              </div>
            ) : (
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progressPct}%` }}
              />
            )}
          </div>
        </div>

        {/* Botão desabilitado */}
        {isAdmin && (
          <Button
            variant="ghost" size="sm"
            className="h-6 w-6 p-0 rounded-full opacity-40 cursor-not-allowed"
            disabled
            title="Sincronização em andamento…"
          >
            <RefreshCw className="h-3 w-3 animate-spin" />
          </Button>
        )}
      </div>
    );
  }

  /* ── Render: idle ────────────────────────────────────────────────────────── */
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <FreshnessIcon ageMin={ageMin} />
      <span className="hidden sm:inline select-none whitespace-nowrap">{timeLabel}</span>
      {isAdmin && (
        <Button
          variant="ghost" size="sm"
          className="h-6 w-6 p-0 rounded-full hover:bg-muted"
          onClick={handleSync}
          title={`Atualizar ${label ?? routine}`}
        >
          <RefreshCw className="h-3 w-3" />
          <span className="sr-only">Sincronizar {label ?? routine}</span>
        </Button>
      )}
    </div>
  );
}
