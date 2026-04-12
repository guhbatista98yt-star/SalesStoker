import { useLocation, Link } from "wouter";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Target, Bell, Settings, BarChart3, TrendingUp,
  Store, PaintBucket, Calendar, Megaphone, LineChart, DollarSign, ShieldCheck, ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const coreItems = [
  { title: "Dashboard",     url: "/",          icon: LayoutDashboard },
  { title: "Vendedores",    url: "/vendedores", icon: Users },
  { title: "Metas",         url: "/metas",      icon: Target },
  { title: "Alertas",      url: "/alertas",    icon: Bell },
];

const comprasItems = [
  { title: "Copiloto de Compras",     url: "/compras",               icon: ShoppingCart },
  { title: "Configuração de Compras", url: "/compras/configuracoes", icon: Settings },
];

const analysisItems = [
  { title: "Visão Semanal", url: "/semanal",                    icon: BarChart3 },
  { title: "Visão Mensal",  url: "/mensal",                     icon: TrendingUp },
  { title: "Visão em Loja", url: "/analises/visao-em-loja",     icon: Store },
  { title: "Comissões",     url: "/comissoes",                  icon: DollarSign },
];

const campaignVendedorItems = [
  { title: "Acompanhamento", url: "/metas-vendedor/acompanhamento", icon: LayoutDashboard },
  { title: "DTR Amanco",     url: "/metas-vendedor/dtr-amanco",     icon: TrendingUp },
  { title: "TV Amanco",      url: "/metas-vendedor/tv-amanco",      icon: Calendar },
  { title: "Tintas Elit",    url: "/metas-vendedor/tintas-elit",    icon: PaintBucket },
  { title: "Comissões",      url: "/comissoes",                     icon: DollarSign },
];

function NavItem({ item, active }: { item: { title: string; url: string; icon: any }; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        className="h-9 rounded-lg text-sm font-medium"
      >
        <Link href={item.url} data-testid={`nav-link-${item.url.replace(/\//g, "-").slice(1) || "dashboard"}`}>
          <item.icon className="h-4 w-4 shrink-0" />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.role || "admin";
  const isLoja = role === "loja";
  const isSupervisor = role === "supervisor";
  const isVendedor = role === "vendedor";
  const modPerms = user?.modulePermissions ?? null;

  function isModuleEnabled(moduleName: string): boolean {
    if (!modPerms) return true;
    return modPerms[moduleName] !== false;
  }

  const filteredCore = isLoja || isVendedor
    ? []
    : coreItems.filter(i => isModuleEnabled(i.title));

  const filteredAnalysis = isLoja
    ? analysisItems.filter(i => i.title === "Visão em Loja" && isModuleEnabled(i.title))
    : isVendedor
      ? []
      : isSupervisor
        ? analysisItems.filter(i => i.title !== "Visão em Loja" && isModuleEnabled(i.title))
        : analysisItems.filter(i => isModuleEnabled(i.title));

  const showCampanhas = role === "admin" && isModuleEnabled("Campanhas");
  const COMPRAS_ROLES = ["admin", "supervisor", "gerente", "diretor", "comprador"];
  const showCompras = COMPRAS_ROLES.includes(role) && isModuleEnabled("Compras");

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      {/* ── Logo / Brand ── */}
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <LineChart className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm tracking-tight leading-none text-sidebar-foreground">
              CONECTUBOS
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
              {isVendedor ? "Minhas Campanhas" : "Dashboard Executivo"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">

        {/* Campanhas do Vendedor */}
        {isVendedor && isModuleEnabled("Campanhas") && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Campanhas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {campaignVendedorItems.map(item => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Principal */}
        {!isLoja && !isVendedor && filteredCore.length > 0 && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredCore.map(item => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Análises */}
        {filteredAnalysis.length > 0 && (
          <SidebarGroup className="mb-2">
            {!isLoja && !isVendedor && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
                Análises
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAnalysis.map(item => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Compras */}
        {showCompras && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Compras
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {comprasItems.map(item => (
                  <NavItem
                    key={item.title}
                    item={item}
                    active={
                      item.url === "/compras"
                        ? location === "/compras" || (location.startsWith("/compras/") && !location.startsWith("/compras/configuracoes"))
                        : location.startsWith(item.url)
                    }
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer — admin only */}
      {role === "admin" && !isLoja && (
        <SidebarFooter className="px-2 pb-3 pt-2 border-t border-sidebar-border">
          <SidebarMenu>
            {showCampanhas && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/campanhas")}
                  className="h-9 rounded-lg text-sm font-medium"
                >
                  <Link href="/campanhas" data-testid="nav-link-campanhas">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span>Campanhas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/usuarios"}
                className="h-9 rounded-lg text-sm font-medium"
              >
                <Link href="/usuarios" data-testid="nav-link-usuarios">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Usuários</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/configuracoes"}
                className="h-9 rounded-lg text-sm font-medium"
              >
                <Link href="/configuracoes" data-testid="nav-link-configuracoes">
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Configurações</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
