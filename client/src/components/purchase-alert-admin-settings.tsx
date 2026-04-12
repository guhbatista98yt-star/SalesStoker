import { useState, useEffect } from "react";
import { Settings, Save, Loader2, Bell, Clock, Volume2, Database, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface PurchaseSettings {
  alerts_enabled: string;
  cooldown_minutes: string;
  min_severity_sound: string;
  repetition_window_hours: string;
  grouping_policy: string;
  expiration_hours: string;
  retention_days: string;
}

const defaults: PurchaseSettings = {
  alerts_enabled: "true",
  cooldown_minutes: "60",
  min_severity_sound: "importante",
  repetition_window_hours: "24",
  grouping_policy: "by_type",
  expiration_hours: "168",
  retention_days: "90",
};

export function PurchaseAlertAdminSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<PurchaseSettings>({
    queryKey: ["/api/compras/configuracoes"],
  });

  const [local, setLocal] = useState<PurchaseSettings>(defaults);

  useEffect(() => {
    if (data) setLocal({ ...defaults, ...data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (settings: PurchaseSettings) =>
      apiRequest("PUT", "/api/compras/configuracoes", settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compras/configuracoes"] });
      toast({ title: "Configurações salvas", description: "Parâmetros globais de alertas atualizados." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível salvar as configurações.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Carregando configurações...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings className="h-4 w-4" />
          Configuração Global de Alertas de Compras
        </CardTitle>
        <CardDescription>
          Parâmetros administrativos do sistema de alertas. Afetam todos os usuários.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Sistema de alertas habilitado</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Habilita ou desabilita todos os alertas de compras globalmente.
            </p>
          </div>
          <Switch
            checked={local.alerts_enabled === "true"}
            onCheckedChange={v => setLocal(p => ({ ...p, alerts_enabled: v ? "true" : "false" }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Cooldown (minutos)
            </Label>
            <Input
              type="number"
              min={1}
              max={1440}
              value={local.cooldown_minutes}
              onChange={e => setLocal(p => ({ ...p, cooldown_minutes: e.target.value }))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Tempo mínimo entre alertas do mesmo tipo/referência.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              Criticidade mínima para som
            </Label>
            <Select
              value={local.min_severity_sound}
              onValueChange={v => setLocal(p => ({ ...p, min_severity_sound: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Informativo (todos)</SelectItem>
                <SelectItem value="importante">Importante e acima</SelectItem>
                <SelectItem value="critico">Apenas críticos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Janela de repetição (horas)
            </Label>
            <Input
              type="number"
              min={1}
              max={168}
              value={local.repetition_window_hours}
              onChange={e => setLocal(p => ({ ...p, repetition_window_hours: e.target.value }))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Período em que um alerta pode ser reaberto automaticamente.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Política de agrupamento</Label>
            <Select
              value={local.grouping_policy}
              onValueChange={v => setLocal(p => ({ ...p, grouping_policy: v }))}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="by_type">Por tipo</SelectItem>
                <SelectItem value="by_severity">Por criticidade</SelectItem>
                <SelectItem value="none">Sem agrupamento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Expiração de alerta (horas)
            </Label>
            <Input
              type="number"
              min={1}
              max={8760}
              value={local.expiration_hours}
              onChange={e => setLocal(p => ({ ...p, expiration_hours: e.target.value }))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Alertas não resolvidos expiram após este período.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5" />
              Retenção de histórico (dias)
            </Label>
            <Input
              type="number"
              min={7}
              max={365}
              value={local.retention_days}
              onChange={e => setLocal(p => ({ ...p, retention_days: e.target.value }))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Alertas resolvidos/lidos são excluídos após este período.
            </p>
          </div>
        </div>

        <Button
          onClick={() => saveMutation.mutate(local)}
          disabled={saveMutation.isPending}
          className="w-full"
          size="sm"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar configurações globais
        </Button>
      </CardContent>
    </Card>
  );
}
