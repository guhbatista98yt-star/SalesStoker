import { useState } from "react";
import { Bell, BellOff, Volume2, VolumeX, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePurchaseAlerts } from "@/hooks/use-purchase-alerts";
import { useToast } from "@/hooks/use-toast";

export function PurchaseAlertPreferences() {
  const { prefs, savePreferences, isSavingPrefs } = usePurchaseAlerts();
  const { toast } = useToast();

  const [localPrefs, setLocalPrefs] = useState({
    enabled: prefs.enabled,
    soundEnabled: prefs.soundEnabled,
    onlyCriticalSound: prefs.onlyCriticalSound,
  });

  const isMuted = prefs.mutedUntil && new Date(prefs.mutedUntil) > new Date();

  function handleMute(duration: string) {
    const now = new Date();
    let mutedUntil: string | null = null;
    if (duration === "none") {
      mutedUntil = null;
    } else if (duration === "15m") {
      mutedUntil = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    } else if (duration === "1h") {
      mutedUntil = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (duration === "4h") {
      mutedUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    } else if (duration === "amanha") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0);
      mutedUntil = tomorrow.toISOString();
    }
    savePreferences({ mutedUntil });
    toast({
      title: mutedUntil ? "Sons silenciados" : "Sons reativados",
      description: mutedUntil ? `Até ${new Date(mutedUntil).toLocaleString("pt-BR")}` : "Notificações sonoras reativadas.",
    });
  }

  function handleSave() {
    savePreferences(localPrefs);
    toast({ title: "Preferências salvas", description: "Suas configurações de alertas foram atualizadas." });
  }

  const muteCurrentValue = isMuted ? "ativo" : "none";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Alertas de Compras
        </CardTitle>
        <CardDescription>
          Configure como você recebe alertas do módulo de compras.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Receber notificações</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Alertas de estoque baixo, cotações e fornecedores.
            </p>
          </div>
          <Switch
            checked={localPrefs.enabled}
            onCheckedChange={v => setLocalPrefs(p => ({ ...p, enabled: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Sons de alerta</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toca um áudio ao receber novos alertas.
            </p>
          </div>
          <Switch
            checked={localPrefs.soundEnabled}
            disabled={!localPrefs.enabled}
            onCheckedChange={v => setLocalPrefs(p => ({ ...p, soundEnabled: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Som apenas para críticos</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toca som somente para alertas críticos.
            </p>
          </div>
          <Switch
            checked={localPrefs.onlyCriticalSound}
            disabled={!localPrefs.enabled || !localPrefs.soundEnabled}
            onCheckedChange={v => setLocalPrefs(p => ({ ...p, onlyCriticalSound: v }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Silenciar sons temporariamente</Label>
          <Select
            value={muteCurrentValue}
            onValueChange={handleMute}
            disabled={!localPrefs.enabled || !localPrefs.soundEnabled}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {isMuted ? `Reativar (silenciado até ${new Date(prefs.mutedUntil!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })})` : "Não silenciar"}
              </SelectItem>
              <SelectItem value="15m">Silenciar por 15 minutos</SelectItem>
              <SelectItem value="1h">Silenciar por 1 hora</SelectItem>
              <SelectItem value="4h">Silenciar por 4 horas</SelectItem>
              <SelectItem value="amanha">Silenciar até amanhã (8h)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={isSavingPrefs} className="w-full" size="sm">
          {isSavingPrefs ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar preferências
        </Button>
      </CardContent>
    </Card>
  );
}
