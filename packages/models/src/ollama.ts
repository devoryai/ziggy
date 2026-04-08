// Ollama client — thin wrapper around the Ollama REST API.
// Docs: https://github.com/ollama/ollama/blob/main/docs/api.md

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatResponse {
  model: string;
  message: OllamaMessage;
  done: boolean;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  model: process.env.OLLAMA_MODEL ?? "llama3.2",
  temperature: 0.2,
  timeoutMs: 60_000,
};

export async function ollamaChat(
  messages: OllamaMessage[],
  config: Partial<OllamaConfig> = {}
): Promise<string> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const url = `${cfg.baseUrl}/api/chat`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs ?? 60_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        stream: false,
        options: {
          temperature: cfg.temperature ?? 0.2,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(
      `Ollama request failed (is Ollama running at ${cfg.baseUrl}?): ${String(err)}`
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Ollama responded ${response.status}: ${body}`);
  }

  const data = (await response.json()) as OllamaChatResponse;
  return data.message.content;
}

/**
 * Check whether Ollama is reachable. Returns the list of available models
 * on success, or throws if Ollama is not running.
 */
export async function checkOllamaHealth(
  baseUrl = DEFAULT_CONFIG.baseUrl
): Promise<string[]> {
  const response = await fetch(`${baseUrl}/api/tags`).catch(() => null);
  if (!response || !response.ok) {
    throw new Error(`Ollama not reachable at ${baseUrl}`);
  }
  const data = (await response.json()) as { models: Array<{ name: string }> };
  return data.models.map((m) => m.name);
}
