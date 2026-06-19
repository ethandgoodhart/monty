import { NextRequest } from "next/server";
import { addLocalEvent } from "@/app/lib/local-event-store";
import type { PromptEventInput } from "@/app/lib/prompt-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OTelAttribute = {
  key?: string;
  value?: unknown;
};

type OTelLogRecord = {
  body?: unknown;
  attributes?: OTelAttribute[];
  timeUnixNano?: string;
};

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    return new Response(null, { status: 204 });
  }

  const payload = await request.json().catch(() => null);
  const records = collectLogRecords(payload);
  const teamId = cleanQueryParam(request.nextUrl.searchParams.get("team")) || process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
  const userName = cleanQueryParam(request.nextUrl.searchParams.get("user")) || process.env.MONTY_USER || process.env.USER || "unknown";
  const avatarUrl = cleanQueryParam(request.nextUrl.searchParams.get("avatar")) || process.env.MONTY_AVATAR_URL || null;
  const githubLogin = cleanQueryParam(request.nextUrl.searchParams.get("github")) || null;

  for (const record of records) {
    const event = promptEventFromRecord(record, { teamId, userName, avatarUrl, githubLogin });
    if (event) await addLocalEvent(event);
  }

  return new Response(null, { status: 204 });
}

function collectLogRecords(payload: unknown): OTelLogRecord[] {
  const records: OTelLogRecord[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const object = value as Record<string, unknown>;
    if (Array.isArray(object.logRecords)) {
      object.logRecords.forEach((record) => records.push(record as OTelLogRecord));
    }
    Object.values(object).forEach(visit);
  };

  visit(payload);
  return records;
}

function promptEventFromRecord(
  record: OTelLogRecord,
  context: { teamId: string; userName: string; avatarUrl: string | null; githubLogin: string | null },
): Partial<PromptEventInput> | null {
  const attributes = attributesToRecord(record.attributes || []);
  const body = otelValueToString(record.body);
  const eventName = stringValue(attributes["event.name"] || attributes["name"] || attributes["otel.name"] || body);
  const isPromptEvent = eventName.includes("user_prompt") || Object.keys(attributes).some((key) => key.includes("user_prompt"));

  if (!isPromptEvent) return null;

  const prompt = findPrompt(attributes, body);
  if (!prompt) return null;

  return {
    team_id: context.teamId,
    source: "codex",
    prompt,
    user_name: context.userName,
    avatar_url: context.avatarUrl,
    machine_id: attributes["host.name"] ? stringValue(attributes["host.name"]) : "codex",
    cwd: stringValue(attributes["process.command_args"] || attributes["codex.cwd"] || "") || null,
    model: stringValue(attributes["model"] || attributes["codex.model"] || ""),
    session_id: stringValue(attributes["thread.id"] || attributes["session.id"] || attributes["conversation.id"] || ""),
    metadata: {
      otel: true,
      eventName,
      originator: stringValue(attributes.originator),
      appVersion: stringValue(attributes["app.version"]),
      promptLength: stringValue(attributes.prompt_length),
      githubLogin: context.githubLogin,
    },
  };
}

function attributesToRecord(attributes: OTelAttribute[]) {
  const result: Record<string, unknown> = {};
  for (const attribute of attributes) {
    if (!attribute.key) continue;
    result[attribute.key] = unwrapOtelValue(attribute.value);
  }
  return result;
}

function findPrompt(attributes: Record<string, unknown>, body: string) {
  const exactKeys = ["codex.user_prompt", "user_prompt", "prompt", "gen_ai.prompt", "codex.prompt"];
  for (const key of exactKeys) {
    const value = stringValue(attributes[key]);
    if (value && value !== "codex.user_prompt") return value;
  }

  for (const [key, value] of Object.entries(attributes)) {
    const text = stringValue(value);
    if (key.includes("prompt") && text && !text.includes("user_prompt") && !/^\d+$/.test(text)) return text;
  }

  return body && !body.includes("user_prompt") ? body : "";
}

function unwrapOtelValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const object = value as Record<string, unknown>;

  if ("stringValue" in object) return object.stringValue;
  if ("intValue" in object) return object.intValue;
  if ("doubleValue" in object) return object.doubleValue;
  if ("boolValue" in object) return object.boolValue;
  if ("arrayValue" in object) return object.arrayValue;
  if ("kvlistValue" in object) return object.kvlistValue;
  return value;
}

function otelValueToString(value: unknown) {
  return stringValue(unwrapOtelValue(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function cleanQueryParam(value: string | null) {
  if (!value || value === "undefined" || value === "null") return "";
  return value;
}
