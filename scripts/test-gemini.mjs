import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: "postgresql://postgres:1234@127.0.0.1:5435/database" });

async function main() {
  const result = await pool.query("SELECT value FROM app_settings WHERE key = 'ai_config'");
  if (!result.rows.length) { console.log("No AI config found in DB"); await pool.end(); return; }

  const cfg = JSON.parse(result.rows[0].value);
  console.log("Provider:", cfg.provider);
  console.log("Model   :", cfg.model);
  console.log("Key     :", cfg.apiKey?.slice(0, 15) + "... (len=" + (cfg.apiKey?.length ?? 0) + ")");
  await pool.end();

  if (!cfg.apiKey) { console.log("No API key stored."); return; }

  // Test direct API call
  const model = cfg.model || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`;
  console.log("\nCalling:", url.replace(cfg.apiKey, "***KEY***"));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: "You are a helpful assistant." }] },
      contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 10 },
    }),
  });

  const text = await res.text();
  console.log("HTTP Status:", res.status);
  try {
    const data = JSON.parse(text);
    if (data.candidates) {
      console.log("SUCCESS! Response:", data.candidates[0]?.content?.parts[0]?.text);
    } else if (data.error) {
      console.log("API Error:", data.error.code, "-", data.error.message);
      console.log("Status:", data.error.status);
    }
  } catch {
    console.log("Raw response:", text.slice(0, 300));
  }
}

main().catch(console.error);
