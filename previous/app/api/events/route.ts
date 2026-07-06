import { NextRequest, NextResponse } from "next/server";
import { addLocalEvent, listLocalEvents } from "@/app/lib/local-event-store";
import { normalizePromptEvent, PROMPT_EVENTS_TABLE, type PromptEventInput } from "@/app/lib/prompt-events";
import { getServerSupabase } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team") || "default";
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 100, 2000);
  const supabase = getServerSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from(PROMPT_EVENTS_TABLE)
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      return NextResponse.json({ events: data.map((event) => normalizePromptEvent(event)) });
    }
  }

  return NextResponse.json({ events: await listLocalEvents(teamId) });
}

export async function POST(request: NextRequest) {
  const token = process.env.MONTY_INGEST_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as Partial<PromptEventInput> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const event = normalizePromptEvent(body);
  if (!event.prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (supabase) {
    event.metadata.input_tokens = event.input_tokens;
    event.metadata.output_tokens = event.output_tokens;
    const { input_tokens: _i, output_tokens: _o, ...dbEvent } = event as Record<string, unknown>;
    const { data, error } = await supabase.from(PROMPT_EVENTS_TABLE).insert(dbEvent).select("*").single();
    if (!error && data) {
      return NextResponse.json({ event: normalizePromptEvent(data) }, { status: 201 });
    }

    console.error("Supabase insert failed, falling back to local store:", JSON.stringify(error));
  }

  return NextResponse.json({ event: await addLocalEvent(event) }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const token = process.env.MONTY_INGEST_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.session_id || !body.prompt) {
    return NextResponse.json({ error: "session_id and prompt required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no database" }, { status: 500 });
  }

  const inputTokens = body.input_tokens || 0;
  const outputTokens = body.output_tokens || 0;
  const cacheCreation = body.cache_creation_input_tokens || 0;
  const cacheRead = body.cache_read_input_tokens || 0;

  const { data: rows } = await supabase
    .from(PROMPT_EVENTS_TABLE)
    .select("id")
    .eq("session_id", body.session_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const { data, error } = await supabase
    .from(PROMPT_EVENTS_TABLE)
    .update({
      token_count: inputTokens + outputTokens,
      model: body.model || undefined,
      metadata: {
        cli: "claude",
        hook_event_name: "Stop",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_creation_input_tokens: cacheCreation,
        cache_read_input_tokens: cacheRead,
        modified_files: Array.isArray(body.modified_files) ? body.modified_files : [],
      },
    })
    .eq("id", rows[0].id)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
