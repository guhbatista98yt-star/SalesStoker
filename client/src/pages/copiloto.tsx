import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, CheckCircle2, AlertCircle, Sparkles,
  Key, Bot, Eye, EyeOff, ChevronDown, ChevronRight, ArrowRight, Save,
} from "lucide-react";

interface AIProvider {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

interface AIConfig {
  provider: string;
  model: string;
  hasKey: boolean;
  providers: AIProvider[];
}

interface CopilotMsg { role: "user" | "assistant"; content: string; ts: number }

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let listBuf: string[] = [];
  let listKey = 0;

  function flushList() {
    if (!listBuf.length) return;
    out.push(
      <ul key={`ul${listKey++}`} className="list-disc pl-5 space-y-0.5 my-1">
        {listBuf.map((li, i) => <li key={i} className="text-sm leading-relaxed">{inl(li)}</li>)}
      </ul>
    );
    listBuf = [];
  }

  function inl(s: string): React.ReactNode {
    return s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="px-1 py-0.5 rounded text-[11px] bg-muted font-mono">{p.slice(1, -1)}</code>;
      return p;
    });
  }

  lines.forEach((line, i) => {
    if (/^[-•*]\s/.test(line)) { listBuf.push(line.replace(/^[-•*]\s/, "")); return; }
    if (/^\d+\.\s/.test(line)) { listBuf.push(line.replace(/^\d+\.\s/, "")); return; }
    flushList();
    if (line.startsWith("### ")) out.push(<p key={i} className="text-sm font-semibold mt-3 mb-0.5">{inl(line.slice(4))}</p>);
    else if (line.startsWith("## ")) out.push(<p key={i} className="text-sm font-bold mt-3 mb-1">{inl(line.slice(3))}</p>);
    else if (line.startsWith("# ")) out.push(<p key={i} className="text-base font-bold mt-3 mb-1">{inl(line.slice(2))}</p>);
    else if (!line.trim()) out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i} className="text-sm leading-relaxed">{inl(line)}</p>);
  });
  flushList();
  return <>{out}</>;
}

