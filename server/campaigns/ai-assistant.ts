import { Router } from "express";
import multer from "multer";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import { pgGet, pgRun, pgAll } from "../pg-client";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ─── Supported providers ──────────────────────────────────────────────────────

// Models that were deprecated and should be auto-upgraded
const GEMINI_DEPRECATED_MODELS: Record<string, string> = {
  "gemini-1.5-flash": "gemini-2.0-flash",
  "gemini-1.5-flash-latest": "gemini-2.0-flash",
  "gemini-1.5-pro": "gemini-2.0-flash",
  "gemini-1.5-pro-latest": "gemini-2.0-flash",
  "gemini-pro": "gemini-2.0-flash",
};

const PROVIDERS: Record<string, { label: string; models: { id: string; label: string }[] }> = {
  gemini: {
    label: "Google Gemini (gratuito)",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recomendado)" },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite (mais rápido)" },
    ],
  },
  openai: {
    label: "OpenAI (ChatGPT)",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini (econômico)" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    ],
  },
  claude: {
    label: "Anthropic Claude",
    models: [
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (econômico)" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (recomendado)" },
      { id: "claude-3-opus-20240229", label: "Claude 3 Opus (poderoso)" },
    ],
  },
  groq: {
    label: "Groq (rápido e gratuito)",
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (recomendado)" },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B (mais rápido)" },
      { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B" },
    ],
  },
  mistral: {
    label: "Mistral AI",
    models: [
      { id: "mistral-small-latest", label: "Mistral Small (econômico)" },
      { id: "mistral-medium-latest", label: "Mistral Medium" },
      { id: "mistral-large-latest", label: "Mistral Large (poderoso)" },
    ],
  },
};

// ─── Load / save AI config from app_settings ─────────────────────────────────

