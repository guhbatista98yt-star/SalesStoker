import { Router } from "express";
import { isAuthenticated, isAdmin, type AuthRequest } from "../auth";
import { pgGet, pgRun } from "../pg-client";

const router = Router();

// ─── Supported providers ──────────────────────────────────────────────────────

const PROVIDERS: Record<string, { label: string; models: { id: string; label: string }[]; urlFn: (model: string, key: string) => string }> = {
  gemini: {
    label: "Google Gemini (gratuito)",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (recomendado)" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
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
        model: cfg.model || "gemini-2.0-flash",
        apiKey: cfg.apiKey || process.env.GEMINI_API_KEY || "",
      };
    }
  } catch {}
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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um assistente especialista em criar campanhas de incentivo de vendas para distribuidoras de tubos e conexões.

Seu trabalho é conversar com o usuário, entender o que ele quer, fazer perguntas quando necessário, e ao final gerar a configuração completa da campanha em JSON.

## REGRAS DE CONVERSA

1. Seja direto e amigável. Use linguagem simples e objetiva.
2. Faça UMA pergunta por vez quando precisar de informações.
3. Quando tiver informações suficientes, gere a configuração JSON automaticamente.
4. Confirme com o usuário antes de finalizar.

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

// ─── Chat route ───────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function callGemini(apiKey: string, model: string, contents: any[], systemPrompt: string): Promise<string> {
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }
  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOpenAI(apiKey: string, model: string, messages: any[], systemPrompt: string): Promise<string> {
  const payload = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages.map((m: any) => ({ role: m.role, content: m.content }))],
    temperature: 0.7,
    max_tokens: 2048,
  };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${err}`);
  }
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content ?? "";
}

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
      const msgs = messages.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
      text = await callOpenAI(cfg.apiKey, cfg.model, msgs, SYSTEM_PROMPT);
    } else {
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      text = await callGemini(cfg.apiKey, cfg.model, contents, SYSTEM_PROMPT);
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
