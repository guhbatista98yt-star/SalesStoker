import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { playAlertSound, severityToSoundType } from "@/lib/purchase-sounds";

export interface PurchaseAlert {
  id: string;
  userId: number;
  type: string;
  referenceKey: string;
  severity: "critico" | "importante" | "info";
  title: string;
  message: string;
  status: "nao_lido" | "lido" | "reconhecido" | "adiado" | "silenciado" | "resolvido" | "reaberto";
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AlertPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  onlyCriticalSound: boolean;
  mutedUntil: string | null;
}

export function usePurchaseAlerts() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const sseRef = useRef<EventSource | null>(null);

  const { data: prefsData } = useQuery<AlertPreferences>({
    queryKey: ["/api/compras/preferencias"],
    enabled: !!token,
  });

  const prefs: AlertPreferences = prefsData ?? {
    enabled: true,
    soundEnabled: true,
    onlyCriticalSound: false,
    mutedUntil: null,
  };

  const { data: alertsData, isLoading } = useQuery<{
    alerts: PurchaseAlert[];
    total: number;
    unreadCount: number;
  }>({
    queryKey: ["/api/compras/alertas"],
    enabled: !!token && prefs.enabled,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (alertsData?.unreadCount !== undefined) {
      setUnreadCount(alertsData.unreadCount);
    }
  }, [alertsData?.unreadCount]);

  const connectSSE = useCallback(() => {
    if (!token || !prefs.enabled) return;
    if (sseRef.current) return;

    const url = `/api/compras/sse`;
    const es = new EventSource(url + `?token=${encodeURIComponent(token)}`);

    es.addEventListener("connected", () => {
      console.log("[PurchaseAlerts] SSE connected");
    });

    es.addEventListener("purchase_alert", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);

        setUnreadCount(prev => prev + 1);
        queryClient.invalidateQueries({ queryKey: ["/api/compras/alertas"] });

        if (data.playSound && prefs.enabled) {
          const soundType = severityToSoundType(data.severity);
          playAlertSound(soundType, {
            soundEnabled: prefs.soundEnabled,
            onlyCriticalSound: prefs.onlyCriticalSound,
            mutedUntil: prefs.mutedUntil,
          });
        }
      } catch (err) {
        console.error("[PurchaseAlerts] Error handling SSE event:", err);
      }
    });

    es.onerror = () => {
      es.close();
      sseRef.current = null;
      setTimeout(() => {
        if (token && prefs.enabled) connectSSE();
      }, 5000);
    };

    sseRef.current = es;
  }, [token, prefs.enabled, prefs.soundEnabled, prefs.onlyCriticalSound, prefs.mutedUntil, queryClient]);

  useEffect(() => {
    if (!token || !prefs.enabled) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    connectSSE();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [token, prefs.enabled, connectSSE]);

  const markAsReadMutation = useMutation({
    mutationFn: (alertId: string) =>
      apiRequest("PATCH", `/api/compras/alertas/${alertId}/status`, { status: "lido" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras/alertas"] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ alertId, status }: { alertId: string; status: string }) =>
      apiRequest("PATCH", `/api/compras/alertas/${alertId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras/alertas"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/compras/alertas/marcar-todos-lidos", {}),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ["/api/compras/alertas"] });
    },
  });

  const savePreferencesMutation = useMutation({
    mutationFn: (prefs: Partial<AlertPreferences>) =>
      apiRequest("PUT", "/api/compras/preferencias", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras/preferencias"] });
    },
  });

  return {
    alerts: alertsData?.alerts ?? [],
    total: alertsData?.total ?? 0,
    unreadCount,
    isLoading,
    prefs,
    markAsRead: (alertId: string) => markAsReadMutation.mutate(alertId),
    updateStatus: (alertId: string, status: string) => updateStatusMutation.mutate({ alertId, status }),
    markAllRead: () => markAllReadMutation.mutate(),
    savePreferences: (p: Partial<AlertPreferences>) => savePreferencesMutation.mutate(p),
    isSavingPrefs: savePreferencesMutation.isPending,
  };
}
