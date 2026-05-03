import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { Bell, Settings, AlertTriangle, Info, AlertCircle, Plus, Volume2, VolumeX } from "lucide-react";
import { HelpButton, HelpDrawer, HELP_CONTENT } from "@/components/help";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Company, Alert, AlertNotification } from "@shared/schema";

const POLL_INTERVAL_MS = 60 * 1000;
const SOUND_PREF_KEY = "alerts_sound_enabled";

function getAlertTypeLabel(type: string): string {
  switch (type) {
    case "yoy_queda": return "Queda YoY";
    case "ticket_baixo": return "Ticket Médio Baixo";
    case "conexoes_tubos_fora": return "Conexões/Tubos Fora do Esperado";
    case "a_faturar_anomalia": return "A Faturar Anômalo";
    default: return type;
  }
}

function getSeverityIcon(severity: "info" | "warning" | "critical") {
  switch (severity) {
    case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case "info": return <Info className="h-4 w-4 text-blue-500" />;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playAlertSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
  }
}

export default function Alertas() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [companyId, setCompanyId] = useState<string>("1");
  const [tab, setTab] = useState<"notifications" | "config">("notifications");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(SOUND_PREF_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const prevUnreadIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);
  const prevCompanyId = useRef<string>(companyId);

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  useEffect(() => {
    if (companies.length > 0 && !companies.find(c => c.id === companyId)) {
      setCompanyId(companies[0].id);
    }
  }, [companies]);

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<AlertNotification[]>({
    queryKey: ["/api/alerts", companyId],
    refetchInterval: POLL_INTERVAL_MS,
  });

  const { data: alertConfigs = [], isLoading: configsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alert-configs", companyId],
    queryFn: () => apiRequest("GET", `/api/alert-configs?companyId=${companyId}`).then(r => r.json()),
    refetchInterval: POLL_INTERVAL_MS,
  });

  useEffect(() => {
    const unread = notifications.filter(n => !n.read);
    const currentIds = new Set(unread.map(n => n.id));
    const companyChanged = prevCompanyId.current !== companyId;

    if (isFirstLoad.current || companyChanged) {
      prevUnreadIdsRef.current = currentIds;
      isFirstLoad.current = false;
      prevCompanyId.current = companyId;
      return;
    }

    const hasNew = unread.some(n => !prevUnreadIdsRef.current.has(n.id));
    if (hasNew && soundEnabled) {
      playAlertSound();
    }

    prevUnreadIdsRef.current = currentIds;
  }, [notifications, soundEnabled, companyId]);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SOUND_PREF_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/alerts/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
  });

  const toggleAlertMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiRequest("PATCH", `/api/alert-configs/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alert-configs"] });
    },
  });

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border shrink-0">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Alertas</h1>
            <HelpButton onClick={() => setHelpOpen(true)} />
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium">Notificações e configurações</span>
          </div>
          <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSound}
                title={soundEnabled ? "Desativar som" : "Ativar som"}
                className="h-8 gap-1.5 text-xs rounded-lg"
                data-testid="button-toggle-sound"
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="hidden sm:inline">
                  {soundEnabled ? "Som ativado" : "Som desativado"}
                </span>
              </Button>
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={setCompanyId}
                loading={companiesLoading}
              />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="notifications" data-testid="tab-alerts-notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notificações
              {notifications.filter(n => !n.read).length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {notifications.filter(n => !n.read).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-alerts-config">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="mt-6">
            <AlertsPanel
              alerts={notifications}
              loading={notificationsLoading}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onDismiss={(id) => dismissMutation.mutate(id)}
            />
          </TabsContent>

          <TabsContent value="config" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">Regras de Alerta</CardTitle>
                  <Button size="sm" data-testid="button-add-alert-rule" disabled>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Regra
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {configsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : alertConfigs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Settings className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma regra de alerta configurada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {alertConfigs.map((config) => (
                      <div
                        key={config.id}
                        className="flex items-center justify-between p-4 rounded-md border"
                        data-testid={`alert-config-${config.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {getSeverityIcon(config.severity)}
                          <div>
                            <p className="font-medium">
                              {getAlertTypeLabel(config.type)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {config.message}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline">
                            Limite: {config.threshold}{config.type === "ticket_baixo" ? " R$" : "%"}
                          </Badge>
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={(checked) =>
                              toggleAlertMutation.mutate({ id: config.id, enabled: checked })
                            }
                            data-testid={`switch-alert-${config.id}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP_CONTENT.alertas} />
    </div>
  );
}
