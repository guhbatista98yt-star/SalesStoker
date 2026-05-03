import { Router } from "express";
import { isAuthenticated, type AuthRequest } from "../auth";

const router = Router();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/chat", isAuthenticated, async (req: AuthRequest, res) => {
  try {
    const { messages }: { messages: ChatMessage[] } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages é obrigatório" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });
    }

    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const payload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[AI Assistant] Gemini error:", errText);
      return res.status(500).json({ error: "Erro ao comunicar com IA. Verifique a chave GEMINI_API_KEY." });
    }

    const data = await response.json() as any;
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
