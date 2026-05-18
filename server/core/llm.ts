/**
 * Anthropic LLM client. Used by all prompt builders for partner tags, sayThis
 * lines, Ruben's Take, edition synthesis and Substack drafts.
 *
 * Translates the existing OpenAI-shaped `{messages: [{role, content}]}` calling
 * convention used everywhere in this codebase to the Anthropic Messages API
 * (separate `system` field, no nested `system` role in messages).
 *
 * Defaults:
 *   - Model: claude-opus-4-7
 *   - Adaptive thinking enabled (Claude decides depth)
 *   - Streaming for any request that may produce > 16K tokens (avoids SDK
 *     HTTP timeouts)
 *
 * Env: ANTHROPIC_API_KEY must be set in production. Demo mode (no DATABASE_URL)
 * short-circuits to a deterministic stub.
 */
import Anthropic from "@anthropic-ai/sdk";
import { isDemoMode } from "../demo/store";
import { env } from "./env";
import { demoLlm } from "../demo/llmStub";

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

const DEFAULT_MAX_TOKENS = 16000;
const STREAM_THRESHOLD = 16000;
const MODEL = "claude-opus-4-7";

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cachedClient) {
    if (!env.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    cachedClient = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return cachedClient;
}

/**
 * Pull any `system` role messages out of the OpenAI-shaped array and
 * concatenate them. Anthropic expects `system` as a separate top-level
 * field and the `messages` array to contain only user/assistant roles.
 */
function splitSystem(messages: LlmMessage[]): {
  system: string | undefined;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
} {
  const systemParts: string[] = [];
  const conversation: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else {
      conversation.push({ role: m.role, content: m.content });
    }
  }
  return {
    system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
    conversation,
  };
}

/**
 * Append a JSON-shape instruction to the system prompt so the model
 * returns parseable JSON. Anthropic supports structured outputs natively
 * via `output_config.format`, but our callers already pass raw schemas and
 * parse the response themselves, a textual instruction is the smallest
 * possible change.
 */
function augmentSystemForJson(
  system: string | undefined,
  responseFormat: LlmResponseFormat | undefined
): string | undefined {
  if (!responseFormat || responseFormat.type === "text") return system;
  const schemaDesc =
    responseFormat.type === "json_schema"
      ? `Return JSON matching this schema: ${JSON.stringify(responseFormat.json_schema.schema)}.`
      : "Return a single JSON object.";
  const instruction = `Output ONLY valid JSON. No markdown fences, no preamble, no commentary. ${schemaDesc}`;
  return system ? `${system}\n\n${instruction}` : instruction;
}

export async function invokeLLM(params: InvokeLlmParams): Promise<string> {
  if (isDemoMode()) return demoLlm(params);

  const client = getClient();
  const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
  const { system: rawSystem, conversation } = splitSystem(params.messages);
  const system = augmentSystemForJson(rawSystem, params.responseFormat);

  if (conversation.length === 0) {
    throw new Error("invokeLLM: at least one non-system message is required");
  }

  // Stream when output budget is large to avoid SDK HTTP read timeouts.
  if (maxTokens > STREAM_THRESHOLD) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      ...(system ? { system } : {}),
      messages: conversation,
    });
    const finalMessage = await stream.finalMessage();
    return extractText(finalMessage);
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    ...(system ? { system } : {}),
    messages: conversation,
  });
  return extractText(response);
}

function extractText(response: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") parts.push(block.text);
  }
  const joined = parts.join("").trim();
  if (joined.length === 0) {
    throw new Error("LLM returned empty content");
  }
  return joined;
}

/**
 * Invoke the LLM with a JSON schema response format and return the parsed
 * object. Throws on parse failure, the caller is expected to surface a
 * useful error or fall back gracefully.
 */
export async function invokeLLMJson<T>(
  params: InvokeLlmParams & { responseFormat: LlmResponseFormat }
): Promise<T> {
  const raw = await invokeLLM(params);
  // Strip markdown fences the model might wrap around the JSON.
  let json = raw.trim();
  const fenced = json.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced && fenced[1]) json = fenced[1].trim();
  try {
    return JSON.parse(json) as T;
  } catch {
    throw new Error("LLM returned invalid JSON");
  }
}
