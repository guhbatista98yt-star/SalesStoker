import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { Loader2, Monitor, AlertCircle } from "lucide-react";
import { TVDashboardData } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

// Custom Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-background border rounded p-2 shadow-lg text-sm">
                <p className="font-bold">{data.displayName} ({data.displayCode})</p>
                <p className="text-muted-foreground">Vendas: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.sales.total)}</p>
                <p className="text-muted-foreground">Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(data.goal.value)}</p>
                <p className={data.achievement >= 100 ? "text-green-500 font-bold" : "text-yellow-500"}>
                    Atingimento: {data.achievement.toFixed(2)}%
                </p>
                {data.yoy.percentage !== 0 && (
                    <p className={data.yoy.percentage > 0 ? "text-green-500" : "text-red-500"}>
                        YoY: {data.yoy.percentage > 0 ? "+" : ""}{data.yoy.percentage.toFixed(2)}%
                    </p>
                )}
            </div>
        );
    }
    return null;
};

export default function TVDashboard() {
    const { user } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    // Week calculation logic (Current Week)
    const getCurrentWeek = () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Sunday
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Saturday
        end.setHours(23, 59, 59, 999);
        return {
            weekStart: start.toISOString().split('T')[0],
            weekEnd: end.toISOString().split('T')[0]
        };
    };

    const { weekStart, weekEnd } = getCurrentWeek();

    // Data Fetching with Auto-Refresh every 5 minutes
    const { data, isLoading, error, refetch } = useQuery<TVDashboardData>({
        queryKey: ["tv-dashboard", weekStart, weekEnd],
        queryFn: async () => {
            const res = await fetch(`/api/tv/dashboard?weekStart=${weekStart}&weekEnd=${weekEnd}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}` // Ensure token is sent
                }
            });
            if (!res.ok) throw new Error("Falha ao carregar dados");
            return res.json();
        },
        refetchInterval: 5 * 60 * 1000, // 5 minutes
    });

    // Clock Update
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Keep-Alive / Token Refresh Logic (Simplified)
    // In a real scenario, we might hit a /refresh endpoint.
    // Here we rely on the refetchInterval to keep activity, assuming token has long expiry 
    // or we handle 401 in a global interceptor (which is typical in useAuth).
    // For TV mode specifically, we might want to force a reload if 401 occurs.

    if (isLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <span className="ml-4 text-xl font-medium">Carregando Modo TV...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background text-destructive">
                <AlertCircle className="h-16 w-16 mr-4" />
                <span className="text-xl">Erro de conexão. Tentando reconectar...</span>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="h-screen w-screen bg-zinc-950 text-zinc-50 overflow-hidden flex flex-col p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <Monitor className="h-10 w-10 text-blue-500" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Painel de Vendas Semanal</h1>
                        <p className="text-zinc-400">
                            Última sincronização: {new Date(data.meta.lastSync).toLocaleTimeString('pt-BR')}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-5xl font-mono font-bold text-white">
                        {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-xl text-zinc-400">
                        {currentTime.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                </div>
            </div>

            {/* Grid of Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 flex-1 content-start">
                {data.vendors.map((vendor) => {
                    // Calculate segments for visualization
                    // Total Bar Width = 100%
                    // Goal Line = Dashed line at specific point? 
                    // Better: Stacked Bar. 
                    // Segment 1: L01 (Blue). Segment 2: L03 (Red). 
                    // Background: Gray (Goal). 
                    // If Total > Goal, bar fills up.

                    // Simplified Visualization for Card:
                    // 1. Label (Code)
                    // 2. Bar Chart inside Card? Or just simple CSS bars?
                    // Let's use CSS bars for performance and ease of customization

                    const goalValue = vendor.goal.value || 1; // Avoid div by zero
                    const totalSales = vendor.sales.total;
                    const l01Pct = (vendor.sales.loja01 / goalValue) * 100;
                    const l03Pct = (vendor.sales.loja03 / goalValue) * 100;
                    const totalPct = l01Pct + l03Pct;

                    const isExceeded = totalSales > goalValue;

                    return (
                        <Card key={vendor.id} className="bg-zinc-900 border-zinc-800 overflow-hidden flex flex-col justify-between">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-4xl font-bold text-white">{vendor.displayCode}</CardTitle>
                                    <div className={`px-2 py-1 rounded text-xs font-bold ${vendor.yoy.percentage >= 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                        YoY {vendor.yoy.percentage > 0 ? '+' : ''}{vendor.yoy.percentage.toFixed(0)}%
                                    </div>
                                </div>
                                <p className="text-sm text-zinc-500 truncate">{vendor.displayName}</p>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-2 flex justify-between items-end">
                                    <span className="text-2xl font-bold text-white">
                                        {vendor.achievement.toFixed(1)}%
                                    </span>
                                    <span className="text-xs text-zinc-400">
                                        Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(vendor.goal.value)}
                                    </span>
                                </div>

                                {/* Progress Bar Container */}
                                <div className="h-6 w-full bg-zinc-800 rounded-full flex overflow-hidden relative">
                                    {/* Goal Marker (100%) - Only visible if we scale > 100%?? 
                                 Let's keep it simple: 100% width = Goal. 
                                 If exceeded, we show full bar and maybe a glow or + badge.
                              */}

                                    <div
                                        style={{ width: `${Math.min(l01Pct, 100)}%` }}
                                        className="h-full bg-blue-600"
                                    />
                                    <div
                                        style={{ width: `${Math.min(l03Pct, 100 - Math.min(l01Pct, 100))}%` }}
                                        className="h-full bg-red-600"
                                    />
                                </div>

                                <div className="mt-2 flex justify-between text-xs text-zinc-500">
                                    <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(vendor.sales.loja01)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-right">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(vendor.sales.loja03)}</span>
                                        <div className="w-2 h-2 rounded-full bg-red-600"></div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