async function loadAIConfig(): Promise<{ provider: string; model: string; apiKey: string }> {
  try {
    const row = await pgGet<{ value: string }>(`SELECT value FROM app_settings WHERE key = 'ai_config' LIMIT 1`);
    if (row?.value) {
      const cfg = JSON.parse(row.value);
      const rawModel = cfg.model || "gemini-2.0-flash";
      const migratedModel = (cfg.provider === "gemini" && GEMINI_DEPRECATED_MODELS[rawModel])
        ? GEMINI_DEPRECATED_MODELS[rawModel]
        : rawModel;
      return {
        provider: cfg.provider || "gemini",
        model: migratedModel,
        apiKey: cfg.apiKey || process.env.GEMINI_API_KEY || "",
      };
    }
  } catch { }
  return {
    provider: "gemini",
    model: "gemini-2.0-flash",
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
      const pdfParseModule: any = await import("pdf-parse");
      const pdfParse = pdfParseModule.default || pdfParseModule;
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

function buildSystemPrompt(vendorGroups: { id: string; name: string }[]): string {
  const groupsSection = vendorGroups.length > 0
    ? `\n## GRUPOS DE VENDEDORES CADASTRADOS\n\nUse estes IDs exatos ao configurar targets.vendedores.groupIds:\n${vendorGroups.map(g => `- ID: "${g.id}" → Nome: "${g.name}"`).join("\n")}\n`
    : `\n## GRUPOS DE VENDEDORES\n\nNenhum grupo cadastrado no sistema. Se o usuário quiser segmentar por grupo, sugira que ele crie grupos em Configurações → Grupos de Vendedores antes de criar a campanha.\n`;

  return `Você é um assistente especialista em criar campanhas de incentivo de vendas para distribuidoras de tubos e conexões.

Seu trabalho é entender o que o usuário quer e gerar a configuração COMPLETA da campanha em JSON na mesma resposta, sem deixar campos em branco.

## REGRAS FUNDAMENTAIS

1. **Seja objetivo e eficiente.** Não enrole, não faça rodeios.
2. **Gere o JSON SEMPRE que tiver informações mínimas** (nome + período + prêmio). Não espere ter tudo perfeito para gerar.
3. **Faça perguntas ANTES de gerar o JSON** apenas quando informações críticas estiverem completamente ausentes (ex: período indefinido, prêmio indefinido). Faça no máximo 2 perguntas de uma vez, de forma direta.
4. **Preencha TODOS os campos do JSON**, mesmo que com valores padrão razoáveis. Nunca deixe o JSON incompleto.
5. **Quando tiver dúvida** sobre algum campo específico, deixe o valor padrão no JSON E mencione o campo na sua mensagem pedindo confirmação.
6. Se o usuário enviar uma imagem ou PDF, analise o conteúdo e monte a campanha imediatamente.
7. Hoje é ${new Date().toISOString().slice(0, 10)}.
${groupsSection}
## QUANDO FAZER PERGUNTAS

Pergunte ANTES de gerar apenas se não souber:
- Data de início E fim (ou mês de referência)
- Valor do prêmio ou tipo de premiação (fixo, %, ranking, faixas)

Para tudo mais (nome, fornecedor, condição, quem participa), faça uma suposição razoável e indique no JSON. Confirme no texto da resposta.

## MODOS DE CAMPANHA — ESCOLHA O MELHOR

- **atingimento**: todos que cumprirem as condições ganham prêmio fixo
- **comissao**: % sobre o valor vendido por transação
- **ranking_volume**: ranking por maior volume vendido, prêmios por posição
- **ranking_crescimento**: ranking por crescimento % vs período anterior
- **faixa**: prêmio escalonado por faixas de qtde ou valor

## TIPOS DE PRÊMIO

- **VALOR_FIXO**: valor fixo em R$ (use baseValue)
- **PERCENTUAL**: % sobre valor da transação (use baseValue como percentual, ex: 2 = 2%)
- **COMISSAO_PERCENTUAL**: % sobre base de pagamento total
- **FAIXA**: faixas escalonadas (preencha tiers[])
- **RANKING**: prêmios por posição (preencha posicoes[])

## FORMATO DO JSON — PREENCHA TODOS OS CAMPOS

Sempre que tiver informações suficientes, inclua o JSON completo no fim da resposta:

<<<CAMPAIGN_JSON>>>
{
  "name": "Nome da Campanha",
  "description": "Descrição completa da campanha",
  "objective": "Objetivo claro da campanha",
  "supplier_name": "Nome do fornecedor ou null",
  "campaign_type": "padrao",
  "campaign_mode": "atingimento",
  "starts_at": "YYYY-MM-DD",
  "ends_at": "YYYY-MM-DD",
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
    "baseValue": 0,
    "tiers": [],
    "posicoes": [],
    "maxBonus": null,
    "minCutoff": null,
    "rounding": "none"
  },
  "limits": {},
  "exceptions": [],
  "natural_language": "Descrição em linguagem natural completa da campanha, para referência humana"
}
<<<END_CAMPAIGN_JSON>>>

## CONDIÇÕES — EXEMPLOS PRONTOS

Fornecedor específico:
{ "id": "c1", "type": "FORNECEDOR", "operator": "EQUALS", "value": "NOME_FORNECEDOR" }

Quantidade mínima:
{ "id": "c2", "type": "QUANTIDADE", "operator": "GTE", "value": 50 }

Valor mínimo em R$:
{ "id": "c3", "type": "VALOR", "operator": "GTE", "value": 5000 }

Categoria de produto:
{ "id": "c4", "type": "CATEGORIA", "operator": "EQUALS", "value": "NOME_CATEGORIA" }

## PRÊMIOS — EXEMPLOS PRONTOS

Valor fixo R$200:
"rewards": { "type": "VALOR_FIXO", "scope": "individual", "baseValue": 200, "tiers": [], "posicoes": [] }

Comissão 2%:
"rewards": { "type": "PERCENTUAL", "scope": "individual", "baseValue": 2, "tiers": [], "posicoes": [] }

Ranking top 3 (R$500, R$300, R$150):
"rewards": { "type": "RANKING", "scope": "individual", "baseValue": 0, "tiers": [], "posicoes": [
  { "id": "p1", "posicao": 1, "label": "1º lugar", "valor": 500 },
  { "id": "p2", "posicao": 2, "label": "2º lugar", "valor": 300 },
  { "id": "p3", "posicao": 3, "label": "3º lugar", "valor": 150 }
]}

Faixas de quantidade:
"rewards": { "type": "FAIXA", "scope": "individual", "baseValue": 0, "posicoes": [], "tiers": [
  { "id": "t1", "label": "Bronze", "min": 50, "max": 100, "value": 100 },
  { "id": "t2", "label": "Prata", "min": 101, "max": 200, "value": 200 },
  { "id": "t3", "label": "Ouro", "min": 201, "max": null, "value": 400 }
]}

## TARGETS — SEGMENTAÇÃO

Todos: { "mode": "all", "ids": [], "groupIds": [], "exclude": [] }
Por grupo: { "mode": "group", "ids": [], "groupIds": ["ID_DO_GRUPO"], "exclude": [] }
Específicos: { "mode": "specific", "ids": ["ID1", "ID2"], "groupIds": [], "exclude": [] }
Por fornecedor: produtos { "mode": "supplier", "suppliers": ["NOME_FORNECEDOR"], ... }

## CICLOS

"todo mês" → cycle_type: "monthly", auto_renew: true
"todo trimestre" → cycle_type: "quarterly", auto_renew: true
"única vez" → cycle_type: "none", auto_renew: false

## IMPORTANTE

- NUNCA envie um JSON com campos faltando. Preencha tudo.
- Se o usuário pedir ajuste, gere um JSON NOVO e completo na resposta.
- Confirme o que foi configurado em linguagem simples antes do JSON.`;
}

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

const GEMINI_FALLBACK_CHAIN = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];

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
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
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
      const code: number = parsed?.error?.code ?? status;
      const detail: string = parsed?.error?.message ?? "";
      if (code === 429 || detail.includes("RESOURCE_EXHAUSTED") || detail.includes("quota")) {
        isQuota = true;
        lastError = detail || `quota esgotada no modelo ${tryModel}`;
      } else if (code === 401 || code === 403 || detail.includes("API_KEY_INVALID") || detail.includes("PERMISSION_DENIED")) {
        throw new Error(`Chave API inválida ou sem permissão (${code}). Verifique se a chave está correta e se o projeto Google tem a API Generative Language ativada.`);
      } else {
        // Any other error (404 model not found, 400 bad request, etc.) — throw immediately
        throw new Error(detail ? `Gemini: ${detail.slice(0, 300)}` : `Gemini API erro ${status}`);
      }
    } catch (e: any) {
      // Re-throw errors we intentionally created above
      if (e.message.startsWith("Chave") || e.message.startsWith("Gemini")) throw e;
      // JSON.parse failed — response was not JSON (unlikely for Google API but handle it)
      throw new Error(`Gemini API retornou resposta inválida (status ${status}). Raw: ${raw.slice(0, 150)}`);
    }
    if (!isQuota) break;
    // quota/rate-limit error — try next model in chain
  }

  throw new Error(
    `Limite de requisições atingido em todos os modelos Gemini (erro 429). ` +
    `O plano gratuito permite 15 req/min e 1.500 req/dia. Aguarde 1 minuto e tente novamente. ` +
    `Último detalhe: ${lastError.slice(0, 200)}`
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
    body: JSON.stringify({ model, messages: builtMessages, temperature: 0.7, max_tokens: 4096 }),
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

async function callClaude(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const builtMessages: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const isLast = i === messages.length - 1;

    if (m.role === "assistant") {
      builtMessages.push({ role: "assistant", content: m.content });
      continue;
    }

    const contentParts: any[] = [];
    if (isLast && m.attachment) {
      if (m.attachment.type === "image" && m.attachment.data && m.attachment.mimeType) {
        contentParts.push({ type: "image", source: { type: "base64", media_type: m.attachment.mimeType, data: m.attachment.data } });
        contentParts.push({ type: "text", text: m.content || "Analise a imagem e monte a campanha de vendas." });
      } else if (m.attachment.type === "pdf" && m.attachment.text) {
        contentParts.push({ type: "text", text: `[Conteúdo do PDF "${m.attachment.name}":\n${m.attachment.text}\n]\n\n${m.content || "Monte a campanha com base neste PDF."}` });
      } else {
        contentParts.push({ type: "text", text: m.content });
      }
    } else {
      contentParts.push({ type: "text", text: m.content });
    }
    builtMessages.push({ role: "user", content: contentParts });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, system: systemPrompt, messages: builtMessages, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Erro ${res.status} na API Claude.`;
    try {
      const parsed = JSON.parse(raw);
      const type = parsed?.error?.type ?? "";
      const detail = parsed?.error?.message ?? "";
      if (res.status === 429 || type === "rate_limit_error") {
        msg = `Limite de requisições Claude atingido (429). Aguarde alguns segundos e tente novamente.`;
      } else if (res.status === 401 || type === "authentication_error") {
        msg = `Chave API Claude inválida (401). Verifique em https://console.anthropic.com/settings/keys.`;
      } else if (res.status === 403 || type === "permission_error") {
        msg = `Sem créditos ou permissão negada na conta Anthropic (403). Adicione créditos em https://console.anthropic.com/settings/billing.`;
      } else if (detail) {
        msg = `Claude: ${detail.slice(0, 300)}`;
      }
    } catch { msg = `Claude API erro ${res.status}: ${raw.slice(0, 200)}`; }
    throw new Error(msg);
  }
  const data = await res.json() as any;
  return data?.content?.[0]?.text ?? "";
}

