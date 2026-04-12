import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanySelector } from "@/components/dashboard/company-selector";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { Bell, Settings, AlertTriangle, Info, AlertCircle, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Company, Alert, AlertNotification } from "@shared/schema";

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

export default function Alertas() {
  const [companyId, setCompanyId] = useState<string>("1");
  const [tab, setTab] = useState<"notifications" | "config">("notifications");

  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<AlertNotification[]>({
    queryKey: ["/api/alerts", companyId],
  });

  const { data: alertConfigs = [], isLoading: configsLoading } = useQuery<Alert[]>({
    queryKey: ["/api/alert-configs", companyId],
  });

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
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
              <p className="text-sm text-muted-foreground">
                Notificações e configurações de alertas
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <CompanySelector
                companies={companies}
                selectedId={companyId}
                onChange={setCompanyId}
                loading={companiesLoading}
              />
            </div>
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
                  <Button size="sm" data-testid="button-add-alert-rule">
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
                            Limite: {config.threshold}%
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
    </div>
  );
}
