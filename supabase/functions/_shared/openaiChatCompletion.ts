/** Minimal OpenAI chat completions helper for Edge (Deno). Uses OPENAI_API_KEY secret. */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openaiChatJson(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) {
    return { ok: false, error: "OPENAI_API_KEY not configured" };
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `openai_http_${res.status}: ${t.slice(0, 200)}` };
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return { ok: false, error: "openai_empty_content" };
  }
  return { ok: true, content };
}