async function callGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const builtMessages: any[] = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    builtMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: builtMessages, temperature: 0.7, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Erro ${res.status} na API Groq.`;
    try {
      const parsed = JSON.parse(raw);
      const code = parsed?.error?.code ?? "";
      const detail = parsed?.error?.message ?? "";
      if (res.status === 429 || code === "rate_limit_exceeded") {
        msg = `Limite de requisições Groq atingido (429). O plano gratuito tem limites por minuto — aguarde alguns segundos.`;
      } else if (res.status === 401 || code === "invalid_api_key") {
        msg = `Chave API Groq inválida (401). Verifique em https://console.groq.com/keys.`;
      } else if (detail) {
        msg = `Groq: ${detail.slice(0, 300)}`;
      }
    } catch { msg = `Groq API erro ${res.status}: ${raw.slice(0, 200)}`; }
    throw new Error(msg);
  }
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

async function callMistral(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  systemPrompt: string
): Promise<string> {
  const builtMessages: any[] = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    builtMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.content });
  }

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: builtMessages, temperature: 0.7, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const raw = await res.text();
    let msg = `Erro ${res.status} na API Mistral.`;
    try {
      const parsed = JSON.parse(raw);
      const detail = parsed?.message ?? parsed?.error?.message ?? "";
      if (res.status === 429) {
        msg = `Limite de requisições Mistral atingido (429). Aguarde alguns segundos.`;
      } else if (res.status === 401 || res.status === 403) {
        msg = `Chave API Mistral inválida ou sem permissão (${res.status}). Verifique em https://console.mistral.ai/api-keys.`;
      } else if (detail) {
        msg = `Mistral: ${detail.slice(0, 300)}`;
      }
    } catch { msg = `Mistral API erro ${res.status}: ${raw.slice(0, 200)}`; }
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

    const [cfg, vendorGroups] = await Promise.all([
      loadAIConfig(),
      pgAll<{ id: string; name: string }>(`SELECT id, name FROM vendor_groups ORDER BY name`).catch(() => [] as { id: string; name: string }[]),
    ]);

    if (!cfg.apiKey) {
      return res.status(400).json({ error: "Chave API da IA não configurada. Acesse Configurações → Inteligência Artificial." });
    }

    const systemPrompt = buildSystemPrompt(vendorGroups);

    let text = "";
    if (cfg.provider === "openai") {
      text = await callOpenAI(cfg.apiKey, cfg.model, messages, systemPrompt);
    } else if (cfg.provider === "claude") {
      text = await callClaude(cfg.apiKey, cfg.model, messages, systemPrompt);
    } else if (cfg.provider === "groq") {
      text = await callGroq(cfg.apiKey, cfg.model, messages, systemPrompt);
    } else if (cfg.provider === "mistral") {
      text = await callMistral(cfg.apiKey, cfg.model, messages, systemPrompt);
    } else {
      text = await callGemini(cfg.apiKey, cfg.model, messages, systemPrompt);
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
