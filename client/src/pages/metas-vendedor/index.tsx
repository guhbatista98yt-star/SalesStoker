import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LayoutDashboard, TrendingUp, Calendar, PaintBucket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

import AcompanhamentoTab from "./acompanhamento";
import DtrAmancoTab from "./dtr-amanco";
import TvAmancoTab from "./tv-amanco";
import TintasElitTab from "./tintas-elit";

const ALL_TABS = [
  { value: "acompanhamento", label: "Acompanhamento", short: "Geral",  icon: LayoutDashboard, flagKey: "showAcompanhamentoTab", defaultVisible: false },
  { value: "dtr-amanco",     label: "DTR Amanco",      short: "DTR",   icon: TrendingUp,       flagKey: "showDtrAmancoTab",      defaultVisible: true  },
  { value: "tv-amanco",      label: "TV Amanco",        short: "TV",    icon: Calendar,         flagKey: "showTvAmancoTab",       defaultVisible: true  },
  { value: "tintas-elit",    label: "Tintas Elit",      short: "Elit",  icon: PaintBucket,      flagKey: "showTintasElitTab",     defaultVisible: true  },
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
  const { data: settingDtr }   = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showDtrAmancoTab"],      staleTime: 30_000 });
  const { data: settingTv }    = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTvAmancoTab"],        staleTime: 30_000 });
  const { data: settingElit }  = useQuery<{ key: string; value: string | null }>({ queryKey: ["/api/app-settings/showTintasElitTab"],      staleTime: 30_000 });

  if (!user || user.role !== "vendedor") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">Apenas vendedores podem acessar este módulo.</p>
          </div>
        </div>
      </div>
    );
  }

  const settingMap: Record<string, string | null | undefined> = {
    showAcompanhamentoTab: settingAcomp?.value,
    showDtrAmancoTab:      settingDtr?.value,
    showTvAmancoTab:       settingTv?.value,
    showTintasElitTab:     settingElit?.value,
  };

  function isVisible(tab: typeof ALL_TABS[number]): boolean {
    const val = settingMap[tab.flagKey];
    if (val === null || val === undefined) return tab.defaultVisible;
    return val === "true";
  }

  const visibleTabs = ALL_TABS.filter(isVisible);
  const validTabValues = visibleTabs.map(t => t.value) as string[];
  const activeTab = getTabFromPath(location, validTabValues.length > 0 ? validTabValues : ["dtr-amanco"]);

  function handleTabChange(tab: string) {
    setLocation(`/metas-vendedor/${tab}`);
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center flex flex-col items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
            <LayoutDashboard className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Nenhuma campanha ativa</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde a ativação de campanhas pelo administrador.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Minhas Metas e Campanhas
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe seus resultados e performance em tempo real
          </p>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
            <TabsList className="inline-flex w-max sm:w-full h-auto bg-card border border-border shadow-sm rounded-xl p-1 gap-0.5">
              {visibleTabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex items-center gap-2 h-9 px-3 text-sm font-medium rounded-lg transition-all
                      data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm
                      data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground
                      whitespace-nowrap flex-shrink-0 sm:flex-1 sm:justify-center"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.short}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="mt-4">
            {isVisible(ALL_TABS[0]) && (
              <TabsContent value="acompanhamento" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <AcompanhamentoTab />
              </TabsContent>
            )}
            {isVisible(ALL_TABS[1]) && (
              <TabsContent value="dtr-amanco" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <DtrAmancoTab />
              </TabsContent>
            )}
            {isVisible(ALL_TABS[2]) && (
              <TabsContent value="tv-amanco" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <TvAmancoTab />
              </TabsContent>
            )}
            {isVisible(ALL_TABS[3]) && (
              <TabsContent value="tintas-elit" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                <TintasElitTab />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
