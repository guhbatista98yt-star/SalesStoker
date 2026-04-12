import { Switch, Route, Redirect, useLocation, Link } from "wouter";
import { useState, useEffect, useCallback } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { ErrorBoundary } from "@/components/error-boundary";
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
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { DialogTitle } from "@/components/ui/dialog";
import {
  LogOut, Loader2, KeyRound, LayoutDashboard, Users, Target, Bell,
  BarChart3, Settings, ChevronDown, Search, CalendarDays, CalendarRange,
  Store, AlertTriangle, Megaphone, BookOpen, DollarSign,
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
import MetasVendedorIndex from "@/pages/metas-vendedor/index";
import CampanhasList from "@/pages/campanhas/index";
import CampaignForm from "@/pages/campanhas/form";
import CampaignView from "@/pages/campanhas/view";
import Comissoes from "@/pages/comissoes/index";
import ConfigurarComissoes from "@/pages/comissoes/configurar";
import Usuarios from "@/pages/usuarios";
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

function getInitialRoute(role?: string): string {
  switch (role) {
    case "loja":     return "/analises/visao-em-loja";
    case "vendedor": return "/metas-vendedor";
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
      <Route path="/metas-vendedor" component={() => <MetasVendedorIndex />} />
      <Route path="/metas-vendedor/:tab" component={() => <MetasVendedorIndex />} />
      <Route path="/analises/visao-em-loja" component={VisaoEmLoja} />
      <Route path="/tv" component={TVDashboard} />
      <Route path="/campanhas" component={CampanhasList} />
      <Route path="/campanhas/nova" component={() => <CampaignForm />} />
      <Route path="/campanhas/:id/editar" component={(params: { id: string }) => <CampaignForm campaignId={params.id} />} />
      <Route path="/campanhas/:id" component={(params: { id: string }) => <CampaignView campaignId={params.id} />} />
      <Route path="/comissoes" component={Comissoes} />
      <Route path="/comissoes/configurar" component={ConfigurarComissoes} />
      <Route path="/usuarios" component={Usuarios} />
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
    { label: "Config",     href: "/configuracoes", icon: Settings,     match: (p: string) => p.startsWith("/configuracoes") },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border safe-bottom">
      <div className="flex items-center h-16 px-2">
        {items.map(item => {
          const active = item.match(location);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-all duration-150",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                active ? "bg-primary/10" : "transparent",
              )}>
                <item.icon className={cn("h-4 w-4", active && "text-primary")} />
              </div>
              <span className={cn(
                "text-[9px] font-medium leading-none",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ── Command Palette (Search) ─────────────────────────────────────────────────── */
function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const role = user?.role;

  const go = useCallback((href: string) => {
    setOpen(false);
    navigate(href);
  }, [navigate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const adminItems = [
    { label: "Dashboard",       href: "/",            icon: LayoutDashboard },
    { label: "Vendedores",      href: "/vendedores",  icon: Users },
    { label: "Metas",           href: "/metas",       icon: Target },
    { label: "Alertas",         href: "/alertas",     icon: AlertTriangle },
    { label: "Visão Semanal",   href: "/semanal",     icon: CalendarDays },
    { label: "Visão Mensal",    href: "/mensal",      icon: CalendarRange },
    { label: "Campanhas",            href: "/campanhas",   icon: Megaphone },
    { label: "Comissões",            href: "/comissoes",   icon: DollarSign },
    { label: "Usuários & Permissões", href: "/usuarios",   icon: Users },
    { label: "Configurações",        href: "/configuracoes", icon: Settings },
  ];

  const lojaItems = [
    { label: "Visão em Loja",   href: "/analises/visao-em-loja", icon: Store },
  ];

  const vendedorItems = [
    { label: "Metas e Campanhas", href: "/metas-vendedor", icon: BookOpen },
  ];

  const items = role === "loja"
    ? lojaItems
    : role === "vendedor"
    ? vendedorItems
    : adminItems;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative hidden sm:flex items-center flex-1 max-w-xs xl:max-w-sm",
          "h-9 w-full rounded-lg bg-muted/60 dark:bg-muted/30",
          "pl-9 pr-10 text-sm text-muted-foreground/60",
          "border border-transparent hover:border-primary/30 hover:bg-muted/80",
          "transition-all duration-150 text-left cursor-pointer",
        )}
        data-testid="command-palette-trigger"
      >
        <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <span className="select-none">Pesquisar...</span>
        <kbd className="absolute right-3 flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <DialogTitle className="sr-only">Pesquisar e navegar</DialogTitle>
        <CommandInput placeholder="Pesquisar páginas..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          <CommandGroup heading="Navegar para">
            {items.map(item => (
              <CommandItem
                key={item.href}
                value={item.label}
                onSelect={() => go(item.href)}
                className="gap-3 cursor-pointer"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
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
    <header className={cn(
      "flex h-14 items-center gap-3 px-3 sm:px-5 shrink-0",
      "border-b border-border",
      "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80",
    )}>
      {/* Left: sidebar trigger */}
      <SidebarTrigger
        data-testid="button-sidebar-toggle"
        className="h-8 w-8 rounded-lg hover:bg-muted transition-colors shrink-0"
      />

      {/* Center: command palette */}
      <div className="flex-1 flex">
        <CommandPalette />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg relative" title="Notificações">
          <Bell className="h-4 w-4" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 gap-2 px-1.5 sm:px-2 rounded-lg hover:bg-muted"
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-primary text-primary-foreground text-[9px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline text-[13px] font-medium">
                {displayName}
              </span>
              <ChevronDown className="hidden sm:block h-3 w-3 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-panel">
            <DropdownMenuLabel className="font-normal py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="text-[13px] font-semibold truncate">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ChangePasswordDialog>
              <DropdownMenuItem asChild>
                <button className="w-full flex items-center gap-2 cursor-pointer text-[13px]">
                  <KeyRound className="h-3.5 w-3.5" />
                  Alterar Senha
                </button>
              </DropdownMenuItem>
            </ChangePasswordDialog>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              data-testid="button-logout"
              className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40 cursor-pointer text-[13px]"
            >
              <LogOut className="h-3.5 w-3.5 mr-2" />
              Sair da conta
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
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AuthProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
