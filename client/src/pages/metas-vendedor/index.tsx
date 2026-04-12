import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, Target, TrendingUp, PaintBucket, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

import AcompanhamentoTab from "./acompanhamento";
import DtrAmancoTab from "./dtr-amanco";
import TvAmancoTab from "./tv-amanco";
import TintasElitTab from "./tintas-elit";

export default function MetasVendedor() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("acompanhamento");

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

    return (
        <div className="h-full overflow-auto bg-gray-50/50 dark:bg-zinc-950/50 pt-2 pb-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 py-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Minhas Metas e Campanhas</h1>
                        <p className="text-muted-foreground mt-1">Acompanhe seus resultados e performance em tempo real</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="relative overflow-x-auto pb-2 scrollbar-hide">
                        <TabsList className="w-max sm:w-full justify-start h-12 bg-white dark:bg-zinc-900 border shadow-sm rounded-lg p-1">
                            <TabsTrigger
                                value="acompanhamento"
                                className="gap-2 flex-shrink-0 h-10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                            >
                                <Target className="w-4 h-4" />
                                <span className="hidden sm:inline">Acompanhamento</span>
                                <span className="sm:hidden">Geral</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="dtr-amanco"
                                className="gap-2 flex-shrink-0 h-10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                            >
                                <TrendingUp className="w-4 h-4" />
                                <span className="hidden sm:inline">Campanha DTR Amanco</span>
                                <span className="sm:hidden">DTR Amanco</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="tv-amanco"
                                className="gap-2 flex-shrink-0 h-10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                            >
                                <Calendar className="w-4 h-4" />
                                <span className="hidden sm:inline">Campanha TV Amanco</span>
                                <span className="sm:hidden">TV Amanco</span>
                            </TabsTrigger>
                            <TabsTrigger
                                value="tintas-elit"
                                className="gap-2 flex-shrink-0 h-10 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
                            >
                                <PaintBucket className="w-4 h-4" />
                                <span className="hidden sm:inline">Campanha Tintas Elit</span>
                                <span className="sm:hidden">Tintas Elit</span>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
