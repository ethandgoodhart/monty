export type PromptSource = "claude" | "codex" | "manual" | "test";

export type PromptEvent = {
  id: string;
  created_at: string;
  team_id: string;
  source: PromptSource;
  prompt: string;
  user_name: string;
  avatar_url: string | null;
  machine_id: string;
  cwd: string | null;
  model: string | null;
  token_count: number | null;
  input_tokens: number;
  output_tokens: number;
  session_id: string | null;
  metadata: Record<string, unknown>;
};

export type PromptEventInput = Omit<PromptEvent, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export const PROMPT_EVENTS_TABLE = "prompt_events";

export function normalizePromptEvent(input: Partial<PromptEventInput>): PromptEvent {
  const now = new Date().toISOString();
  const source = input.source === "claude" || input.source === "codex" || input.source === "test" ? input.source : "manual";

  return {
    id: input.id ?? crypto.randomUUID(),
    created_at: input.created_at ?? now,
    team_id: stringOrDefault(input.team_id, "default"),
    source,
    prompt: stringOrDefault(input.prompt, ""),
    user_name: stringOrDefault(input.user_name, "unknown"),
    avatar_url: nullableUrl(input.avatar_url),
    machine_id: stringOrDefault(input.machine_id, "unknown"),
    cwd: nullableString(input.cwd),
    model: nullableString(input.model),
    token_count: typeof input.token_count === "number" && Number.isFinite(input.token_count) ? input.token_count : null,
    input_tokens: finiteNumberOr(input.input_tokens, metadataNum(input.metadata, "input_tokens")),
    output_tokens: finiteNumberOr(input.output_tokens, metadataNum(input.metadata, "output_tokens")),
    session_id: nullableString(input.session_id),
    metadata: isRecord(input.metadata) ? input.metadata : {},
  };
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function nullableUrl(value: unknown) {
  const text = nullableString(value);
  if (!text || text === "undefined" || text === "null") return null;

  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function finiteNumberOr(primary: unknown, fallback: number): number {
  if (typeof primary === "number" && Number.isFinite(primary)) return primary;
  return fallback;
}

function metadataNum(metadata: unknown, key: string): number {
  if (isRecord(metadata) && typeof metadata[key] === "number" && Number.isFinite(metadata[key] as number)) return metadata[key] as number;
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
