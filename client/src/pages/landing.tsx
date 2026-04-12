import { useState, useId } from "react";
import { BarChart3, Eye, EyeOff, LogIn, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════════
   Tela de Login — CONECTUBOS
   Layout: página off-white + card central premium
   ══════════════════════════════════════════════════════════════════ */

/* ── Input com label flutuante ────────────────────────────────────── */
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: boolean;
  rightElement?: React.ReactNode;
}

function Field({ label, error, rightElement, className, id: idProp, ...props }: FieldProps) {
  const uid = useId();
  const id = idProp ?? uid;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground/80">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cn(
            "h-11 w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground",
            "placeholder:text-muted-foreground/50",
            "outline-none transition-all duration-150",
            "focus:border-primary focus:ring-2 focus:ring-primary/15",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-500/15"
              : "border-border hover:border-border/80",
            rightElement ? "pr-11" : "",
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-0 top-0 flex h-full items-center pr-3.5">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Botão principal ─────────────────────────────────────────────── */
function PrimaryButton({
  children,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(
        "relative flex h-11 w-full items-center justify-center gap-2 rounded-xl",
        "bg-primary text-primary-foreground text-sm font-semibold",
        "shadow-[0_1px_2px_rgba(0,0,0,.12),0_4px_12px_rgba(37,99,235,.25)]",
        "transition-all duration-150",
        "hover:brightness-105 hover:shadow-[0_1px_3px_rgba(0,0,0,.14),0_6px_16px_rgba(37,99,235,.30)]",
        "active:scale-[0.98] active:brightness-95",
        "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100",
        props.className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <LogIn className="h-4 w-4" />
      )}
      <span>{loading ? "Autenticando..." : children}</span>
    </button>
  );
}

/* ── Página principal ────────────────────────────────────────────── */
export default function LandingPage() {
  const { login } = useAuth();

  const [form, setForm]         = useState({ email: "", password: "" });
  const [showPw, setShowPw]     = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.email.trim() || !form.password) {
      setError("Preencha usuário e senha para continuar.");
      return;
    }

    setIsLoading(true);
    const result = await login(form.email.trim(), form.password);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Credenciais inválidas. Verifique e tente novamente.");
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col items-center justify-center",
        "bg-background px-4 py-12",
        /* Decoração de fundo extremamente sutil */
        "bg-[radial-gradient(ellipse_at_60%_0%,hsl(217_93%_52%_/_0.07)_0%,transparent_55%)]"
      )}
    >
      {/* Linha de acento superior */}
      <div className="fixed top-0 inset-x-0 h-[2px] bg-gradient-to-r from-primary/0 via-primary to-primary/0" />

      {/* Conteúdo central */}
      <div className="w-full max-w-[400px] flex flex-col items-center gap-8">

        {/* ── Marca ─────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-3 text-center">
          {/* Ícone */}
          <div className={cn(
            "h-14 w-14 rounded-2xl flex items-center justify-center",
            "bg-primary shadow-[0_4px_16px_rgba(37,99,235,.30)]"
          )}>
            <BarChart3 className="h-7 w-7 text-white" strokeWidth={2.2} />
          </div>

          {/* Nome do produto */}
          <div>
            <p className="text-2xl font-black tracking-tight text-foreground leading-none">
              CONECTUBOS
            </p>
            <p className="text-sm text-muted-foreground font-medium mt-1">
              Gestão Comercial e Performance
            </p>
          </div>
        </div>

        {/* ── Card de login ──────────────────────────────────────── */}
        <div className={cn(
          "w-full rounded-2xl border border-border bg-card",
          "shadow-[0_2px_4px_rgba(0,0,0,.04),0_8px_32px_rgba(0,0,0,.08)]",
          "p-8"
        )}>
          {/* Cabeçalho do card */}
          <div className="mb-7">
            <h1 className="text-xl font-bold text-foreground leading-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field
              label="Usuário"
              id="login-email"
              type="text"
              placeholder="Digite seu usuário"
              value={form.email}
              onChange={e => { setError(null); setForm(p => ({ ...p, email: e.target.value })); }}
              autoComplete="username"
              data-testid="input-login-email"
              error={!!error}
              disabled={isLoading}
            />

            <Field
              label="Senha"
              id="login-password"
              type={showPw ? "text" : "password"}
              placeholder="Digite sua senha"
              value={form.password}
              onChange={e => { setError(null); setForm(p => ({ ...p, password: e.target.value })); }}
              autoComplete="current-password"
              data-testid="input-login-password"
              error={!!error}
              disabled={isLoading}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  tabIndex={-1}
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  aria-label={showPw ? "Ocultar senha" : "Exibir senha"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            {/* Mensagem de erro inline */}
            {error && (
              <div className={cn(
                "flex items-start gap-2.5 rounded-xl px-3.5 py-3",
                "bg-red-50 border border-red-100 text-red-700",
                "dark:bg-red-900/15 dark:border-red-800/30 dark:text-red-400",
                "text-sm font-medium"
              )}>
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Botão */}
            <div className="pt-1">
              <PrimaryButton
                type="submit"
                loading={isLoading}
                data-testid="button-login"
              >
                Entrar
              </PrimaryButton>
            </div>
          </form>
        </div>

        {/* ── Rodapé ────────────────────────────────────────────── */}
        <p className="text-xs text-muted-foreground/60 text-center">
          Acesso restrito a usuários autorizados
          <span className="mx-2">·</span>
          CONECTUBOS © {new Date().getFullYear()}
        </p>
        <p className="text-[10px] text-muted-foreground/35 text-center mt-1 tracking-wide">
          Developed by Gustavo Batista
        </p>
      </div>
    </div>
  );
}
