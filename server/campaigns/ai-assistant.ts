import { Router } from "express";
import multer from "multer";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import { pgGet, pgRun } from "../pg-client";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ─── Supported providers ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, { label: string; models: { id: string; label: string }[]; urlFn: (model: string, key: string) => string }> = {
  gemini: {
    label: "Google Gemini (gratuito)",
    models: [
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash (recomendado)" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    urlFn: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (econômico)" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
    urlFn: () => "https://api.openai.com/v1/chat/completions",
  },
};

// ─── Load / save AI config from app_settings ─────────────────────────────────

async function loadAIConfig(): Promise<{ provider: string; model: string; apiKey: string }> {
  try {
    const row = await pgGet<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'ai_config' LIMIT 1`);
    if (row?.value) {
      const cfg = JSON.parse(row.value);
      return {
        provider: cfg.provider || "gemini",
        model: cfg.model || "gemini-1.5-flash",
        apiKey: cfg.apiKey || process.env.GEMINI_API_KEY || "",
      };
    }
  } catch {}
  return {
    provider: "gemini",
    model: "gemini-1.5-flash",
    apiKey: process.env.GEMINI_API_KEY || "",
  };
}

async function saveAIConfig(provider: string, model: string, apiKey: string): Promise<void> {
  const value = JSON.stringify({ provider, model, apiKey });
  await pgRun(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES ('ai_config', ?, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
  `, [value]);
}

// ─── Routes: get/set AI config ────────────────────────────────────────────────

router.get("/config", isAuthenticated, isAdmin, async (_req, res) => {
  try {
    const cfg = await loadAIConfig();
    res.json({
      provider: cfg.provider,
      model: cfg.model,
      hasKey: Boolean(cfg.apiKey),
      providers: Object.entries(PROVIDERS).map(([id, p]) => ({
        id, label: p.label, models: p.models,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/config", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { provider, model, apiKey } = req.body;
    if (!provider || !model) return res.status(400).json({ error: "provider e model são obrigatórios" });
    if (!PROVIDERS[provider]) return res.status(400).json({ error: "Provider inválido" });

    const current = await loadAIConfig();
    const keyToSave = apiKey || current.apiKey;
    if (!keyToSave) return res.status(400).json({ error: "Chave API é obrigatória" });

    await saveAIConfig(provider, model, keyToSave);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Upload route ─────────────────────────────────────────────────────────────

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const PDF_TYPE = "application/pdf";

router.post("/upload", isAuthenticated, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

    if (IMAGE_TYPES.includes(file.mimetype)) {
      const base64 = file.buffer.toString("base64");
      return res.json({
        type: "image",
        mimeType: file.mimetype,
        data: base64,
        name: file.originalname,
        size: file.size,
      });
    }

    if (file.mimetype === PDF_TYPE) {
      const pdfParse = (await import("pdf-parse")).default;
      const parsed = await pdfParse(file.buffer);
      const text = parsed.text?.trim() || "";
      if (!text) return res.status(422).json({ error: "Não foi possível extrair texto do PDF" });
      return res.json({
        type: "pdf",
        text,
        name: file.originalname,
        pages: parsed.numpages,
        size: file.size,
      });
    }

    return res.status(415).json({ error: "Tipo de arquivo não suportado. Use imagens (JPG, PNG, WebP) ou PDF." });
  } catch (err: any) {
    console.error("[AI Upload]", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente especialista em criar campanhas de incentivo de vendas para distribuidoras de tubos e conexões.

Seu trabalho é conversar com o usuário, entender o que ele quer, fazer perguntas quando necessário, e ao final gerar a configuração completa da campanha em JSON.

## REGRAS DE CONVERSA

1. Seja direto e amigável. Use linguagem simples e objetiva.
2. Faça UMA pergunta por vez quando precisar de informações.
3. Quando tiver informações suficientes, gere a configuração JSON automaticamente.
4. Confirme com o usuário antes de finalizar.
5. Se o usuário enviar uma imagem (flyer, arte, tabela, documento fotográfico), analise todo o conteúdo visual para extrair as informações da campanha.
6. Se o usuário enviar um PDF, o texto extraído virá no início da mensagem. Use essas informações para montar a campanha.

## INFORMAÇÕES NECESSÁRIAS PARA UMA CAMPANHA

Pergunte apenas o que não ficou claro na descrição do usuário:

- **Nome** da campanha
- **Período** (data início e fim)
- **Objetivo** (o que incentiva? Ex: vender produto X, fornecedor Y, bater meta de valor, ranking de vendas)
- **Quem participa** (todos os vendedores? alguns específicos?)
- **Regras/condições** (mínimo de quantidade? valor mínimo? produto específico? fornecedor específico?)
- **Prêmio** (valor fixo? percentual? ranking? faixas?)
- **Ciclo** (se repete mensalmente, trimestralmente ou é única)

## MODOS DE CAMPANHA

Escolha o melhor baseado no que o usuário descreve:
- **atingimento**: todos que cumprirem as condições ganham um prêmio fixo
- **comissao**: cada vendedor recebe % sobre o valor vendido
- **ranking_volume**: ranking por quem vendeu mais volume — prêmios por posição
- **ranking_crescimento**: ranking por maior crescimento % em relação ao período anterior
- **faixa**: prêmio escalonado por faixas de valor/quantidade

## TIPOS DE PRÊMIO

- **VALOR_FIXO**: valor fixo em R$ para quem atingir
- **PERCENTUAL**: % sobre o valor da transação
- **COMISSAO_PERCENTUAL**: % sobre a base de pagamento total
- **FAIXA**: prêmio diferente por faixa (ex: 1-100 un = R$50, 101-200 un = R$100)
- **RANKING**: prêmio por posição no ranking (1º lugar R$X, 2º R$Y...)

## FORMATO JSON DE SAÍDA

Quando tiver informações suficientes, responda com uma mensagem amigável confirmando o que entendeu E termine com o bloco JSON entre marcadores especiais assim:

<<<CAMPAIGN_JSON>>>
{
  "name": "Nome da Campanha",
  "description": "Descrição completa",
  "objective": "Objetivo da campanha",
  "supplier_name": "Fornecedor (se houver)",
  "campaign_type": "padrao",
  "campaign_mode": "atingimento",
  "starts_at": "2025-01-01",
  "ends_at": "2025-01-31",
  "cycle_type": "none",
  "auto_renew": false,
  "priority": 50,
  "is_cumulative": true,
  "is_exclusive": false,
  "targets": {
    "vendedores": { "mode": "all", "ids": [], "groupIds": [], "exclude": [] },
    "produtos": { "mode": "all", "ids": [], "suppliers": [], "categories": [], "exclude": [] },
    "clientes": { "mode": "all", "ids": [], "exclude": [] },
    "empresas": { "mode": "all", "ids": [] }
  },
  "bases": {
    "elegibilidade": { "mix_minimo": 0, "produtos": null },
    "apuracao": { "produtos": null },
    "ranking": { "tipo": "volume", "criterio_desempate": "valor", "periodo_comparativo": null },
    "pagamento": { "produtos": null }
  },
  "conditions": {
    "id": "root",
    "connector": "AND",
    "conditions": [],
    "groups": []
  },
  "triggers": [],
  "rewards": {
    "type": "VALOR_FIXO",
    "scope": "individual",
    "baseValue": 100,
    "tiers": [],
    "posicoes": [],
    "maxBonus": null,
    "minCutoff": null,
    "rounding": "none"
  },
  "limits": {},
  "exceptions": [],
  "natural_language": "Descrição em linguagem natural da campanha completa"
}
<<<END_CAMPAIGN_JSON>>>

## EXEMPLOS DE CONDIÇÕES NO JSON

Para "vender mínimo 50 unidades do fornecedor X":
\`\`\`json
"conditions": {
  "id": "root",
  "connector": "AND",
  "conditions": [
    { "id": "c1", "type": "FORNECEDOR", "operator": "EQUALS", "value": "NOME_FORNECEDOR" },
    { "id": "c2", "type": "QUANTIDADE", "operator": "GTE", "value": 50 }
  ],
  "groups": []
}
\`\`\`

Para "vender mínimo R$ 5.000":
\`\`\`json
"conditions": {
  "id": "root",
  "connector": "AND",
  "conditions": [
    { "id": "c1", "type": "VALOR", "operator": "GTE", "value": 5000 }
  ],
  "groups": []
}
\`\`\`

## EXEMPLOS DE PRÊMIOS

Prêmio fixo de R$200 para quem atingir:
\`\`\`json
"rewards": { "type": "VALOR_FIXO", "scope": "individual", "baseValue": 200, "tiers": [], "posicoes": [] }
\`\`\`

Ranking (1º R$500, 2º R$300, 3º R$150):
\`\`\`json
"rewards": {
  "type": "RANKING", "scope": "individual", "tiers": [],
  "posicoes": [
    { "id": "p1", "posicao": 1, "label": "1º lugar", "valor": 500 },
    { "id": "p2", "posicao": 2, "label": "2º lugar", "valor": 300 },
    { "id": "p3", "posicao": 3, "label": "3º lugar", "valor": 150 }
  ]
}
\`\`\`

Faixas de quantidade:
\`\`\`json
"rewards": {
  "type": "FAIXA", "scope": "individual", "tiers": [
    { "id": "t1", "label": "Bronze", "min": 50, "max": 100, "value": 100 },
    { "id": "t2", "label": "Prata", "min": 101, "max": 200, "value": 200 },
    { "id": "t3", "label": "Ouro", "min": 201, "max": null, "value": 400 }
  ], "posicoes": []
}
\`\`\`

## DATAS

Use sempre o formato YYYY-MM-DD. Se o usuário disser "esse mês", use o mês atual. Hoje é ${new Date().toISOString().slice(0, 10)}.

## CICLOS

- "toda mês" → cycle_type: "monthly", auto_renew: true
- "todo trimestre" → cycle_type: "quarterly", auto_renew: true  
- "única" → cycle_type: "none", auto_renew: false

Lembre-se: seja eficiente. Se o usuário deu informações suficientes na primeira mensagem, gere o JSON imediatamente sem perguntar mais.`;

// ─── AI call helpers ──────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  attachment?: {
    type: "image" | "pdf";
    mimeType?: string;
    data?: string;
    text?: string;
    name: string;
  };
}

const GEMINI_FALLBACK_CHAIN = ["gemini-1.5-flash", "gemini-1.5-pro"];

async function callGeminiModel(
  apiKey: string,
  model: string,
  contents: any[],
  systemPrompt: string
): Promise<{ ok: true; text: string } | { ok: false; status: number; raw: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, status: res.status, raw: await res.text() };
  const data = await res.json() as any;
  return { ok: true, text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "" };
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const contents = messages.map((m, i) => {
    const isLast = i === messages.length - 1;
    const parts: any[] = [];
    if (m.attachment && isLast) {
      if (m.attachment.type === "image" && m.attachment.data && m.attachment.mimeType) {
        parts.push({ inline_data: { mime_type: m.attachment.mimeType, data: m.attachment.data } });
      } else if (m.attachment.type === "pdf" && m.attachment.text) {
        parts.push({ text: `[Conteúdo do PDF "${m.attachment.name}":\n${m.attachment.text}\n]\n\n` });
      }
    }
    parts.push({ text: m.content || (m.attachment ? "Analise o conteúdo enviado e monte a campanha." : "") });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  // Try the configured model first, then fall back automatically on quota errors
  const modelsToTry = [model, ...GEMINI_FALLBACK_CHAIN.filter(m => m !== model)];

  let lastError = "";
  for (const tryModel of modelsToTry) {
    const result = await callGeminiModel(apiKey, tryModel, contents, systemPrompt);
    if (result.ok) return result.text;

    const { status, raw } = result;
    let isQuota = false;
    try {
      const parsed = JSON.parse(raw);
      const code = parsed?.error?.code ?? status;
      const detail = parsed?.error?.message ?? "";
      if (code === 429 || detail.includes("RESOURCE_EXHAUSTED") || detail.includes("quota")) {
        isQuota = true;
        lastError = detail;
      } else if (code === 401 || code === 403 || detail.includes("API_KEY_INVALID") || detail.includes("PERMISSION_DENIED")) {
        throw new Error(`Chave API inválida ou sem permissão (${code}). Verifique se a chave está correta e se o projeto Google tem a API Generative Language ativada.`);
      } else {
        throw new Error(detail ? `Gemini: ${detail.slice(0, 300)}` : `Gemini API erro ${status}`);
      }
    } catch (e: any) {
      if (e.message.startsWith("Chave") || e.message.startsWith("Gemini")) throw e;
      isQuota = true;
      lastError = raw.slice(0, 100);
    }
    if (!isQuota) break;
    // quota error — try next model in chain
  }

  throw new Error(
    `Cota esgotada em todos os modelos Gemini disponíveis. Verifique sua chave em https://aistudio.google.com/app/apikey — certifique-se de que o projeto Google tem a API "Generative Language" ativada e não tem restrições de cota zeradas.`
  );
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const builtMessages: any[] = [{ role: "system", content: systemPrompt }];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLast = i === messages.length - 1;

    if (m.role === "assistant") {
      builtMessages.push({ role: "assistant", content: m.content });
      continue;
    }

    if (isLast && m.attachment) {
      const contentParts: any[] = [];

      if (m.attachment.type === "image" && m.attachment.data && m.attachment.mimeType) {
        contentParts.push({
          type: "image_url",
          image_url: { url: `data:${m.attachment.mimeType};base64,${m.attachment.data}` },
        });
        if (m.content) contentParts.push({ type: "text", text: m.content });
        else contentParts.push({ type: "text", text: "Analise a imagem e monte a campanha de vendas." });
      } else if (m.attachment.type === "pdf" && m.attachment.text) {
        const fullText = `[Conteúdo do PDF "${m.attachment.name}":\n${m.attachment.text}\n]\n\n${m.content || "Monte a campanha com base neste PDF."}`;
        contentParts.push({ type: "text", text: fullText });
      } else {
        contentParts.push({ type: "text", text: m.content });
      }

      builtMessages.push({ role: "user", content: contentParts });
    } else {
      builtMessages.push({ role: "user", content: m.content });
    }
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: builtMessages, temperature: 0.7, max_tokens: 2048 }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Erro ${res.status} na API OpenAI.`;
    try {
      const parsed = JSON.parse(raw);
      const code = parsed?.error?.code ?? "";
      const detail = parsed?.error?.message ?? "";
      if (res.status === 429 || code === "insufficient_quota" || detail.includes("quota")) {
        msg = `Cota da API OpenAI esgotada (429). Verifique seu saldo em https://platform.openai.com/usage e adicione créditos se necessário.`;
      } else if (res.status === 401 || code === "invalid_api_key") {
        msg = `Chave API OpenAI inválida (401). Verifique se a chave começa com "sk-" e está correta em https://platform.openai.com/api-keys.`;
      } else if (detail) {
        msg = `OpenAI: ${detail.slice(0, 300)}`;
      }
    } catch { msg = `OpenAI API erro ${res.status}: ${raw.slice(0, 200)}`; }
    throw new Error(msg);
  }
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

// ─── Chat route ───────────────────────────────────────────────────────────────

router.post("/chat", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { messages }: { messages: ChatMessage[] } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages é obrigatório" });
    }

    const cfg = await loadAIConfig();
    if (!cfg.apiKey) {
      return res.status(400).json({ error: "Chave API da IA não configurada. Acesse Configurações → Inteligência Artificial." });
    }

    let text = "";
    if (cfg.provider === "openai") {
      text = await callOpenAI(cfg.apiKey, cfg.model, messages, SYSTEM_PROMPT);
    } else {
      text = await callGemini(cfg.apiKey, cfg.model, messages, SYSTEM_PROMPT);
    }

    const jsonMatch = text.match(/<<<CAMPAIGN_JSON>>>([\s\S]*?)<<<END_CAMPAIGN_JSON>>>/);
    let campaignDraft = null;
    let message = text;

    if (jsonMatch) {
      try {
        campaignDraft = JSON.parse(jsonMatch[1].trim());
        message = text.replace(/<<<CAMPAIGN_JSON>>>[\s\S]*?<<<END_CAMPAIGN_JSON>>>/, "").trim();
      } catch (e) {
        console.error("[AI Assistant] JSON parse error:", e);
      }
    }

    res.json({ message, campaignDraft });
  } catch (err: any) {
    console.error("[AI Assistant] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
