/**
 * Thin client around the Manus built-in LLM endpoint. The reference codebase
 * exposed a dense OpenAI-shaped surface with a half-dozen aliases; we keep a
 * single shape and pick the content off it for callers in one place.
 */
import { env } from "./env";

export type LlmRole = "system" | "user" | "assistant";

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, unknown>;
      };
    };

export type InvokeLlmParams = {
  messages: LlmMessage[];
  responseFormat?: LlmResponseFormat;
  maxTokens?: number;
};

type RawLlmResponse = {
  choices: Array<{
    message?: { content?: string | null };
  }>;
};

function resolveApiUrl(): string {
  const base = env.forgeApiUrl.trim();
  if (!base) return "https://forge.manus.im/v1/chat/completions";
  return `${base.replace(/\/$/, "")}/v1/chat/completions`;
}

/**
 * Invoke the LLM and return the assistant text content. Throws if the API key
 * is missing or the call fails — callers in the ingestion pipeline catch and
 * log so a single failed enrichment never breaks an ingest.
 */
export async function invokeLLM(params: InvokeLlmParams): Promise<string> {
  if (!env.forgeApiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const payload: Record<string, unknown> = {
    model: "gemini-2.5-flash",
    messages: params.messages,
    max_tokens: params.maxTokens ?? 32768,
    thinking: { budget_tokens: 128 },
  };
  if (params.responseFormat) payload.response_format = params.responseFormat;

  const res = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM call failed: ${res.status} ${res.statusText} ${detail}`);
  }

  const data = (await res.json()) as RawLlmResponse;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("LLM returned empty content");
  }
  return content.trim();
}

/**
 * Invoke the LLM with a JSON schema response format and return the parsed
 * object, validated by the caller. Throws on parse failure.
 */
export async function invokeLLMJson<T>(params: InvokeLlmParams & { responseFormat: LlmResponseFormat }): Promise<T> {
  const raw = await invokeLLM(params);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("LLM returned invalid JSON");
  }
}
