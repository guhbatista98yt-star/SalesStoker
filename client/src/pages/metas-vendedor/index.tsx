import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, LayoutDashboard } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";

import AcompanhamentoTab from "./acompanhamento";
import DtrAmancoTab from "./dtr-amanco";
import TvAmancoTab from "./tv-amanco";
import TintasElitTab from "./tintas-elit";

const ALL_TABS = [
  { value: "acompanhamento", flagKey: "showAcompanhamentoTab", defaultVisible: false },
  { value: "dtr-amanco", flagKey: "showDtrAmancoTab", defaultVisible: true },
  { value: "tv-amanco", flagKey: "showTvAmancoTab", defaultVisible: true },
  { value: "tintas-elit", flagKey: "showTintasElitTab", defaultVisible: true },
] as const;

type TabValue = typeof ALL_TABS[number]["value"];

function getTabFromPath(path: string, validTabs: string[]): TabValue {
  const segment = path.split("/").filter(Boolean).pop() ?? "";
  return (validTabs.includes(segment) ? segment : validTabs[0]) as TabValue;
}

export default function MetasVendedor() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: settingAcomp } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showAcompanhamentoTab"], staleTime: 30_000 });
  const { data: settingDtr } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showDtrAmancoTab"], staleTime: 30_000 });
  const { data: settingTv } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTvAmancoTab"], staleTime: 30_000 });
  const { data: settingElit } = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTintasElitTab"], staleTime: 30_000 });

  const settingMap: Record<string, string | null | undefined> = {
    showAcompanhamentoTab: settingAcomp?.value,
    showDtrAmancoTab: settingDtr?.value,
    showTvAmancoTab: settingTv?.value,
    showTintasElitTab: settingElit?.value,
  };

  function isVisible(tab: typeof ALL_TABS[number]): boolean {
    const val = settingMap[tab.flagKey];
    if (val === null || val === undefined) return tab.defaultVisible;
    return val === "true";
  }

  const visibleTabs = ALL_TABS.filter(isVisible);
  const validTabValues = visibleTabs.map((tab) => tab.value);
  const activeTab = getTabFromPath(location, validTabValues.length > 0 ? validTabValues : ["dtr-amanco"]);

  useEffect(() => {
    if (user?.role === "vendedor" && location === "/metas-vendedor" && visibleTabs.length > 0) {
      setLocation(`/metas-vendedor/${activeTab}`);
    }
  }, [activeTab, location, setLocation, user?.role, visibleTabs.length]);

  function handleTabChange(tab: string) {
    setLocation(`/metas-vendedor/${tab}`);
  }

  if (!user || user.role !== "vendedor") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">Apenas vendedores podem acessar este modulo.</p>
          </div>
        </div>
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8" style={{ backgroundColor: "#EBF7FB" }}>
        <div className="text-center flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <LayoutDashboard className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Nenhuma campanha ativa</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde a ativacao de campanhas pelo administrador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" style={{ backgroundColor: "#EBF7FB" }}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full">
        {isVisible(ALL_TABS[0]) && (
          <TabsContent value="acompanhamento" className="m-0 h-full focus-visible:outline-none focus-visible:ring-0">
            <AcompanhamentoTab />
          </TabsContent>
        )}
        {isVisible(ALL_TABS[1]) && (
          <TabsContent value="dtr-amanco" className="m-0 h-full focus-visible:outline-none focus-visible:ring-0">
            <DtrAmancoTab />
          </TabsContent>
        )}
        {isVisible(ALL_TABS[2]) && (
          <TabsContent value="tv-amanco" className="m-0 h-full focus-visible:outline-none focus-visible:ring-0">
            <TvAmancoTab />
          </TabsContent>
        )}
        {isVisible(ALL_TABS[3]) && (
          <TabsContent value="tintas-elit" className="m-0 h-full focus-visible:outline-none focus-visible:ring-0">
            <TintasElitTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
