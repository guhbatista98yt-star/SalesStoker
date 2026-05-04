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

function buildSystemPrompt(vendorGroups: { id: string; name: string }[], vendedores: { id: string; nome: string }[] = []): string {
  const groupsSection = vendorGroups.length > 0
    ? `\n## GRUPOS DE VENDEDORES CADASTRADOS\n\nUse estes IDs exatos ao configurar targets.vendedores.groupIds:\n${vendorGroups.map(g => `- ID: "${g.id}" → Nome: "${g.name}"`).join("\n")}\n`
    : `\n## GRUPOS DE VENDEDORES\n\nNenhum grupo cadastrado. Se quiser segmentar por grupo, sugira criar em Configurações → Grupos de Vendedores.\n`;

  const vendedoresSection = vendedores.length > 0
    ? `\n## VENDEDORES CADASTRADOS NO SISTEMA\n\n⚠️ IMPORTANTE: Ao configurar targets.vendedores.ids ou ao mencionar vendedores, use **sempre o ID** da coluna abaixo, nunca o nome diretamente.\n\n${vendedores.map(v => `- ID: "${v.id}" → Nome: ${v.nome}`).join("\n")}\n\nQuando o usuário mencionar um nome (ex: "Alan"), localize o ID correspondente (ex: "1014115") e use o ID no JSON.\n`
    : "";

  return `Você é um assistente especialista em criar campanhas de incentivo de vendas para distribuidoras de tubos e conexões.

Seu trabalho é entender o que o usuário quer, fazer perguntas quando necessário, e gerar a configuração COMPLETA da campanha em JSON.

## REGRAS FUNDAMENTAIS

1. **Faça perguntas quando informações importantes estiverem faltando.** Não invente dados críticos.
2. **Gere o JSON quando tiver: nome + período + tipo de prêmio + valor do prêmio.** Se faltar algum desses, pergunte primeiro.
3. **Faça no máximo 2 perguntas por vez**, de forma direta e numerada. Nunca peça confirmação após gerar o JSON.
4. **Preencha TODOS os campos do JSON**, mesmo que com valores padrão razoáveis.
5. **Quando tiver dúvida** sobre algum campo específico, use valor padrão no JSON E mencione no texto.
6. Se o usuário enviar uma imagem ou PDF, analise o conteúdo e monte a campanha imediatamente — não peça confirmação.
7. Hoje é ${new Date().toISOString().slice(0, 10)}.
8. **NUNCA deixe "Próximos Passos" que bloqueiam o usuário.** Gere o JSON e diga o que fazer depois de criar.
${groupsSection}${vendedoresSection}
## QUANDO PERGUNTAR (OBRIGATÓRIO)

**Sempre pergunte antes de gerar** se não souber:
- Período da campanha (data início e fim, ou mês/trimestre de referência)
- Valor ou tipo do prêmio (fixo R$X, porcentagem, ranking, faixas?)

**Pode assumir** (use valores padrão e confirme no texto):
- Nome da campanha — crie um nome descritivo
- Quem participa — assuma "todos os vendedores" se não especificado
- Prioridade — use 50
- Acumulável — assuma true

## GATILHOS POR VENDEDOR — CONCEITO CRÍTICO

⚠️ **IMPORTANTE**: O sistema tem dois tipos de metas por vendedor:

**1. Gatilho único para todos** (use em conditions):
Quando todos os vendedores precisam bater o mesmo valor mínimo, use conditions com ACUM_VALOR:
\`{ "id": "c1", "type": "ACUM_VALOR", "operator": "GTE", "value": 30000 }\`

**2. Gatilhos DIFERENTES por vendedor** (ex: DTR Amanco — Alan 30k, Janio 30k, Erivan 40k, etc.):
Este é um recurso especial chamado "Gatilhos por Vendedor". Quando o usuário mencionar valores DIFERENTES para cada vendedor:
- Gere o JSON com a conditions usando o valor MÍNIMO como referência (ou sem condição de valor)
- **Informe explicitamente no texto** que os valores individuais devem ser configurados após criar a campanha, na aba "Gatilhos por Vendedor" que aparece na tela de edição da campanha
- Exemplo de mensagem: "⚠️ Como os vendedores têm metas diferentes (Alan 30k, Janio 40k...), após criar a campanha acesse a aba **Gatilhos por Vendedor** na edição da campanha para configurar o valor individual de cada um."

## MODOS DE CAMPANHA — ESCOLHA O MELHOR

- **atingimento**: todos que cumprirem as condições ganham prêmio fixo → para campanhas DTR com valor fixo, metas por vendedor
- **comissao**: % sobre base de pagamento acumulado no período → para campanhas DTR com comissão percentual ou com categorias (Incentivo/Elite)
- **ranking_volume**: ranking por maior volume vendido, prêmios por posição → para competições
- **ranking_crescimento**: ranking por crescimento % vs período anterior → para crescimento
- **faixa**: prêmio fixo escalonado por faixas de valor → para incentivos progressivos com valor fixo por faixa

## TIPOS DE PRÊMIO

- **VALOR_FIXO**: valor fixo em R$ (use baseValue) → mais comum em campanhas de atingimento
- **COMISSAO_PERCENTUAL**: % único sobre base de pagamento total (use basePercent)
- **FAIXA com percent > 0**: % escalonado — o percentual varia conforme o volume apurado (Incentivo: 0.5%, Elite: 1%) → para campanhas com categorias automáticas de desempenho
- **FAIXA com value > 0**: valor fixo por faixa (use value, deixe percent: 0)
- **RANKING**: prêmios por posição (preencha posicoes[])

## CONCEITO CENTRAL — CAMPANHA GLOBAL COM RESULTADO INDIVIDUAL

**Uma campanha global** significa: targets.vendedores.mode = "all" — todos participam da mesma campanha com as mesmas regras.

**Resultado individual** significa: o prêmio de cada vendedor é calculado individualmente com base nas suas próprias vendas. Cada um tem seu gatilho individual configurado na aba "Gatilhos por Vendedor".

**Categorias automáticas** (Incentivo, Elite, Bronze, Prata, etc.) NÃO são grupos de segmentação. São RÓTULOS AUTOMÁTICOS calculados na apuração com base no volume acumulado de cada vendedor. O vendedor não é colocado num grupo — o sistema decide a categoria dele pelo resultado.

Regra: NUNCA coloque os vendedores em grupos separados por categoria. Use FAIXA com percent para que o sistema calcule automaticamente.

## FORMATO DO JSON — PREENCHA TODOS OS CAMPOS

Sempre que tiver informações suficientes, inclua o JSON completo no fim da resposta:

<<<CAMPAIGN_JSON>>>
{
  "name": "Nome da Campanha",
  "description": "Descrição completa da campanha",
  "objective": "Objetivo claro da campanha",
  "supplier_name": "Nome do fornecedor ou null",
  "logo_url": null,
  "brand_color": null,
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
    "conditions": [
      { "id": "c1", "type": "FORNECEDOR", "operator": "EQUALS", "value": "NOME_FORNECEDOR" }
    ],
    "groups": []
  },
  "triggers": [],
  "rewards": {
    "type": "VALOR_FIXO",
    "scope": "individual",
    "baseValue": 0,
    "basePercent": 0,
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

## CONDIÇÕES — FORMATO OBRIGATÓRIO

⚠️ O campo "conditions" **SEMPRE** deve ter o formato de grupo raiz com "id": "root". As condições ficam DENTRO do array "conditions" do grupo root. NUNCA use um array plano no lugar do objeto root.

**CORRETO:**
"conditions": {
  "id": "root",
  "connector": "AND",
  "conditions": [
    { "id": "c1", "type": "FORNECEDOR", "operator": "EQUALS", "value": "AMANCO" },
    { "id": "c2", "type": "ACUM_VALOR", "operator": "GTE", "value": 30000 }
  ],
  "groups": []
}

**ERRADO (nunca faça isso):**
"conditions": [
  { "id": "c1", "type": "FORNECEDOR", ... }
]

**Tipos de condição disponíveis:**
- Fornecedor: { "type": "FORNECEDOR", "operator": "EQUALS", "value": "NOME_FABRICANTE" }
- Valor mínimo por pedido: { "type": "VALOR", "operator": "GTE", "value": 500 }
- Valor acumulado no período (gatilho único): { "type": "ACUM_VALOR", "operator": "GTE", "value": 30000 }
- Qtd mínima por pedido: { "type": "QUANTIDADE", "operator": "GTE", "value": 10 }
- Categoria de produto: { "type": "CATEGORIA", "operator": "EQUALS", "value": "NOME_CATEGORIA" }

**mix_minimo** (em bases.elegibilidade): número INTEIRO de SKUs distintos que o vendedor precisa vender. Ex: "mix_minimo": 5 = precisa vender pelo menos 5 produtos diferentes. NAO é porcentagem. Para regras de mix por categoria/ratio (ex: "40% de Conexoes sobre Tubos"), informar que deve ser verificado manualmente.

## PRÊMIOS — EXEMPLOS PRONTOS

Valor fixo R$200:
"rewards": { "type": "VALOR_FIXO", "scope": "individual", "baseValue": 200, "basePercent": 0, "tiers": [], "posicoes": [] }

Comissão % sobre base de pagamento (use basePercent, NÃO baseValue):
"rewards": { "type": "COMISSAO_PERCENTUAL", "scope": "individual", "baseValue": 0, "basePercent": 0.5, "tiers": [], "posicoes": [] }

Ranking top 3 (R$500, R$300, R$150):
"rewards": { "type": "RANKING", "scope": "individual", "baseValue": 0, "basePercent": 0, "tiers": [], "posicoes": [
  { "id": "p1", "posicao": 1, "label": "1º lugar", "valor": 500 },
  { "id": "p2", "posicao": 2, "label": "2º lugar", "valor": 300 },
  { "id": "p3", "posicao": 3, "label": "3º lugar", "valor": 150 }
]}

Faixas de valor fixo:
"rewards": { "type": "FAIXA", "scope": "individual", "baseValue": 0, "basePercent": 0, "posicoes": [], "tiers": [
  { "id": "t1", "label": "Bronze", "min": 10000, "max": 25000, "value": 150, "percent": 0 },
  { "id": "t2", "label": "Prata", "min": 25001, "max": 50000, "value": 300, "percent": 0 },
  { "id": "t3", "label": "Ouro", "min": 50001, "max": null, "value": 600, "percent": 0 }
]}

Faixas de comissão percentual por categoria (use percent > 0, deixe value = 0):
"rewards": { "type": "FAIXA", "scope": "individual", "baseValue": 0, "basePercent": 0, "posicoes": [], "tiers": [
  { "id": "t1", "label": "Incentivo", "min": 30000, "max": 59999, "value": 0, "percent": 0.5 },
  { "id": "t2", "label": "Elite", "min": 60000, "max": null, "value": 0, "percent": 1.0 }
]}
Neste caso o sistema aplica: percent% sobre a base de pagamento do vendedor. O vendedor que vende R$80.000 na base Elite recebe 1% sobre esse valor.

## TARGETS — SEGMENTAÇÃO

Todos os vendedores: { "mode": "all", "ids": [], "groupIds": [], "exclude": [] }
Por grupo: { "mode": "group", "ids": [], "groupIds": ["ID_DO_GRUPO"], "exclude": [] }
Vendedores específicos (use IDs da lista acima): { "mode": "specific", "ids": ["1014115", "1014938"], "groupIds": [], "exclude": [] }
Por fornecedor (produtos): { "mode": "supplier", "suppliers": ["AMANCO"], "ids": [], "categories": [], "exclude": [] }

## BASES DE PRODUTO (apuracao / pagamento)

Use quando a base de cálculo for diferente da base de apuração.
Exemplo: apurar total de vendas Amanco, mas pagar comissão só sobre Não-Tubos:
"bases": {
  "elegibilidade": { "mix_minimo": 0, "produtos": null },
  "apuracao": { "produtos": { "mode": "supplier", "suppliers": ["AMANCO"] } },
  "ranking": { "tipo": "volume", "criterio_desempate": "valor", "periodo_comparativo": null },
  "pagamento": { "produtos": { "mode": "category", "categories": ["NAO-TUBOS"] } }
}

## CICLOS

"todo mês" → cycle_type: "monthly", auto_renew: true
"todo trimestre" → cycle_type: "quarterly", auto_renew: true
"única vez" → cycle_type: "none", auto_renew: false

## EXEMPLO REAL — DTR SIMPLES (gatilhos iguais para todos)

Usuário: "DTR Amanco Q2 2025, meta R$30.000, prêmio R$300"

JSON:
- campaign_mode: "atingimento"
- targets.produtos: { "mode": "supplier", "suppliers": ["AMANCO"] }
- conditions.root.conditions: [{ "id": "c1", "type": "ACUM_VALOR", "operator": "GTE", "value": 30000 }]
- rewards: { "type": "VALOR_FIXO", "baseValue": 300 }
- brand_color: "#0057A8"

## EXEMPLO REAL — DTR COM GATILHOS DIFERENTES POR VENDEDOR

Usuário: "DTR Amanco Q2 2025, Alan 30k, Janio 30k, Erivan 40k, Mariane 40k, Carlisson 50k, demais 60k, prêmio R$300"

**O que fazer:**
1. Gere o JSON com o valor mínimo (30000) no ACUM_VALOR da conditions
2. targets.vendedores: mode "all" (todos participam)
3. Avise no texto: "⚠️ Após criar, acesse a aba **Gatilhos por Vendedor** na edição da campanha para configurar: Alan → 30k, Janio → 30k, Erivan → 40k, Mariane → 40k, Carlisson → 50k, demais → 60k"

## EXEMPLO REAL — DTR COM CATEGORIAS INCENTIVO/ELITE (campanha única global)

**Situação:** Todos os vendedores participam da mesma campanha. Cada um tem seu próprio gatilho individual. O sistema classifica automaticamente cada vendedor na categoria Incentivo (0,5%) ou Elite (1%) pelo volume acumulado.

**Regra:** targets.vendedores.mode SEMPRE "all" — NUNCA separe por grupo.

**Modelo JSON para DTR Amanco Q2 2025 com Incentivo/Elite:**

- campaign_mode: "comissao"
- targets.vendedores: { "mode": "all", "ids": [], "groupIds": [], "exclude": [] }
- targets.produtos: { "mode": "supplier", "suppliers": ["AMANCO"] }
- bases.apuracao: { "produtos": { "mode": "supplier", "suppliers": ["AMANCO"] } }
- bases.pagamento: { "produtos": { "mode": "category", "categories": ["NAO-TUBOS"] } } (se o prêmio é só sobre Não-Tubos)
- bases.ranking.tipos: ["volume", "crescimento"] (dois rankings simultâneos na mesma campanha)
- bases.ranking.periodo_comparativo: { "starts_at": "DATA_INICIO_ANO_ANTERIOR", "ends_at": "DATA_FIM_ANO_ANTERIOR" }
- rewards:
  { "type": "FAIXA", "scope": "individual", "baseValue": 0, "basePercent": 0, "posicoes": [], "tiers": [
    { "id": "t1", "label": "Incentivo", "min": 30000, "max": 59999, "value": 0, "percent": 0.5 },
    { "id": "t2", "label": "Elite", "min": 60000, "max": null, "value": 0, "percent": 1.0 }
  ]}
- conditions: grupo root com ACUM_VALOR >= 30000 (valor mínimo de referência) e FORNECEDOR = AMANCO
- brand_color: "#0057A8"

Após criar: "⚠️ Configure os Gatilhos por Vendedor na aba de edição da campanha com os valores individuais de cada vendedor."

**Situações que o sistema NÃO calcula automaticamente — sempre informar:**
- Trava coletiva da loja (crescimento % global) → verificação manual antes de apurar
- Mix percentual entre categorias (ex: Conexões/Tubos) → verificação manual
- Base mínima garantida para ranking de crescimento → verificação manual

**Situações que ainda exigem campanhas SEPARADAS (raro):**
- Produtos completamente diferentes com regras independentes
- Campanhas para equipes/lojas distintas sem sobreposição

## CORES DE MARCA

- Amanco/Wavin: brand_color "#0057A8"
- Tigre: brand_color "#E8380D"
- Fortal/Fortlev: brand_color "#1E7EC8"
- Krona: brand_color "#00923F"
- Genova: brand_color "#F57C00"

## REGRAS FINAIS

- **FORMATO OBRIGATÓRIO DO JSON**: Sempre coloque o JSON entre os marcadores <<<CAMPAIGN_JSON>>> e <<<END_CAMPAIGN_JSON>>>. NUNCA use blocos de código markdown com json para o JSON da campanha. O sistema só reconhece os marcadores — blocos markdown serão ignorados e o usuário não conseguirá criar a campanha.
- NUNCA use nomes de vendedores como IDs. Use sempre o ID numérico da lista de vendedores.
- NUNCA envie "conditions" como array plano. Sempre use o objeto root com "id": "root".
- NUNCA use baseValue para percentuais — use basePercent para COMISSAO_PERCENTUAL.
- NUNCA deixe "Próximos Passos" que bloqueiam. Gere o JSON e diga o que fazer depois.
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

    const [cfg, vendorGroups, vendedores] = await Promise.all([
      loadAIConfig(),
      pgAll<{ id: string; name: string }>(`SELECT id, name FROM vendor_groups ORDER BY name`).catch(() => [] as { id: string; name: string }[]),
      pgAll<{ id: string; nome: string }>(`
        SELECT CAST("IDVENDEDOR" AS TEXT) as id, MAX("NOME_VENDEDOR") as nome
        FROM cache_vendas
        WHERE "IDVENDEDOR" IS NOT NULL AND "NOME_VENDEDOR" IS NOT NULL
          AND "NOME_VENDEDOR" NOT LIKE '%SEM VENDEDOR%'
          AND "NOME_VENDEDOR" NOT LIKE '%DEC VENDAS%'
          AND "NOME_VENDEDOR" NOT LIKE '%VENDA LIC%'
          AND "NOME_VENDEDOR" NOT LIKE '%VENDEDOR C%'
          AND "NOME_VENDEDOR" NOT LIKE '%VENDEDOR E%'
        GROUP BY "IDVENDEDOR" ORDER BY nome
      `).catch(() => [] as { id: string; nome: string }[]),
    ]);

    if (!cfg.apiKey) {
      return res.status(400).json({ error: "Chave API da IA não configurada. Acesse Configurações → Inteligência Artificial." });
    }

    const systemPrompt = buildSystemPrompt(vendorGroups, vendedores);

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

    // Try official markers first, then fall back to ```json blocks
    const jsonMatch = text.match(/<<<CAMPAIGN_JSON>>>([\s\S]*?)<<<END_CAMPAIGN_JSON>>>/);
    let campaignDraft = null;
    let message = text;

    if (jsonMatch) {
      try {
        campaignDraft = JSON.parse(jsonMatch[1].trim());
        message = text.replace(/<<<CAMPAIGN_JSON>>>[\s\S]*?<<<END_CAMPAIGN_JSON>>>/, "").trim();
      } catch (e) {
        console.error("[AI Assistant] JSON parse error (markers):", e);
      }
    }

    // Fallback: extract from ```json ... ``` blocks when model ignores markers
    if (!campaignDraft) {
      const mdRe = /```json\s*([\s\S]*?)```/g;
      let mdMatch: RegExpExecArray | null;
      while ((mdMatch = mdRe.exec(text)) !== null) {
        try {
          const parsed = JSON.parse(mdMatch[1].trim());
          // Only treat as campaign draft if it has the essential campaign fields
          if (parsed && typeof parsed === "object" && parsed.name && parsed.campaign_mode && parsed.starts_at) {
            campaignDraft = parsed;
            message = text.replace(mdMatch[0], "").trim();
            break;
          }
        } catch { /* not valid JSON, skip */ }
      }
    }

    res.json({ message, campaignDraft });
  } catch (err: any) {
    console.error("[AI Assistant] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
