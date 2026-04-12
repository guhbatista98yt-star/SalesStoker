import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, LayoutDashboard, TrendingUp, Calendar, PaintBucket } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

import AcompanhamentoTab from "./acompanhamento";
import DtrAmancoTab from "./dtr-amanco";
import TvAmancoTab from "./tv-amanco";
import TintasElitTab from "./tintas-elit";

const TABS = [
  { value: "acompanhamento", label: "Acompanhamento", short: "Geral",  icon: LayoutDashboard },
  { value: "dtr-amanco",     label: "DTR Amanco",      short: "DTR",   icon: TrendingUp },
  { value: "tv-amanco",      label: "TV Amanco",        short: "TV",    icon: Calendar },
  { value: "tintas-elit",    label: "Tintas Elit",      short: "Elit",  icon: PaintBucket },
] as const;

type TabValue = typeof TABS[number]["value"];
const VALID_TABS = TABS.map(t => t.value) as string[];

function getTabFromPath(path: string): TabValue {
  const segment = path.split("/").filter(Boolean).pop() ?? "";
  return (VALID_TABS.includes(segment) ? segment : "acompanhamento") as TabValue;
}

export default function MetasVendedor() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

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

  const activeTab = getTabFromPath(location);

  function handleTabChange(tab: string) {
    setLocation(`/metas-vendedor/${tab}`);
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
          {/* Tab bar — scrollable on mobile */}
          <div className="overflow-x-auto pb-0.5 -mx-1 px-1">
            <TabsList className="inline-flex w-max sm:w-full h-auto bg-card border border-border shadow-sm rounded-xl p-1 gap-0.5">
              {TABS.map(tab => {
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

          {/* Tab content */}
          <div className="mt-4">
            <TabsContent value="acompanhamento" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <AcompanhamentoTab />
            </TabsContent>
            <TabsContent value="dtr-amanco" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <DtrAmancoTab />
            </TabsContent>
            <TabsContent value="tv-amanco" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <TvAmancoTab />
            </TabsContent>
            <TabsContent value="tintas-elit" className="m-0 focus-visible:outline-none focus-visible:ring-0">
              <TintasElitTab />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
