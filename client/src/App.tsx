import { Switch, Route, Redirect, useLocation, Link } from "wouter";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut, Loader2, KeyRound, LayoutDashboard, Users, Target, Bell,
  BarChart3, TrendingUp, Settings, ChevronDown,
} from "lucide-react";
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
import CampanhasList from "@/pages/campanhas/index";
import CampaignForm from "@/pages/campanhas/form";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Guards ──────────────────────────────────────────────────────────────────── */
function VendedorGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || user.role !== "vendedor") {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-lg font-medium">Acesso restrito a vendedores.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function CampaignPage({ children }: { children: React.ReactNode }) {
  return (
    <VendedorGuard>
      <div className="h-full overflow-auto bg-background pt-2 pb-20 sm:pb-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6">
          {children}
        </div>
      </div>
    </VendedorGuard>
  );
}

function getInitialRoute(role?: string): string {
  switch (role) {
    case "loja":     return "/analises/visao-em-loja";
    case "vendedor": return "/metas-vendedor/dtr-amanco";
    default:         return "/";
  }
}

/* ── Router ──────────────────────────────────────────────────────────────────── */
function Router() {
  const { user } = useAuth();
  const role = user?.role;
  const initialRoute = getInitialRoute(role);

  return (
    <Switch>
      <Route path="/" component={role === "admin" || role === "supervisor" ? Dashboard : () => <Redirect to={initialRoute} />} />
      <Route path="/vendedores" component={Vendedores} />
      <Route path="/metas" component={Metas} />
      <Route path="/alertas" component={Alertas} />
      <Route path="/semanal" component={Semanal} />
      <Route path="/mensal" component={Mensal} />
      <Route path="/configuracoes" component={Configuracoes} />
      <Route path="/metas-vendedor" component={() => <Redirect to="/metas-vendedor/dtr-amanco" />} />
      <Route path="/metas-vendedor/dtr-amanco" component={() => <CampaignPage><DtrAmancoTab /></CampaignPage>} />
      <Route path="/metas-vendedor/tv-amanco" component={() => <CampaignPage><TvAmancoTab /></CampaignPage>} />
      <Route path="/metas-vendedor/tintas-elit" component={() => <CampaignPage><TintasElitTab /></CampaignPage>} />
      <Route path="/analises/visao-em-loja" component={VisaoEmLoja} />
      <Route path="/tv" component={TVDashboard} />
      <Route path="/campanhas" component={CampanhasList} />
      <Route path="/campanhas/nova" component={() => <CampaignForm />} />
      <Route path="/campanhas/:id/editar" component={(params: { id: string }) => <CampaignForm campaignId={params.id} />} />
      <Route path="/campanhas/:id" component={(params: { id: string }) => <CampaignForm campaignId={params.id} />} />
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

/* ── Mobile Bottom Navigation ─────────────────────────────────────────────────── */
function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.role;

  if (role === "loja" || role === "vendedor") return null;

  const items = [
    { label: "Dashboard",  href: "/",          icon: LayoutDashboard, match: (p: string) => p === "/" },
    { label: "Vendedores", href: "/vendedores", icon: Users,           match: (p: string) => p.startsWith("/vendedores") },
    { label: "Metas",      href: "/metas",      icon: Target,          match: (p: string) => p.startsWith("/metas") },
    { label: "Análises",   href: "/semanal",    icon: BarChart3,       match: (p: string) => p.startsWith("/semanal") || p.startsWith("/mensal") },
    { label: "Alertas",    href: "/alertas",    icon: Bell,            match: (p: string) => p.startsWith("/alertas") },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {items.map(item => {
          const active = item.match(location);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl min-w-[52px] transition-all duration-150",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className={cn("text-[9px] font-medium leading-none", active ? "text-primary" : "text-muted-foreground")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Top Header ───────────────────────────────────────────────────────────────── */
function TopHeader() {
  const { user, logout } = useAuth();

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : user?.email?.slice(0, 2).toUpperCase() || "U";

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName[0] + "." : ""}`
    : user?.email || "Usuário";

  return (
    <header className="flex h-14 items-center justify-between gap-3 px-3 sm:px-5 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 shrink-0">
      {/* Left: sidebar trigger */}
      <div className="flex items-center gap-2">
        <SidebarTrigger
          data-testid="button-sidebar-toggle"
          className="h-8 w-8 rounded-lg hover:bg-muted transition-colors"
        />
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <ThemeToggle />

        <ChangePasswordDialog>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" title="Alterar Senha">
            <KeyRound className="h-4 w-4" />
          </Button>
        </ChangePasswordDialog>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 px-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-xs font-medium text-foreground">
                {displayName}
              </span>
              <ChevronDown className="hidden sm:block h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-panel">
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-medium truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ChangePasswordDialog>
              <DropdownMenuItem asChild>
                <button className="w-full flex items-center gap-2 cursor-pointer">
                  <KeyRound className="h-3.5 w-3.5" />
                  Alterar Senha
                </button>
              </DropdownMenuItem>
            </ChangePasswordDialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              data-testid="button-logout"
              className="text-red-600 dark:text-red-400 focus:text-red-600 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

/* ── Authenticated Shell ──────────────────────────────────────────────────────── */
function AuthenticatedApp() {
  const { user } = useAuth();
  const isLoja = user?.role === "loja";

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

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

        <div className="flex flex-col flex-1 overflow-hidden h-full min-w-0">
          <TopHeader />
          <main className="flex-1 overflow-hidden h-full relative pb-16 md:pb-0">
            <Router />
          </main>
        </div>
      </div>
      <MobileBottomNav />
    </SidebarProvider>
  );
}

/* ── Root ────────────────────────────────────────────────────────────────────── */
function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
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
