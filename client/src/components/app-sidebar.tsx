import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Target, Bell, Settings, BarChart3, TrendingUp, Store, PaintBucket, Calendar, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Vendedores",
    url: "/vendedores",
    icon: Users,
  },
  {
    title: "Metas",
    url: "/metas",
    icon: Target,
  },
  {
    title: "Alertas",
    url: "/alertas",
    icon: Bell,
  },
];

const analysisItems = [
  {
    title: "Visão Semanal",
    url: "/semanal",
    icon: BarChart3,
  },
  {
    title: "Visão Mensal",
    url: "/mensal",
    icon: TrendingUp,
  },
  {
    title: "Visão em Loja",
    url: "/analises/visao-em-loja",
    icon: Store,
  },
];

// Campanhas disponíveis para vendedores
const campaignItems = [
  {
    title: "DTR Amanco",
    url: "/metas-vendedor/dtr-amanco",
    icon: TrendingUp,
  },
  {
    title: "TV Amanco",
    url: "/metas-vendedor/tv-amanco",
    icon: Calendar,
  },
  {
    title: "Tintas Elit",
    url: "/metas-vendedor/tintas-elit",
    icon: PaintBucket,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.role || "admin";
  const isLoja = role === "loja";
  const isSupervisor = role === "supervisor";
  const isVendedor = role === "vendedor";

  // loja: só Visão em Loja; supervisor: sem Visão em Loja; vendedor: campanhas; admin: tudo
  const filteredMenuItems = isLoja ? [] : isVendedor ? [] : menuItems;
  const filteredAnalysisItems = isLoja
    ? analysisItems.filter(i => i.title === "Visão em Loja")
    : isVendedor
      ? []
      : isSupervisor
        ? analysisItems.filter(i => i.title !== "Visão em Loja")
        : analysisItems;

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">CONECTUBOS</h1>
            <p className="text-xs text-muted-foreground">{isVendedor ? "Minhas Campanhas" : "Dashboard Executivo"}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* Campanhas do Vendedor */}
        {isVendedor && (
          <SidebarGroup>
            <SidebarGroupLabel>Campanhas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {campaignItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link href={item.url} data-testid={`nav-link-${item.url.replace(/\//g, "-").slice(1)}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Menu principal (admin/supervisor) */}
        {!isLoja && !isVendedor && (
          <SidebarGroup>
            <SidebarGroupLabel>Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link href={item.url} data-testid={`nav-link-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          {!isLoja && !isVendedor && <SidebarGroupLabel>Análises</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredAnalysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-link-${item.url.replace("/", "")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      {role === "admin" && !isLoja && (
        <SidebarFooter className="p-4 border-t border-sidebar-border space-y-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location.startsWith("/campanhas")}>
                <Link href="/campanhas" data-testid="nav-link-campanhas">
                  <Megaphone className="h-4 w-4" />
                  <span>Campanhas</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/configuracoes"}>
                <Link href="/configuracoes" data-testid="nav-link-configuracoes">
                  <Settings className="h-4 w-4" />
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

