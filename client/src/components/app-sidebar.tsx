import { Link, useLocation } from "wouter";
import {
  Bell,
  BarChart3,
  Calendar,
  DollarSign,
  LayoutDashboard,
  LineChart,
  Megaphone,
  PaintBucket,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Receipt,
  FileText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";

const coreItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Vendedores", url: "/vendedores", icon: Users },
  { title: "Metas", url: "/metas", icon: Target },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

const comprasItems = [
  { title: "Copiloto de Compras", url: "/compras", icon: ShoppingCart },
  { title: "Configuração de Compras", url: "/compras/configuracoes", icon: Settings },
];

const financeiroItems = [
  { title: "Contas a Receber",    url: "/financeiro/contas-receber",    icon: Receipt },
  { title: "Extrato de Cobranças", url: "/financeiro/extrato-cobrancas", icon: FileText },
];

const analysisItems = [
  { title: "Visão Semanal", url: "/semanal", icon: BarChart3 },
  { title: "Visão Mensal", url: "/mensal", icon: TrendingUp },
  { title: "Visão em Loja", url: "/analises/visao-em-loja", icon: Store },
  { title: "Comissões", url: "/comissoes", icon: DollarSign },
];

const vendedorCampaignItems = [
  { title: "DTR Amanco", url: "/metas-vendedor/dtr-amanco", icon: TrendingUp },
  { title: "TV Amanco", url: "/metas-vendedor/tv-amanco", icon: Calendar },
  { title: "Tintas Elit", url: "/metas-vendedor/tintas-elit", icon: PaintBucket },
];

function NavItem({ item, active }: { item: { title: string; url: string; icon: any }; active: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className="h-9 rounded-lg text-sm font-medium nav-item"
      >
        <Link href={item.url} data-testid={`nav-link-${item.url.replace(/\//g, "-").slice(1) || "dashboard"}`}>
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar({ collapsible = "icon", side = "left" }: { collapsible?: "offcanvas" | "icon" | "none"; side?: "left" | "right" }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.role || "admin";
  const isLoja = role === "loja";
  const isSupervisor = role === "supervisor";
  const isVendedor = role === "vendedor";
  const modPerms = user?.modulePermissions ?? null;

  function isModuleEnabled(moduleName: string): boolean {
    if (!modPerms) return true;
    const aliases: Record<string, string[]> = {
      Usuarios: ["Usuarios", "Usuários"],
      Configuracoes: ["Configuracoes", "Configurações"],
      Comissoes: ["Comissoes", "Comissões"],
      Analises: ["Analises", "Análises"],
      "Visao em Loja": ["Visao em Loja", "Visão em Loja"],
      "Visao Semanal": ["Visao Semanal", "Visão Semanal"],
      "Visao Mensal": ["Visao Mensal", "Visão Mensal"],
    };
    return (aliases[moduleName] ?? [moduleName]).every((key) => modPerms[key] !== false);
  }

  const filteredCore = isLoja || isVendedor
    ? []
    : coreItems.filter((item) => isModuleEnabled(item.title));

  const filteredAnalysis = isLoja
    ? analysisItems.filter((item) => item.title === "Visão em Loja" && isModuleEnabled(item.title))
    : isVendedor
      ? []
      : isSupervisor
        ? analysisItems.filter((item) => item.title !== "Visão em Loja" && isModuleEnabled(item.title))
        : analysisItems.filter((item) => isModuleEnabled(item.title));

  const showCampanhas = role === "admin" && isModuleEnabled("Campanhas");
  const COMPRAS_ROLES = ["admin", "supervisor", "gerente", "diretor", "comprador"];
  const showCompras = COMPRAS_ROLES.includes(role) && isModuleEnabled("Compras");
  const FINANCEIRO_ROLES = ["admin", "supervisor", "gerente", "diretor", "financeiro"];
  const showFinanceiro = FINANCEIRO_ROLES.includes(role) && isModuleEnabled("Financeiro");

  return (
    <Sidebar collapsible={collapsible} side={side} className="bg-sidebar">
      <SidebarHeader className="px-3 py-3 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/25 shrink-0">
            <LineChart className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 sidebar-logo-text group-data-[collapsible=icon]:hidden">
            <p className="font-bold text-sm tracking-tight leading-none text-sidebar-foreground">
              Stoker Sales
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">
              {isVendedor ? "Minhas Campanhas" : "Dashboard Executivo"}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        {isVendedor && isModuleEnabled("Campanhas") && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Campanhas
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {vendedorCampaignItems.map((item) => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isLoja && !isVendedor && filteredCore.length > 0 && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredCore.map((item) => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredAnalysis.length > 0 && (
          <SidebarGroup className="mb-2">
            {!isLoja && !isVendedor && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
                Análises
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAnalysis.map((item) => (
                  <NavItem key={item.title} item={item} active={location === item.url} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {showCompras && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Compras
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {comprasItems.map((item) => (
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

        {showFinanceiro && (
          <SidebarGroup className="mb-2">
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-1">
              Financeiro
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {financeiroItems.map((item) => (
                  <NavItem
                    key={item.title}
                    item={item}
                    active={location.startsWith(item.url)}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {role === "admin" && !isLoja && (
        <SidebarFooter className="px-2 pb-3 pt-2 border-t border-sidebar-border">
          <SidebarMenu>
            {showCampanhas && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.startsWith("/campanhas")}
                  tooltip="Campanhas"
                  className="h-9 rounded-lg text-sm font-medium"
                >
                  <Link href="/campanhas" data-testid="nav-link-campanhas">
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span>Campanhas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {isModuleEnabled("Usuarios") && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/usuarios"}
                  tooltip="Usuários"
                  className="h-9 rounded-lg text-sm font-medium"
                >
                  <Link href="/usuarios" data-testid="nav-link-usuarios">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>Usuários</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={location === "/copiloto"}
                tooltip="Copiloto de IA"
                className="h-9 rounded-lg text-sm font-medium"
              >
                <Link href="/copiloto" data-testid="nav-link-copiloto">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>Copiloto de IA</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {isModuleEnabled("Configuracoes") && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/configuracoes"}
                  tooltip="Configurações"
                  className="h-9 rounded-lg text-sm font-medium"
                >
                  <Link href="/configuracoes" data-testid="nav-link-configuracoes">
                    <Settings className="h-4 w-4 shrink-0" />
                    <span>Configurações</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
