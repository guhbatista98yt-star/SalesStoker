import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { TVDashboardData } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/components/ui/sidebar";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    LabelList,
} from "recharts";

interface LojaViewConfig {
    bgColor: string;
    colorL01: string;
    colorL03: string;
    colorMatriz: string;
    showL01: boolean;
    showL03: boolean;
    showMatriz: boolean;
    showGrid: boolean;
    showRefLine: boolean;
    showLabels: boolean;
    title: string;
    footerText: string;
    tickColor: string;
    showRealNames: boolean;
}

const LOJA_DEFAULTS: LojaViewConfig = {
    bgColor: "#02040a",
    colorL01: "#1e5ac8",
    colorL03: "#ff0042",
    colorMatriz: "#eaaa00",
    showL01: true,
    showL03: true,
    showMatriz: true,
    showGrid: true,
    showRefLine: true,
    showLabels: true,
    title: "Performance Comercial",
    footerText: "Indicadores consolidados automaticamente via integração sistêmica.",
    tickColor: "#7ba8d4",
    showRealNames: false,
};

function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return [r, g, b];
}

// IDs exatos dos vendedores autorizados (evita duplicatas por nomes parciais)
const ALLOWED_VENDOR_IDS = new Set([
    "1014115", // ALAN
    "14093",   // CARLISON
    "1004249", // EMILLY
    "10421",   // ERIVAN
    "1014938", // JANIO
    "10774",   // JOANES
    "1004703", // LAURA LETICIA
    "11033",   // MAGNO
    "11038",   // MARCOS
    "1014856", // MARCOS FELIPE
    "1012888", // MARIANE
    "10965",   // NAILTON
    "11704",   // REJANE
]);

// Códigos fictícios exibidos no gráfico (C + 4 dígitos)
const VENDOR_DISPLAY_CODES: Record<string, string> = {
    "1014115": "C4821", // ALAN
    "14093": "C3076", // CARLISON
    "1004249": "C1547", // EMILLY
    "10421": "C7839", // ERIVAN
    "1014938": "C2954", // JANIO
    "10774": "C6183", // JOANES
    "1004703": "C9247", // LAURA LETICIA
    "11033": "C5360", // MAGNO
    "11038": "C8512", // MARCOS
    "1014856": "C4093", // MARCOS FELIPE
    "1012888": "C7428", // MARIANE
    "10965": "C2671", // NAILTON
    "11704": "C5834", // REJANE
};

// Neon bar with SVG filter glow, breathing pulse, and bubble particles
function GlossyBar(props: any) {
    const { x, y, width, height, filterId } = props;
    if (!width || !height || height <= 0) return null;
    return (
        <g>
            <style>{`
            @keyframes breatheGlow {
                0% { opacity: 0.85; filter: brightness(1) saturate(1); }
                50% { opacity: 1; filter: brightness(1.2) saturate(1.2); }
                100% { opacity: 0.85; filter: brightness(1) saturate(1); }
            }
            @keyframes floatBubbles {
                0% { background-position: 0 100%; opacity: 0; }
                20% { opacity: 0.6; }
                80% { opacity: 0.6; }
                100% { background-position: 0 0; opacity: 0; }
            }
            .breathing-bar {
                animation: breatheGlow 4s ease-in-out infinite;
                transform-origin: bottom center;
            }
            .bubble-overlay {
                background-image: radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 1px, transparent 2px),
                                  radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 1.5px, transparent 2px),
                                  radial-gradient(circle at 80% 30%, rgba(255,255,255,0.2) 1px, transparent 1.5px);
                background-size: 16px 32px, 20px 40px, 12px 24px;
                animation: floatBubbles 3s linear infinite;
                mix-blend-mode: overlay;
                border-radius: 4px 4px 0 0;
            }
            `}</style>

            <rect
                className="breathing-bar"
                x={x}
                y={y}
                width={width}
                height={height}
                fill={`url(#${props.gradId})`}
                filter={filterId ? `url(#${filterId})` : undefined}
                rx={4}
                ry={4}
            />

            {/* Overlay html para animação CSS contínua dentro da barra */}
            <foreignObject className="breathing-bar" x={x} y={y} width={width} height={height}>
                <div
                    className="bubble-overlay"
                    style={{ width: '100%', height: '200%' }}
                />
            </foreignObject>
        </g>
    );
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

// Retorna "Semana DD/MM à DD/MM" referente à semana atual (seg-sáb)
function getWeekRange(): string {
    const now = new Date();
    const day = now.getDay(); // 0=dom, 1=seg...
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon);
    const sat = new Date(mon);
    sat.setDate(mon.getDate() + 5);
    const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `Semana ${fmt(mon)} à ${fmt(sat)}`;
}

