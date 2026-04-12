import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Loader2, KeyRound } from "lucide-react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Vendedores from "@/pages/vendedores";
import Metas from "@/pages/metas";
import Alertas from "@/pages/alertas";
import Semanal from "@/pages/semanal";
import Mensal from "@/pages/mensal";
import Configuracoes from "@/pages/configuracoes";
import LandingPage from "@/pages/landing";
import VisaoEmLoja from "@/pages/visao-em-loja";
import TVDashboard from "@/pages/tv-dashboard";
import DtrAmancoTab from "@/pages/metas-vendedor/dtr-amanco";
import TvAmancoTab from "@/pages/metas-vendedor/tv-amanco";
import TintasElitTab from "@/pages/metas-vendedor/tintas-elit";
import AdminGatilhos from "@/pages/metas/admin-gatilhos";
import AdminReports from "@/pages/metas/admin-reports";
import CampanhasList from "@/pages/campanhas/index";
import CampaignForm from "@/pages/campanhas/form";

// Wrapper para páginas de campanha com layout e acesso de vendedor
import { AlertCircle } from "lucide-react";
import { useAuth as useAuthCtx } from "@/lib/auth-context";

function VendedorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthCtx();
  if (!user || user.role !== "vendedor") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg">Acesso negado. Apenas vendedores podem acessar este módulo.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function CampaignPage({ children }: { children: React.ReactNode }) {
  return (
    <VendedorGuard>
      <div className="h-full overflow-auto bg-gray-50/50 dark:bg-zinc-950/50 pt-2 pb-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6">
          {children}
        </div>
      </div>
    </VendedorGuard>
  );
}

// Resolve a rota inicial permitida com base no role do usuário
function getInitialRoute(role?: string): string {
  switch (role) {
    case "loja":     return "/analises/visao-em-loja";
    case "vendedor": return "/metas-vendedor/dtr-amanco";
    default:         return "/";
  }
}

function Router() {
  const { user } = useAuth();
  const role = user?.role;
  const initialRoute = getInitialRoute(role);

  return (
    <Switch>
      {/* Raiz: redireciona conforme role */}
      <Route path="/" component={role === "admin" || role === "supervisor" ? Dashboard : () => <Redirect to={initialRoute} />} />

      {/* Rotas para admin/supervisor */}
      <Route path="/vendedores" component={Vendedores} />
      <Route path="/metas" component={Metas} />
      <Route path="/alertas" component={Alertas} />
      <Route path="/semanal" component={Semanal} />
      <Route path="/mensal" component={Mensal} />
      <Route path="/configuracoes" component={Configuracoes} />

      {/* Rotas de campanhas — VendedorGuard verifica o role internamente */}
      <Route path="/metas-vendedor" component={() => <Redirect to="/metas-vendedor/dtr-amanco" />} />
      <Route path="/metas-vendedor/dtr-amanco" component={() => <CampaignPage><DtrAmancoTab /></CampaignPage>} />
      <Route path="/metas-vendedor/tv-amanco" component={() => <CampaignPage><TvAmancoTab /></CampaignPage>} />
      <Route path="/metas-vendedor/tintas-elit" component={() => <CampaignPage><TintasElitTab /></CampaignPage>} />

      {/* Visão em Loja — acessada por loja e admin */}
      <Route path="/analises/visao-em-loja" component={VisaoEmLoja} />
      <Route path="/tv" component={TVDashboard} />

      {/* Módulo de Campanhas Comerciais */}
      <Route path="/campanhas" component={CampanhasList} />
      <Route path="/campanhas/nova" component={() => <CampaignForm />} />
      <Route path="/campanhas/:id/editar" component={(params: { id: string }) => <CampaignForm campaignId={params.id} />} />
      <Route path="/campanhas/:id" component={(params: { id: string }) => <CampaignForm campaignId={params.id} />} />

      {/* Rotas exclusivas de admin — redirecionam para Configurações */}
      {(role === "admin" || role === "supervisor") && (
        <>
          <Route path="/admin/gatilhos" component={() => <Redirect to="/configuracoes" />} />
          <Route path="/admin/relatorios" component={() => <Redirect to="/configuracoes" />} />
        </>
      )}

      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, logout } = useAuth();
  const isLoja = user?.role === "loja";
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  // Usuário loja: fullscreen sem sidebar/header
  if (isLoja) {
    return (
      <SidebarProvider style={sidebarStyle as React.CSSProperties} defaultOpen={false}>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden h-full">
            <main className="flex-1 overflow-hidden h-full relative">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden h-full">
          <header className="flex h-14 items-center justify-between gap-4 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-muted-foreground">
                  {user?.firstName || user?.email || "Usuário"}
                </span>
              </div>
              <ChangePasswordDialog>
                <Button variant="ghost" size="icon" title="Alterar Senha">
                  <KeyRound className="h-4 w-4" />
                </Button>
              </ChangePasswordDialog>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                data-testid="button-logout"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-hidden h-full relative">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
