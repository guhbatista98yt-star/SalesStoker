import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, TrendingUp, Users, Target, LogIn, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function LandingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const result = await login(loginForm.email, loginForm.password);
    setIsLoading(false);

    if (!result.success) {
      toast({ title: result.error || "Erro ao fazer login", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            CONECTUBOS
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Dashboard completo para supervisores e diretores de vendas.
            Acompanhe KPIs, rankings, metas e desempenho da equipe em tempo real.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-12">
          <Card>
            <CardHeader className="text-center pb-4">
              <CardTitle>Acesso ao Sistema</CardTitle>
              <CardDescription>Entre com suas credenciais</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Usuário</Label>
                  <Input
                    id="login-email"
                    type="text"
                    placeholder="Seu usuário"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-login-email"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Sua senha"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    data-testid="input-login-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-login">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                  Entrar
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg">KPIs em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Acompanhe vendas semanais, mensais, pedidos e valores a faturar.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <CardTitle className="text-lg">Ranking de Vendedores</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Veja o desempenho individual e compare resultados da equipe.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-2">
                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <CardTitle className="text-lg">Metas Personalizadas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Defina e acompanhe metas em R$ por vendedor.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
                <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg">Mix de Produtos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Análise ABC e distribuição de vendas por categoria.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Acesso restrito a usuários autorizados.</p>
        </div>
      </div>
    </div>
  );
}