// Label rendered inside the bar (if space permits) or right above it!
function CustomBarLabel({ x, y, width, height, value, fill }: any) {
    if (!value && value !== 0) return null;
    const numH = Number(height);
    const numY = Number(y);
    const cx = Number(x) + Number(width) / 2;

    const textY = Math.max(14, numY - 8);

    // O valor original em dataKey é salesL01 / salesL03 (no formato ex: 52700)
    // Então dividimos por 1000 para gerar o falso percentual igual ao design original (2 casas)
    const label = `${(Number(value) / 1000).toFixed(2).replace('.', ',')}%`;

    // Diminuindo o fontsize para caber melhor na barra
    return (
        <text
            x={cx}
            y={textY}
            fill={fill}
            fontSize={11}
            fontWeight={700}
            textAnchor="middle"
        >
            {label}
        </text>
    );
}

// ─── Chart/Dashboard ─────────────────────────────────────────────────────────
export default function VisaoEmLoja() {
    const [, setLocation] = useLocation();
    const { logout, user } = useAuth();

    // Auto-recolhe a sidebar ao entrar na tela
    const { setOpen } = useSidebar();
    useEffect(() => {
        setOpen(false);
    }, []);

    const getCurrentWeek = () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return {
            weekStart: start.toISOString().split('T')[0],
            weekEnd: end.toISOString().split('T')[0]
        };
    };

    const { weekStart, weekEnd } = getCurrentWeek();

    const { data: configData } = useQuery<{ key: string; value: string | null }>({
        queryKey: ["/api/app-settings/visao_loja_config"],
        staleTime: 30_000,
    });

    const cfg: LojaViewConfig = (() => {
        if (configData?.value) {
            try { return { ...LOJA_DEFAULTS, ...JSON.parse(configData.value) }; } catch {}
        }
        return LOJA_DEFAULTS;
    })();

    const [r1, g1, b1] = hexToRgb(cfg.colorL01);
    const [r2, g2, b2] = hexToRgb(cfg.colorL03);
    const [r3, g3, b3] = hexToRgb(cfg.colorMatriz);

    const { data, isLoading, error, dataUpdatedAt } = useQuery<TVDashboardData>({
        queryKey: ["tv-dashboard", weekStart, weekEnd],
        queryFn: async () => {
            const res = await fetch(`/api/tv/dashboard?weekStart=${weekStart}&weekEnd=${weekEnd}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            if (!res.ok) {
                if (res.status === 401) throw new Error("Sessão expirada");
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Falha ao carregar dados");
            }
            return res.json();
        },
        refetchInterval: 60 * 1000,
        retry: false,
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center p-8" style={{ background: cfg.bgColor }}>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-4" style={{ color: 'rgba(255,255,255,0.7)' }}>Carregando dados...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 text-destructive flex-col gap-2" style={{ background: cfg.bgColor }}>
                <div className="flex items-center">
                    <AlertCircle className="h-8 w-8 mr-4" />
                    <span className="text-lg font-medium">Erro: {error.message}</span>
                </div>
                {error.message === "Sessão expirada" && (
                    <Button variant="outline" onClick={() => {
                        logout();
                        window.location.reload();
                    }}>
                        Ir para Login
                    </Button>
                )}
                <Button variant="ghost" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
        );
    }

    const seenIds = new Set<string>();
    const chartData = data?.vendors
        .filter(v => {
            if (!ALLOWED_VENDOR_IDS.has(v.id)) return false;
            if (seenIds.has(v.id)) return false;
            seenIds.add(v.id);
            return true;
        })
        .map(v => {
            const goalL01 = v.goal.loja01 || v.goal.value / 2 || 1;
            const goalL03 = v.goal.loja03 || v.goal.value / 2 || 1;
            const displayName = cfg.showRealNames
                ? v.displayName
                : (VENDOR_DISPLAY_CODES[v.id] || v.displayCode);
            return {
                name: displayName,
                fullName: v.displayName,
                goalL01: v.goal.loja01,
                goalL03: v.goal.loja03,
                l01: (v.sales.loja01 / goalL01) * 100,
                l03: (v.sales.loja03 / goalL03) * 100,
                salesL01: v.sales.loja01,
                salesL03: v.sales.loja03,
                salesLMatriz: v.sales.lojaMatriz ?? 0,
                salesYoY: v.yoy.value,
                salesTotal: v.sales.total
            };
        });
    const maxChartValue = Math.max(
        1,
        ...(chartData ?? []).flatMap((item) => [
            Number(item.salesL01) || 0,
            Number(item.salesL03) || 0,
            Number(item.salesLMatriz) || 0,
        ]),
    );

    return (
        <div className="flex flex-col w-full h-[100dvh] px-3 py-3 sm:p-6" style={{ overflow: 'hidden', background: cfg.bgColor }}>
            {/* Header profissional */}
            <div className="flex items-center justify-between mb-3 sm:mb-6 w-full gap-2">
                <div className="min-w-0">
                    <h2 className="text-sm sm:text-2xl font-medium truncate" style={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '0.01em', margin: 0 }}>
                        {cfg.title}{' '}
                        <span className="hidden sm:inline" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>&mdash; {getWeekRange()}</span>
                    </h2>
                    <p className="text-[11px] sm:hidden" style={{ color: 'rgba(255,255,255,0.4)' }}>{getWeekRange()}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 8px #22c55e', animation: 'pulseGlow 2s infinite' }} />
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Tempo real</span>
                    </div>
                    {dataUpdatedAt ? (
                        <span className="hidden sm:inline" style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 12 }}>
                            {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    ) : null}
                    <button
                        onClick={() => { logout(); window.location.href = '/'; }}
                        style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'none', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', padding: '3px 8px', borderRadius: 12, transition: 'all 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    >
                        Sair
                    </button>
                </div>
            </div>

            {/* Linha divisória transparente */}
            <div style={{ width: '100%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(160,200,255,0.15), transparent)', marginBottom: 12 }} className="sm:mb-6" />

            {/* Chart container */}
            <div className="w-full rounded-xl flex-1 flex flex-col" style={{ minHeight: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 54, right: 16, left: 16, bottom: 4 }}
                        barGap={2}
                        barCategoryGap="8%"
                    >
                        <defs>
                            <linearGradient id="grad01" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor={`rgb(${Math.round(r1*0.5)},${Math.round(g1*0.5)},${Math.round(b1*0.5)})`} stopOpacity={1} />
                                <stop offset="100%" stopColor={`rgb(${r1},${g1},${b1})`} stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="grad03" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor={`rgb(${Math.round(r2*0.5)},${Math.round(g2*0.5)},${Math.round(b2*0.5)})`} stopOpacity={1} />
                                <stop offset="100%" stopColor={`rgb(${r2},${g2},${b2})`} stopOpacity={1} />
                            </linearGradient>
                            <linearGradient id="gradMz" x1="0" y1="1" x2="0" y2="0">
                                <stop offset="0%" stopColor={`rgb(${Math.round(r3*0.5)},${Math.round(g3*0.5)},${Math.round(b3*0.5)})`} stopOpacity={1} />
                                <stop offset="100%" stopColor={`rgb(${r3},${g3},${b3})`} stopOpacity={1} />
                            </linearGradient>
                            <filter id="glow01" x="-12%" y="-4%" width="124%" height="108%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="glow03" x="-12%" y="-4%" width="124%" height="108%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                            <filter id="glowMz" x="-12%" y="-4%" width="124%" height="108%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                            </filter>
                        </defs>

                        <XAxis
                            dataKey="name"
                            stroke="#4a6080"
                            tick={{ fill: cfg.tickColor, fontSize: 14, fontWeight: 700 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis hide={true} domain={[0, Math.ceil(maxChartValue * 1.18)]} />
                        {cfg.showGrid && <CartesianGrid vertical={false} strokeDasharray="6 6" stroke="rgba(255,255,255,0.05)" />}
                        {cfg.showRefLine && <ReferenceLine y={100} stroke="rgba(100,200,100,0.4)" strokeDasharray="6 6" />}

                        {cfg.showL01 && (
                            <Bar
                                dataKey="salesL01"
                                name="Loja 01"
                                fill={`url(#grad01)`}
                                radius={[0, 0, 0, 0]}
                                shape={(props: any) => <GlossyBar {...props} gradId="grad01" filterId="glow01" />}
                                background={(props: any) => {
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} fill="rgba(255,255,255,0.04)" rx={0} />;
                                }}
                            >
                                {cfg.showLabels && (
                                    <LabelList
                                        dataKey="salesL01"
                                        position="top"
                                        content={(props: any) => <CustomBarLabel {...props} fill="rgba(255,255,255,0.9)" />}
                                    />
                                )}
                            </Bar>
                        )}

                        {cfg.showL03 && (
                            <Bar
                                dataKey="salesL03"
                                name="Loja 03"
                                fill={`url(#grad03)`}
                                radius={[0, 0, 0, 0]}
                                shape={(props: any) => <GlossyBar {...props} gradId="grad03" filterId="glow03" />}
                                background={(props: any) => {
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} fill="rgba(255,255,255,0.04)" rx={0} />;
                                }}
                            >
                                {cfg.showLabels && (
                                    <LabelList
                                        dataKey="salesL03"
                                        position="top"
                                        content={(props: any) => <CustomBarLabel {...props} fill="rgba(255,255,255,0.9)" />}
                                    />
                                )}
                            </Bar>
                        )}

                        {cfg.showMatriz && (
                            <Bar
                                dataKey="salesLMatriz"
                                name="Matriz (hoje)"
                                fill={`url(#gradMz)`}
                                radius={[0, 0, 0, 0]}
                                shape={(props: any) => <GlossyBar {...props} gradId="gradMz" filterId="glowMz" />}
                                background={(props: any) => {
                                    const { x, y, width, height } = props;
                                    return <rect x={x} y={y} width={width} height={height} fill="rgba(255,255,255,0.04)" rx={0} />;
                                }}
                            >
                                {cfg.showLabels && (
                                    <LabelList
                                        dataKey="salesLMatriz"
                                        position="top"
                                        content={(props: any) => <CustomBarLabel {...props} fill={`rgba(${r3},${g3},${b3},0.95)`} />}
                                    />
                                )}
                            </Bar>
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto', width: '100%' }}>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.03em', fontWeight: 500 }}>
                    {cfg.footerText}
                </span>
            </div>
        </div>
    );
}