export default function Copiloto() {
  const { toast } = useToast();

  const [msgs, setMsgs] = useState<CopilotMsg[]>([{
    role: "assistant",
    content: "Olá! Sou o **Copiloto Stoker Sales**. Posso ajudar com:\n\n- Dúvidas sobre qualquer módulo do sistema\n- Configuração de metas, equipes e permissões\n- Criação de campanhas de incentivo\n- Análise de dados e sugestões\n\nComo posso ajudar?",
    ts: Date.now(),
  }]);
  const [inputVal, setInputVal] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [cfgOpen, setCfgOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const { data: cfg, isLoading: cfgLoading } = useQuery<AIConfig>({ queryKey: ["/api/campaigns-ai/config"] });

  useEffect(() => { if (cfg && !provider) { setProvider(cfg.provider); setModel(cfg.model); } }, [cfg]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, thinking]);

  const providerObj = (cfg?.providers ?? []).find(p => p.id === provider);
  const availableModels = providerObj?.models ?? [];

  const saveCfgMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns-ai/config", { provider, model, apiKey: apiKey || undefined });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns-ai/config"] }); setApiKey(""); toast({ title: "Configuração salva!" }); },
    onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/campaigns-ai/chat", { messages: [{ role: "user", content: "Olá, responda apenas 'OK' para confirmar que está funcionando." }] });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: (d) => { setTestResult("ok"); setTestMsg(d.message?.slice(0, 80) || "IA respondeu!"); },
    onError: (e: any) => { setTestResult("error"); setTestMsg(e.message); },
  });

  async function sendMsg() {
    const text = inputVal.trim();
    if (!text || thinking) return;
    const userMsg: CopilotMsg = { role: "user", content: text, ts: Date.now() };
    const history = [...msgs, userMsg];
    setMsgs(history);
    setInputVal("");
    setThinking(true);
    try {
      const res = await apiRequest("POST", "/api/campaigns-ai/copilot", {
        messages: history.map(m => ({ role: m.role, content: m.content })),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Erro desconhecido"); }
      const data = await res.json();
      setMsgs(prev => [...prev, { role: "assistant", content: data.message || "Sem resposta.", ts: Date.now() }]);
    } catch (err: any) {
      setMsgs(prev => [...prev, { role: "assistant", content: `⚠️ Erro: ${err.message}\n\nVerifique a configuração da chave API.`, ts: Date.now() }]);
    } finally {
      setThinking(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Copiloto de IA
          </h1>
          <span className="hidden sm:inline text-xs text-muted-foreground font-medium">
            Assistente especialista no Stoker Sales
          </span>
        </div>
        {cfg && (
          <Badge variant={cfg.hasKey ? "default" : "destructive"} className="shrink-0 gap-1 text-xs">
            {cfg.hasKey ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {cfg.hasKey ? `IA ativa — ${cfg.provider}` : "Sem chave API"}
          </Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 gap-4 max-w-4xl mx-auto w-full">

        {/* Chat panel */}
        <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden flex-1 min-h-0">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[82%] rounded-2xl px-4 py-2.5",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted/60 rounded-bl-sm"
                )}>
                  {m.role === "assistant" ? renderMarkdown(m.content) : <p className="text-sm">{m.content}</p>}
                </div>
                {m.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-primary-foreground">EU</span>
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                  {[0,1,2].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${d*150}ms` }} />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">Pensando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 shrink-0">
            {!cfg?.hasKey && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-800 text-xs text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Configure uma chave API abaixo para usar o Copiloto.
              </div>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                className="flex-1 resize-none min-h-[38px] max-h-32 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
                placeholder={cfg?.hasKey ? "Pergunte algo... (Enter envia, Shift+Enter quebra linha)" : "Configure a chave API primeiro..."}
                rows={1}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={onKey}
                disabled={thinking || !cfg?.hasKey}
              />
              <Button onClick={sendMsg} disabled={!inputVal.trim() || thinking || !cfg?.hasKey} size="sm" className="shrink-0 h-[38px] gap-1.5 rounded-xl">
                {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-muted-foreground/60">Enter envia · Shift+Enter nova linha</p>
              <button
                className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground underline"
                onClick={() => setMsgs([{ role: "assistant", content: "Conversa reiniciada. Como posso ajudar?", ts: Date.now() }])}
              >
                Limpar conversa
              </button>
            </div>
          </div>
        </div>

        {/* AI Config accordion */}
        <div className="shrink-0 border rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
            onClick={() => setCfgOpen(v => !v)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Key className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Configuração de API</span>
              {cfg?.hasKey && (
                <Badge variant="secondary" className="text-[10px]">
                  {cfg.provider} / {cfg.model}
                </Badge>
              )}
            </div>
            {cfgOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>

          {cfgOpen && (
            <div className="p-4 border-t space-y-4">
              {cfgLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium flex items-center gap-1"><Bot className="h-3.5 w-3.5" /> Provedor</label>
                      <select
                        className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        value={provider}
                        onChange={e => { setProvider(e.target.value); setModel((cfg?.providers ?? []).find(p => p.id === e.target.value)?.models[0]?.id ?? ""); setTestResult("idle"); }}
                      >
                        {(cfg?.providers ?? []).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </select>
                      {provider === "gemini" && <p className="text-[10px] text-muted-foreground">Grátis: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">aistudio.google.com</a> — 1.500 req/dia</p>}
                      {provider === "groq" && <p className="text-[10px] text-muted-foreground">Grátis: <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.groq.com</a></p>}
                      {provider === "openai" && <p className="text-[10px] text-muted-foreground">Pago: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">platform.openai.com</a></p>}
                      {provider === "claude" && <p className="text-[10px] text-muted-foreground">Pago: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.anthropic.com</a></p>}
                      {provider === "mistral" && <p className="text-[10px] text-muted-foreground">Grátis: <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.mistral.ai</a></p>}
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Modelo</label>
                      <select
                        className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        value={model}
                        onChange={e => setModel(e.target.value)}
                      >
                        {availableModels.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium flex items-center gap-1"><Key className="h-3.5 w-3.5" /> Chave API</label>
                    <div className="relative">
                      <input
                        type={showKey ? "text" : "password"}
                        className="w-full h-8 px-3 pr-9 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                        placeholder={cfg?.hasKey ? "••••••• (em branco = manter atual)" : "Cole sua chave API..."}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                      />
                      <button type="button" className="absolute right-2.5 top-1.5 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(v => !v)}>
                        {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">A chave é armazenada de forma segura no banco de dados.</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" onClick={() => saveCfgMutation.mutate()} disabled={saveCfgMutation.isPending || !provider || !model} className="h-8 text-xs gap-1.5">
                      {saveCfgMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setTestResult("idle"); testMutation.mutate(); }} disabled={testMutation.isPending || !cfg?.hasKey} className="h-8 text-xs gap-1.5">
                      {testMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Testar
                    </Button>
                    {testResult !== "idle" && (
                      <span className={cn("text-xs flex items-center gap-1", testResult === "ok" ? "text-green-600" : "text-red-600")}>
                        {testResult === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                        {testResult === "ok" ? "Funcionando!" : testMsg.slice(0, 60)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
