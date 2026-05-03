import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getAuthToken } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Send, Loader2, X, CheckCircle2,
  RotateCcw, ChevronRight, Bot, User, Paperclip,
  FileText, ImageIcon, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Attachment {
  type: "image" | "pdf";
  name: string;
  mimeType?: string;
  data?: string;
  text?: string;
  previewUrl?: string;
  pages?: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  attachment?: Attachment;
}

interface AICampaignAssistantProps {
  onApply: (draft: Record<string, any>) => void;
  onClose: () => void;
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Campanha do fornecedor Tigre no mês de junho: quem vender 50 unidades ganha R$200",
  "Ranking de vendas de julho a setembro, top 3 ganham R$500, R$300 e R$150",
  "Comissão de 2% sobre tudo vendido de conexões em julho",
  "Campanha mensal recorrente: quem bater R$10.000 em vendas ganha R$100",
];

const MAX_FILE_MB = 10;

// ─── Component ────────────────────────────────────────────────────────────────

export function AICampaignAssistant({ onApply, onClose }: AICampaignAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Descreva a campanha que você quer criar e eu monto tudo automaticamente.\n\nVocê também pode enviar uma imagem (flyer, arte) ou PDF com os detalhes da campanha.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingDraft, setPendingDraft] = useState<Record<string, any> | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── Upload mutation ───────────────────────────────────────────────────────

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const token = getAuthToken();
      const res = await fetch("/api/campaigns-ai/upload", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let errMsg = "Erro ao enviar arquivo";
        try {
          const err = await res.json();
          errMsg = err.error || err.message || errMsg;
        } catch { /* not JSON */ }
        throw new Error(errMsg);
      }
      return res.json() as Promise<{
        type: "image" | "pdf";
        mimeType?: string;
        data?: string;
        text?: string;
        name: string;
        pages?: number;
        size: number;
      }>;
    },
    onSuccess: (data, file) => {
      setUploadError(null);
      const att: Attachment = {
        type: data.type,
        name: data.name,
        mimeType: data.mimeType,
        data: data.data,
        text: data.text,
        pages: data.pages,
        previewUrl: data.type === "image" && data.data && data.mimeType
          ? `data:${data.mimeType};base64,${data.data}`
          : undefined,
      };
      setAttachment(att);
    },
    onError: (e: any) => {
      setUploadError(e.message);
      setAttachment(null);
    },
  });

  // ─── Chat mutation ─────────────────────────────────────────────────────────

  const chatMutation = useMutation({
    mutationFn: async (msgs: Message[]) => {
      const res = await apiRequest("POST", "/api/campaigns-ai/chat", { messages: msgs });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao comunicar com IA");
      }
      return res.json() as Promise<{ message: string; campaignDraft: Record<string, any> | null }>;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
      if (data.campaignDraft) setPendingDraft(data.campaignDraft);
    },
    onError: (e: any) => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Ocorreu um erro: ${e.message}. Tente novamente.`,
      }]);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(`Arquivo muito grande. Limite: ${MAX_FILE_MB}MB`);
      return;
    }

    setUploadError(null);
    setAttachment(null);
    uploadMutation.mutate(file);
  }

  function handleRemoveAttachment() {
    setAttachment(null);
    setUploadError(null);
    uploadMutation.reset();
  }

  function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if ((!msg && !attachment) || chatMutation.isPending || uploadMutation.isPending) return;

    const userMsg: Message = {
      role: "user",
      content: msg,
      attachment: attachment ?? undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setAttachment(null);
    setUploadError(null);
    setPendingDraft(null);
    chatMutation.mutate(newMessages);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMessages([{
      role: "assistant",
      content: "Conversa reiniciada. Descreva a nova campanha que você quer criar.",
    }]);
    setPendingDraft(null);
    setInput("");
    setAttachment(null);
    setUploadError(null);
  }

  const isBusy = chatMutation.isPending || uploadMutation.isPending;
  const canSend = (input.trim().length > 0 || attachment !== null) && !isBusy;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/20 dark:to-blue-950/20">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-violet-600 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold">Assistente de Campanhas</p>
            <p className="text-[10px] text-muted-foreground">Texto · Imagens · PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleReset} title="Recomeçar">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </div>
              )}
              <div className="max-w-[85%] space-y-1.5">
                {/* Attachment display */}
                {msg.attachment && (
                  <div className={cn(
                    "rounded-xl overflow-hidden border",
                    msg.role === "user" ? "border-violet-400/40" : "border-border"
                  )}>
                    {msg.attachment.type === "image" && msg.attachment.previewUrl ? (
                      <img
                        src={msg.attachment.previewUrl}
                        alt={msg.attachment.name}
                        className="max-w-[220px] max-h-[180px] object-cover block"
                      />
                    ) : (
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 text-xs",
                        msg.role === "user"
                          ? "bg-violet-500 text-white"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate max-w-[160px]">{msg.attachment.name}</span>
                        {msg.attachment.pages && (
                          <span className="shrink-0 opacity-70">({msg.attachment.pages} pág.)</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Text bubble */}
                {msg.content && (
                  <div className={cn(
                    "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-muted rounded-tl-sm"
                  )}>
                    {msg.content.split("\n").map((line, j) => (
                      <span key={j}>
                        {line}
                        {j < msg.content.split("\n").length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-2.5 justify-start">
              <div className="h-7 w-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Draft ready */}
          {pendingDraft && !chatMutation.isPending && (
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">
                  Campanha pronta para configurar!
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                  "{pendingDraft.name}" — clique em Aplicar ao Formulário para preencher automaticamente.
                </p>
              </div>
              <Button
                size="sm"
                className="shrink-0 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApply(pendingDraft)}
              >
                Aplicar ao Formulário <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Suggestions — show only at start */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Exemplos</p>
          <div className="grid grid-cols-1 gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                className="text-left text-xs px-3 py-2 rounded-lg bg-muted/60 hover:bg-muted border border-transparent hover:border-muted-foreground/20 transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => handleSend(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attachment preview */}
      {(attachment || uploadMutation.isPending || uploadError) && (
        <div className="px-4 pb-1">
          {uploadMutation.isPending && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processando arquivo...
            </div>
          )}
          {uploadError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {uploadError}
              <button className="ml-auto" onClick={() => setUploadError(null)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {attachment && !uploadMutation.isPending && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800">
              {attachment.type === "image"
                ? <ImageIcon className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                : <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
              }
              <span className="text-xs text-violet-700 dark:text-violet-300 truncate flex-1">
                {attachment.name}
                {attachment.pages && ` (${attachment.pages} páginas)`}
              </span>
              {attachment.type === "image" && attachment.previewUrl && (
                <img src={attachment.previewUrl} alt="" className="h-8 w-8 object-cover rounded" />
              )}
              <button
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleRemoveAttachment}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t">
        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Attach button */}
          <Button
            size="icon"
            variant="outline"
            className={cn(
              "h-10 w-10 shrink-0",
              attachment && "border-violet-400 bg-violet-50 dark:bg-violet-950/20"
            )}
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            title="Anexar imagem ou PDF"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Textarea
            ref={textareaRef}
            className="flex-1 resize-none text-sm min-h-[60px] max-h-[120px]"
            placeholder={attachment ? "Adicione uma mensagem (opcional) ou envie direto..." : "Descreva a campanha em linguagem natural..."}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            disabled={isBusy}
          />

          <Button
            size="icon"
            className="h-10 w-10 shrink-0 bg-violet-600 hover:bg-violet-700"
            onClick={() => handleSend()}
            disabled={!canSend}
          >
            {chatMutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />
            }
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Enter para enviar · Shift+Enter para nova linha · Suporta imagens e PDF
        </p>
      </div>
    </div>
  );
}
